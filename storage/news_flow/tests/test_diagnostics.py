import asyncio
from email.message import Message
from pathlib import Path
from tempfile import TemporaryDirectory
import time
import unittest
from unittest.mock import patch
from urllib.error import HTTPError

from storage.news_flow.collector import NewsCollector
from storage.news_flow.feeds import FeedResult
from storage.news_flow.store import NewsStore
from storage.news_flow.tests.test_notifications import request


class NewsDiagnosticsTests(unittest.TestCase):
    def setUp(self):
        self.temp = TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.store = NewsStore(Path(self.temp.name))
        self.source = self.store.sources()[0]
        self.now = int(time.time() * 1000) // 60000 * 60000 + 1000

    def record(self, at, status=200, **extra):
        self.store.fetch_timing(self.source, 125, 250, {'http_status': status, **extra}, at-125, at)

    def test_minute_rollups_retention_and_edited_feed_isolation(self):
        self.record(self.now, item_count=100, cache_age=32)
        self.record(self.now+1000, 304)
        self.record(self.now+2000, 429, failed=True)
        self.record(self.now+3000, None, failed=True)
        result = self.store.diagnostics(self.source['id'], self.now+4000)
        row = result['checks'][0]
        self.assertEqual((row['ok'], row['unchanged'], row['limited'], row['errors']), (1, 1, 1, 1))
        self.assertEqual(row['item_count'], 100)
        self.assertEqual(row['max_queue_ms'], 250)
        self.assertEqual(len(result['checks']), 1, 'Repeated one-second checks occupy one row per source/minute')
        self.record(self.now+86400000+61000)
        with self.store.database() as db:
            self.assertEqual(db.execute('SELECT count(*) FROM feed_checks').fetchone()[0], 1)
        self.store.save_source('Edited', 'https://example.com/new-feed', self.source['id'])
        self.assertEqual(self.store.diagnostics(self.source['id'], self.now+86400000+62000)['checks'], [])
        self.record(self.now+86400000+63000)
        self.assertEqual(self.store.diagnostics(self.source['id'], self.now+86400000+64000)['checks'], [], 'An old in-flight response cannot contaminate the edited URL')

    def test_prior_success_is_frozen_on_live_discovery_and_unavailable_for_history(self):
        item = {'identity': 'one', 'title': 'Oil surprise', 'url': 'https://example.com/one',
                'summary': '', 'publisher': 'Reuters', 'published_at': self.now-1800000}
        self.store.success(self.source, [], '', '', self.now)
        self.store.success(self.source, [item], '', '', self.now+3000)
        row = self.store.query()['items'][0]
        self.assertEqual(row['previous_check_at'], self.now)
        self.assertEqual(row['first_seen'], self.now+3000)
        self.store.success(self.source, [{**item, 'title': 'Oil revised'}], '', '', self.now+5000)
        row = self.store.query()['items'][0]
        self.assertEqual(row['previous_check_at'], self.now, 'Later edits do not overwrite collection evidence')
        self.assertEqual(row['first_seen'], self.now+3000)
        self.store.success(self.source, [{**item, 'identity': 'archive', 'url': 'https://example.com/archive'}], '', '', self.now+6000, update_status=False)
        archived = next(row for row in self.store.query()['items'] if row['identity'] == 'archive')
        self.assertIsNone(archived['previous_check_at'])
        with self.store.database() as db:
            db.execute('ALTER TABLE items DROP COLUMN previous_check_at')
        self.assertTrue(all(row['previous_check_at'] is None for row in NewsStore(self.store.path.parent.parent).query()['items']), 'Legacy rows migrate with unknown evidence, never fabricated timestamps')

    def test_http_metadata_tuple_contract_and_collector_outcomes(self):
        headers = Message(); headers['Age'] = '34'; headers['Date'] = 'Mon, 16 Nov 2026 04:51:01 GMT'
        result = FeedResult([], 'etag', 'modified', headers=headers)
        self.assertEqual(result, ([], 'etag', 'modified'))
        self.assertEqual(result.diagnostics['cache_age'], 34)
        self.assertIsInstance(result.diagnostics['response_at'], int)
        collector = NewsCollector(self.store, lambda source: result)
        collector._fetch(self.source, 0)
        result = FeedResult(None, 'etag', 'modified', 304, headers)
        collector._fetch(self.source, 0)
        def limited(source):
            raise HTTPError(source['url'], 429, 'Too many requests', headers, None)
        collector.fetcher = limited
        collector._fetch(self.source, 0)
        rows = self.store.diagnostics(self.source['id'])['checks']
        self.assertEqual(sum(row['ok'] for row in rows), 1)
        self.assertEqual(sum(row['unchanged'] for row in rows), 1)
        self.assertEqual(sum(row['limited'] for row in rows), 1)

    def test_run_heartbeats_stops_and_diagnostics_api(self):
        with patch('storage.news_flow.store.time.time', return_value=self.now/1000):
            identity = self.store.collection_run()
        with patch('storage.news_flow.store.time.time', return_value=(self.now+30000)/1000):
            self.store.collection_run(identity)
        with patch('storage.news_flow.store.time.time', return_value=(self.now+40000)/1000):
            self.store.collection_run(identity, stopped=True)
        run = self.store.diagnostics(self.source['id'], self.now+50000)['runs'][0]
        self.assertEqual(run, {'started_at': self.now, 'heartbeat_at': self.now+40000, 'stopped_at': self.now+40000})
        from storage.app import create_app
        app = create_app(self.store.path.parent.parent, run_collector=False)
        # Existing ASGI helper has no query support; exercise validation directly
        # with a real query string in this small wrapper.
        original = app
        async def query_app(scope, receive, send):
            scope['query_string'] = b'source=reuters'
            await original(scope, receive, send)
        self.assertEqual(asyncio.run(request(query_app, 'GET', '/api/v1/news-flow/diagnostics'))[0], 200)
        self.assertEqual(asyncio.run(request(app, 'GET', '/api/v1/news-flow/diagnostics'))[0], 422)
