import asyncio
from concurrent.futures import ThreadPoolExecutor
from email.message import Message
import json
from pathlib import Path
from tempfile import TemporaryDirectory
from threading import Event
import time
import unittest
from unittest.mock import patch
from urllib.error import HTTPError
from urllib.parse import urlsplit
import xml.etree.ElementTree as ET

from storage.news_flow.collector import NewsCollector, retry_delay
from storage.news_flow.feeds import MAX_FEED_BYTES, fetch_feed, parse_feed
from storage.news_flow.store import NewsStore
from storage.news_flow.history import NewsHistory, historical_url

RSS = b'''<rss version="2.0"><channel><title>Reuters</title>
<item><guid>oil-1</guid><title>Iran &amp; OPEC: oil falls</title>
<description><![CDATA[<a href="https://example.com">Iran &amp; OPEC: oil falls</a><p>Trump comments on supply</p>]]></description>
<source url="https://reuters.com">Reuters</source><link>https://news.google.com/rss/articles/one</link><pubDate>Sun, 15 Nov 2026 02:58:00 GMT</pubDate></item>
<item><title>Rates unchanged</title><link>https://example.com/rates</link><pubDate>invalid</pubDate></item>
<item><title>Unsafe</title><link>javascript:alert(1)</link></item></channel></rss>'''
ATOM = b'''<feed xmlns="http://www.w3.org/2005/Atom"><entry><id>speech</id><title>Policy speech</title>
<link rel="self" href="https://example.com/api"/><link rel="alternate" href="https://example.com/speech"/>
<summary type="html">&lt;p&gt;Monetary outlook&lt;/p&gt;</summary><published>2026-11-15T10:00:00+07:00</published></entry></feed>'''


