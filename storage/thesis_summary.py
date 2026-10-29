"""Small read-only projection of the latest live daily Thesis, across months."""
from datetime import datetime, timezone
from hashlib import sha256
import json

from .thesis_reviews import read_reviews
from .thesis_research import read_research


def currency_summary(journal_path, after_revision=None):
    now = datetime.now(timezone.utc)
    # Resolve corrections before filtering, so a corrected reconstruction cannot
    # accidentally expose its earlier live version. Never revive an older schedule.
    latest = {item['review_id']: item for item in read_reviews(journal_path)}
    eligible = [item for item in latest.values() if item['scope'] == 'ALL'
        and item['format'] == 'daily_news' and item['provenance'] == 'assessment'
        and datetime.fromisoformat(item['as_of_utc']) <= now]
    review = max(eligible, key=lambda item: (datetime.fromisoformat(item['as_of_utc']),
        datetime.fromisoformat(item['saved_utc']), item['id']), default=None)
    views = {view['currency']: view for view in review['currency_views']} if review else {}
    book = read_research(journal_path)
    by_id = {d['id']: d for d in book['developments']}
    runs = sorted([r for r in book['runs'] if r['provenance'] == 'assessment'
        and datetime.fromisoformat(r['as_of_utc']) <= now], key=lambda r: (r['as_of_utc'], r['saved_utc'], r['id']))
    selected = {currency: {'as_of_utc': review['as_of_utc'], 'id': review['id'], 'view': view}
                for currency, view in views.items()} if review else {}
    for run in runs:
        for assessment in run['assessments']:
            c = assessment['currency']; prior = selected.get(c)
            if prior and datetime.fromisoformat(run['as_of_utc']) < datetime.fromisoformat(prior['as_of_utc']): continue
            direction = assessment['direction']
            if not direction and prior and prior['view'].get('direction'):
                direction = {**prior['view']['direction'], 'reassessment': None, 'reassessment_gap': assessment['gap']}
            ids = run['evidence_versions'].get(c, [])
            # A gap can retain a prior direction, but has not assessed the new
            # evidence. Keep that direction's original anchor and clock together.
            evidence = (max((by_id[i] for i in ids), key=lambda d: (d['published_on'], d.get('published_at') or ''), default=None)
                if assessment['direction'] else prior.get('evidence') if prior else None)
            selected[c] = {'as_of_utc': run['as_of_utc'], 'id': run['id'], 'view': {'direction': direction}, 'evidence': evidence, 'gap': assessment['gap']}
    rows = []
    live_developments = {i for run in runs for i in run['development_ids']}
    for currency in ('USD', 'EUR', 'GBP', 'JPY', 'CHF', 'CAD', 'AUD', 'NZD'):
        item = selected.get(currency, {})
        direction = item.get('view', {}).get('direction')
        if direction:
            pending = [by_id[i] for i in live_developments if any(x['currency'] == currency for x in by_id[i]['impacts'])
                and datetime.fromisoformat(by_id[i]['verified_utc']) > datetime.fromisoformat(direction['verified_utc'])]
            if pending:
                direction = {**direction, 'reassessment': None,
                    'reassessment_gap': 'New saved research has not yet been incorporated into this currency assessment: '+max(pending,key=lambda d:(d['verified_utc'],d['id']))['title']}
        anchor = direction.get('evidence_anchor') if direction else None
        evidence = item.get('evidence')
        if evidence:
            anchor = {'title': evidence['title'], 'event_at': evidence.get('published_at'),
                'event_date': None if evidence.get('published_at') else evidence['published_on'], 'sources': evidence['sources'],
                'note': 'Latest recorded development referenced by this assessment; the full dated evidence and offsets remain in Thesis.'}
        rows.append({'currency': currency, 'verdict': direction['verdict'] if direction else None,
            'basis': direction.get('basis') if direction else None,
            'intensity': direction.get('intensity') if direction else None,
            'horizon': direction.get('horizon', '') if direction else '',
            'verified_utc': direction['verified_utc'] if direction else None,
            'evidence_anchor': anchor,
            'reassessment': direction['reassessment'] if direction else None,
            'reassessment_gap': direction['reassessment_gap'] if direction else item.get('gap','')})
    newest = max(selected.values(), key=lambda x: (x['as_of_utc'], x['id']), default=None)
    content = {'schema': 1, 'review_id': newest['id'] if newest else None,
        'as_of_utc': newest['as_of_utc'] if newest else None, 'rows': rows}
    revision = sha256(json.dumps(content, sort_keys=True).encode()).hexdigest()
    return {'schema': 1, 'revision': revision, **({'unchanged': True} if revision == after_revision else content)}
