"""Read-only D1 enrichment outside the frozen bridge; no account or symbol writes."""
from __future__ import annotations

import json
import math
import os
from pathlib import Path
import subprocess
import sys
import threading
import time
from urllib.request import urlopen

from .calendar_clock import broker_offset
from .currencies import CURRENCIES

MAJORS = ('EURUSD', 'GBPUSD', 'USDJPY', 'USDCHF', 'AUDUSD', 'USDCAD', 'NZDUSD')


def priority(symbol):
    if symbol in MAJORS:
        return MAJORS.index(symbol)
    return 7 if len(symbol) == 6 and symbol[:3] in CURRENCIES and symbol[3:] in CURRENCIES else 8


def broker_day(now):
    offset = broker_offset('Pepperstone-Demo', now)
    if offset is None:
        raise ValueError('Pepperstone daily clock unavailable')
    return int((now + offset) // 86400) * 86400


def daily_record(rates, day):
    """Only completed D1 bars anchor change; older bars never supply today's range."""
    bars = sorted(rates, key=lambda bar: int(bar['time']))
    completed = [bar for bar in bars if int(bar['time']) < day]
    current = next((bar for bar in bars if int(bar['time']) == day), None)
    close = float(completed[-1]['close']) if completed else None
    high = float(current['high']) if current is not None else None
    low = float(current['low']) if current is not None else None
    valid = lambda value: value is not None and math.isfinite(value) and value > 0
    return {'previous_close': close if valid(close) else None,
            'high': high if valid(high) and valid(low) and high >= low else None,
            'low': low if valid(high) and valid(low) and high >= low else None}


class DailyMarketWatch:
    def __init__(self, fetch_health=None, read=None, clock=time.time):
        self.fetch_health = fetch_health or self._health
        self.read = read or self._read
        self.clock = clock
        self.lock = threading.Lock()
        self.cache = {}
        self.identity = None

    @staticmethod
    def _health():
        root = os.environ.get('FYODOR_BRIDGE_API_URL', 'http://127.0.0.1:8001').rstrip('/')
        with urlopen(root + '/api/v1/health', timeout=2) as response:
            return json.load(response)['mt5']

    @staticmethod
    def _read(identity, symbols, day):
        request = {'identity': identity, 'symbols': symbols, 'day': day}
        result = subprocess.run([sys.executable, '-m', 'storage.market_watch_daily_worker'],
                                input=json.dumps(request), text=True, capture_output=True, timeout=18,
                                cwd=Path(__file__).resolve().parents[1],
                                creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0))
        if result.returncode:
            raise ValueError('Daily candle reader unavailable')
        return json.loads(result.stdout)

    def snapshot(self, source_id, generation, symbols, selected):
        # One native reader at a time; bounded subprocess also isolates MT5 hangs.
        with self.lock:
            health = self.fetch_health()
            if (source_id != 'Pepperstone-Demo' or not health.get('connected')
                    or not health.get('process_running') or health.get('account_server') != source_id
                    or health.get('generation') != generation or not health.get('terminal_path')):
                raise ValueError('Connected Pepperstone source does not match daily candle request')
            identity = {key: health.get(key) for key in ('terminal_path', 'account_login', 'account_server', 'generation')}
            day = broker_day(self.clock())
            key = (tuple(identity.items()), day)
            if key != self.identity:
                self.identity, self.cache = key, {}
            now = self.clock()
            ordered = [selected, *sorted(dict.fromkeys(symbols), key=priority)]
            needed = [symbol for symbol in dict.fromkeys(ordered) if symbol and (
                symbol not in self.cache or self.cache[symbol]['previous_close'] is None and now - self.cache[symbol]['checked_at'] >= 60
                or symbol == selected and now - self.cache[symbol]['checked_at'] >= 5)]
            if needed:
                records = self.read(identity, needed, day)
                after = self.fetch_health()
                if (not after.get('connected') or not after.get('process_running')
                        or any(after.get(key) != value for key, value in identity.items()) or broker_day(self.clock()) != day):
                    self.cache = {}
                    raise ValueError('Daily candle source changed during read')
                wanted = set(needed)
                for symbol, record in records.items():
                    if symbol in wanted:
                        self.cache[symbol] = {**record, 'checked_at': now}
            return {'source_id': source_id, 'generation': generation, 'day': day,
                    'observed_at': self.clock(), 'symbols': {symbol: self.cache[symbol] for symbol in symbols if symbol in self.cache}}
