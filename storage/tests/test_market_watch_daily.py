import asyncio
import json
import unittest
from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import patch

from storage.app import create_app
from storage.market_watch_daily import DailyMarketWatch, broker_day, daily_record
from storage.market_watch_daily_worker import read_daily


class DailyMarketTests(unittest.TestCase):
    def setUp(self):
        self.now = 1791547200  # 2026-10-09 noon UTC, Pepperstone summer clock
        self.day = broker_day(self.now)
        self.health = {'connected': True, 'process_running': True, 'account_server': 'Pepperstone-Demo',
                       'account_login': 7, 'terminal_path': 'C:/MT5/terminal64.exe', 'generation': 2}
        self.calls = []

    def reader(self, identity, symbols, day):
        self.calls.append((identity, symbols, day))
        return {symbol: {'open': 1.1, 'high': 1.12, 'low': 1.09} for symbol in symbols}

    def service(self, read=None):
        return DailyMarketWatch(lambda: dict(self.health), read or self.reader, lambda: self.now)

    def snapshot(self, service, selected='EURUSD', symbols=None):
        return service.snapshot('Pepperstone-Demo', 2, symbols or ['EURUSD', 'NZDUSD'], selected)

    def test_exact_day_open_extremes_weekend_and_missing_history(self):
        bars = [{'time': self.day - 4 * 86400, 'close': 1.08},
                {'time': self.day - 86400, 'close': 1.1},
                {'time': self.day, 'open': 1.105, 'close': 1.11, 'high': 1.12, 'low': 1.104}]
        self.assertEqual(daily_record(bars, self.day), {'open': 1.105, 'high': 1.12, 'low': 1.104})
        self.assertEqual(daily_record(bars[:-1], self.day), {'open': None, 'high': None, 'low': None})
        self.assertEqual(daily_record([], self.day), {'open': None, 'high': None, 'low': None})
        self.assertIsNone(daily_record([{**bars[-1], 'open': float('nan')}], self.day)['open'])

    def test_cache_bounded_work_selected_refresh_and_rollover(self):
        service = self.service()
        names = [f'TEST{i}' for i in range(2000)]
        self.snapshot(service, 'TEST0', names)
        self.assertEqual(len(self.calls[0][1]), 2000)
        self.snapshot(service, 'TEST0', names)
        self.assertEqual(len(self.calls), 1, 'Unchanged requests do no native work')
        self.now += 5
        self.snapshot(service, 'TEST0', names)
        self.assertEqual(self.calls[-1][1], ['TEST0'], 'Quote polling never rereads the whole D1 catalog')
        self.now += 86400
        self.snapshot(service, 'TEST0', names)
        self.assertEqual(len(self.calls[-1][1]), 2000, 'A new broker day loads its own candles')

    def test_live_extremes_refresh_for_all_symbols_and_history_does_not_evict_today(self):
        service = self.service()
        self.snapshot(service)
        self.now += 15
        self.snapshot(service)
        self.assertEqual(self.calls[-1][1], ['EURUSD', 'NZDUSD'])
        old = datetime.fromtimestamp(self.day - 86400, timezone.utc).date()
        result = service.snapshot('Pepperstone-Demo', 2, ['EURUSD'], 'EURUSD', old)
        self.assertEqual(result['day'], self.day - 86400)
        reads = len(self.calls)
        service.snapshot('Pepperstone-Demo', 2, ['EURUSD'], 'EURUSD', old)
        self.snapshot(service)
        self.assertEqual(len(self.calls), reads, 'Complete historical days and the live cache are reused')
        future = datetime.fromtimestamp(self.day + 86400, timezone.utc).date()
        with self.assertRaises(ValueError):
            service.snapshot('Pepperstone-Demo', 2, ['EURUSD'], 'EURUSD', future)
        for offset in range(1, 12):
            date = datetime.fromtimestamp(self.day - offset * 86400, timezone.utc).date()
            service.snapshot('Pepperstone-Demo', 2, ['EURUSD'], 'EURUSD', date)
        self.assertEqual(len(service.days), 8, 'Historical cache has a fixed day bound')

    def test_completed_day_is_reread_after_rollover(self):
        service = self.service()
        self.snapshot(service)
        old = datetime.fromtimestamp(self.day, timezone.utc).date()
        self.now += 86400
        service.snapshot('Pepperstone-Demo', 2, ['EURUSD'], 'EURUSD', old)
        self.assertEqual(len(self.calls), 2, 'Yesterday’s partial live extremes cannot become its final historical values')

    def test_partial_batch_missing_retry_and_source_guard(self):
        service = self.service(lambda *_: {'EURUSD': {'open': None, 'high': None, 'low': None}})
        result = self.snapshot(service)
        self.assertNotIn('NZDUSD', result['symbols'], 'Incomplete batches stay unavailable and can be retried')
        for patch_value in [{'generation': 3}, {'account_server': 'Other'}, {'connected': False}, {'process_running': False}]:
            original = dict(self.health)
            self.health.update(patch_value)
            with self.assertRaises(ValueError):
                self.snapshot(service)
            self.health = original
        def changed(*args):
            result = self.reader(*args)
            self.health['account_login'] = 8
            return result
        with self.assertRaises(ValueError):
            self.snapshot(self.service(changed))

    def test_native_priority_and_rollover_during_read(self):
        service = self.service()
        self.snapshot(service, 'EURJPY', ['AAPL.US', 'NZDUSD', 'EURJPY', 'GBPUSD'])
        self.assertEqual(self.calls[0][1], ['EURJPY', 'GBPUSD', 'NZDUSD', 'AAPL.US'])
        def rollover(*args):
            records = self.reader(*args)
            self.now += 86400
            return records
        with self.assertRaises(ValueError):
            self.snapshot(self.service(rollover))

    def test_native_reads_only_visible_symbols_and_never_mutates_account(self):
        native = SimpleNamespace(TIMEFRAME_D1=24, initialize=lambda **_: True,
            account_info=lambda: SimpleNamespace(server='Pepperstone-Demo', login=7),
            terminal_info=lambda: SimpleNamespace(connected=True),
            symbols_get=lambda: [SimpleNamespace(name='EURUSD', visible=True), SimpleNamespace(name='HIDDEN', visible=False)],
            shutdown=lambda: None)
        reads = []
        native.copy_rates_range = lambda *args: reads.append(args) or [{'time': self.day - 86400, 'close': 1.1}]
        result = read_daily(native, {'identity': self.health, 'symbols': ['EURUSD', 'HIDDEN'], 'day': self.day})
        self.assertEqual(reads, [('EURUSD', 24, datetime.fromtimestamp(self.day, timezone.utc),
                                 datetime.fromtimestamp(self.day + 86399, timezone.utc))])
        self.assertIsNone(result['EURUSD']['open'], 'A neighbouring candle is not the requested day')
        self.assertEqual(list(result), ['EURUSD'])
        native.account_info = lambda: SimpleNamespace(server='Other', login=7)
        with self.assertRaises(ValueError):
            read_daily(native, {'identity': self.health, 'symbols': ['EURUSD'], 'day': self.day})
        self.assertEqual(len(reads), 1)

    def test_api_contract_validation_and_unavailable(self):
        with patch('storage.app.DailyMarketWatch', return_value=self.service()):
            app = create_app(run_collector=False)
        async def request(payload):
            messages = []
            async def receive():
                return {'type': 'http.request', 'body': json.dumps(payload).encode(), 'more_body': False}
            async def send(message):
                messages.append(message)
            await app({'type': 'http', 'method': 'POST', 'path': '/api/v1/market-watch/daily', 'query_string': b'',
                       'headers': [(b'content-type', b'application/json')], 'scheme': 'http', 'server': ('test', 80),
                       'client': ('test', 1), 'http_version': '1.1'}, receive, send)
            return messages[0]['status'], json.loads(messages[1]['body'])
        payload = {'source_id': 'Pepperstone-Demo', 'generation': 2, 'symbols': ['EURUSD'], 'selected': 'EURUSD'}
        status, body = asyncio.run(request(payload))
        self.assertEqual(status, 200)
        self.assertEqual(body['symbols']['EURUSD']['open'], 1.1)
        old = datetime.fromtimestamp(self.day - 86400, timezone.utc).date().isoformat()
        status, body = asyncio.run(request({**payload, 'date': old}))
        self.assertEqual(status, 200)
        self.assertEqual(body['day'], self.day - 86400)
        self.assertEqual(asyncio.run(request({**payload, 'date': 'invalid'}))[0], 422)
        self.assertEqual(asyncio.run(request({**payload, 'symbols': ['x' * 129]}))[0], 422)
        self.health['connected'] = False
        self.assertEqual(asyncio.run(request(payload))[0], 503)


if __name__ == '__main__':
    unittest.main()
