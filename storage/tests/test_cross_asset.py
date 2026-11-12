import asyncio
import json
import unittest
from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import patch

from storage.app import create_app
from storage.cross_asset import CrossAssetHistory
from storage.cross_asset_worker import read_history
from storage.market_watch_daily import broker_day


class CrossAssetTests(unittest.TestCase):
    def setUp(self):
        self.now = datetime(2026, 11, 12, 12, tzinfo=timezone.utc).timestamp()
        self.health = dict(connected=True, process_running=True, account_server='Pepperstone-Demo',
                           account_login=7, terminal_path='C:/MT5/terminal64.exe', generation=2)
        self.calls = []

    def reader(self, identity, symbols, starts, end):
        self.calls.append((identity, symbols, starts, end))
        return {s: dict(bars=[dict(time=min(broker_day(self.now), end // 86400 * 86400),
            open=100, high=102, low=99, close=101)], availability='available') for s in symbols}

    def service(self, read=None):
        return CrossAssetHistory(lambda: dict(self.health), read or self.reader, lambda: self.now)

    def snapshot(self, service, symbols=None, year=2026, retry=False):
        return service.snapshot('Pepperstone-Demo', 2, symbols or ['EURUSD'], year, retry)

    def test_bounded_reads_continue_and_unchanged_requests_do_no_native_work(self):
        service, names = self.service(), [f'TEST{i}' for i in range(35)]
        first = self.snapshot(service, names)
        self.assertEqual(len(self.calls[0][1]), 12)
        self.assertEqual(first['pending'], 23)
        self.snapshot(service, names)
        complete = self.snapshot(service, names)
        self.assertEqual(complete['pending'], 0)
        self.assertEqual(len(complete['symbols']), 35)
        self.assertEqual(len(self.calls), 3)
        self.assertEqual(self.snapshot(service, names)['revision'], complete['revision'])
        self.assertEqual(len(self.calls), 3)
        self.now += 21
        self.assertEqual(self.snapshot(service, names)['pending'], 23, 'Refresh continues through every expired instrument')
        self.assertEqual(list(self.calls[-1][2].values())[0], broker_day(self.now) - 7 * 86400, 'Live reads use a bounded tail')

    def test_history_padding_year_edge_and_retry_reloads_all_batches(self):
        service = self.service()
        self.snapshot(service, year=2025)
        _, _, starts, end = self.calls[-1]
        self.assertEqual(starts['EURUSD'], int(datetime(2025, 1, 1, tzinfo=timezone.utc).timestamp()) - 400 * 86400)
        self.assertEqual(datetime.fromtimestamp(end, timezone.utc).date().isoformat(), '2026-01-04', 'Final weekly column includes its January trading days')
        self.snapshot(service, year=2025)
        self.assertEqual(len(self.calls), 1)
        names = [f'ROW{i}' for i in range(30)]
        for _ in range(3):
            self.snapshot(service, names, year=2025)
        self.assertEqual(self.snapshot(service, names, year=2025, retry=True)['pending'], 18)
        for _ in range(2):
            self.snapshot(service, names, year=2025)
        self.assertTrue(all(set(c[2].values()) == {starts['EURUSD']} for c in self.calls[-3:]))

    def test_source_guards_before_and_after_read(self):
        for changes in [dict(generation=3), dict(account_server='Other'), dict(connected=False), dict(process_running=False)]:
            with self.subTest(changes=changes):
                original = self.health.copy()
                self.health.update(changes)
                with self.assertRaises(ValueError):
                    self.snapshot(self.service())
                self.health = original
        def changed(*args):
            result = self.reader(*args)
            self.health['account_login'] += 1
            return result
        service = self.service(changed)
        with self.assertRaises(ValueError):
            self.snapshot(service)
        self.assertFalse(service.years)
        def rollover(*args):
            result = self.reader(*args)
            self.now += 86400
            return result
        with self.assertRaises(ValueError):
            self.snapshot(self.service(rollover))

    def test_failed_refresh_preserves_history_and_its_success_clock(self):
        service = self.service()
        first = self.snapshot(service)['symbols']['EURUSD']
        self.now += 21
        service.read = lambda *_: {'EURUSD': dict(bars=[], availability='unavailable')}
        failed = self.snapshot(service)['symbols']['EURUSD']
        self.assertEqual(failed['bars'], first['bars'])
        self.assertEqual(failed['checked_at'], first['checked_at'])
        self.assertEqual(failed['availability'], 'unavailable')
        self.now += 20
        service.read = self.reader
        self.snapshot(service)
        self.assertEqual(len(self.calls), 1, 'Failure backoff uses the attempt clock')
        self.now += 41
        self.assertEqual(self.snapshot(service)['symbols']['EURUSD']['availability'], 'available')

    def test_rollover_rereads_final_close_and_cache_is_bounded(self):
        service = self.service()
        self.snapshot(service)
        self.now += 86400
        self.snapshot(service)
        self.assertEqual(len(self.calls), 2)
        for year in range(2015, 2025):
            self.snapshot(service, year=year)
        self.assertEqual(len(service.years), 4)
        for i in range(150):
            self.snapshot(service, [f'S{i}'], year=2025)
        self.assertEqual(len(service.years[2025]), 128)
        for year in [2014, 2027]:
            with self.assertRaises(ValueError):
                self.snapshot(service, year=year)

    def test_native_read_visibility_validation_and_no_account_writes(self):
        reads, shutdowns = [], []
        day = broker_day(self.now)
        rates = [dict(time=day, open=100, high=103, low=98, close=102),
                 dict(time=day - 86400, open=100, high=102, low=99, close=101),
                 dict(time=day - 2 * 86400, open=100, high=99, low=98, close=101)]
        native = SimpleNamespace(TIMEFRAME_D1=24, initialize=lambda **_: True,
            account_info=lambda: SimpleNamespace(server='Pepperstone-Demo', login=7),
            terminal_info=lambda: SimpleNamespace(connected=True),
            symbols_get=lambda: [SimpleNamespace(name='EURUSD', visible=True), SimpleNamespace(name='HIDDEN', visible=False)],
            copy_rates_range=lambda *args: reads.append(args) or rates,
            shutdown=lambda: shutdowns.append(True))
        request = dict(identity=self.health, symbols=['EURUSD', 'HIDDEN'], starts=dict(EURUSD=day-3*86400, HIDDEN=day), end=day+86399)
        result = read_history(native, request)
        self.assertEqual(len(reads), 1)
        self.assertEqual([b['close'] for b in result['EURUSD']['bars']], [101, 102])
        self.assertEqual(result['HIDDEN']['availability'], 'not_visible')
        self.assertEqual(shutdowns, [True])
        native.copy_rates_range = lambda *_: None
        self.assertEqual(read_history(native, request)['EURUSD']['availability'], 'unavailable')
        native.copy_rates_range = lambda *_: []
        self.assertEqual(read_history(native, request)['EURUSD']['availability'], 'no_history')
        native.account_info = lambda: SimpleNamespace(server='Other', login=7)
        with self.assertRaises(ValueError):
            read_history(native, request)

    def test_api_contract_and_validation(self):
        with patch('storage.app.CrossAssetHistory', return_value=self.service()):
            app = create_app(run_collector=False)
        async def request(payload):
            messages = []
            async def receive():
                return dict(type='http.request', body=json.dumps(payload).encode(), more_body=False)
            async def send(message):
                messages.append(message)
            await app(dict(type='http', method='POST', path='/api/v1/cross-asset/history', query_string=b'',
                headers=[(b'content-type', b'application/json')], scheme='http', server=('test', 80), client=('test', 1), http_version='1.1'), receive, send)
            return messages[0]['status'], json.loads(messages[1]['body'])
        payload = dict(source_id='Pepperstone-Demo', generation=2, year=2026, symbols=['EURUSD'])
        status, body = asyncio.run(request(payload))
        self.assertEqual(status, 200)
        self.assertEqual(body['today'], '2026-11-12')
        self.assertEqual(body['symbols']['EURUSD']['bars'][-1]['close'], 101)
        for invalid in [dict(year=2014), dict(symbols=[''] ), dict(symbols=['X'*129]), dict(symbols=['X']*129)]:
            self.assertEqual(asyncio.run(request({**payload, **invalid}))[0], 422)
        self.health['connected'] = False
        self.assertEqual(asyncio.run(request(payload))[0], 503)
