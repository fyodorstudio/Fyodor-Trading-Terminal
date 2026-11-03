"""Daily relative FX excursions: original calls, explicit broker days, sampled paths."""
from datetime import datetime, timedelta, timezone
import math
from ..calendar_clock import broker_offset, chart_utc, PROFILES
from .outcomes import LEGS
from .store import digest, instant, stamp

SOURCE = 'Pepperstone-Demo'
PROTOCOL = {
    'version': 4, 'basis': 'Equal-weight relative FX basket · synchronized M1 closes',
    'day': 'Pepperstone New York-close D1; D1 opens normalize seven USD legs.',
    'daily_max': 'Largest absolute signed excursion from broker D1 opens; upward wins ties.',
    'call': 'First common completed minute after persisted delivery, within 120 seconds; no earlier prices credited.',
    'windows': 'Full remaining broker day and active interval through earliest declared end/checkpoint/supersession/day close, separately.',
    'feedback': 'Largest absolute post-call excursion aligned/opposed/flat; supporting case or refinement candidate, never causal proof or profit.',
    'closing_comparison': 'Verified completed broker D1 closes for the day endpoint; exact synchronized M1 endpoints for intraday windows. Closing alignment is separate from sampled excursions. No neighbouring terminal minute substituted.',
    'limits': 'Sampled maxima, not synthetic wick extrema. Missing samples stay partial. No fills/costs or automatic model training.',
    'price_provenance': 'Archive the exact source day document for each new completed observation, with its measured-as-of cutoff; live progress reuses the mutable cache.',
}
PROTOCOL_ID = digest(PROTOCOL)


def broker_date(at):
    at = instant(at)
    offset = broker_offset(SOURCE, at.timestamp())
    if offset is None:
        raise ValueError('Historical broker-day profile unavailable')
    return (at + timedelta(seconds=offset)).date().isoformat()


def bounds(day):
    raw = datetime.fromisoformat(day).replace(tzinfo=timezone.utc)
    start = chart_utc(SOURCE, int(raw.timestamp()))
    end = chart_utc(SOURCE, int((raw + timedelta(days=1)).timestamp()))
    if start is None or end is None:
        raise ValueError('Ambiguous historical daily boundary')
    return start, end


def episode_day(row):
    return broker_date(row['cutoff_utc'] if row['provenance'] == 'reconstruction' else row['delivered_utc'])


