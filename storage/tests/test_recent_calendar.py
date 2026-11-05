import asyncio
import json
from datetime import datetime, timezone
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest import TestCase
from urllib.parse import urlencode

from storage.app import create_app
from storage.calendar_store import CalendarStore
from storage.recent_calendar import recent_snapshot
from test_calendar_storage import event


class RecentCalendarTests(TestCase):
    def setUp(self):
        self.temp = TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.store = CalendarStore(Path(self.temp.name) / 'calendar.sqlite3')
        self.addCleanup(self.store.close)
        self.end = int(datetime(2026, 11, 4, 18, tzinfo=timezone.utc).timestamp()) * 1000
        self.start = self.end - 3 * 86400000
        manifest = {'calendar_from_timestamp': '1420070400', 'calendar_to_timestamp': '1800000000',
                    'calendar_currencies': 'EUR,USD,JPY', 'snapshot_trade_server_timestamp': str(self.end // 1000 + 10800),
                    'snapshot_gmt_timestamp': str(self.end // 1000)}
        rows = [event(value_id=str(i), currency=currency, server_time_seconds=at // 1000 + 10800,
                      time_mode=mode, actual=actual, forecast=.2)
                for i, currency, at, mode, actual in [
                    (1, 'EUR', self.start - 1000, 0, .1), (2, 'USD', self.start, 0, .1),
                    (3, 'EUR', self.end - 3600000, 0, None), (4, 'JPY', self.end, 0, .1),
                    (5, 'USD', self.end + 1000, 0, .1), (6, 'USD', self.end, 0, 0),
                    (7, 'EUR', self.end - 3600000, 1, None), (8, 'USD', self.end - 3600000, 3, .5)]]
        for source in ('Unknown-Broker', 'Pepperstone-Demo'):
            self.store.import_rows(source, source, manifest, {}, rows)

    def test_utc_bounds_pair_scope_all_series_order_and_no_writes(self):
        statements = []
        before = self.store.db.total_changes
        self.store.db.set_trace_callback(statements.append)
        snapshot = recent_snapshot(self.store, 'Unknown-Broker', self.start, self.end, ['EUR', 'USD'])
        self.store.db.set_trace_callback(None)
        self.assertTrue(snapshot['source_available'])
        self.assertEqual([row['value_id'] for row in snapshot['events']], ['6', '3', '8', '2'])
        self.assertEqual(snapshot['events'][0]['actual'], 0)
        self.assertIsNone(snapshot['events'][1]['actual'], 'Elapsed rows need not have actuals yet')
        self.assertTrue(all(row['chart_time_seconds'] is None for row in snapshot['events']),
                        'Captured publication UTC works even without a historical chart profile')
        self.assertEqual(self.store.db.total_changes, before)
        reads = [sql for sql in statements if 'SELECT e.*' in sql]
        self.assertEqual(len(reads), 1)
        plan = ' '.join(row[3] for row in self.store.db.execute('EXPLAIN QUERY PLAN ' + reads[0]))
        self.assertIn('events_range', plan)
        self.assertIn('server_time>?', plan)
        missing = recent_snapshot(self.store, 'Missing', self.start, self.end, ['EUR'])
        self.assertFalse(missing['source_available'])
        self.assertEqual(missing['events'], [])

    def test_api_interval_currency_validation_and_broker_isolation(self):
        async def run():
            app = create_app(Path(self.temp.name), run_collector=False)
            async def get(**overrides):
                params = dict(source_id='Pepperstone-Demo', from_utc_ms=self.start, to_utc_ms=self.end, currencies='EUR,USD')
                params.update(overrides)
                received = []
                async def receive():
                    return {'type': 'http.request', 'body': b''}
                async def send(message):
                    received.append(message)
                await app({'type': 'http', 'method': 'GET', 'path': '/api/v1/recent-calendar',
                           'query_string': urlencode(params).encode(), 'headers': []}, receive, send)
                status = next(item['status'] for item in received if item['type'] == 'http.response.start')
                body = json.loads(b''.join(item.get('body', b'') for item in received))
                return status, body
            async with app.router.lifespan_context(app):
                status, data = await get()
                self.assertEqual(status, 200)
                self.assertEqual(data['source_id'], 'Pepperstone-Demo')
                self.assertEqual(len(data['events']), 4)
                self.assertTrue(all(row['chart_time_seconds'] is not None for row in data['events']))
                for overrides in [dict(from_utc_ms=self.end), dict(from_utc_ms=self.end - 31 * 86400000 - 1),
                                  dict(currencies='EUR,EUR'), dict(currencies='BTC'), dict(currencies='USD,btc')]:
                    self.assertEqual((await get(**overrides))[0], 422)
                self.assertEqual((await get(from_utc_ms=self.end - 31 * 86400000))[0], 200)
                status, upcoming = await get(from_utc_ms=self.end + 1, to_utc_ms=self.end + 3 * 86400000)
                self.assertEqual(status, 200)
                self.assertEqual([row['value_id'] for row in upcoming['events']], ['5'])
        asyncio.run(run())
