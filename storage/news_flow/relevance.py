"""Deterministic target-market relevance, shared by every reader and alert path.

This is a relevance filter, not a volatility forecast. No article bodies or LLMs.
The editable vocabulary and context patterns live beside this module in JSON.
"""
from functools import lru_cache
import json
from pathlib import Path
import re
from urllib.parse import urlsplit, parse_qs

from .rules import MAX_RULE_CHARS, matches, normalized, patterns

PROFILE = json.loads(Path(__file__).with_name('relevance.json').read_text(encoding='utf-8'))
PRESET = PROFILE['preset']
CONTEXTUAL = set(PROFILE['contextual'])
_rx = {key: re.compile(PROFILE[key], re.I) for key in (
    'country_macro', 'global_market', 'geopolitics', 'geo_event', 'politics', 'other_market',
    'crypto', 'crypto_bridge', 'noise', 'local_quote', 'local_quote_bridge', 'official_policy', 'official_admin', 'official_economic')}
_strong = ','.join(term for term in PRESET if normalized(term) not in CONTEXTUAL)
_spillover = ','.join(term for group in ('Indices', 'Index companies and systemic banks', 'Energy', 'Metals and context commodities')
                      for term in PROFILE['groups'][group])
_banks = ','.join(PROFILE['groups']['Policy'][:PROFILE['groups']['Policy'].index('monetary policy')])
_market_event = re.compile(r'\b(gdp|inflation|cpi|pce|payrolls|monetary|interest rates?|central bank|economy|tariffs?|sanctions?|earnings|revenue|demand|supply|inventories|prices?|futures|shares|stocks|markets?|yields?|bonds?|exports?|imports?|financial|liquidity|credit|banking|debt)\b', re.I)
_companies = ','.join(PROFILE['groups']['Index companies and systemic banks'])
_publisher_suffix = re.compile(r'\s+-\s+(?:Reuters|Bloomberg(?:\.com)?|Investing\.com(?:\s+[\w ]+)?|Financial Times|FXStreet|WSJ|MarketWatch|Barron.?s|Seeking Alpha|IntelliNews(?: Lambda)?|CNBC|BeInCrypto)\s*$', re.I)
_systemic = re.compile(r'\b(?:bank run|banking crisis|systemic|contagion|sovereign default|capital controls|capital flight|bailout|liquidity crisis|credit freeze|deleveraging)\b', re.I)
_routine = re.compile(r'\b(?:hires?|hiring|appoints?|names?)\b.{0,100}\b(?:trading veteran|head (?:of|up) (?:sales|trading|oil products)|portfolio manager|sales director|marketing director)\b|\b(?:how to (?:buy|invest|trade|choose)|best (?:brokers|trading apps)|sponsored content|paid promotion)\b|\bwhen\b.{0,60}\bstumbled\b.{0,60}\b(?:funds|etfs) delivered\b', re.I)


def tags(value):
    return list(dict.fromkeys(term.strip() for term in value.split(',') if term.strip()))


def matching_terms(title, value):
    text = normalized(title)
    return [term for term, pattern in term_patterns(value) if pattern.search(text)]


@lru_cache(maxsize=128)
def term_patterns(value):
    return tuple(zip(tags(value), patterns(value)))


def migrate_include(value, version):
    if version >= PROFILE['version'] or not value.strip():
        return value
    # Replace the old seed, preserve custom additions, and leave a local backup
    # to callers. Context-only terms no longer trigger unrelated headlines alone.
    legacy = {normalized(term) for term in PROFILE['legacy_preset']}
    custom = [term for term in tags(value) if normalized(term) not in legacy]
    result = list(dict.fromkeys([*PRESET, *custom]))
    upgraded = ', '.join(result)
    return upgraded if len(result) <= 500 and len(upgraded) <= MAX_RULE_CHARS else value


def official_host(url, feed_url, domains):
    hosts = [urlsplit(url).hostname or '', urlsplit(feed_url).hostname or '']
    feed = urlsplit(feed_url)
    if feed.hostname == 'news.google.com':
        scopes = re.findall(r'(?:^|[\s(])site:([a-z0-9.-]+)', parse_qs(feed.query).get('q', [''])[0], re.I)
        if scopes and all(any(host == domain or host.endswith('.' + domain) for domain in domains) for host in scopes):
            hosts.extend(scopes)
    return any(host == domain or host.endswith('.' + domain) for host in hosts for domain in domains)


