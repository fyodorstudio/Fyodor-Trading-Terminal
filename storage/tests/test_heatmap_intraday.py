import asyncio
import json
import unittest
from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import patch

from storage.app import create_app
from storage.calendar_clock import broker_offset
from storage.heatmap_intraday import HeatmapIntraday
from storage.heatmap_worker import read_history


class IntradayTests(unittest.TestCase):
    def setUp(self):
        self.now = int(datetime(2026, 11, 12, 12, tzinfo=timezone.utc).timestamp())
        self.health = dict(connected=True, process_running=True, account_server='Pepperstone-Demo',
                           account_login=7, terminal_path='C:/MT5/terminal64.exe', generation=2)
        self.calls = []

    def reader(self, identity, symbols, starts, end):
        self.calls.append((identity, symbols, starts, end))
        return {s: dict(bars=[dict(time=self.now-60, open=100, high=102, low=99, close=101)], availability='available') for s in symbols}

    def service(self, read=None):
        return HeatmapIntraday(lambda: dict(self.health), read or self.reader, lambda: self.now)

    def snapshot(self, service, symbols=None, retry=False, start=None, end=None):
        return service.snapshot('Pepperstone-Demo', 2, symbols or ['EURUSD'], start or self.now-3600, end or self.now+3600, retry)

    def test_batches_bounds_source_change_and_retained_failure(self):
        service, symbols = self.service(), [f'R{i}' for i in range(30)]
        self.assertEqual(self.snapshot(service, symbols)['pending'], 18)
        self.assertEqual(self.snapshot(service, symbols)['pending'], 6)
        complete = self.snapshot(service, symbols)
        self.assertEqual(len(complete['symbols']), 30)
        self.assertEqual(len(self.calls), 3)
        self.assertTrue(all(len(call[1]) <= 12 for call in self.calls))
        self.assertEqual(self.calls[0][2]['R0'], self.now-3600-3*86400)
        self.snapshot(service, symbols)
        self.assertEqual(len(self.calls), 3)
        first = complete['symbols']['R0']
        self.now += 60
        service.read = lambda *args: {'R0': dict(bars=[], availability='unavailable')}
        failed = self.snapshot(service, ['R0'], start=self.now-3660, end=self.now+3540)['symbols']['R0']
        self.assertEqual(failed['bars'], first['bars'])
        self.assertEqual(failed['checked_at'], first['checked_at'])
        self.assertEqual(failed['availability'], 'unavailable')
        self.health['account_login'] = 99
        self.assertEqual(self.snapshot(service, ['R0'])['symbols']['R0']['bars'], [])
        self.health['connected'] = False
        with self.assertRaises(ValueError):
            self.snapshot(service)

    def test_post_read_guard_and_input_validation(self):
        def changed(*args):
            result = self.reader(*args)
            self.health['account_login'] += 1
            return result
        service = self.service(changed)
        with self.assertRaises(ValueError):
            self.snapshot(service)
        self.assertFalse(service.years)
        service = self.service()
        for start, end in [(self.now, self.now), (self.now, self.now+73*3600), (self.now+60, self.now+120), (self.now-61, self.now)]:
            with self.subTest(start=start, end=end), self.assertRaises(ValueError):
                self.snapshot(service, start=start, end=end)
        with self.assertRaises(ValueError):
            self.snapshot(service, ['X'*129])
        for i in range(6):
            self.snapshot(service, start=self.now-3600-i*60, end=self.now-i*60)
        self.assertEqual(len(service.years), 4)

    def test_native_minute_clock_conversion_and_visibility(self):
        reads = []
        for month in [7, 11]:
            utc = int(datetime(2026, month, 12, 12, tzinfo=timezone.utc).timestamp())
            wall = utc + broker_offset('Pepperstone-Demo', utc)
            native = SimpleNamespace(TIMEFRAME_M1=1, initialize=lambda **_: True,
                account_info=lambda: SimpleNamespace(server='Pepperstone-Demo', login=7),
                terminal_info=lambda: SimpleNamespace(connected=True),
                symbols_get=lambda: [SimpleNamespace(name='EURUSD', visible=True)],
                copy_rates_range=lambda *args: reads.append(args) or [dict(time=wall, open=100, high=102, low=99, close=101)],
                shutdown=lambda: None)
            request = dict(identity=self.health, symbols=['EURUSD','HIDDEN'], starts={'EURUSD':wall-60,'HIDDEN':wall-60},
                           end=wall+60, intraday=True, utc_from=utc, utc_through=utc+60)
            result = read_history(native, request)
            self.assertEqual(result['EURUSD']['bars'][0]['time'], utc)
            self.assertEqual(result['HIDDEN']['availability'], 'not_visible')
            self.assertEqual(reads[-1][1], 1)
            request['utc_through'] = utc
            self.assertEqual(read_history(native, request)['EURUSD']['bars'], [])

    def test_api(self):
        with patch('storage.app.HeatmapIntraday', return_value=self.service()):
            app = create_app(run_collector=False)
        async def request(payload):
            messages = []
            async def receive():
                return dict(type='http.request', body=json.dumps(payload).encode(), more_body=False)
            async def send(message):
                messages.append(message)
            await app(dict(type='http', method='POST', path='/api/v1/heatmap/intraday', query_string=b'',
                headers=[(b'content-type', b'application/json')], scheme='http', server=('test', 80), client=('test', 1), http_version='1.1'), receive, send)
            return messages[0]['status'], json.loads(messages[1]['body'])
        payload = dict(source_id='Pepperstone-Demo', generation=2, from_utc=self.now-3600, through_utc=self.now, symbols=['EURUSD'])
        status, body = asyncio.run(request(payload))
        self.assertEqual(status, 200)
        self.assertEqual(body['from_utc'], payload['from_utc'])
        self.assertEqual(asyncio.run(request({**payload, 'generation':3}))[0], 503)
        self.assertEqual(asyncio.run(request({**payload, 'symbols':['X']*129}))[0], 422)
