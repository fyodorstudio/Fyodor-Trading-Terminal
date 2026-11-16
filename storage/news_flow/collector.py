"""One in-flight fetch per provider; one-second cadence, conditional GET and backoff."""
from concurrent.futures import ThreadPoolExecutor
from email.utils import parsedate_to_datetime
import logging
from threading import Event, Lock, Thread
import time
from urllib.parse import urlsplit
from urllib.error import HTTPError

from .feeds import fetch_feed

logger = logging.getLogger(__name__)
WORKERS = 8
PER_HOST = 2


def retry_delay(error, failures, now):
    delay = min(300, 2 ** min(failures, 9))
    if isinstance(error, HTTPError) and error.headers:
        value = error.headers.get('Retry-After', '')
        try:
            delay = max(delay, float(value))
        except ValueError:
            try:
                delay = max(delay, parsedate_to_datetime(value).timestamp() - now)
            except (ValueError, TypeError, OverflowError):
                pass
    return min(86400, max(1, delay))


class NewsCollector:
    def __init__(self, store, fetcher=fetch_feed):
        self.store, self.fetcher = store, fetcher
        self.stopped = Event()
        self.lock = Lock()
        self.pending = {}
        self.source_locks = {}
        self.thread = None
        self.pool = None
        self.run_id = None
        self.last_heartbeat = 0

    def start(self):
        if self.thread is not None:
            return
        self.stopped.clear()
        self.run_id = self.store.collection_run()
        self.pool = ThreadPoolExecutor(max_workers=WORKERS, thread_name_prefix='news-feed')
        self.thread = Thread(target=self._run, name='news-flow', daemon=True)
        self.thread.start()

    def stop(self):
        self.stopped.set()
        if self.thread is not None:
            self.thread.join()
            self.thread = None
        if self.pool is not None:
            self.pool.shutdown(wait=True, cancel_futures=True)
            self.pool = None
        if self.run_id is not None:
            self.store.collection_run(self.run_id, stopped=True)
            self.run_id = None

    def refresh(self):
        # Manual refresh advances healthy feeds, but respects a server's retry delay.
        self.store.refresh()

    def source_lock(self, identity):
        with self.lock:
            return self.source_locks.setdefault(identity, Lock())

    def _run(self):
        while not self.stopped.is_set():
            try:
                self.tick()
                if time.monotonic() - self.last_heartbeat >= 30:
                    self.store.collection_run(self.run_id)
                    self.last_heartbeat = time.monotonic()
            except Exception:
                logger.exception('News Flow collection failed; retrying without discarding history')
            self.stopped.wait(0.2)

    def tick(self):
        now = time.time() * 1000
        with self.lock:
            sources = self.store.sources()
            hosts = {source['id']: urlsplit(source['url']).hostname for source in sources}
            self.pending = {key: future for key, future in self.pending.items() if not future.done()}
            busy = {}
            for identity in self.pending:
                host = hosts.get(identity)
                busy[host] = busy.get(host, 0) + 1
            # Never fill an unbounded executor queue. Oldest due request goes
            # first; one host (notably Google) cannot occupy every worker.
            for source in sorted(sources, key=lambda row: max(row['next_fetch_at'], row['retry_at'])):
                identity = source['id']
                due = max(source['next_fetch_at'], source['retry_at'])
                host = hosts[identity]
                if len(self.pending) >= WORKERS:
                    break
                if identity in self.pending or busy.get(host, 0) >= PER_HOST:
                    continue
                if due <= now and self.pool is not None:
                    self.pending[identity] = self.pool.submit(self._fetch, source, source['failures'])
                    busy[host] = busy.get(host, 0) + 1

    def _fetch(self, source, failures):
        with self.source_lock(source['id']):
            current = next((row for row in self.store.sources() if row['id'] == source['id'] and row['url'] == source['url']), None)
            if current is None or current['retry_at'] > time.time() * 1000:
                return
            started = time.time() * 1000
            queued = started - max(current['next_fetch_at'], current['retry_at']) if current['next_fetch_at'] else 0
            metadata = {'http_status': 200}
            try:
                result = self.fetcher(current)
                items, etag, modified = result
                metadata.update(getattr(result, 'diagnostics', {'item_count': len(items) if items is not None else None}))
                self.store.success(current, items, etag, modified, int(time.time() * 1000))
            except Exception as error:
                metadata.update(http_status=error.code if isinstance(error, HTTPError) else None, failed=True)
                failures = max(failures, current['failures']) + 1
                delay = retry_delay(error, failures, time.time())
                self.store.failure(current, f'{error}. Retrying in {int(delay)}s.', int(time.time() * 1000 + delay * 1000), failures)
            finally:
                completed = time.time() * 1000
                self.store.fetch_timing(current, completed - started, queued, metadata, started, completed)