def official_policy(title, url, feed_url):
    feed = urlsplit(feed_url)
    if not official_host(url, feed_url, PROFILE['official_domains']) or _rx['official_admin'].search(title):
        return False
    dedicated = any(word in feed.path.lower() for word in ('speeches', 'press_monetary', 'cb-speeches')) and feed.hostname != 'news.google.com'
    return dedicated or bool(_rx['official_policy'].search(title))


def financial_remarks(title, url, feed_url):
    if not official_host(url, feed_url, PROFILE['financial_domains']) or _rx['noise'].search(title):
        return False
    text = normalized(title)
    country_quote = re.search(r"\b(?:japan|australia|canada|new zealand|switzerland|uk|us|eurozone)'s [a-z -]{2,40}:", text)
    # Aliases observed in the collected feed, not a claim of current office.
    speaker = matches(text, ','.join(PROFILE['speaker_aliases'])) and re.search(r'\b(?:says?|said|signals?|warns?|remarks?|speech|policy|rates?|inflation|hikes?|cuts?|outlook|resigns?|fired)\b', text)
    return bool(country_quote or speaker)


@lru_cache(maxsize=128)
def profile_rules(include, exclude, enabled):
    # Intern long rule strings once instead of retaining a duplicate per story.
    return include, exclude, bool(enabled)


def classify(title, source_id='', url='', feed_url='', include='', exclude='', enabled=False):
    return _classify(title, source_id, url, feed_url, profile_rules(include, exclude, bool(enabled)))


@lru_cache(maxsize=32768)
def _classify(title, source_id, url, feed_url, profile):
    include, exclude, enabled = profile
    exclusion = next(iter(matching_terms(title, exclude)), '')
    if exclusion:
        return {'included': False, 'reason': 'Excluded keyword · ' + exclusion, 'keyword': exclusion}
    if enabled:
        title = _publisher_suffix.sub('', title)
        if _routine.search(title) and not _systemic.search(title):
            return {'included': False, 'reason': 'Excluded · routine personnel/promotional/retrospective story', 'keyword': ''}
    if enabled and official_policy(title, url, feed_url):
        return {'included': True, 'reason': 'Official central-bank policy/speech', 'keyword': ''}
    if enabled and official_host(url, feed_url, PROFILE['official_economic_domains']) and _rx['official_economic'].search(title):
        return {'included': True, 'reason': 'Official economic release', 'keyword': ''}
    if enabled and financial_remarks(title, url, feed_url):
        return {'included': True, 'reason': 'Target-market remarks · financial news source', 'keyword': ''}
    hits = matching_terms(title, include)
    if not hits:
        return {'included': False, 'reason': 'No include match', 'keyword': ''}
    if not enabled:
        return {'included': True, 'reason': 'Included · ' + hits[0], 'keyword': hits[0]}
    text = normalized(title)
    # These are topic guards, not global country/crypto exclusions. Cross-asset
    # transmission, named index companies and explicit user Exclude stay visible.
    if _rx['crypto'].search(text) and not _rx['crypto_bridge'].search(text) and not matches(text, _companies):
        return {'included': False, 'reason': 'Excluded · crypto-only news', 'keyword': hits[0]}
    if _rx['local_quote'].search(text) and not _rx['local_quote_bridge'].search(text):
        return {'included': False, 'reason': 'Excluded · local retail metal quote', 'keyword': hits[0]}
    spillover = matches(text, _spillover) or matches(text, _banks)
    geopolitics = _rx['geopolitics'].search(text) and _rx['geo_event'].search(text)
    if _rx['other_market'].search(text) and not spillover and not geopolitics and not _systemic.search(text):
        return {'included': False, 'reason': 'Excluded · other-market domestic news', 'keyword': hits[0]}
    if _rx['noise'].search(text) and not matches(text, _companies) and not _market_event.search(text):
        return {'included': False, 'reason': 'Excluded · non-market topic', 'keyword': hits[0]}
    country_macro = bool(_rx['country_macro'].search(text))
    market_context = matches(text, _strong) or country_macro or _rx['global_market'].search(text) or (_rx['crypto'].search(text) and _rx['crypto_bridge'].search(text))
    politics = _rx['politics'].search(text)
    # Avoid a broad geography tag becoming its own circular market context.
    for term in hits:
        if normalized(term) not in CONTEXTUAL:
            return {'included': True, 'reason': 'Included · ' + term, 'keyword': term}
    if market_context or geopolitics or politics:
        context = 'macro' if country_macro else 'geopolitics' if geopolitics else 'policy/fiscal' if politics else 'target market'
        return {'included': True, 'reason': f'Included · {hits[0]} ({context})', 'keyword': hits[0]}
    return {'included': False, 'reason': 'No target-market context · ' + hits[0], 'keyword': hits[0]}
