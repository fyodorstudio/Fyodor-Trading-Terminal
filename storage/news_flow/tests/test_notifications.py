import asyncio
from base64 import b64encode
from concurrent.futures import Future
import json
from pathlib import Path
from tempfile import TemporaryDirectory
import time
import unittest
from unittest.mock import patch

from storage.news_flow.collector import NewsCollector, WORKERS
from storage.news_flow.notifications import NewsNotifier
from storage.news_flow.phone import phone_app
from storage.news_flow.store import NewsStore
from storage.news_flow.phone_setup import prepare, VERSION


async def request(app, method, path, body=None, login=None):
    headers = [(b'content-type', b'application/json')]
    if login:
        headers.append((b'authorization', b'Basic ' + b64encode(login.encode())))
    messages = []
    async def receive():
        return {'type': 'http.request', 'body': json.dumps(body).encode(), 'more_body': False}
    async def send(message):
        messages.append(message)
    await app({'type': 'http', 'http_version': '1.1', 'scheme': 'http', 'method': method,
               'path': path.partition('?')[0], 'query_string': path.partition('?')[2].encode(), 'headers': headers,
               'client': ('127.0.0.1', 1), 'server': ('test', 80)}, receive, send)
    return messages[0]['status'], b''.join(message.get('body', b'') for message in messages if message['type'] == 'http.response.body')


