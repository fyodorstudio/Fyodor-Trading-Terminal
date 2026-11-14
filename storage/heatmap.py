"""Bounded, read-only broker D1 history for the heatmap heatmap."""
from __future__ import annotations

import hashlib
import json
from collections import OrderedDict
from datetime import datetime, timedelta, timezone
from pathlib import Path
import subprocess
import sys
import threading
import time

from .market_watch_daily import DailyMarketWatch, broker_day


class HeatmapHistory:
    def __init__(self, fetch_health=None, read=None, clock=time.time):
        self.fetch_health = fetch_health or DailyMarketWatch._health
        self.read = read or self._read
        self.clock = clock
        self.lock = threading.Lock()
        self.identity = None
        self.years = OrderedDict()

    @staticmethod
    def _read(identity, symbols, starts, end):
        result = subprocess.run([sys.executable, '-m', 'storage.heatmap_worker'],
            input=json.dumps(dict(identity=identity, symbols=symbols, starts=starts, end=end)),
            text=True, capture_output=True, timeout=18,
            cwd=Path(__file__).resolve().parents[1],
            creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0))
        if result.returncode:
            raise ValueError('Heatmap candle reader unavailable')
        return json.loads(result.stdout)

    def snapshot(self, source_id, generation, symbols, year, retry=False):
        if not 2015 <= year <= datetime.fromtimestamp(broker_day(self.clock()), timezone.utc).year:
            raise ValueError('Unsupported heatmap year')
        names = list(dict.fromkeys(symbols))
        if len(names) > 128 or any(not isinstance(s, str) or not s or len(s) > 128 for s in names):
            raise ValueError('Invalid heatmap symbols')
        with self.lock:
            health = self.fetch_health()
            if (source_id != 'Pepperstone-Demo' or not health.get('connected')
                    or not health.get('process_running') or health.get('account_server') != source_id
                    or health.get('generation') != generation or not health.get('terminal_path')):
                raise ValueError('Connected source does not match heatmap request')
            identity = {key: health.get(key) for key in ('terminal_path', 'account_login', 'account_server', 'generation')}
            key = tuple(identity.items())
            if self.identity != key:
                self.years.clear()
                self.identity = key
            today, now = broker_day(self.clock()), self.clock()
            start = int(datetime(year, 1, 1, tzinfo=timezone.utc).timestamp()) - 400 * 86400
            final_day = datetime(year, 12, 31, tzinfo=timezone.utc)
            week_end = final_day + timedelta(days=6 - final_day.weekday())
            end = min(int(week_end.timestamp()) + 86399, today + 86399)
            cache = self.years.setdefault(year, OrderedDict())
            self.years.move_to_end(year)
            while len(self.years) > 4:
                self.years.popitem(last=False)
            historical = end < today
            if retry:
                for symbol in names:
                    cache.pop(symbol, None)
            needed = [s for s in names if s not in cache or retry
                or cache[s]['live'] and cache[s]['day'] != today
                or now - cache[s].get('attempt_at', cache[s]['checked_at']) >= (60 if cache[s]['availability'] == 'unavailable'
                    else 3600 if historical else 20)]
            # Missing instruments first; then oldest reads. A large watchlist cannot starve its tail.
            needed.sort(key=lambda s: cache.get(s, {}).get('checked_at', 0))
            batch = needed[:12]
            records = {}
            if batch:
                starts = {s: max(start, today - 7 * 86400) if not retry and s in cache
                    and cache[s]['availability'] == 'available' and not historical else start for s in batch}
                records = self.read(identity, batch, starts, end)
                after = self.fetch_health()
                if (not after.get('connected') or not after.get('process_running')
                        or any(after.get(k) != v for k, v in identity.items()) or broker_day(self.clock()) != today):
                    self.years.clear()
                    raise ValueError('Heatmap source changed during read')
                for symbol in batch:
                    if symbol not in records:
                        continue  # Reader deadline reached; next request continues this batch.
                    record = records[symbol]
                    checked_at = now
                    if record['availability'] == 'unavailable' and symbol in cache:
                        record = {**record, 'bars': cache[symbol]['bars']}
                        checked_at = cache[symbol]['checked_at']
                    if starts[symbol] > start and record['availability'] != 'unavailable':
                        older = [b for b in cache[symbol]['bars'] if b['time'] < starts[symbol]]
                        record = {**record, 'bars': older + record['bars']}
                        if record['bars']:
                            record['availability'] = 'available'
                    cache[symbol] = {**record, 'checked_at': checked_at, 'attempt_at': now, 'day': today, 'live': not historical}
                    cache.move_to_end(symbol)
            # Bounded even if users repeatedly swap instruments within one calendar year.
            while len(cache) > 128:
                cache.popitem(last=False)
            selected = {s: {k: v for k, v in cache[s].items() if k not in ('day', 'live', 'attempt_at')}
                        for s in names if s in cache}
            pending = sum(s not in records for s in needed)
            revision = hashlib.sha256(json.dumps(selected, sort_keys=True, separators=(',', ':')).encode()).hexdigest()
            return dict(schema=1, source_id=source_id, generation=generation, year=year,
                today=datetime.fromtimestamp(today, timezone.utc).date().isoformat(),
                observed_at=self.clock(), revision=revision, pending=pending, symbols=selected)
