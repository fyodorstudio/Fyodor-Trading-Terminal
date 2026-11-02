"""Deterministic price observations with explicit clocks, gaps and relative-basket limits."""
import math
from pathlib import Path
from .store import digest, instant, stamp

LEGS = {'EUR': ('EURUSD', 1), 'GBP': ('GBPUSD', 1), 'AUD': ('AUDUSD', 1), 'NZD': ('NZDUSD', 1),
        'JPY': ('USDJPY', -1), 'CHF': ('USDCHF', -1), 'CAD': ('USDCAD', -1)}
CURRENCIES = ('USD', *LEGS)


class PriceTape:
    def __init__(self, documents, now):
        self.now = instant(now).timestamp()
        self.closes = {symbol: {} for symbol, _ in LEGS.values()}
        self.provenance = {}
        self.broker = None
        self.step = None
        for path, data in documents:
            symbol = data.get('pair')
            if symbol not in self.closes:
                continue
            if data.get('symbol', symbol) != symbol:
                raise ValueError('Evaluation needs verified exact FX symbols, not an unverified suffix/alias')
            if data.get('broker') != 'Pepperstone-Demo' or not data.get('clock_basis'):
                raise ValueError('Evaluation needs a verified Pepperstone source and historical clock basis')
            if data.get('timeframe') != 'M1':
                raise ValueError('Precise delivered-call evaluation requires M1; H1 is diagnostic evidence only')
            self.broker, self.step = data['broker'], 60
            captured = instant(data['captured_utc']).timestamp()
            identity = digest(data)
            self.provenance[identity] = {'path': str(path), 'sha256_content': identity, 'broker': self.broker,
                'symbol': symbol, 'captured_utc': data['captured_utc'], 'clock_basis': data['clock_basis']}
            seen = set()
            for bar in data['bars']:
                raw = bar.get('utc_time')
                if type(raw) not in (int, float) or not math.isfinite(raw) or raw % 60 or raw in seen:
                    raise ValueError('Evaluation candles need distinct UTC minute opens')
                seen.add(raw)
                values = [bar.get(key) for key in ('open', 'high', 'low', 'close')]
                if any(type(v) not in (int, float) or not math.isfinite(v) or v <= 0 for v in values):
                    raise ValueError('Evaluation candles need finite positive prices')
                opening, high, low, close = values
                if not low <= min(opening, close) <= max(opening, close) <= high:
                    raise ValueError('Invalid evaluation OHLC bounds')
                at = raw + 60
                if at > min(captured, self.now):
                    continue
                prior = self.closes[symbol].get(at)
                if prior and prior[1] == captured and prior[0] != close:
                    raise ValueError('Conflicting candle closes at the same capture clock')
                if not prior or captured > prior[1]:
                    self.closes[symbol][at] = (close, captured, identity)
        sets = [set(points) for points in self.closes.values()]
        self.times = sorted(set.intersection(*sets)) if all(sets) else []

    def values(self, at):
        return {'USD': 0., **{currency: direction * math.log(self.closes[symbol][at][0])
            for currency, (symbol, direction) in LEGS.items()}}

    def measure(self, episode, end_utc=None):
        start = instant(episode['delivered_utc']).timestamp()
        end = instant(end_utc or episode['end_utc']).timestamp()
        if end > self.now:
            return {'status': 'pending'}
        baseline = next((at for at in self.times if start <= at <= start + 120), None)
        terminal = math.floor(end / 60) * 60
        if baseline is None:
            return {'status': 'unavailable', 'gap': 'No common completed M1 baseline within 120 seconds of delivery.'}
        if terminal not in self.times:
            return {'status': 'unavailable', 'gap': 'Missing exact completed terminal minute; no neighbouring candle substituted.'}
        if terminal <= baseline:
            return {'status': 'unavailable', 'gap': 'No completed post-delivery interval before the evaluation end.'}
        times = [at for at in self.times if baseline <= at <= terminal]
        expected = int((terminal - baseline) / 60) + 1
        origin = self.values(baseline)
        currency = episode['currency']
        sign = 1 if episode['direction']['verdict'] == 'POTENTIAL STRENGTHENING' else -1
        others = [c for c in CURRENCIES if c != currency]
        observations, used = [], set()
        price_input = []
        for at in times:
            values = self.values(at)
            returns = {c: (values[currency] - origin[currency]) - (values[c] - origin[c]) for c in others}
            observations.append(math.expm1(sum(returns.values()) / len(returns)) * 100)
            for symbol, points in self.closes.items():
                used.add(points[at][2])
                price_input.append((at, symbol, points[at][0]))
        final = self.values(terminal)
        counterparts = {c: math.expm1((final[currency] - origin[currency]) - (final[c] - origin[c])) * 100 for c in others}
        signed = [value * sign for value in observations]
        return {'status': 'complete' if len(times) == expected else 'partial', 'baseline_utc': stamp_from_seconds(baseline),
            'terminal_utc': stamp_from_seconds(terminal), 'baseline_delay_seconds': baseline - start,
            'return_pct': observations[-1], 'signed_return_pct': signed[-1],
            'direction_result': 'aligned' if signed[-1] > 0 else 'opposed' if signed[-1] < 0 else 'flat',
            'favourable_close_excursion_pct': max(0., max(signed)), 'adverse_close_excursion_pct': min(0., min(signed)),
            'counterpart_returns_pct': counterparts, 'directional_breadth': sum(v * sign > 0 for v in counterparts.values()),
            'sample_count': len(times), 'expected_sample_count': expected, 'missing_samples': expected - len(times),
            'longest_gap_seconds': max(b - a for a, b in zip(times, times[1:])),
            'price_input_hash': digest(price_input), 'provenance': [self.provenance[key] for key in sorted(used)],
            'price_basis': 'Geometric equal-weight relative FX basket from synchronized USD legs; sampled M1 closes, not wick extrema or executable returns.'}

    def preference(self, episode, preference, end_utc):
        observation = self.measure(episode, end_utc)
        if observation['status'] not in ('complete', 'partial'):
            return observation
        opening = self.values(instant(observation['baseline_utc']).timestamp())
        closing = self.values(instant(observation['terminal_utc']).timestamp())
        base, quote = preference['pair'][:3], preference['pair'][3:]
        result = math.expm1((closing[base] - opening[base]) - (closing[quote] - opening[quote])) * 100
        signed = result * (1 if preference['verdict'] == 'BUY' else -1)
        return {'status': observation['status'], 'pair': preference['pair'], 'verdict': preference['verdict'],
            'return_pct': result, 'signed_return_pct': signed, 'direction_result': 'aligned' if signed > 0 else 'opposed' if signed < 0 else 'flat',
            'baseline_utc': observation['baseline_utc'], 'terminal_utc': observation['terminal_utc'],
            'basis': 'Triangulated synchronous closes; no direct-cross spread/fill claim.'}


def stamp_from_seconds(value):
    from datetime import datetime, timezone
    return stamp(datetime.fromtimestamp(value, timezone.utc))


def import_documents(paths, reader):
    return [(Path(path), reader(path)) for path in paths]