class NewsNotificationTests(unittest.TestCase):
    def setUp(self):
        self.temp = TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.store = NewsStore(self.root)
        self.source = self.store.sources()[0]
        with self.store.database() as db:
            db.execute("DELETE FROM sources WHERE id!='reuters'")
        self.now = int(time.time() * 1000)
        self.store.success(self.source, [], '', '', self.now)
        self.sent = []
        self.notifier = NewsNotifier(self.store, lambda setup, body: self.sent.append(body))
        self.notifier.root.mkdir(parents=True)
        (self.notifier.root / 'setup.json').write_text(json.dumps({'topic': 'private-test', 'publisher_password': 'never-expose', 'reader_password': 'phone-login'}))

    def add(self, identity, title='Oil supply surprise', published=None, history=False):
        self.store.success(self.source, [{'identity': identity, 'title': title, 'url': f'https://example.com/{identity}',
                           'summary': '', 'publisher': 'Reuters', 'published_at': self.now if published is None else published}], '', '', self.now + 1, update_status=not history)

    def test_late_collection_filters_edits_history_and_restart_without_browser(self):
        rules = {'include': 'oil', 'exclude': 'India', 'hidden': []}
        self.notifier.configure(rules, 'included')
        self.add('late', published=self.now - 6*3600000)
        self.add('excluded', 'India oil trade')
        self.add('unmatched', 'Football results')
        self.add('archive', history=True)
        self.notifier.tick()
        self.assertEqual(len(self.sent), 1)
        self.assertEqual(self.sent[0]['title'], 'Oil supply surprise')
        self.assertEqual(self.sent[0]['click'], 'https://example.com/late')
        self.assertEqual(self.notifier.last_sent['received_at'], self.now + 1)
        self.notifier.tick()
        self.assertEqual(len(self.sent), 1, 'Repeat polls are silent')
        self.notifier.configure({**rules, 'include': 'yen'})
        self.add('edit', 'Yen intervention warning')
        self.notifier.tick()
        self.assertEqual(len(self.sent), 2, 'Latest synchronized rules apply without a browser listener')
        restarted = NewsNotifier(self.store, lambda setup, body: self.sent.append(body))
        restarted.tick()
        self.assertEqual(len(self.sent), 2, 'Restart establishes a baseline; no backlog replay')
        restarted.configure({**rules, 'hidden': ['reuters']}, 'all')
        self.add('hidden')
        restarted.tick()
        self.assertEqual(len(self.sent), 2)
        restarted.configure(rules, 'off')
        self.add('off')
        restarted.tick()
        restarted.configure(rules, 'all')
        restarted.tick()
        self.assertEqual(len(self.sent), 2, 'Enabling does not replay headlines collected while off')

    def test_delivery_failure_preserves_cursor_and_bounded_message(self):
        self.notifier.configure({'include': '', 'exclude': '', 'hidden': []}, 'all')
        for i in range(15):
            self.add(str(i), 'Yen ' + '\u00a5' * 1500)
        baseline = self.notifier.cursor
        with patch.object(self.notifier, 'sender', side_effect=OSError('unavailable')):
            with self.assertRaises(OSError):
                self.notifier.tick()
        self.assertEqual(self.notifier.cursor, baseline)
        self.notifier.tick()
        self.assertEqual(len(self.sent), 1)
        self.assertLess(len(self.sent[0]['message'].encode()), 4096)
        self.assertEqual(self.notifier.last_sent['count'], 15)
        self.assertNotIn('publisher_password', self.notifier.status())

    def test_scheduler_reserves_capacity_for_other_hosts_and_never_queues_unbounded(self):
        with self.store.database() as db:
            db.execute('DELETE FROM sources')
        for i in range(20):
            self.store.save_source(f'Google {i}', f'https://news.google.com/rss/search?q={i}')
        for i in range(10):
            self.store.save_source(f'Official {i}', f'https://bank{i}.example/feed')
        submitted = []
        class Pool:
            def submit(self, function, source, failures):
                submitted.append(source)
                return Future()
        collector = NewsCollector(self.store)
        collector.pool = Pool()
        collector.tick()
        self.assertEqual(len(submitted), WORKERS)
        self.assertEqual(sum('news.google.com' in row['url'] for row in submitted), 2)
        collector.tick()
        self.assertEqual(len(submitted), WORKERS, 'No executor backlog beyond active capacity')
        for future in collector.pending.values():
            future.set_result(None)
        collector.tick()
        self.assertLessEqual(len(collector.pending), WORKERS)

    def test_phone_gateway_requires_reader_and_blocks_mutations_credentials_and_traversal(self):
        app = phone_app(self.root, self.root / 'assets', {'reader_password': 'phone-login'})
        async def run():
            self.assertEqual((await request(app, 'GET', '/news'))[0], 401)
            self.assertEqual((await request(app, 'GET', '/news', login='reader:wrong'))[0], 401)
            self.assertEqual((await request(app, 'GET', '/storage-api/news-flow/notifications', login='reader:phone-login'))[0], 404)
            self.assertEqual((await request(app, 'GET', '/storage-api/news-flow/arrivals', login='reader:phone-login'))[0], 404)
            self.assertEqual((await request(app, 'PUT', '/storage-api/news-flow/sources', {}, 'reader:phone-login'))[0], 405)
            self.assertEqual((await request(app, 'GET', '/assets/../../setup.json', login='reader:phone-login'))[0], 404)
            self.assertEqual((await request(app, 'GET', '/news', login='reader:phone-login'))[0], 503)
        asyncio.run(run())

    def test_notification_api_persists_mode_profile_and_validates_rules(self):
        from storage.app import create_app
        app = create_app(self.root, run_collector=False)
        async def run():
            prefix = '/api/v1/news-flow'
            result, body = await request(app, 'PUT', prefix + '/notifications', {'mode': 'included', 'include': 'oil', 'hidden': ['reuters']})
            self.assertEqual(result, 200)
            self.assertEqual(json.loads(body)['mode'], 'included')
            await request(app, 'PUT', prefix + '/notifications/rules', {'include': 'yen', 'exclude': 'India', 'hidden': [], 'market_relevance': True, 'preset_version': 3})
            self.assertEqual(json.loads((await request(app, 'GET', prefix + '/notifications'))[1])['mode'], 'included')
            profile = json.loads((await request(app, 'GET', prefix + '/phone-profile'))[1])
            self.assertEqual(profile, {'include': 'yen', 'exclude': 'India', 'hidden': [], 'market_relevance': True, 'preset_version': 3, 'max_age_seconds': 86400, 'filter_policy': '{}'})
            self.assertNotIn('reader_password', profile)
            self.assertEqual((await request(app, 'PUT', prefix + '/notifications', {'mode': 'bad'}))[0], 422)
            self.assertEqual((await request(app, 'PUT', prefix + '/notifications', {'mode': 'all', 'include': ','.join(f'word{i}' for i in range(501))}))[0], 422)
        asyncio.run(run())

    def test_setup_pins_download_and_hashes_exact_password_without_windows_crlf(self):
        root = self.root / 'install'
        binary = root / f'ntfy-{VERSION}' / 'ntfy.exe'
        binary.parent.mkdir(parents=True)
        binary.write_bytes(b'fake executable; all subprocesses mocked')
        class Result:
            stdout = b'$2a$10$' + b'a' * 53 + b'\n'
        with patch('storage.news_flow.phone_setup.subprocess.run', return_value=Result()) as hashing, patch('storage.news_flow.phone_setup.lan_ip', return_value='192.168.1.10'):
            executable, config, setup = prepare(root)
            self.assertEqual(executable, binary.resolve())
            self.assertEqual(hashing.call_count, 2)
            for call in hashing.call_args_list:
                value = call.kwargs['input']
                self.assertIsInstance(value, bytes, 'Raw stdin is required: text mode changes LF to CRLF on Windows')
                self.assertNotIn(b'\r', value)
                self.assertEqual(len(value.splitlines()), 2)
            self.assertNotIn(setup['reader_password'], config.read_text())
            self.assertNotIn(setup['publisher_password'], config.read_text())
            hashing.reset_mock()
            self.assertEqual(prepare(root)[2], setup, 'Reader credentials survive restarts')
            hashing.assert_not_called()
        class Download:
            def __enter__(self): return self
            def __exit__(self, *args): pass
            def read(self, size): return b'corrupt archive'
        with patch('storage.news_flow.phone_setup.urlopen', return_value=Download()), patch('storage.news_flow.phone_setup.subprocess.run') as execute:
            with self.assertRaisesRegex(ValueError, 'checksum mismatch'):
                prepare(self.root / 'bad-download')
            execute.assert_not_called()
