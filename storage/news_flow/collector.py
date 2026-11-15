"""One in-flight fetch per provider; one-second cadence, conditional GET and backoff."""
from concurrent.futures import ThreadPoolExecutor
from email.utils import parsedate_to_datetime
import logging
from threading import Event, Lock, Thread
import time
from urllib.error import HTTPError

from .feeds import fetch_feed

logger = logging.getLogger(__name__)


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
        self.pending, self.schedule = {}, {}
        self.thread = None
        self.pool = None

    def start(self):
        if self.thread is not None:
            return
        self.stopped.clear()
        self.pool = ThreadPoolExecutor(max_workers=4, thread_name_prefix='news-feed')
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

    def refresh(self):
        # Manual refresh advances healthy feeds, but respects a server's retry delay.
        with self.lock:
            self.schedule = {key: value for key, value in self.schedule.items() if value[1] > 0}

    def _run(self):
        while not self.stopped.is_set():
            try:
                self.tick()
            except Exception:
                logger.exception('News Flow collection failed; retrying without discarding history')
            self.stopped.wait(0.2)

    def tick(self):
        now = time.monotonic()
        with self.lock:
            for source in self.store.sources():
                identity = source['id']
                scheduled = self.schedule.get(identity, (0, 0, source['url']))
                due, failures, previous_url = scheduled
                future = self.pending.get(identity)
                if future is not None:
                    if not future.done():
                        continue
                    self.pending.pop(identity)
                    # Worker records its outcome and schedules the next request.
                if source['url'] != previous_url:
                    due = 0
                if due <= now and self.pool is not None:
                    self.pending[identity] = self.pool.submit(self._fetch, source, failures if source['url'] == previous_url else 0)

    def _fetch(self, source, failures):
        delay = 5
        try:
            items, etag, modified = self.fetcher(source)
            self.store.success(source, items, etag, modified, int(time.time() * 1000))
            delay, failures = 1, 0
        except Exception as error:
            failures += 1
            delay = retry_delay(error, failures, time.time())
            self.store.failure(source, f'{error}. Retrying in {int(delay)}s.')
        finally:
            # Schedule after completion, never overlap a slow feed's requests.
            with self.lock:
                self.schedule[source['id']] = (time.monotonic() + delay, failures, source['url'])
