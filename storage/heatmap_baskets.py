"""Bounded, on-demand broker-session basket ranges from synchronized M1 samples."""
from collections import OrderedDict
from datetime import date, datetime, timezone
import math
import re
import threading

from .calendar_clock import chart_utc
from .heatmap_intraday import HeatmapIntraday

CURRENCIES = ('USD', 'EUR', 'GBP', 'JPY', 'CHF', 'CAD', 'AUD', 'NZD')


def basket_range(currency, pairs, daily, minutes, day, observed):
    """Keep D1 closing returns; estimate the basket path, never combine pair wicks."""
    members = [(pair, symbol) for pair, symbol in pairs.items() if currency in (pair[:3], pair[3:])]
    missing = dict(open=None, high=None, low=None, samples=0, expected=0,
                   previous=None, reason='All seven counterparts and matching session baselines required')
    if len(members) != 7:
        return missing
    aligned, previous = [], None
    for pair, symbol in members:
        bars = daily.get(symbol, {}).get('bars', [])
        index = next((i for i, b in enumerate(bars) if datetime.fromtimestamp(b['time'], timezone.utc).date().isoformat() == day), None)
        if index is None or index == 0:
            return missing
        baseline = bars[index - 1]
        if bars[index]['time'] - baseline['time'] > 10 * 86400:
            return missing
        if previous is not None and previous != baseline['time']:
            return missing
        previous = baseline['time']
        record = minutes.get(symbol, {})
        if record.get('availability') != 'available':
            return {**missing, 'reason': 'Minute history unavailable for one or more counterparts'}
        aligned.append((1 if pair.startswith(currency) else -1, baseline['close'],
                        {b['time']: b for b in record['bars']}))
    instants = sorted(set.intersection(*(set(bars) for _, _, bars in aligned)))
    if not instants:
        return {**missing, 'reason': 'No synchronized minute observations for all seven counterparts'}
    def reading(at, field):
        return math.expm1(sum(sign * math.log(bars[at][field] / baseline)
                             for sign, baseline, bars in aligned) / 7) * 100
    # Both minute boundaries are sampled. Independent constituent highs/lows are
    # not simultaneous observations and cannot establish a basket extreme.
    readings = [reading(at, field) for at in instants for field in ('open', 'close')]
    start = chart_utc('Pepperstone-Demo', int(datetime.fromisoformat(day).replace(tzinfo=timezone.utc).timestamp()))
    end = chart_utc('Pepperstone-Demo', int(datetime.fromisoformat(day).replace(tzinfo=timezone.utc).timestamp()) + 86400)
    expected = max(1, math.ceil((min(end, observed) - start) / 60))
    return dict(open=readings[0], high=max(readings), low=min(readings), samples=len(instants), expected=expected,
                previous=datetime.fromtimestamp(previous, timezone.utc).date().isoformat(),
                reason='M1-sampled basket range' + ('; gaps or market closure' if len(instants) < expected else ''))