class NewsFlowTests(unittest.TestCase):
    def setUp(self):
        self.temp = TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name) / 'data'
        self.store = NewsStore(self.root)
        self.source = self.store.sources()[0]
        self.items = parse_feed(RSS)
        self.now = 1794711600000

    def ingest(self):
        self.store.success(self.source, self.items, 'version-1', '', self.now)

    def test_rss_atom_text_links_dates_and_invalid_xml(self):
        self.assertEqual(len(self.items), 2)
        first = self.items[0]
        self.assertEqual(first['title'], 'Iran & OPEC: oil falls')
        self.assertEqual(first['publisher'], 'Reuters')
        self.assertNotIn('<', first['summary'])
        self.assertIn('Trump comments', first['summary'])
        self.assertEqual(first['published_at'], 1794711480000)
        self.assertIsNone(self.items[1]['published_at'])
        atom = parse_feed(ATOM)[0]
        self.assertEqual(atom['summary'], 'Monetary outlook')
        self.assertEqual(atom['url'], 'https://example.com/speech')
        for xml in (b'<html/>', b'<rss>', b'x' * (MAX_FEED_BYTES + 1),
                    b'<!DOCTYPE rss [<!ENTITY a "x">]><rss/>', '<!DOCTYPE rss><rss/>'.encode('utf-16')):
            with self.subTest(xml=xml[:50]), self.assertRaises((ValueError, ET.ParseError)):
                parse_feed(xml)

    def test_persistence_upsert_missing_dates_and_provider_changes(self):
        self.ingest(); self.ingest()
        self.assertEqual(self.store.query()['total'], 2)
        changed = [{**self.items[0], 'title': 'Updated headline', 'published_at': None}]
        self.store.success(self.source, changed, 'version-2', '', self.now + 1)
        rows = NewsStore(self.root).query()['items']
        first = next(row for row in rows if row['identity'] == changed[0]['identity'])
        self.assertEqual(first['title'], 'Updated headline')
        self.assertEqual(first['first_seen'], self.now)
        self.assertEqual(first['published_at'], self.items[0]['published_at'])
        self.store.save_source('Reuters', 'https://example.com/new', self.source['id'])
        self.store.success(self.source, [{**changed[0], 'title': 'Stale response'}], 'stale', '', self.now)
        self.assertNotIn('Stale response', str(self.store.query()))
        self.assertEqual(self.store.sources()[0]['etag'], '')

    def test_filters_apply_to_all_history_and_preserve_it(self):
        self.ingest()
        bank = self.store.save_source('Central bank', 'https://example.com/feed')
        source = next(source for source in self.store.sources() if source['id'] == bank)
        self.store.success(source, parse_feed(ATOM), '', '', self.now)
        self.assertEqual(self.store.query(include='OPEC')['total'], 1)
        self.assertEqual(self.store.query(include='comments')['total'], 1, 'Search includes feed summaries')
        self.assertEqual(self.store.query(include='iran, rates')['total'], 2, 'Any included term matches')
        self.assertEqual(self.store.query(include='iran, opec', exclude='supply')['total'], 0)
        self.assertEqual(self.store.query(include='%')['total'], 0, 'SQL wildcard characters remain literal')
        self.assertEqual(self.store.query(sources=[bank])['total'], 1)
        self.assertEqual(self.store.query(start=self.items[0]['published_at'], end=self.items[0]['published_at'] + 1)['total'], 1)
        self.assertEqual(self.store.query(limit=1, offset=2)['total'], 3)
        self.assertEqual(len(self.store.query(limit=1, offset=2)['items']), 1)
        newest = self.store.query()['items']; oldest = self.store.query(order='oldest')['items']
        self.assertEqual([row['id'] for row in newest], [row['id'] for row in oldest][::-1])
        self.assertEqual(self.store.query()['total'], 3)

    def test_exclusion_only_and_included_but_excluded_stories(self):
        self.ingest()
        self.store.success(self.source, [{**self.items[0], 'identity': 'india', 'title': 'India oil demand', 'summary': ''}], '', '', self.now)
        self.assertEqual(self.store.query(include='oil')['total'], 2)
        self.assertEqual(self.store.query(include='oil', exclude='INDIA')['total'], 1, 'Exclusion overrides a matching inclusion')
        self.assertEqual(self.store.query(exclude='india')['total'], 2, 'An empty inclusion allows everything except exclusions')
        self.assertEqual(self.store.query()['total'], 3, 'All mode leaves collected stories intact')

    def test_historical_date_search_preserves_live_feed_cache_and_exact_timezone_window(self):
        self.ingest()
        # August 19 in Jakarta spans two UTC dates.
        start, end = 1787072400000, 1787158800000
        seen = []
        def fetch(source):
            seen.append(source)
            return [{**self.items[0], 'identity': 'august', 'published_at': start + 1000},
                    {**self.items[0], 'identity': 'too-early', 'published_at': start - 1},
                    {**self.items[0], 'identity': 'too-late', 'published_at': end},
                    {**self.items[0], 'identity': 'undated', 'published_at': None}], 'archive-etag', ''
        collector = NewsCollector(self.store)
        history = NewsHistory(self.store, collector, fetch)
        original = self.store.sources()[0]
        result = history.search(start, end)
        self.assertEqual(result['searched'], 1); self.assertEqual(result['found'], 1)
        self.assertEqual(self.store.query(start=start, end=end)['total'], 1)
        self.assertEqual(self.store.query()['total'], 3)
        self.assertEqual(seen[0]['etag'], '')
        self.assertNotIn('when%3A', seen[0]['url'])
        self.assertIn('after%3A2026-08-18', seen[0]['url'])
        self.assertIn('before%3A2026-08-20', seen[0]['url'])
        self.assertEqual(self.store.sources()[0], original, 'Historical results do not overwrite live URL, validators, success time or error')
        self.assertEqual(history.search(start, end)['cached'], 1)
        self.assertEqual(len(seen), 1)
        history.search(start, end, force=True)
        self.assertEqual(len(seen), 2)
        self.assertEqual(self.store.query(start=start, end=end)['total'], 1, 'Backfill deduplicates on retries')
        bank = self.store.save_source('Fed', 'https://www.federalreserve.gov/feeds/speeches.xml')
        self.assertEqual(history.search(start, end, [bank])['unsupported'], ['Fed'])
        self.assertEqual(history.search(start, end, ['__none__'])['searched'], 0)
        self.assertIsNone(historical_url('https://example.com/rss', start, end))

    def test_historical_errors_respect_retry_after_and_keep_saved_news(self):
        self.ingest()
        headers = Message(); headers['Retry-After'] = '60'
        calls = []
        def offline(source):
            calls.append(source)
            raise HTTPError(source['url'], 429, 'Throttled', headers, None)
        history = NewsHistory(self.store, NewsCollector(self.store), offline)
        result = history.search(self.now - 86400000, self.now)
        self.assertIn('60s', result['errors'][0])
        self.assertEqual(history.search(self.now - 86400000, self.now, force=True)['cached'], 1)
        self.assertEqual(len(calls), 1, 'Even forced refresh respects Retry-After')
        self.assertEqual(self.store.query()['total'], 2)

    def test_history_serializes_with_live_provider_fetches(self):
        entered, release, archive_entered = Event(), Event(), Event()
        def live(source):
            entered.set(); release.wait(3)
            return self.items, 'live-etag', ''
        def archive(source):
            archive_entered.set()
            return self.items, 'archive-etag', ''
        collector = NewsCollector(self.store, live)
        history = NewsHistory(self.store, collector, archive)
        with ThreadPoolExecutor(max_workers=2) as pool:
            try:
                live_job = pool.submit(collector._fetch, self.source, 0)
                self.assertTrue(entered.wait(1))
                history_job = pool.submit(history.search, self.now - 86400000, self.now)
                self.assertFalse(archive_entered.wait(0.05))
                release.set(); live_job.result(timeout=3); history_job.result(timeout=3)
                self.assertTrue(archive_entered.is_set())
                self.assertEqual(self.store.sources()[0]['etag'], 'live-etag')
            finally:
                release.set()

    def test_conditional_get_and_retry_after(self):
        self.ingest()
        headers = Message(); headers['Retry-After'] = '37'
        error = HTTPError(self.source['url'], 429, 'Too many requests', headers, None)
        self.assertEqual(retry_delay(error, 1, time.time()), 37)
        self.assertEqual(retry_delay(ValueError('offline'), 9, time.time()), 300)
        headers['ETag'] = 'version-1'
        source = self.store.sources()[0]
        with patch('storage.news_flow.feeds.urlopen', side_effect=HTTPError(source['url'], 304, 'Unchanged', headers, None)) as network:
            self.assertEqual(fetch_feed(source), (None, 'version-1', ''))
            self.assertEqual(network.call_args.args[0].get_header('If-none-match'), 'version-1')

    def test_collector_never_overlaps_or_bypasses_backoff_and_preserves_history(self):
        entered, release = Event(), Event()
        def blocked(source):
            entered.set(); release.wait(3)
            return self.items, '', ''
        collector = NewsCollector(self.store, blocked)
        collector.pool = ThreadPoolExecutor(max_workers=1)
        try:
            collector.tick(); self.assertTrue(entered.wait(1))
            first = collector.pending[self.source['id']]
            for _ in range(5): collector.tick()
            self.assertIs(collector.pending[self.source['id']], first)
            release.set(); first.result(timeout=3)
            collector.tick()
            self.assertEqual(len(collector.pending), 0, 'A completed request waits one second before another')
            self.assertEqual(self.store.query()['total'], 2)
            def offline(source): raise OSError('Offline')
            collector.fetcher = offline
            collector._fetch(self.source, 0)
            scheduled = collector.schedule[self.source['id']]
            collector.refresh()
            self.assertEqual(collector.schedule[self.source['id']], scheduled)
            self.assertEqual(self.store.query()['total'], 2)
            self.assertIn('Offline', self.store.sources()[0]['error'])
        finally:
            release.set(); collector.stop()

    def test_backup_restore_includes_news_database(self):
        from storage.calendar_store import CalendarStore
        from storage.recovery import backup_directory, restore_directory
        calendar = CalendarStore(self.root / 'calendar.sqlite3'); calendar.close()
        self.ingest()
        backup, restored = Path(self.temp.name) / 'backup', Path(self.temp.name) / 'restored'
        backup_directory(self.root, backup); restore_directory(backup, restored)
        self.assertEqual(NewsStore(restored).query(), self.store.query())
        self.assertEqual(NewsStore(restored).sources(), self.store.sources())

    def test_http_routes_validation_provider_setup_and_pagination(self):
        from storage.app import create_app
        app = create_app(self.root, run_collector=False)
        self.ingest()
        async def request(method, path, body=None):
            route = urlsplit(path); sent = []
            async def receive(): return {'type': 'http.request', 'body': json.dumps(body).encode(), 'more_body': False}
            async def send(message): sent.append(message)
            await app({'type': 'http', 'http_version': '1.1', 'scheme': 'http', 'method': method, 'path': route.path,
                       'query_string': route.query.encode(), 'headers': [(b'content-type', b'application/json')],
                       'client': ('test', 1), 'server': ('test', 80)}, receive, send)
            return sent[0]['status'], json.loads(b''.join(message.get('body', b'') for message in sent if message['type'] == 'http.response.body'))
        async def run():
            prefix = '/api/v1/news-flow'
            status, body = await request('GET', prefix + '/sources')
            self.assertEqual(status, 200); self.assertNotIn('etag', body['sources'][0])
            status, body = await request('GET', prefix + '/items?include=IRAN&limit=1')
            self.assertEqual(status, 200); self.assertEqual(body['total'], 1)
            for url in ('javascript:bad', 'file:///etc/passwd', 'https://user:pass@example.com/rss'):
                self.assertEqual((await request('POST', prefix + '/sources', {'name': 'Bad', 'url': url}))[0], 422)
            self.assertEqual((await request('POST', prefix + '/sources', {'name': ' ', 'url': 'https://example.com/rss'}))[0], 422)
            self.assertEqual((await request('POST', prefix + '/sources', {'name': 'Duplicate', 'url': self.source['url']}))[0], 409)
            status, body = await request('POST', prefix + '/sources', {'name': ' Bank ', 'url': 'https://example.com/rss'})
            self.assertEqual(status, 200)
            self.assertEqual((await request('PUT', prefix + '/sources/' + body['id'], {'name': 'Bank news', 'url': 'https://example.com/rss2'}))[0], 200)
            self.assertEqual((await request('GET', prefix + '/items?order=broken'))[0], 422)
            self.assertEqual((await request('GET', prefix + '/items?limit=9999'))[0], 422)
            self.assertEqual((await request('POST', prefix + '/refresh'))[0], 202)
            history_result = {'searched': 1, 'cached': 0, 'found': 1, 'unsupported': [], 'errors': []}
            with patch('storage.news_flow.history.NewsHistory.search', return_value=history_result) as search:
                status, body = await request('POST', prefix + '/history', {'start': self.now - 86400000, 'end': self.now, 'source': ['reuters']})
                self.assertEqual(status, 200); self.assertEqual(body, history_result)
                search.assert_called_once_with(self.now - 86400000, self.now, ['reuters'], False)
            for body in ({'start': self.now, 'end': self.now}, {'start': 0, 'end': self.now}, {'start': -1, 'end': 1}):
                self.assertEqual((await request('POST', prefix + '/history', body))[0], 422)
        asyncio.run(run())
