"""Bounded M1 event windows, with historical broker clocks converted to UTC."""
from collections import OrderedDict
import hashlib
import json
from pathlib import Path
import subprocess
import sys

from .calendar_clock import broker_offset
from .heatmap import HeatmapHistory


class HeatmapIntraday(HeatmapHistory):
    @staticmethod
    def _read(identity, symbols, starts, end):
        # Include all possible historical offsets in the native query; the worker
        # resolves each returned wall clock uniquely and clips in UTC.
        beginning = min(starts.values())
        if broker_offset(identity['account_server'], beginning) is None or broker_offset(identity['account_server'], end) is None:
            raise ValueError('Historical broker clock unavailable')
        request = dict(identity=identity, symbols=symbols, starts={s: starts[s] + 7200 for s in symbols},
                       end=end + 10800, intraday=True, utc_from=beginning, utc_through=end)
        result = subprocess.run([sys.executable, '-m', 'storage.heatmap_worker'],
            input=json.dumps(request), text=True, capture_output=True, timeout=18,
            cwd=Path(__file__).resolve().parents[1], creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0))
        if result.returncode:
            raise ValueError('Intraday candle reader unavailable')
        return json.loads(result.stdout)

    def snapshot(self, source_id, generation, symbols, from_utc, through_utc, retry=False):
        now = self.clock()
        if (not isinstance(from_utc, int) or not isinstance(through_utc, int)
                or from_utc % 60 or through_utc % 60 or not 60 <= through_utc-from_utc <= 72*3600
                or from_utc < 1420070400 or from_utc > now):
            raise ValueError('Choose a minute-aligned window of up to 72 hours, starting in the past')
        names = list(dict.fromkeys(symbols))
        if len(names) > 128 or any(not isinstance(s, str) or not s or len(s)>128 for s in names):
            raise ValueError('Invalid intraday symbols')
        with self.lock:
            health = self.fetch_health()
            if (source_id != 'Pepperstone-Demo' or not health.get('connected') or not health.get('process_running')
                    or health.get('account_server') != source_id or health.get('generation') != generation or not health.get('terminal_path')):
                raise ValueError('Connected source does not match intraday request')
            identity = {key: health.get(key) for key in ('terminal_path','account_login','account_server','generation')}
            if self.identity != tuple(identity.items()):
                self.years.clear()
                self.identity = tuple(identity.items())
            key = (from_utc, through_utc)
            cache = self.years.setdefault(key, OrderedDict())
            self.years.move_to_end(key)
            while len(self.years)>4:
                self.years.popitem(last=False)
            if retry:
                for symbol in names:
                    cache.pop(symbol, None)
            needed = [s for s in names if s not in cache or now-cache[s]['attempt_at'] >=
                      (60 if cache[s]['availability']=='unavailable' else 3600 if through_utc<=now-60 else 20)]
            needed.sort(key=lambda s: cache.get(s,{}).get('checked_at',0))
            batch, records = needed[:12], {}
            if batch:
                # Three preceding days permit an explicitly dated Friday baseline
                # after weekends without fetching an entire intraday year.
                records = self.read(identity, batch, {s: from_utc-3*86400 for s in batch}, min(through_utc, int(now)+1))
                after = self.fetch_health()
                if (not after.get('connected') or not after.get('process_running') or any(after.get(k)!=v for k,v in identity.items())):
                    self.years.clear()
                    raise ValueError('Intraday source changed during read')
                for symbol in batch:
                    if symbol not in records:
                        continue
                    record, checked = records[symbol], now
                    if len(record['bars'])>10080:
                        raise ValueError('Intraday reader exceeded window limit')
                    if record['availability']=='unavailable' and symbol in cache:
                        record = {**record, 'bars':cache[symbol]['bars']}
                        checked = cache[symbol]['checked_at']
                    cache[symbol] = {**record,'checked_at':checked,'attempt_at':now}
                    cache.move_to_end(symbol)
            while len(cache)>128:
                cache.popitem(last=False)
            selected = {s:{k:v for k,v in cache[s].items() if k!='attempt_at'} for s in names if s in cache}
            revision = hashlib.sha256(json.dumps(selected,sort_keys=True,separators=(',',':')).encode()).hexdigest()
            return dict(schema=1,source_id=source_id,generation=generation,from_utc=from_utc,through_utc=through_utc,
                        observed_at=self.clock(),revision=revision,pending=sum(s not in records for s in needed),symbols=selected)
