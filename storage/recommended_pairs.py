"""Read-only pair comparisons from exact Thesis versions; no inferred pair signals."""
from datetime import datetime, timezone
from hashlib import sha256
import json

from .thesis_research import read_research
from .thesis_summary import currency_summary
from .currencies import CURRENCIES


def recommended_pairs(journal_path, after_revision=None):
    now = datetime.now(timezone.utc)
    book = read_research(journal_path)
    runs = sorted((r for r in book['runs'] if r['provenance'] == 'assessment'
        and datetime.fromisoformat(r['as_of_utc']) <= now), key=lambda r: (r['as_of_utc'], r['saved_utc'], r['id']))
    latest, comparisons = {}, {}
    evidence = {d['id']: d for d in book['developments']}
    summary = {r['currency']: r for r in currency_summary(journal_path)['rows']}
    for run in runs:
        assessments = {a['currency']: a for a in run['assessments']}
        for c in assessments:
            latest[c] = run['id'] + ':' + c
        for a in run['assessments']:
            for pref in (a.get('evaluation') or {}).get('relative_preferences', []):
                pair = pref['pair']
                if pair not in {base+quote for n, base in enumerate(CURRENCIES) for quote in CURRENCIES[n+1:]}:
                    continue
                sides = [assessments.get(c) for c in (pair[:3], pair[3:])]
                if any(not side or not side.get('direction') or side['direction']['basis'] != 'standalone' for side in sides):
                    continue
                checkpoints = [side['direction'].get('reassessment') for side in sides]
                if any(not cp or not cp.get('event_at') for cp in checkpoints):
                    continue
                ends = [(cp['event_at'], cp['title']) for cp in checkpoints]
                ends += [(side['evaluation']['until_utc'], 'Saved comparison horizon') for side in sides if side.get('evaluation')]
                until, title = min(ends, key=lambda x: datetime.fromisoformat(x[0]))
                if datetime.fromisoformat(until) <= datetime.fromisoformat(run['saved_utc']):
                    continue
                detail = pref.get('recommendation') or {}
                supporting = []
                for side in sides:
                    ids = run['evidence_versions'].get(side['currency'], [])
                    sources = {s['locator']: s for s in side['direction']['sources'] if s['kind'] == 'web'}
                    for identity in ids:
                        sources.update({s['locator']: s for s in evidence[identity]['sources'] if s['kind'] == 'web'})
                    supporting.append(dict(currency=side['currency'], assessment_id=run['id']+':'+side['currency'],
                        reason=side['direction']['reason'], evidence_ids=ids, sources=list(sources.values())[:8]))
                comparisons[pair] = dict(id=run['id']+':'+pair, pair=pair, verdict=pref['verdict'],
                    intensity=detail.get('intensity'), rank=detail.get('rank'), reason=pref['reason'],
                    strongest_opposition=detail.get('strongest_opposition', a['evaluation']['strongest_opposition']),
                    invalidation=detail.get('invalidation', a['evaluation']['invalidation']),
                    as_of_utc=run['as_of_utc'], starts_at=run['saved_utc'], until_utc=until,
                    checkpoint=title, evidence=supporting,
                    status='provisional' if any(side['direction'].get('review_status') != 'complete' for side in sides) else 'current')
    for item in comparisons.values():
        if any(latest.get(side['currency']) != side['assessment_id'] for side in item['evidence']):
            item['status'] = 'superseded'
        elif any(summary[side['currency']]['reassessment_gap'] for side in item['evidence']):
            item['status'] = 'source_gap'
    items = sorted(comparisons.values(), key=lambda x: (x['status'] != 'current', x['rank'] is None,
        x['rank'] or 29, -datetime.fromisoformat(x['as_of_utc']).timestamp(), x['pair']))
    content = dict(schema=1, items=items)
    revision = sha256(json.dumps(content, sort_keys=True).encode()).hexdigest()
    return {'schema': 1, 'revision': revision, **({'unchanged': True} if revision == after_revision else content)}
