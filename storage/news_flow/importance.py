"""Explainable attention levels, not predictions of price direction or volatility."""
from functools import lru_cache
import re

from .relevance import classify, normalized, profile_rules

_bank = r'(?:fed|fomc|ecb|boe|boj|boc|rba|rbnz|snb|central bank|federal reserve|bank of england|bank of japan|bank of canada|reserve bank of (?:australia|new zealand)|swiss national bank)'
_policy = re.compile(r'\b' + _bank + r"(?:'s)?\b.{0,65}\b(?:raises?|raised|hikes?|hiked|cuts?|cut|holds?|held|keeps?|kept|leaves?|left)\b.{0,45}\b(?:rates|(?:interest|cash|policy|deposit|benchmark|key|lending) rates?|borrowing costs?)\b", re.I)
_preview = re.compile(r'\b(?:may|might|could|should|would|expected|expects|forecasts?|predicts|preview|ahead of|seen|likely|unlikely|odds|chance)\b', re.I)
_quantified = re.compile(r'\b\d+(?:\.\d+)?\s*(?:%|percent|per cent)\s+(?:chance|probability|odds|priced|pricing)\b|\b(?:markets? (?:imply|implies|implied|price|prices|priced|pricing)|odds|chance|probability)\b.{0,45}\b\d+(?:\.\d+)?\s*(?:%|percent|per cent)', re.I)
_policy_change = re.compile(r'\b(?:yield curve control|ycc|quantitative easing|quantitative tightening|balance sheet runoff|asset purchases|bond purchases|forward guidance)\b', re.I)
_change = re.compile(r'\b(?:ends?|ended|scraps?|scrapped|abandons?|abandoned|launches?|launched|halts?|halted|suspends?|suspended|doubles?|doubled|expands?|expanded|accelerates?|accelerated)\b', re.I)
_intervention = re.compile(r'\b(?:intervenes?|intervened|intervention)\b', re.I)
_actual = re.compile(r'\b(?:conducts?|conducted|confirms?|confirmed|launches?|launched|intervenes?|intervened)\b', re.I)
_fx = re.compile(r'\b(?:yen|franc|dollar|currency|fx|foreign exchange|japan|snb|boj)\b', re.I)
_data = re.compile(r'\b(?:cpi|pce|inflation|payrolls|nfp|gdp|unemployment|jobs report|retail sales|pmi|ism)\b', re.I)
_surprise = re.compile(r'\b(?:unexpectedly|surprise|surprises|surprised|above (?:estimates|expectations|consensus)|below (?:estimates|expectations|consensus)|beats? (?:estimates|expectations|consensus)|misses? (?:estimates|expectations|consensus))\b', re.I)
_energy = re.compile(r'\b(?:opec|oil|crude|brent|hormuz|refineries|refinery|pipeline|tankers?|lng)\b', re.I)
_supply = re.compile(r'\b(?:halts?|halted|shuts?|shut|shutdown|shuts down|closed|closes|closure|blockade|blockades|blocked|disrupted|disruption|suspends?|suspended|outage|outages|embargo|production cuts?|output cuts?|supply cuts?)\b', re.I)
_conflict = re.compile(r'\b(?:iran|israel|hormuz|middle east|taiwan|russia|ukraine)\b', re.I)
_development = re.compile(r'\b(?:ceasefire (?:agreed|deal|begins|collapses)|agrees? (?:to )?(?:a )?ceasefire|peace deal|launches? (?:an? )?(?:attack|invasion)|invades?|blockade|further attacks?.{0,30}unlikely|attacks?.{0,30}ruled out)\b', re.I)
_systemic = re.compile(r'\b(?:bank run|banking crisis|credit freeze|emergency bailout|sovereign default|liquidity crisis)\b', re.I)


@lru_cache(maxsize=8192)
def attention_reason(title):
    text = normalized(title)
    if re.search(r'\b' + _bank + r'\b', text) and _quantified.search(text):
        return 'Quantified policy expectations · verify event date'
    if '?' in text:
        return ''
    reported = re.sub(r'\bas expected\b', '', text)
    if not _preview.search(reported):
        if _policy.search(text):
            return 'Reported central-bank rate decision'
        if re.search(r'\b' + _bank + r'\b', text) and _policy_change.search(text) and _change.search(text):
            return 'Explicit monetary-policy change'
        if _fx.search(text) and _intervention.search(text) and _actual.search(text):
            return 'Reported currency intervention'
        if _data.search(text) and _surprise.search(text):
            return 'Reported economic-data surprise'
        if _energy.search(text) and _supply.search(text):
            return 'Reported energy-supply development'
        if _systemic.search(text):
            return 'Reported systemic financial stress'
        if re.search(r'\b(?:treasury|finance ministry)\b', text) and re.search(r'\bbuybacks?\b', text) and (_change.search(text) or _surprise.search(text)):
            return 'Treasury funding/buyback change'
    rollback = re.search(r'\b(?:further attacks?.{0,30}unlikely|attacks?.{0,30}ruled out)\b', text)
    if _conflict.search(text) and _development.search(text) and (not _preview.search(text) or rollback):
        return 'Major geopolitical development · verify scope'
    return ''


def decision(title, source_id='', url='', feed_url='', include='', exclude='', enabled=False, pinned=False):
    # The relevance cache interns profiles; stars remain separate mutable state.
    relevant = classify(title, source_id, url, feed_url, *profile_rules(include, exclude, enabled))
    explicit_exclude = relevant['reason'].startswith('Excluded keyword')
    reason = ('Manually starred' if pinned and not explicit_exclude else
              attention_reason(title) if relevant['included'] else '')
    tier = 'priority' if reason else 'included' if relevant['included'] else 'excluded'
    return {**relevant, 'included': relevant['included'] or bool(reason), 'tier': tier, 'priority_reason': reason}


def level(*args):
    return {'excluded': 0, 'included': 1, 'priority': 2}[decision(*args)['tier']]
