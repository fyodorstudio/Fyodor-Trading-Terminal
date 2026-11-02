"""Descriptive reward/refinement evidence; no automatic causal verdict or weight update."""
from collections import Counter
from .store import instant


def feedback_summary(rows, recorded, case_reviews, cutoff, limit=5):
    selected = {r['id']: r for r in rows}
    latest = {o['episode_id']: o for o in recorded if o['episode_id'] in selected
        and (o['phase'] == 'final' and instant(o['day_end_utc']) <= instant(cutoff)
            or o['active_window'].get('phase') == 'final' and instant(o['active_window']['end_utc']) <= instant(cutoff))}
    confronted = {r['outcome_id'] for r in case_reviews}
    active_counts = Counter(o['feedback'] for o in latest.values())
    cases = []
    for episode, outcome in latest.items():
        active = outcome['active_window']
        full_day = outcome['phase'] == 'final' and instant(outcome['day_end_utc']) <= instant(cutoff)
        opportunity = outcome['after_verdict'] if full_day else active
        cases.append(dict(episode_id=episode, outcome_id=outcome['id'], currency=outcome['currency'],
            delivered_utc=selected[episode]['delivered_utc'], verdict=outcome['verdict'], intensity=outcome['intensity'],
            broker_day=outcome['broker_day'], feedback=outcome.get('remaining_day_feedback', 'unresolved') if full_day else outcome['feedback'],
            feedback_window='remaining_day' if full_day else 'active_interval',
            active_window_feedback=outcome['feedback'], reviewed=outcome['id'] in confronted,
            day_max_pct=outcome['day'].get('max_pct') if full_day else None, favourable_pct=opportunity.get('favourable_pct'),
            adverse_pct=opportunity.get('adverse_pct'), adverse_before_peak_pct=opportunity.get('adverse_before_peak_pct'),
            peak_utc=opportunity.get('peak_utc'), time_to_peak_seconds=opportunity.get('time_to_peak_seconds'),
            active_favourable_pct=active.get('favourable_pct'), active_adverse_pct=active.get('adverse_pct'),
            direction_result=opportunity.get('direction_result'), coverage=opportunity['status'],
            remaining_day_favourable_pct=outcome['after_verdict'].get('favourable_pct') if full_day else None,
            remaining_day_adverse_pct=outcome['after_verdict'].get('adverse_pct') if full_day else None))
    pending = [c for c in cases if not c['reviewed'] and c['feedback'] in ('supporting_case', 'refinement_candidate')]
    counts = Counter(c['feedback'] for c in cases)
    pending.sort(key=lambda c: (c['feedback'] != 'refinement_candidate', c['feedback_window'] != 'active_interval',
        -abs(c['adverse_pct'] or 0) if c['feedback'] == 'refinement_candidate' else -(c['favourable_pct'] or 0), c['delivered_utc']))
    queue = pending[:limit]
    success = next((c for c in pending if c['feedback'] == 'supporting_case'), None)
    if success and success not in queue and len(queue) > 1:
        queue[-1] = success
    return dict(protocol='Post-delivery sampled maximum excursion through broker-day close; active-window feedback and daily-open context stay separate.',
        counts=dict(counts), active_window_counts=dict(active_counts), case_queue=queue, unreviewed=len(pending), cases=cases,
        interpretation='Aligned observed excursion is a supporting/reward case; opposed excursion is a refinement candidate. Coverage remains explicit, including partial paths. Day-open context never credits a late call. Review original reasoning and contrary facts; neither causality nor profitability is proved.')
