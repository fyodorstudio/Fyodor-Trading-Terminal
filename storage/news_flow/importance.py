"""Explainable attention levels, not predictions of price direction or volatility."""
from .relevance import classify, profile_rules
from .priority import attention_reason


def decision(title, source_id='', url='', feed_url='', include='', exclude='', enabled=False, pinned=False, filter_policy=''):
    # The relevance cache interns profiles; stars remain separate mutable state.
    relevant = classify(title, source_id, url, feed_url, *profile_rules(include, exclude, enabled, filter_policy))
    explicit_exclude = relevant['reason'].startswith('Excluded keyword')
    reason = ('Manually starred' if pinned and not explicit_exclude else
              attention_reason(title) if relevant['included'] else '')
    tier = 'priority' if reason else 'included' if relevant['included'] else 'excluded'
    return {**relevant, 'included': relevant['included'] or bool(reason), 'tier': tier, 'priority_reason': reason}


def level(*args):
    return {'excluded': 0, 'included': 1, 'priority': 2}[decision(*args)['tier']]
