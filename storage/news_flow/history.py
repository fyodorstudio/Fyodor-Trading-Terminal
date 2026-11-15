"""Best-effort Google News date searches, separate from the live feed configuration."""
from datetime import datetime, timedelta, timezone
import re
import time
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit
from urllib.error import HTTPError

from .collector import retry_delay
from .feeds import fetch_feed, treasury_url, treasury_data_url
from .providers import historical_feed_url


def historical_url(url, start, end):
    if treasury_url(url):
        return treasury_data_url(datetime.fromtimestamp(start / 1000, timezone.utc).year)
    url = historical_feed_url(url)
    parsed = urlsplit(url)
    if parsed.hostname != 'news.google.com' or parsed.path.rstrip('/') != '/rss/search':
        return None
    params = dict(parse_qsl(parsed.query))
    query = re.sub(r'(?<!\S)(?:when|after|before):\S+', '', params.get('q', ''), flags=re.I).strip()
    if not query:
        return None
    # Search the UTC calendar days intersecting the selected display-timezone day.
    # Google date matching is approximate; publication timestamps decide inclusion.
    first = datetime.fromtimestamp(start / 1000, timezone.utc)
    last = datetime.fromtimestamp((end - 1) / 1000, timezone.utc) + timedelta(days=1)
    params['q'] = f'{query} after:{first:%Y-%m-%d} before:{last:%Y-%m-%d}'
    return urlunsplit((parsed.scheme, parsed.netloc, parsed.path, urlencode(params), ''))


class NewsHistory:
    def __init__(self, store, collector, fetcher=None):
        self.store, self.collector = store, collector
        self.fetcher = fetcher or fetch_feed

    def search(self, start, end, sources=(), force=False):
        result = {'searched': 0, 'cached': 0, 'found': 0, 'unsupported': [], 'errors': []}
        for source in self.store.sources():
            if sources and source['id'] not in sources:
                continue
            url = historical_url(source['url'], start, end)
            if url is None:
                result['unsupported'].append(source['name'])
                continue
            # Also serializes with the live collector and other browser tabs.
            with self.collector.source_lock(source['id']):
                now = int(time.time() * 1000)
                shared_host = urlsplit(url).hostname == urlsplit(source['url']).hostname
                if shared_host and source['retry_at'] > now:
                    result['errors'].append(f"{source['name']}: Provider cooldown until {datetime.fromtimestamp(source['retry_at'] / 1000, timezone.utc):%Y-%m-%d %H:%M UTC}")
                    continue
                cached = self.store.history_search(source, start, end)
                if cached and ((cached['error'] and cached['retry_at'] > now) or
                               (not cached['error'] and not force and now - cached['searched_at'] < 900_000)):
                    result['cached'] += 1
                    result['found'] += cached['found']
                    if cached['error']:
                        result['errors'].append(f"{source['name']}: {cached['error']}")
                    continue
                result['searched'] += 1
                try:
                    items, _, _ = self.fetcher({**source, 'url': url, 'etag': '', 'modified': ''})
                    if treasury_url(source['url']):
                        last_url = treasury_data_url(datetime.fromtimestamp((end - 1) / 1000, timezone.utc).year)
                        if last_url != url:
                            extra, _, _ = self.fetcher({**source, 'url': last_url, 'etag': '', 'modified': ''})
                            items = (items or []) + (extra or [])
                    dated = [item for item in items or [] if item['published_at'] is not None and start <= item['published_at'] < end]
                    if not self.store.success(source, dated, '', '', now, update_status=False):
                        raise ValueError('Provider changed during the search; select the date again')
                    self.store.save_history_search(source, start, end, now, len(dated))
                    result['found'] += len(dated)
                except Exception as error:
                    failures = (cached['failures'] if cached else 0) + 1
                    delay = retry_delay(error, failures, time.time())
                    message = f'{error}. Retry after {int(delay)}s.'[:500]
                    self.store.save_history_search(source, start, end, now, 0, message, int(time.time() * 1000 + delay * 1000), failures)
                    if shared_host and isinstance(error, HTTPError) and error.code in (429, 503):
                        self.store.failure(source, message, int(time.time() * 1000 + delay * 1000), failures)
                    result['errors'].append(f"{source['name']}: {message}")
        return result
