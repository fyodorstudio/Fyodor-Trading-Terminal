"""Descriptive evaluation reports; counts are never independent-trade claims."""
from collections import Counter, defaultdict
from datetime import timedelta, timezone
from .store import instant


def summary(rows, outcomes):
    latest = {o['episode_id']: o for o in outcomes}
    grades = Counter()
    bases = Counter()
    statuses = Counter()
    observations = Counter()
    day_returns = defaultdict(list)
    groups = defaultdict(Counter)
    cases = []
    overdue = []
    previous = {}
    benchmark = defaultdict(lambda: {'observations': 0, 'current_aligned': 0, 'previous_direction_aligned': 0,
        'current_signed_return_sum_pct': 0., 'previous_signed_return_sum_pct': 0.})
    for row in rows:
        direction = row.get('direction') or {}
        if direction:
            grades[direction.get('intensity') or 'unspecified'] += 1
            bases[direction.get('basis') or 'legacy_unspecified'] += 1
        statuses[row.get('window_status', 'unplanned')] += 1
        if row.get('checkpoint_overdue_seconds', 0) > 0:
            overdue.append({'episode_id': row['id'], 'currency': row['currency'],
                'seconds': row['checkpoint_overdue_seconds'], 'checkpoint': direction.get('reassessment')})
        earlier = previous.get(row['currency'])
        if row.get('basis_eligible') and row.get('window_status') in ('matured', 'pending'):
            previous[row['currency']] = direction
        outcome = latest.get(row['id'])
        if not outcome or row.get('window_status') != 'matured' or outcome.get('end_utc', row.get('end_utc')) != row.get('end_utc'):
            continue
        observation = outcome['observation']
        observations[observation['status']] += 1
        if observation['status'] == 'complete' and row.get('basis_eligible') and row.get('window_status') == 'matured':
            day = instant(row['delivered_utc']).astimezone(timezone(timedelta(hours=7))).date().isoformat()
            day_returns[(row['currency'], day)].append(observation['signed_return_pct'])
            groups[(row.get('window_basis', 'unknown'), direction.get('intensity', 'unspecified'))][observation['direction_result']] += 1
            if earlier and observation.get('return_pct') is not None:
                old_sign = 1 if earlier['verdict'] == 'POTENTIAL STRENGTHENING' else -1
                old_signed = observation['return_pct'] * old_sign
                group = benchmark[row.get('window_basis', 'unknown')]
                group['observations'] += 1
                group['current_aligned'] += observation['signed_return_pct'] > 0
                group['previous_direction_aligned'] += old_signed > 0
                group['current_signed_return_sum_pct'] += observation['signed_return_pct']
                group['previous_signed_return_sum_pct'] += old_signed
        cases.append({'episode_id': row['id'], 'currency': row['currency'], 'delivered_utc': row['delivered_utc'],
            'verdict': direction.get('verdict'), 'intensity': direction.get('intensity'), 'basis': direction.get('basis'),
            'window_basis': row.get('window_basis'), 'window_status': row.get('window_status'),
            'end_utc': row.get('end_utc'), 'end_reason': row.get('end_reason'),
            'checkpoint_overdue_seconds': row.get('checkpoint_overdue_seconds'), 'outcome_id': outcome['id'],
            'post_checkpoint_return_pct': (outcome.get('post_checkpoint_observation') or {}).get('return_pct'),
            **{key: observation.get(key) for key in ('status', 'return_pct', 'signed_return_pct', 'direction_result',
                'favourable_close_excursion_pct', 'adverse_close_excursion_pct', 'directional_breadth', 'gap', 'missing_samples')}})
    # Each currency-day has equal weight here regardless of the number of intraday declarations.
    days = [sum(values) / len(values) for values in day_returns.values()]
    return {'declarations': len(rows), 'intensity_distribution': dict(grades), 'basis_distribution': dict(bases),
        'window_status': dict(statuses), 'observation_status': dict(observations),
        'direction_by_window_and_intensity': [{'window': key[0], 'intensity': key[1], **dict(value)} for key, value in sorted(groups.items())],
        'currency_day_observations': len(days),
        'currency_day_mean_signed_return_pct': sum(days) / len(days) if days else None,
        'currency_day_aligned': sum(value > 0 for value in days),
        'previous_call_benchmark': [{'window': key, **value} for key, value in sorted(benchmark.items())],
        'benchmark_limitation': 'Previous eligible direction is evaluated on the identical current interval, without extending its original validity. This naive persistence comparison is correlated and descriptive, not an executable strategy.',
        'overdue_checkpoint_intervals': len(overdue),
        'largest_checkpoint_gaps': sorted(overdue, key=lambda r: r['seconds'], reverse=True)[:10],
        'sample_warning': 'Repeated calls, currencies and triangulated crosses are correlated. These are descriptive observations, not independent trades, returns after costs or evidence of a trading edge.',
        'index_limitation': 'EURX/JPYX/USDX construction is unverified. Only the documented equal-weight FX proxy is measured.',
        'cases': cases}


def markdown(report):
    lines = ['# Analyst evaluation', '', report['sample_warning'], '',
        f"Observation cutoff UTC: {report.get('as_of_utc', 'not supplied')}; scope: {report.get('scope', 'ALL')}.",
        f"Declarations: {report['declarations']}; currency-day observations: {report['currency_day_observations']}.",
        f"Grade distribution: {report['intensity_distribution']}. Window states: {report['window_status']}.",
        f"Price coverage: {report['observation_status']}.", '', report['index_limitation'], '',
        'Checkpoint/supersession proxies without a prospective explicit horizon are diagnostic, not clean forecast pass/fail scores.', '',
        '| Delivered UTC | Currency | Verdict / grade | Window | Observation | Signed % | Breadth / 7 |',
        '| --- | --- | --- | --- | --- | --- | --- |']
    for case in report['cases']:
        value = case['signed_return_pct']
        value = '—' if value is None else f'{value:+.4f}'
        lines.append(f"| {case['delivered_utc']} | {case['currency']} | {case['verdict']} / {case['intensity']} | {case['window_basis']} | {case['status']} | {value} | {case['directional_breadth'] if case['directional_breadth'] is not None else '—'} |")
    return '\n'.join(lines) + '\n'
