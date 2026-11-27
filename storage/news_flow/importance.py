"""Explainable attention levels, not predictions of price direction or volatility."""
from functools import lru_cache

from .relevance import classify, profile_rules
from .priority import attention_reason
from .publication import publication_conflict


def decision(title, source_id='', url='', feed_url='', include='', exclude='', enabled=False, pinned=False, filter_policy='', summary='', published_at=None):
    profile = profile_rules(include, exclude, enabled, filter_policy)
    return dict(_decision(title, source_id, url, feed_url, profile, pinned, summary[:8000], published_at))


@lru_cache(maxsize=65_536)
def _decision(title, source_id, url, feed_url, profile, pinned, summary, published_at):
    relevant = classify(title, source_id, url, feed_url, *profile, summary=summary)
    enabled = profile[2]
    explicit_exclude = relevant['reason'].startswith('Excluded keyword')
    reason = ('Manually starred' if pinned and not explicit_exclude else
              attention_reason(title, summary[:8000] if enabled else '', semantic=enabled) if relevant['included'] else '')
    conflict = publication_conflict(title, published_at, summary[:8000]) if enabled and not pinned else ''
    if conflict and reason:
        reason = ''
        relevant = {**relevant, 'reason': conflict}
    tier = 'priority' if reason else 'included' if relevant['included'] else 'excluded'
    return {**relevant, 'included': relevant['included'] or bool(reason), 'tier': tier, 'priority_reason': reason}


def level(*args):
    return {'excluded': 0, 'included': 1, 'priority': 2}[decision(*args)['tier']]