class HeatmapBaskets:
    def __init__(self, daily, read=None):
        self.daily = daily
        self.read = read or HeatmapIntraday._read
        self.lock = threading.Lock()
        self.identity = None
        self.cache, self.partial = OrderedDict(), OrderedDict()

    def snapshot(self, source_id, generation, pairs, currencies, days, retry=False):
        if (not days or len(days) > 42 or not currencies or len(currencies) > 8
                or any(c not in CURRENCIES for c in currencies) or len(pairs) > 28):
            raise ValueError('Invalid basket scope')
        for pair, symbol in pairs.items():
            if (not re.fullmatch(r'[A-Z]{6}', pair) or pair[:3] not in CURRENCIES or pair[3:] not in CURRENCIES
                    or pair[:3] == pair[3:] or not symbol or len(symbol) > 128):
                raise ValueError('Invalid basket counterpart')
        if len({frozenset((p[:3], p[3:])) for p in pairs}) != len(pairs) or len(set(pairs.values())) != len(pairs):
            raise ValueError('Duplicate basket counterparts')
        now = self.daily.clock()
        health = self.daily.fetch_health()
        if (source_id != 'Pepperstone-Demo' or not health.get('connected') or not health.get('process_running')
                or health.get('account_server') != source_id or health.get('generation') != generation or not health.get('terminal_path')):
            raise ValueError('Connected source does not match basket request')
        identity = {k: health.get(k) for k in ('terminal_path', 'account_login', 'account_server', 'generation')}
        ordered = list(dict.fromkeys(days))
        for day in ordered:
            parsed = date.fromisoformat(day)
            start = chart_utc(source_id, int(datetime.combine(parsed, datetime.min.time(), timezone.utc).timestamp()))
            if parsed.isoformat() != day or parsed.year < 2015 or start is None or start > now:
                raise ValueError('Choose past or current broker sessions')
        needed_pairs = {p: s for p, s in pairs.items() if any(c in (p[:3], p[3:]) for c in currencies)}
        scope = tuple(sorted(needed_pairs.items()))
        with self.lock:
            if self.identity != identity:
                self.cache.clear(); self.partial.clear(); self.identity = identity
            # Reuse the bounded D1 reader and its existing source/account checks.
            daily = {}
            daily_pending = 0
            for year in sorted({date.fromisoformat(d).year for d in ordered}):
                result = self.daily.snapshot(source_id, generation, list(needed_pairs.values()), year)
                daily[year] = result['symbols']
                daily_pending += result['pending']
            due = []
            if retry:
                for day in ordered:
                    if (scope, day) in self.cache:
                        self.cache[(scope, day)]['attempt_at'] = 0
                    self.partial.pop((scope, day), None)
            for day in ordered:
                key = (scope, day)
                saved = self.cache.get(key)
                end_wall = int(datetime.fromisoformat(day).replace(tzinfo=timezone.utc).timestamp()) + 86400
                end = chart_utc(source_id, end_wall)
                interval = 20 if end > now else 3600
                if retry or saved is None or now - saved['attempt_at'] >= interval:
                    due.append(day)
            # One session per request, at most 28 symbol reads, no year-sized M1 payload.
            if due and not daily_pending:
                day = next((d for d in due if (scope, d) in self.partial), due[0])
                key = (scope, day)
                records = self.partial.setdefault(key, {})
                wall = int(datetime.fromisoformat(day).replace(tzinfo=timezone.utc).timestamp())
                start, end = chart_utc(source_id, wall), chart_utc(source_id, wall + 86400)
                missing = [s for s in needed_pairs.values() if s not in records]
                fetched = self.read(identity, missing, {s: start for s in missing}, min(end, int(now) + 1)) if missing else {}
                after = self.daily.fetch_health()
                if (not after.get('connected') or not after.get('process_running') or any(after.get(k) != v for k, v in identity.items())):
                    self.cache.clear(); self.partial.clear()
                    raise ValueError('Basket source changed during read')
                records.update(fetched)
                if all(s in records for s in needed_pairs.values()):
                    values = {c: basket_range(c, needed_pairs, daily[date.fromisoformat(day).year], records, day, now) for c in CURRENCIES}
                    old = self.cache.get(key)
                    if old:
                        values = {c: {**old['values'][c], 'reason': 'Retained M1 range; refresh failed'}
                                  if v['open'] is None and old['values'][c]['open'] is not None else v for c, v in values.items()}
                    self.cache[key] = dict(values=values, attempt_at=now)
                    self.cache.move_to_end(key)
                    del self.partial[key]
            while len(self.cache) > 96:
                self.cache.popitem(last=False)
            while len(self.partial) > 2:
                self.partial.popitem(last=False)
            return dict(source_id=source_id, generation=generation, sampling='M1',
                        days={d: {c: self.cache[(scope, d)]['values'][c] for c in currencies} for d in ordered if (scope, d) in self.cache},
                        pending=daily_pending + sum((scope, d) not in self.cache or (scope, d) in self.partial
                            or self.cache[(scope, d)]['attempt_at'] < now for d in due))
