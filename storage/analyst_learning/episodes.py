"""Freeze original versions and derive non-overlapping delivered information sets."""
from copy import deepcopy
from datetime import timedelta
from pathlib import Path
from ..data_lock import data_lock
from .store import PROTOCOL, PROTOCOL_ID, digest, directory, instant, read, stamp, write


def source_episodes(journal_path):
    from ..thesis_research import read_research
    from ..thesis_reviews import read_reviews
    book = read_research(journal_path)
    evidence = {item['id']: item for item in book['developments']}
    result = []
    for run in book['runs']:
        for assessment in run['assessments']:
            ids = run['evidence_versions'].get(assessment['currency'], [])
            result.append(_episode('research', run, assessment['currency'], assessment.get('direction'),
                assessment.get('gap', ''), assessment.get('evaluation'), [evidence[i] for i in ids], run['id']))
    for review in read_reviews(journal_path):
        if review.get('scope') != 'ALL' or review.get('format') != 'daily_news':
            continue
        for view in review.get('currency_views', []):
            row = _episode('legacy', review, view['currency'], view.get('direction'), view.get('news_gap', ''),
                None, view.get('news', []), review['review_id'])
            row['legacy_view'] = deepcopy(view)
            row['input_hash'] = digest({k: v for k, v in row.items() if k != 'input_hash'})
            result.append(row)
    return result


def _episode(kind, source, currency, direction, gap, evaluation, evidence, logical_id):
    clocks = [source['saved_utc'], source['as_of_utc']]
    if direction:
        clocks.append(direction['verified_utc'])
    row = dict(id=f'{kind}:{source["id"]}:{currency}', source_kind=kind, source_id=source['id'],
        logical_id=logical_id, currency=currency, cutoff_utc=source['as_of_utc'], saved_utc=source['saved_utc'],
        delivered_utc=stamp(max(map(instant, clocks))), provenance=source['provenance'],
        direction=deepcopy(direction), gap=gap, evaluation=deepcopy(evaluation), evidence=deepcopy(evidence),
        workflow=deepcopy(source.get('workflow', {})), analyst_model=source.get('analyst_model') or 'unrecorded',
        protocol_id=PROTOCOL_ID, available_time_basis='Persisted delivery proxy; earlier chat delivery not reconstructed.')
    row['input_hash'] = digest(row)
    return row


def sync(journal_path):
    target = directory(journal_path)
    fresh = source_episodes(journal_path)
    with data_lock(target):
        book = read(target / 'episodes.json', {'version': 1, 'episodes': []})
        if any(row['input_hash'] != digest({k: v for k, v in row.items() if k != 'input_hash'}) for row in book['episodes']):
            raise ValueError('Frozen assessment integrity failed; preserve the evidence and investigate')
        existing = {item['id']: item for item in book['episodes']}
        added = 0
        for item in fresh:
            item = deepcopy(item)
            prior = existing.get(item['id'])
            if prior:
                item['protocol_id'] = prior['protocol_id']
            item['input_hash'] = digest({k: v for k, v in item.items() if k != 'input_hash'})
            if prior and prior['input_hash'] != item['input_hash']:
                raise ValueError('An original assessment changed in place; preserve both stores and investigate')
            if not prior:
                book['episodes'].append(item)
                existing[item['id']] = item
                added += 1
        protocols = read(target / 'protocols.json', {})
        if PROTOCOL_ID in protocols and protocols[PROTOCOL_ID] != PROTOCOL:
            raise ValueError('Frozen evaluation protocol conflicts')
        if PROTOCOL_ID not in protocols:
            write(target / 'protocols.json', {**protocols, PROTOCOL_ID: PROTOCOL})
        if added or not (target / 'episodes.json').exists():
            write(target / 'episodes.json', book)
        return {'added': added, 'episodes': len(book['episodes']), 'protocol_id': PROTOCOL_ID, 'directory': str(target)}


def windows(episodes, now):
    """Replay what was active at delivery; a late correction cannot reactivate an old cutoff."""
    now = instant(now)
    streams = {}
    output = []
    for row in sorted(episodes, key=lambda r: (instant(r['delivered_utc']), r['id'])):
        if instant(row['delivered_utc']) > now or row['provenance'] != 'assessment':
            continue
        currency = row['currency']
        prior = streams.get(currency)
        if prior and instant(row['cutoff_utc']) < instant(prior['cutoff_utc']):
            output.append({**row, 'window_status': 'obsolete_correction', 'end_utc': None})
            continue
        if prior:
            prior['next_delivery_utc'] = row['delivered_utc']
        current = {**row, 'next_delivery_utc': None}
        streams[currency] = current
        output.append(current)
    for row in output:
        if row.get('window_status') == 'obsolete_correction':
            continue
        direction = row['direction']
        if not direction:
            row.update(window_status='no_direction', end_utc=None)
            continue
        start = instant(row['delivered_utc'])
        ends = []
        evaluation = row.get('evaluation')
        if evaluation:
            ends.append((instant(evaluation['until_utc']), 'declared_horizon'))
        checkpoint = direction.get('reassessment')
        if checkpoint and checkpoint.get('event_at'):
            ends.append((instant(checkpoint['event_at']), 'checkpoint'))
        if row.get('next_delivery_utc'):
            ends.append((instant(row['next_delivery_utc']), 'superseded'))
        if not ends:
            row.update(window_status='unbounded_horizon', end_utc=None)
            continue
        end, reason = min(ends)
        row.update(end_utc=stamp(end), end_reason=reason,
            window_basis='declared' if evaluation else 'diagnostic_proxy',
            window_status='expired_at_delivery' if end <= start else 'matured' if end <= now else 'pending')
        # A superseded call cannot accumulate an overdue checkpoint after it ceased to be active.
        checkpoint_at = instant(checkpoint['event_at']) if checkpoint and checkpoint.get('event_at') else None
        next_at = instant(row['next_delivery_utc']) if row.get('next_delivery_utc') else now
        row['checkpoint_overdue_seconds'] = max(0, (min(next_at, now) - checkpoint_at).total_seconds()) if checkpoint_at and end >= checkpoint_at else 0
        row['assessment_latency_seconds'] = (start - instant(row['cutoff_utc'])).total_seconds()
        row['basis_eligible'] = direction.get('basis') == 'standalone'
    return output


def select(rows, scope='ALL', start=None, end=None):
    from ..currencies import CURRENCIES
    scope = scope.upper()
    currencies = list(CURRENCIES) if scope == 'ALL' else [scope] if scope in CURRENCIES else [scope[:3], scope[3:]]
    if (any(c not in CURRENCIES for c in currencies) or scope != 'ALL' and len(scope) not in (3, 6)
            or len(set(currencies)) != len(currencies)):
        raise ValueError('Learning scope uses ALL, one supported currency or a supported pair')
    zone = __import__('datetime').timezone(timedelta(hours=7))
    def included(row):
        day = instant(row['delivered_utc']).astimezone(zone).date().isoformat()
        return row['currency'] in currencies and (start is None or day >= start) and (end is None or day <= end)
    return [row for row in rows if included(row)]
