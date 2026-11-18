import asyncio
from datetime import datetime, timezone
import json
from pathlib import Path
from tempfile import TemporaryDirectory
from types import SimpleNamespace
import unittest
from unittest.mock import patch

from storage.app import create_app
from storage.calendar_clock import chart_utc
from storage.heatmap_baskets import HeatmapBaskets, basket_range


class BasketTests(unittest.TestCase):
    def setUp(self):
        self.day = '2026-11-18'
        self.wall = int(datetime(2026, 11, 18, tzinfo=timezone.utc).timestamp())
        self.start = chart_utc('Pepperstone-Demo', self.wall)
        self.now = self.start + 240
        self.pairs = {p: p + '.a' for p in ('EURUSD', 'GBPUSD', 'AUDUSD', 'NZDUSD', 'USDCAD', 'USDCHF', 'USDJPY')}
        self.daily, self.minutes = {}, {}
        for pair, symbol in self.pairs.items():
            prices = [100 * (g if pair.startswith('USD') else 1 / g) for g in (1, 1.02, .99, 1.01)]
            self.daily[symbol] = dict(bars=[dict(time=self.wall - 86400, close=100), dict(time=self.wall, close=prices[-1])])
            self.minutes[symbol] = dict(availability='available', bars=[dict(time=self.start + i * 60,
                open=prices[max(0, i - 1)], close=price, high=500, low=1) for i, price in enumerate(prices)])
        self.health = dict(connected=True, process_running=True, account_server='Pepperstone-Demo',
                           account_login=7, terminal_path='C:/MT5/terminal64.exe', generation=2)
        self.calls = []
        self.reader = SimpleNamespace(fetch_health=lambda: dict(self.health), clock=lambda: self.now,
            snapshot=lambda *args: dict(symbols=self.daily, pending=0))

    def read(self, identity, names, starts, end):
        self.calls.append((names, starts, end))
        return {s: self.minutes[s] for s in names}

    def snapshot(self, service, **kwargs):
        return service.snapshot('Pepperstone-Demo', 2, self.pairs, ['USD'], [self.day], **kwargs)

    def test_synchronized_extrema_reverse_quotes_and_ignore_pair_wicks(self):
        point = basket_range('USD', self.pairs, self.daily, self.minutes, self.day, self.now)
        self.assertAlmostEqual(point['open'], 0)
        self.assertAlmostEqual(point['high'], 2)
        self.assertAlmostEqual(point['low'], -1)
        self.assertEqual(point['samples'], 4)
        self.assertEqual(point['previous'], '2026-11-17')
        self.assertNotIn('gaps', point['reason'])
        # A constituent's independent wick of 500 must not become a basket high.
        self.minutes[next(iter(self.minutes))]['bars'].pop(1)
        gapped = basket_range('USD', self.pairs, self.daily, self.minutes, self.day, self.now)
        self.assertEqual(gapped['samples'], 3)
        self.assertIn('gaps', gapped['reason'])
        self.assertAlmostEqual(gapped['high'], 2)  # Next minute's open still samples the peak.

    def test_missing_or_misaligned_baselines_and_no_synthetic_zero(self):
        symbol = next(iter(self.daily))
        self.daily[symbol]['bars'][0]['time'] -= 86400
        self.assertIsNone(basket_range('USD', self.pairs, self.daily, self.minutes, self.day, self.now)['open'])
        self.daily[symbol]['bars'][0]['time'] += 86400
        self.minutes[symbol]['bars'] = []
        self.assertIsNone(basket_range('USD', self.pairs, self.daily, self.minutes, self.day, self.now)['high'])

    def test_service_batches_caches_retries_and_guards_account(self):
        def partial(identity, names, starts, end):
            return self.read(identity, names[:3], starts, end)
        service = HeatmapBaskets(self.reader, partial)
        self.assertEqual(self.snapshot(service)['pending'], 1)
        self.assertEqual(self.snapshot(service)['pending'], 1)
        result = self.snapshot(service)
        self.assertEqual(result['pending'], 0)
        self.assertAlmostEqual(result['days'][self.day]['USD']['high'], 2)
        count = len(self.calls)
        self.snapshot(service)
        self.assertEqual(len(self.calls), count)
        service.read = self.read
        self.snapshot(service, retry=True)
        self.assertEqual(len(self.calls), count + 1)
        self.assertEqual(self.calls[-1][1][next(iter(self.pairs.values()))], self.start)
        self.health['connected'] = False
        with self.assertRaises(ValueError):
            self.snapshot(service)

    def test_failed_refresh_keeps_previous_range_and_post_read_guard(self):
        service = HeatmapBaskets(self.reader, self.read)
        good = self.snapshot(service)
        self.now += 30
        service.read = lambda identity, names, starts, end: {s: dict(availability='unavailable', bars=[]) for s in names}
        failed = self.snapshot(service)
        self.assertEqual(failed['days'][self.day]['USD']['high'], good['days'][self.day]['USD']['high'])
        self.assertIn('refresh failed', failed['days'][self.day]['USD']['reason'])
        def changed(*args):
            result = self.read(*args)
            self.health['account_login'] += 1
            return result
        service.read = changed
        with self.assertRaises(ValueError):
            self.snapshot(service, retry=True)
        self.assertFalse(service.cache)

    def test_api_bounds_and_scope(self):
        service = HeatmapBaskets(self.reader, self.read)
        with TemporaryDirectory() as root, patch('storage.app.HeatmapBaskets', return_value=service):
            app = create_app(Path(root), run_collector=False)
        async def request(payload):
            messages = []
            async def receive():
                return dict(type='http.request', body=json.dumps(payload).encode(), more_body=False)
            async def send(message):
                messages.append(message)
            await app(dict(type='http', method='POST', path='/api/v1/heatmap/baskets', query_string=b'',
                headers=[(b'content-type', b'application/json')], scheme='http', server=('test', 80), client=('test', 1), http_version='1.1'), receive, send)
            return messages[0]['status'], json.loads(messages[1]['body'])
        payload = dict(source_id='Pepperstone-Demo', generation=2, pairs=self.pairs, currencies=['USD'], days=[self.day])
        status, result = asyncio.run(request(payload))
        self.assertEqual(status, 200)
        self.assertEqual(result['sampling'], 'M1')
        self.assertEqual(asyncio.run(request({**payload, 'days': [self.day] * 43}))[0], 422)
        self.assertEqual(asyncio.run(request({**payload, 'generation': 3}))[0], 503)