class DailyBasket:
    def __init__(self, document, now):
        if document.get('source_id') != SOURCE or document.get('clock_profile') != PROFILES[SOURCE]:
            raise ValueError('Daily basket source/clock mismatch')
        self.day = document['day']
        self.start, self.end = bounds(self.day)
        self.observed = min(instant(now).timestamp(), instant(document['captured_utc']).timestamp(), self.end)
        self.phase = 'final' if instant(now).timestamp() >= self.end and instant(document['captured_utc']).timestamp() >= self.end else 'developing'
        self.opens = document['opens']
        self.closes = document.get('closes', {})
        self.closing_logs = None
        if self.phase == 'final' and instant(document.get('d1_observed_utc', document['captured_utc'])).timestamp() >= self.end and all(type(self.closes.get(symbol)) in (int, float)
                and math.isfinite(self.closes[symbol]) and self.closes[symbol] > 0
                and type(self.opens.get(symbol)) in (int, float) and math.isfinite(self.opens[symbol]) and self.opens[symbol] > 0
                for symbol, _ in LEGS.values()):
            self.closing_logs = {'USD': 0., **{c: sign * math.log(self.closes[symbol] / self.opens[symbol])
                for c, (symbol, sign) in LEGS.items()}}
        self.points = {}
        self.gap = ''
        for symbol, _ in LEGS.values():
            opening = self.opens.get(symbol)
            if type(opening) not in (int, float) or not math.isfinite(opening) or opening <= 0:
                self.gap = 'A required broker D1 open is unavailable.'
            points = {}
            for at, close in document['samples'].get(symbol, []):
                if (type(at) not in (int, float) or at % 60 or type(close) not in (int, float)
                        or not math.isfinite(close) or close <= 0 or at + 60 in points):
                    raise ValueError('Invalid or duplicate daily minute sample')
                if self.start <= at and at + 60 <= self.observed:
                    points[at + 60] = close
            self.points[symbol] = points
        sets = [set(p) for p in self.points.values()]
        self.times = sorted(set.intersection(*sets)) if all(sets) and not self.gap else []
        self.revision = digest({'source_id': SOURCE, 'clock_profile': document['clock_profile'],
            'day': self.day, 'opens': self.opens, 'closes': self.closes if self.phase == 'final' else {}, 'completed_points': self.points})
        self.paths = {}

    def path(self, currency):
        if currency not in self.paths:
            values = []
            for at in self.times:
                logs = {'USD': 0., **{c: sign * math.log(self.points[symbol][at] / self.opens[symbol])
                    for c, (symbol, sign) in LEGS.items()}}
                values.append((at, logs[currency] - sum(v for c, v in logs.items() if c != currency) / 7))
            self.paths[currency] = values
        return self.paths[currency]

    def daily(self, currency):
        if not self.times:
            return {'status': 'unavailable', 'gap': self.gap or 'No synchronized minute history for this broker day.'}
        path = [(at, math.expm1(value) * 100) for at, value in self.path(currency)]
        high = max([(self.start, 0.), *path], key=lambda p: p[1])
        low = min([(self.start, 0.), *path], key=lambda p: p[1])
        peak = high if high[1] >= abs(low[1]) else low
        expected = max(0, int((self.observed // 60 * 60 - self.start) / 60))
        close = self.close(currency)
        return {'status': 'complete' if len(path) == expected else 'partial', 'max_pct': peak[1], 'current_pct': path[-1][1],
            **({'close_pct': math.expm1(close[0]) * 100, 'close_basis': close[1]} if close else {}),
            'peak_utc': stamp(datetime.fromtimestamp(peak[0], timezone.utc)), 'up_pct': high[1], 'down_pct': low[1],
            'sample_count': len(path), 'missing_samples': max(0, expected - len(path)),
            'through_utc': stamp(datetime.fromtimestamp(self.times[-1], timezone.utc))}

    def close(self, currency):
        if self.closing_logs is not None:
            value = self.closing_logs[currency] - sum(v for c, v in self.closing_logs.items() if c != currency) / 7
            return value, 'broker_d1_close'
        path = self.path(currency)
        if self.phase == 'final' and path and path[-1][0] == self.end:
            return path[-1][1], 'synchronized_m1_close'
        return None

    def measure(self, row, end):
        ending = min(instant(end).timestamp(), self.end, self.observed)
        delivery = instant(row['delivered_utc']).timestamp()
        path = self.path(row['currency'])
        baseline = next(((at, value) for at, value in path if delivery <= at <= delivery + 120), None)
        if not baseline:
            return {'status': 'unavailable', 'gap': 'No common completed minute within 120 seconds after delivery.'}
        terminal = int(ending // 60 * 60)
        window = [(at, math.expm1(value - baseline[1]) * 100) for at, value in path if baseline[0] <= at <= terminal]
        close = self.close(row['currency']) if terminal == self.end else None
        if not window or len(window) < 2 and close is None:
            return {'status': 'unavailable', 'gap': 'No completed post-delivery interval in this window.'}
        sign = 1 if row['direction']['verdict'] == 'POTENTIAL STRENGTHENING' else -1
        signed = [(at, value * sign) for at, value in window]
        best = max(signed, key=lambda p: p[1]); worst = min(signed, key=lambda p: p[1])
        peak = best if best[1] >= abs(worst[1]) else worst
        expected = int((terminal - baseline[0]) / 60) + 1
        status = 'complete' if len(window) == expected and window[-1][0] == terminal else 'partial'
        exact_terminal = close is not None or window[-1][0] == terminal
        terminal_return = (math.expm1(close[0] - baseline[1]) * 100 if close is not None else window[-1][1]) * sign
        return {'status': status, 'favourable_pct': best[1], 'adverse_pct': worst[1],
            'adverse_before_peak_pct': min(value for at, value in signed if at <= best[0]),
            'peak_utc': stamp(datetime.fromtimestamp(best[0], timezone.utc)), 'time_to_peak_seconds': best[0] - baseline[0],
            'baseline_utc': stamp(datetime.fromtimestamp(baseline[0], timezone.utc)),
            'through_utc': stamp(datetime.fromtimestamp(window[-1][0], timezone.utc)),
            'terminal_status': 'complete' if exact_terminal else 'unavailable',
            **({'terminal_basis': close[1] if close is not None else 'synchronized_m1_close',
                'terminal_return_pct': terminal_return, 'currency_return_pct': terminal_return * sign,
                'close_result': 'aligned' if terminal_return > 0 else 'opposed' if terminal_return < 0 else 'flat'} if exact_terminal else {}),
            'max_pct': peak[1] * sign,
            'direction_result': 'aligned' if peak[1] > 0 else 'opposed' if peak[1] < 0 else 'flat',
            'missing_samples': max(0, expected - len(window)), 'sample_count': len(window)}

    def assessment(self, row):
        end = datetime.fromtimestamp(self.end, timezone.utc)
        active_end = min(instant(row['end_utc']), end) if row.get('end_utc') else end
        allowed = (row['provenance'] == 'assessment' and row.get('window_status') not in
            ('obsolete_correction', 'expired_at_delivery', 'no_direction') and bool(row.get('direction')))
        remainder = self.measure(row, stamp(end)) if allowed else {'status': 'unavailable', 'gap': 'Historical reconstruction or obsolete/unresolved call; not a delivered forecast.'}
        active = self.measure(row, stamp(active_end)) if allowed else remainder
        eligible = allowed and row.get('basis_eligible', False)
        result = dict(protocol_id=PROTOCOL_ID, basis=PROTOCOL['basis'], source_id=SOURCE, broker_day=self.day,
            observed_until_utc=stamp(datetime.fromtimestamp(self.observed // 60 * 60, timezone.utc)),
            day_start_utc=stamp(datetime.fromtimestamp(self.start, timezone.utc)), day_end_utc=stamp(end), phase=self.phase,
            delivery_utc=row['delivered_utc'], day=self.daily(row['currency']), after_verdict=remainder,
            active_window={**active, 'end_utc': stamp(active_end), 'end_reason': row.get('end_reason') or 'broker_day_close',
                'phase': 'final' if self.observed >= active_end.timestamp() else 'developing'},
            eligible=eligible, price_revision=self.revision)
        feedback = active.get('direction_result') if eligible and active['status'] == 'complete' and self.observed >= active_end.timestamp() else 'unresolved'
        if active_end == end:
            result['active_window']['end_reason'] = 'broker_day_close'
        result['feedback'] = 'supporting_case' if feedback == 'aligned' else 'refinement_candidate' if feedback == 'opposed' else feedback
        daily_sign = result['day'].get('max_pct', 0) * (1 if row['direction']['verdict'] == 'POTENTIAL STRENGTHENING' else -1)
        result['day_alignment'] = ('unavailable' if result['day']['status'] == 'unavailable' else
            'aligned' if daily_sign > 0 else 'opposed' if daily_sign < 0 else 'flat')
        observed = remainder.get('direction_result') if eligible and self.phase == 'final' else None
        result['remaining_day_feedback'] = ('supporting_case' if observed == 'aligned' else 'refinement_candidate'
            if observed == 'opposed' else 'flat' if observed == 'flat' else 'unresolved')
        return result
