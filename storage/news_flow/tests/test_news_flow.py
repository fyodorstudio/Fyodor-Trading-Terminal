import asyncio
from contextlib import closing
from concurrent.futures import ThreadPoolExecutor
from email.message import Message
import json
import sqlite3
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
from storage.news_flow.feeds import MAX_FEED_BYTES, fetch_feed, parse_feed, parse_treasury
from storage.news_flow.store import NewsStore
from storage.news_flow.providers import PROVIDERS, TREASURY_URL
from storage.news_flow.rules import matches, patterns, priority_reason
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
        # Most cases exercise one feed; starter-pack migration has its own case.
        with self.store.database() as db:
            db.execute("DELETE FROM sources WHERE id!='reuters'")
        self.items = parse_feed(RSS)
        self.now = 1794711600000

    def ingest(self):
        self.store.success(self.source, self.items, 'version-1', '', self.now)

    def test_keyword_boundaries_limits_and_classification_partition(self):
        for title, rule, expected in [('Retail chair said Federer won', 'AI, Fed', 0), ('AI and Fed policy', 'ai, FED', 1),
                                      ('EURUSD moves', 'USD', 1), ('EUR/USD moves', 'EURUSD', 1),
                                      ('USDCAD falls', 'USD/CAD', 1), ('OPEC+ meets', 'OPEC+', 1),
                                      ('Bad crops', 'ADP', 0), ('Oil prices move', 'oil', 1)]:
            with self.subTest(title=title, rule=rule): self.assertEqual(matches(title, rule), expected)
        many = ','.join(f'keyword{i}' for i in range(150))
        self.assertEqual(matches('keyword149 arrives', many), 1, 'Rules past the old 50-term limit work')
        with self.assertRaises(ValueError): patterns(','.join(f'word{i}' for i in range(501)))
        self.ingest()
        self.store.success(self.source, [{**self.items[0], 'identity': 'excluded', 'url': 'https://example.com/india', 'title': 'India oil demand'}], '', '', self.now)
        all_items = self.store.query()['items']
        included = self.store.query(include='oil', exclude='India', mode='included')['items']
        excluded = self.store.query(include='oil', exclude='India', mode='excluded')['items']
        self.assertEqual(len(included), 1)
        self.assertEqual(len(excluded), 2, 'Explicit exclusions and unmatched titles are Excluded')
        self.assertEqual({row['id'] for row in all_items}, {row['id'] for row in included + excluded})
        self.assertEqual(self.store.query(mode='included')['total'], 0)
        self.assertEqual(self.store.query(mode='excluded')['total'], len(all_items))

    def test_priority_candidates_pins_date_scope_and_no_false_probability(self):
        self.ingest()
        candidate = {**self.items[0], 'identity': 'preview', 'url': 'https://example.com/preview', 'title': 'RBA preview ahead of Tuesday decision', 'summary': 'A hike is around 80% priced.'}
        self.store.success(self.source, [candidate], '', '', self.now)
        self.assertTrue(priority_reason('Global watch', 'RBA hike is around 80% priced.'))
        self.assertEqual(priority_reason('RBA hikes as expected', 'Markets implied an 88% chance of a hike.'), '')
        self.assertEqual(priority_reason('Stock falls 88%', ''), '')
        self.assertTrue(priority_reason('RBA expected to cut interest rates', ''))
        self.assertEqual(self.store.query(priority=True)['total'], 1)
        self.store.pin(self.items[0]['url'], True)
        priority = self.store.query(priority=True, include='impossible', exclude='Iran')['items']
        self.assertEqual(len(priority), 2, 'Priority is independent of Include/Exclude')
        self.assertEqual(priority[0]['url'], self.items[0]['url'], 'Manual stars sort before automatic candidates')
        self.assertEqual(NewsStore(self.root).query(priority=True)['total'], 2)
        self.assertEqual(self.store.query(priority=True, start=self.now+1)['total'], 0)
        self.store.pin(self.items[0]['url'], False)
        self.assertEqual(self.store.query(priority=True)['total'], 1)

    def test_poll_override_and_retry_deadline_survive_restart_and_refresh(self):
        self.ingest()
        self.assertTrue(all(source['poll_seconds'] == 1 for source in self.store.sources()))
        self.store.save_source(self.source['name'], self.source['url'], self.source['id'], 300)
        self.assertEqual(self.store.sources()[0]['poll_seconds'], 300)
        self.assertEqual(self.store.sources()[0]['next_fetch_at'], self.now + 300000)
        headers = Message(); headers['Retry-After'] = '1800'
        def throttled(source): raise HTTPError(source['url'], 429, 'Throttled', headers, None)
        NewsCollector(self.store, throttled)._fetch(self.source, 0)
        retry_at = self.store.sources()[0]['retry_at']
        self.assertGreater(retry_at, time.time()*1000 + 1790000)
        reopened = NewsStore(self.root)
        reopened.save_source(self.source['name'], self.source['url'], self.source['id'], 1)
        collector = NewsCollector(reopened)
        collector.refresh()
        self.assertEqual(reopened.sources()[0]['retry_at'], retry_at)
        collector.pool = ThreadPoolExecutor(max_workers=1)
        try:
            collector.tick()
            self.assertEqual(collector.pending, {}, 'Restart/manual refresh/interval edits cannot bypass a cooldown')
        finally: collector.stop()

    def test_old_database_retry_message_migrates_without_bypassing_cooldown(self):
        root = self.root / 'old-install'
        directory = root / 'news-flow'; directory.mkdir(parents=True)
        with closing(sqlite3.connect(directory / 'news.sqlite3')) as db:
            db.execute("CREATE TABLE sources(id TEXT PRIMARY KEY,name TEXT NOT NULL,url TEXT NOT NULL UNIQUE,etag TEXT NOT NULL DEFAULT '',modified TEXT NOT NULL DEFAULT '',last_success INTEGER,error TEXT NOT NULL DEFAULT '')")
            db.execute('INSERT INTO sources(id,name,url,error) VALUES (?,?,?,?)', ('reuters', 'My feed', self.source['url'], 'HTTP Error 429. Retrying in 1800s.'))
            db.commit()
        source = NewsStore(root).sources()[0]
        self.assertEqual(source['poll_seconds'], 1)
        self.assertGreater(source['retry_at'], time.time()*1000 + 1790000)
        reopened = NewsStore(root)
        original = reopened.sources()[0]['retry_at']
        reopened.save_source('Renamed', self.source['url'], 'reuters', 300)
        self.assertEqual(reopened.sources()[0]['retry_at'], original)
        self.assertIn('429', reopened.sources()[0]['error'])

    def test_starter_sources_migrate_once_without_overwriting_customizations(self):
        root = self.root / 'new-install'
        store = NewsStore(root)
        sources = store.sources()
        self.assertEqual(len(sources), len(PROVIDERS))
        store.save_source('My Reuters', 'https://example.com/custom.xml', 'reuters')
        store.save_source('My bank', 'https://example.com/bank.xml')
        reopened = NewsStore(root).sources()
        self.assertEqual(len(reopened), len(PROVIDERS) + 1)
        self.assertEqual(reopened[0]['name'], 'My Reuters')
        # Simulate an existing Reuters-only database before the pack migration.
        with store.database() as db:
            db.execute("DELETE FROM sources WHERE id!='reuters'")
            db.execute('DELETE FROM migrations')
        migrated = NewsStore(root).sources()
        self.assertEqual(len(migrated), len(PROVIDERS))
        self.assertEqual(migrated[0]['url'], 'https://example.com/custom.xml')

    def test_link_duplicates_preserve_provider_views_and_distinct_articles(self):
        self.ingest()
        bank = self.store.save_source('Second feed', 'https://example.com/feed')
        other = next(source for source in self.store.sources() if source['id'] == bank)
        self.store.success(other, [self.items[0]], '', '', self.now + 1)
        self.assertEqual(self.store.query()['total'], 2)
        self.assertEqual(self.store.query(sources=[bank])['items'][0]['source_id'], bank)
        self.store.success(other, [{**self.items[0], 'identity': 'distinct', 'url': 'https://example.com/distinct'}], '', '', self.now + 2)
        self.assertEqual(self.store.query()['total'], 3)

    def test_alert_cursor_keyword_exclusions_history_duplicates_and_freshness(self):
        self.ingest()
        self.assertEqual(self.store.arrivals(0, 'iran', now=self.now)['items'], [], 'First provider load is primed silently')
        baseline = self.store.arrivals(include='iran', now=self.now)
        self.assertEqual(baseline['items'], [], 'Opening the alert listener only establishes a cursor')
        def add(identity, title, **kwargs):
            self.store.success(self.source, [{**self.items[0], 'identity': identity, 'url': f'https://example.com/{identity}',
                                           'title': title, 'published_at': self.now, **kwargs}], '', '', self.now + 1)
        add('fresh', 'Iran oil supply changes')
        add('excluded', 'India and Iran oil trade')
        add('old', 'Iran historical story', published_at=self.now - 1000000)
        add('undated', 'Iran undated story', published_at=None)
        self.store.success(self.source, [{**self.items[0], 'identity': 'historical', 'url': 'https://example.com/history'}], '', '', self.now, update_status=False)
        result = self.store.arrivals(baseline['cursor'], 'IRAN', 'india', now=self.now + 2)
        self.assertEqual([row['title'] for row in result['items']], ['Iran oil supply changes'])
        self.assertEqual(self.store.arrivals(result['cursor'], 'iran', now=self.now + 2)['items'], [])
        self.assertEqual(self.store.arrivals(baseline['cursor'], '', now=self.now + 2)['items'], [])
        self.assertEqual(self.store.arrivals(baseline['cursor'], ',\n', now=self.now + 2)['items'], [])
        self.assertEqual(self.store.arrivals(baseline['cursor'], 'iran', hidden=['reuters'], now=self.now + 2)['items'], [])
        # Later copies of the same article on overlapping feeds stay silent.
        identity = self.store.save_source('Other', 'https://example.com/feed')
        other = next(source for source in self.store.sources() if source['id'] == identity)
        self.store.success(other, [{**self.items[0], 'identity': 'copy', 'url': 'https://example.com/fresh', 'published_at': self.now}], '', '', self.now + 3)
        self.assertEqual(self.store.arrivals(result['cursor'], 'iran', now=self.now + 4)['items'], [])

    def test_treasury_parser_and_historical_year_boundary(self):
        entries = parse_treasury(json.dumps({'items': [
            {'title': 'Treasury doubles buybacks', 'url': '/news/press-releases/sb0607/', 'datetime': '2026-08-19T15:00:00Z'},
            {'title': 'Unsafe', 'url': 'https://example.com/news/press-releases/fake', 'datetime': '2026-08-19T15:00:00Z'}]}).encode())
        self.assertEqual(len(entries), 1)
        self.assertEqual(entries[0]['url'], TREASURY_URL + '/sb0607/')
        self.assertEqual(entries[0]['publisher'], 'US Treasury')
        fed = next(provider for provider in PROVIDERS if provider[0] == 'fed-speeches')
        self.assertIn('federalreserve.gov', historical_url(fed[2], self.now - 86400000, self.now))
        treasury = self.store.save_source('Treasury', TREASURY_URL)
        calls = []
        def fetch(source):
            calls.append(source['url'])
            return entries, '', ''
        history = NewsHistory(self.store, NewsCollector(self.store), fetch)
        start, end = 1798758000000, 1798844400000  # UTC days straddling New Year.
        history.search(start, end, [treasury])
        self.assertEqual(len(calls), 2)
        self.assertTrue(calls[0].endswith('/2026.json'))
        self.assertTrue(calls[1].endswith('/2027.json'))

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
        self.assertEqual(self.store.query(mode='included', include='OPEC')['total'], 1)
        self.assertEqual(self.store.query(mode='included', include='comments')['total'], 0, 'Only visible headline text matches')
        self.assertEqual(self.store.query(mode='included', include='iran, rates')['total'], 2, 'Any included term matches')
        self.assertEqual(self.store.query(mode='included', include='iran, opec', exclude='iran')['total'], 0)
        self.assertEqual(self.store.query(mode='included', include='%')['total'], 0, 'SQL wildcard characters remain literal')
        self.assertEqual(self.store.query(sources=[bank])['total'], 1)
        self.assertEqual(self.store.query(start=self.items[0]['published_at'], end=self.items[0]['published_at'] + 1)['total'], 1)
        self.assertEqual(self.store.query(limit=1, offset=2)['total'], 3)
        self.assertEqual(len(self.store.query(limit=1, offset=2)['items']), 1)
        newest = self.store.query()['items']; oldest = self.store.query(order='oldest')['items']
        self.assertEqual([row['id'] for row in newest], [row['id'] for row in oldest][::-1])
        self.assertEqual(self.store.query()['total'], 3)

    def test_exclusion_only_and_included_but_excluded_stories(self):
        self.ingest()
        self.store.success(self.source, [{**self.items[0], 'identity': 'india', 'url': 'https://example.com/india', 'title': 'India oil demand', 'summary': ''}], '', '', self.now)
        self.assertEqual(self.store.query(mode='included', include='oil')['total'], 2)
        self.assertEqual(self.store.query(mode='included', include='oil', exclude='INDIA')['total'], 1, 'Exclusion overrides a matching inclusion')
        self.assertEqual(self.store.query(mode='excluded', exclude='india')['total'], 3, 'Empty Include classifies every headline as Excluded')
        self.assertEqual(self.store.query()['total'], 3, 'All mode leaves collected stories intact')

    def test_historical_date_search_preserves_live_feed_cache_and_exact_timezone_window(self):
        self.ingest()
        # August 19 in Jakarta spans two UTC dates.
        start, end = 1787072400000, 1787158800000
        seen = []
        def fetch(source):
            seen.append(source)
            return [{**self.items[0], 'identity': 'august', 'url': 'https://example.com/august', 'published_at': start + 1000},
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
        bank = self.store.save_source('Fed', 'https://example.com/custom-bank.xml')
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
        self.assertIn('cooldown', history.search(self.now - 86400000, self.now, force=True)['errors'][0])
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
            scheduled = self.store.sources()[0]['retry_at']
            collector.refresh()
            self.assertEqual(self.store.sources()[0]['retry_at'], scheduled)
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
            status, body = await request('GET', prefix + '/items?mode=included&include=IRAN&limit=1')
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
            status, arrivals = await request('GET', prefix + '/arrivals?include=Iran')
            self.assertEqual(status, 200); self.assertEqual(arrivals['items'], [])
            self.assertIsInstance(arrivals['cursor'], int)
            self.assertEqual((await request('GET', prefix + '/arrivals?after=-1'))[0], 422)
            for poll in (0, 3601, 1.5, '300'):
                self.assertEqual((await request('POST', prefix + '/sources', {'name': 'Bad poll', 'url': 'https://example.com/poll', 'poll_seconds': poll}))[0], 422)
            status, _ = await request('PUT', prefix + '/priority', {'url': self.items[0]['url'], 'pinned': True})
            self.assertEqual(status, 200)
            status, priority = await request('GET', prefix + '/items?priority=true')
            self.assertEqual(priority['total'], 1); self.assertEqual(priority['items'][0]['pinned'], 1)
            self.assertEqual((await request('PUT', prefix + '/priority', {'url': 'javascript:bad', 'pinned': True}))[0], 422)
            too_many = ','.join(f'word{i}' for i in range(501))
            self.assertEqual((await request('GET', prefix + '/items?mode=included&include=' + too_many))[0], 422)
            self.assertEqual((await request('GET', prefix + '/items?mode=invalid'))[0], 422)
            self.assertEqual((await request('POST', prefix + '/refresh'))[0], 202)
            history_result = {'searched': 1, 'cached': 0, 'found': 1, 'unsupported': [], 'errors': []}
            with patch('storage.news_flow.history.NewsHistory.search', return_value=history_result) as search:
                status, body = await request('POST', prefix + '/history', {'start': self.now - 86400000, 'end': self.now, 'source': ['reuters']})
                self.assertEqual(status, 200); self.assertEqual(body, history_result)
                search.assert_called_once_with(self.now - 86400000, self.now, ['reuters'], False)
            for body in ({'start': self.now, 'end': self.now}, {'start': 0, 'end': self.now}, {'start': -1, 'end': 1}):
                self.assertEqual((await request('POST', prefix + '/history', body))[0], 422)
        asyncio.run(run())
