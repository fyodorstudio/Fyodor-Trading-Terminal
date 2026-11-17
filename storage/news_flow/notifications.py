"""Backend-owned, best-effort local ntfy delivery; independent of browser audio."""
from base64 import b64encode
import json
from threading import Event, RLock, Thread
import time
from urllib.request import Request, urlopen
from .relevance import migrate_include
from .notification_format import payload


def publish(setup, payload):
    credentials = b64encode(f"publisher:{setup['publisher_password']}".encode()).decode()
    request = Request('http://127.0.0.1:8004/', data=json.dumps(payload, ensure_ascii=False).encode(), headers={
        'Content-Type': 'application/json', 'Authorization': 'Basic ' + credentials})
    with urlopen(request, timeout=5) as response:
        result = json.loads(response.read(32768))
        if not result.get('id'):
            raise ValueError('ntfy did not acknowledge the message')


class NewsNotifier:
    def __init__(self, store, sender=publish):
        self.store, self.sender = store, sender
        self.root = store.path.parent / 'phone'
        self.lock, self.stopped = RLock(), Event()
        self.thread = None
        self.cursor = None
        self.retry_at = 0
        self.error = ''
        self.last_sent = None

    def settings(self):
        with self.lock:
            return self._settings()

    def _settings(self):
        try:
            result = json.loads((self.root / 'notifications.json').read_text(encoding='utf-8'))
            if result.get('preset_version', 1) < 3:
                backup = self.root / 'notifications.before-relevance-v2.json'
                if not backup.exists():
                    backup.write_text(json.dumps(result), encoding='utf-8')
                result.update(include=migrate_include(result.get('include', ''), 1), market_relevance=True, preset_version=3,
                              mode='off' if result.get('mode') == 'off' else 'included')
                temporary = self.root / 'notifications.json.tmp'
                temporary.write_text(json.dumps(result), encoding='utf-8')
                temporary.replace(self.root / 'notifications.json')
            result.setdefault('max_age_seconds', 86400)
            result.setdefault('filter_policy', '{}')
            return result
        except FileNotFoundError:
            return {'mode': 'off', 'include': '', 'exclude': '', 'hidden': [], 'market_relevance': True, 'preset_version': 3, 'max_age_seconds': 86400}

    def configure(self, rules, mode=None):
        with self.lock:
            current = self.settings()
            if mode is not None:
                if current['mode'] == 'off' and mode != 'off':
                    self.cursor = self.store.arrivals(mode='all')['cursor']
                current['mode'] = mode
            current.update(rules)
            self.root.mkdir(parents=True, exist_ok=True)
            temporary = self.root / 'notifications.json.tmp'
            temporary.write_text(json.dumps(current), encoding='utf-8')
            temporary.replace(self.root / 'notifications.json')
            return self.status()

    def setup(self):
        return json.loads((self.root / 'setup.json').read_text())

    def status(self):
        with self.lock:
            configured = self.settings()
            try:
                setup = self.setup()
                # Only the loopback desktop API exposes setup credentials. The
                # phone gateway explicitly does not proxy this route.
                connection = {key: setup[key] for key in ('topic', 'reader_password')}
                runtime = json.loads((self.root / 'address.json').read_text())
                connection.update(runtime)
            except (FileNotFoundError, KeyError, ValueError):
                connection = None
            return {'mode': configured['mode'], 'max_age_seconds': configured['max_age_seconds'], 'unified_alerts': configured.get('unified_alerts', False), 'connection': connection,
                    'error': self.error, 'last_sent': self.last_sent}

    def test(self):
        with self.lock:
            setup = self.setup()
            self.sender(setup, {'topic': setup['topic'], 'title': 'Fyodor News Flow test',
                               'message': 'Phone notifications are connected.', 'priority': 4})
            return {'sent': True}

    def start(self):
        if self.thread is not None:
            return
        # Existing arrivals are not replayed after service restart.
        self.cursor = self.store.arrivals(mode='all')['cursor']
        self.stopped.clear()
        self.thread = Thread(target=self._run, name='news-notifications', daemon=True)
        self.thread.start()

    def stop(self):
        self.stopped.set()
        if self.thread is not None:
            self.thread.join()
            self.thread = None

    def _run(self):
        while not self.stopped.is_set():
            try:
                self.tick()
            except Exception:
                # Do not log credentials, provider content or full HTTP errors.
                with self.lock:
                    self.error = 'Phone delivery unavailable; retrying. Check the local phone service.'
                    self.retry_at = time.time() + 5
            self.stopped.wait(.5)

    def tick(self):
        with self.lock:
            if time.time() < self.retry_at:
                return
            config = self.settings()
            page = self.store.arrivals(self.cursor, config['include'], config['exclude'], config['hidden'],
                                       mode='all' if config['mode'] == 'off' else config['mode'], market_relevance=config.get('market_relevance', True), max_age_seconds=config['max_age_seconds'], filter_policy=config.get('filter_policy', '{}'))
            if config['mode'] != 'off' and page['items']:
                setup = self.setup()
                items = page['items']
                first = items[0]
                try:
                    reader = json.loads((self.root / 'address.json').read_text(encoding='utf-8')).get('reader', '')
                except (FileNotFoundError, ValueError):
                    reader = ''
                self.sender(setup, payload(items, setup['topic'], reader))
                self.last_sent = {'at': int(time.time() * 1000), 'count': len(items),
                                  'title': first['title'], 'url': first['url'],
                                  'received_at': first['received_at'], 'published_at': first['published_at']}
            self.cursor = page['cursor']
            self.retry_at, self.error = 0, ''
