"""Small read-only projection of the latest live daily Thesis, across months."""
from datetime import datetime, timezone
from hashlib import sha256
import json

from .thesis_reviews import read_reviews


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
    rows = []
    for currency in ('USD', 'EUR', 'GBP', 'JPY', 'CHF', 'CAD', 'AUD', 'NZD'):
        direction = views.get(currency, {}).get('direction')
        rows.append({'currency': currency, 'verdict': direction['verdict'] if direction else None,
            'verified_utc': direction['verified_utc'] if direction else None,
            'evidence_anchor': direction.get('evidence_anchor') if direction else None,
            'reassessment': direction['reassessment'] if direction else None,
            'reassessment_gap': direction['reassessment_gap'] if direction else ''})
    content = {'schema': 1, 'review_id': review['id'] if review else None,
        'as_of_utc': review['as_of_utc'] if review else None, 'rows': rows}
    revision = sha256(json.dumps(content, sort_keys=True).encode()).hexdigest()
    return {'schema': 1, 'revision': revision, **({'unchanged': True} if revision == after_revision else content)}
