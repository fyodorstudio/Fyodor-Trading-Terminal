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
from collections import OrderedDict
from datetime import datetime, timezone
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
    """Use only the requested broker day, never a neighbouring trading candle."""
    current = next((bar for bar in rates if int(bar['time']) == day), None)
    opening = float(current['open']) if current is not None else None
    high = float(current['high']) if current is not None else None
    low = float(current['low']) if current is not None else None
    close = float(current['close']) if current is not None and 'close' in (current.dtype.names if hasattr(current, 'dtype') else current) else None
    valid = lambda value: value is not None and math.isfinite(value) and value > 0
    return {'open': opening if valid(opening) else None,
            'high': high if valid(high) and valid(low) and high >= low else None,
            'low': low if valid(high) and valid(low) and high >= low else None,
            'close': close if valid(close) and valid(high) and valid(low) and low <= close <= high else None}


class DailyMarketWatch:
    def __init__(self, fetch_health=None, read=None, clock=time.time):
        self.fetch_health = fetch_health or self._health
        self.read = read or self._read
        self.clock = clock
        self.lock = threading.Lock()
        self.cache = {}
        self.days = OrderedDict()
        self.live_day = None
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

    def snapshot(self, source_id, generation, symbols, selected, date=None, retry=False):
        # One native reader at a time; bounded subprocess also isolates MT5 hangs.
        with self.lock:
            health = self.fetch_health()
            if (source_id != 'Pepperstone-Demo' or not health.get('connected')
                    or not health.get('process_running') or health.get('account_server') != source_id
                    or health.get('generation') != generation or not health.get('terminal_path')):
                raise ValueError('Connected Pepperstone source does not match daily candle request')
            identity = {key: health.get(key) for key in ('terminal_path', 'account_login', 'account_server', 'generation')}
            today = broker_day(self.clock())
            if today != self.live_day:
                # A formerly live candle must be reread after its completion.
                self.days.pop(self.live_day, None)
                self.live_day = today
            day = int(datetime.combine(date, datetime.min.time(), timezone.utc).timestamp()) if date else today
            if day > today:
                raise ValueError('Future daily candles are unavailable')
            historical = day < today
            key = tuple(identity.items())
            if key != self.identity:
                self.identity = key
                self.days.clear()
            self.cache = self.days.setdefault(day, {})
            self.days.move_to_end(day)
            while len(self.days) > 8:
                self.days.popitem(last=False)
            now = self.clock()
            # Rotate old live records within each priority group, so the bounded
            # native reader cannot starve later symbols in a large catalog.
            ordered = [selected, *sorted(dict.fromkeys(symbols), key=lambda symbol:
                (min(priority(symbol), 7), self.cache.get(symbol, {}).get('checked_at', 0), priority(symbol)))]
            needed = [symbol for symbol in dict.fromkeys(ordered) if symbol and (
                symbol not in self.cache
                or any(self.cache[symbol].get(field) is None for field in ('open', 'high', 'low'))
                and (retry or (not historical or self.cache[symbol].get('availability') != 'no_candle')
                     and now - self.cache[symbol]['checked_at'] >= 60)
                or not historical and self.cache[symbol].get('open') is not None
                and now - self.cache[symbol]['checked_at'] >= (5 if symbol == selected else 15))]
            if needed:
                records = self.read(identity, needed, day)
                after = self.fetch_health()
                if (not after.get('connected') or not after.get('process_running')
                        or any(after.get(key) != value for key, value in identity.items()) or broker_day(self.clock()) != today):
                    self.days.clear()
                    raise ValueError('Daily candle source changed during read')
                wanted = set(needed)
                for symbol, record in records.items():
                    if symbol in wanted:
                        self.cache[symbol] = {**record, 'checked_at': now}
            return {'source_id': source_id, 'generation': generation, 'day': day,
                    'observed_at': self.clock(), 'symbols': {symbol: self.cache[symbol] for symbol in symbols if symbol in self.cache}}
