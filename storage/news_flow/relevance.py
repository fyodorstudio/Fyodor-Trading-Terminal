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
from .filter_policy import canonical_policy, parse_policy
from .headline_filters import catalyst_reason, routine_reason

PROFILE = json.loads(Path(__file__).with_name('relevance.json').read_text(encoding='utf-8'))
PRESET = PROFILE['preset']
CONTEXTUAL = set(PROFILE['contextual'])
_rx = {key: re.compile(PROFILE[key], re.I) for key in (
    'country_macro', 'global_market', 'geopolitics', 'geo_event', 'politics',
    'crypto', 'crypto_bridge', 'noise', 'local_quote', 'local_quote_bridge', 'official_policy', 'official_admin', 'official_economic', 'official_fiscal_release', 'market_transmission', 'sector_bellwethers', 'semiconductor_policy')}
_strong = ','.join(term for term in PRESET if normalized(term) not in CONTEXTUAL)
_banks = ','.join(PROFILE['groups']['Policy'][:PROFILE['groups']['Policy'].index('monetary policy')])
_market_event = re.compile(r'\b(gdp|inflation|cpi|pce|payrolls|monetary|interest rates?|central bank|economy|tariffs?|sanctions?|earnings|revenue|demand|supply|inventories|prices?|futures|shares|stocks|markets?|yields?|bonds?|exports?|imports?|financial|liquidity|credit|banking|debt)\b', re.I)
_companies = ','.join(PROFILE['groups']['Index companies and systemic banks'] + PROFILE['groups']['Sector bellwethers'])
_publisher_suffix = re.compile(r'\s+-\s+(?:Reuters|Bloomberg(?:\.com)?|Investing\.com(?:\s+[\w ]+)?|Financial Times|FXStreet|WSJ|MarketWatch|Barron.?s|Seeking Alpha|(?:bne )?IntelliNews(?: Lambda)?|CNBC|Kitco|BeInCrypto)\s*$', re.I)
_publisher_attribution = re.compile(r'\b(?:Wall Street Journal|Bloomberg News|Reuters|Financial Times)\s+(?:reports?|reported|says?|said)\b', re.I)
_systemic = re.compile(r'\b(?:bank run|banking crisis|systemic|contagion|sovereign default|capital controls|capital flight|bailout|liquidity crisis|credit freeze|deleveraging)\b', re.I)
_routine = re.compile(r'\b(?:hires?|hiring|appoints?|names?)\b.{0,100}\b(?:trading veteran|head (?:of|up) (?:sales|trading|oil products)|portfolio manager|sales director|marketing director)\b|\b(?:how to (?:buy|invest|trade|choose)|best (?:brokers|trading apps)|sponsored content|paid promotion)\b|\bwhen\b.{0,60}\bstumbled\b.{0,60}\b(?:funds|etfs) delivered\b', re.I)
_treasury_notice = re.compile(r'^treasury sanctions\b.{0,160}\b(?:drug trafficking|cocaine|cartels?|narco|casinos|criminal network)\b', re.I)
_notice_driver = re.compile(r'\b(?:oil|crude|brent|gas|energy|tankers?|shipping|shadow fleet|iran(?:ian)?|russia(?:n)?|china|chinese|currenc(?:y|ies)|fx|bonds?|yields?|buybacks?|refunding|debt|tariffs?|trade policy|interest rates?|bank run|contagion|liquidity crisis)\b', re.I)
_not_release = re.compile(r'^tag:|\bstock price\s*\||\bstock quote\s*\(|\|\s*(?:stock price\s*&|stock quote)|^check out .{0,160}stock price.{0,60}in real time|^u\.?s\.? energy information administration\s*-\s*eia\b|\b(?:net asset values?|transaction in own shares|total voting rights)\b|^form\s+(?:4|8\.3)\b', re.I)
_invitation = re.compile(r'\bto (?:present|participate)\b.{0,70}\b(?:investor conferences?|upcoming conferences?|investment conference)\b', re.I)
_consumer = re.compile(r'\b(?:amazon (?:deforestation|rainforest|river|basin|visit)|peru amazon|james bond|black friday deals|your apple watch|movie review|film review)\b', re.I)
_company_event = re.compile(r'\b(?:shares?|stocks?|earnings|revenues?|profits?|sales|losses|acquir\w*|buys?|merger|funding|financing|capex|lawsuit|antitrust|governance|misconduct|fraud|resigns?|ouster|outage|default|exports?|tariffs?)\b', re.I)
_listing = re.compile(r'\s*\((?:[a-z0-9_./-]+:){1,3}[a-z0-9_./-]*\)\s*$', re.I)
_analyst_call = re.compile(r'\b(?:stock (?:price target|rating)|price target|re-rating|(?:buy|sell|neutral|overweight|underweight|hold|outperform|underperform|sector weight) rating|stock with|to (?:buy|sell|neutral|overweight|underweight|hold|outperform|underperform))\b', re.I)
_attribution = re.compile(r'^(?:ubs|wells fargo|deutsche bank|jpmorgan|goldman sachs|morgan stanley|bank of america|citigroup|barclays|hsbc|bnp paribas|societe generale)\s+(?=(?:raises?|cuts?|lowers?|lifts?|initiates?|reiterates?|maintains?|upgrades?|downgrades?|sees?)\b)', re.I)
_exchanges = {'nasdaq', 'nyse', 'nysearca', 'nyseamerican', 'asx', 'tsx', 'tsxv', 'lse', 'com', 'commodity'}
_cross_market_risk = re.compile(r'\b(?:ai|artificial intelligence|chips?|semiconductors?)\b.{0,100}\b(?:sell[ -]?off|rout|retreat|bubble|unravels?|frenzy fades|concentration risk)\b|\b(?:sell[ -]?off|rout|retreat|bubble)\b.{0,100}\b(?:ai|artificial intelligence|chips?|semiconductors?)\b', re.I)
_currency_driver = re.compile(r'\b(?:us dollar|u\.s\. dollar|usd|dxy|dollar index|greenback|euro|sterling|british pound|yen|swiss franc|canadian dollar|australian dollar|new zealand dollar|(?<!singapore )(?<!hong kong )dollar)\b\s+(?:(?:is|are|remains?|extends?)\s+)?(?:weaken\w*|strengthen\w*|falls?|falling|rises?|rising|rall\w*|slid\w*|slips?|surges?|plunges?|sell[ -]?off|gains?|losses|weakness|strength)\b', re.I)
_macro_driver = re.compile(r'\b(?:us|u\.s\.|uk|u\.k\.|eurozone|euro area|german|japan(?:ese)?|swiss|canadian|australian|new zealand)\s+(?:(?:core|headline)\s+)?(?:cpi|pce|ppi|gdp|pmi|nfp|payrolls|inflation|retail sales|jobs report|jobless claims|bond yields|government bonds)\b', re.I)
_fiscal_driver = re.compile(r"\b(?:us|u\.s\.|united states|uk|u\.k\.|germany|german|eurozone|euro area|japan|japanese|swiss|switzerland|canada|canadian|australia|australian|new zealand)(?:'s)?\b.{0,65}\b(?:budget|fiscal|tax treaty|government debt|deficit|net payment|tax hikes?|tax cuts?)\b|\b(?:euro adoption|euro peg|erm ii|danish central bank.{0,40}fx peg)\b", re.I)
_promotion = re.compile(r'\b(?:discounted stocks|\d+% off investingpro|our ai models say|(?:launches?|introduces?|offers?)\b.{0,80}\bcfds?)\b', re.I)
_category = re.compile(r'^(?:federal reserve|energy|china|stocks\s*\|\s*market data center|market data center|base[ -]metals news|feed news|videos)\s*$|^print edition\b|\bstock overview\s*\(|description=\{page_description\}', re.I)
_retrospective_quote = re.compile(r'\bstock (?:outperforms?|underperforms?|rises?|falls?)\b.{0,70}\b(?:competitors|on (?:strong trading|the) day|(?:when compared to|underperforms?|outperforms?) market)\b', re.I)
_material_driver = re.compile(r'\b(?:earnings|revenues?|profits?|guidance|forecasts?|exports?|tariffs?|curbs?|restrictions?|ceo|chief|outages?|lawsuits?|fraud|scandal|governance|merger|acquisition|ipo|bankrupt\w*|defaults?|investigat\w*|probes?|fed|fomc|ecb|boj|boe|rba|rbnz|snb|treasur\w*|nasdaq|s&p|dow jones|sector|sell[ -]?off|rout|rotation|chips?|semiconductors?|inflation|gdp|payrolls|nfp|retail sales|opec|oil|brent|gas|gold|silver|dxy|dollar index|credit|systemic|contagion)\b', re.I)


_analyst_names = r'(?:ubs|wells fargo|deutsche bank|jpmorgan|goldman sachs|morgan stanley|bank of america|citigroup|barclays|hsbc|bnp paribas|societe generale)'
_analyst_suffix = re.compile(r'\s+[–—-]\s+' + _analyst_names + r'\s*$', re.I)
_analyst_explanation = re.compile(r'\b' + _analyst_names + r'(?=\s+(?:explains?\b|(?:upgrades?|downgrades?)\s+(?!(?:its|their|our)\b).{0,90}\b(?:stocks?|shares?|equities|rating|overweight|underweight)\b))', re.I)


def market_text(title):
    """Remove metadata/ambiguous uses, not the headline displayed or excluded."""
    title = _publisher_attribution.sub('publisher reports', _analyst_explanation.sub('analyst', _analyst_suffix.sub('', title)))
    text = normalized(_listing.sub(lambda match: ' ' + ' '.join(
        token for token in re.findall(r'[a-z0-9_./-]+', match[0], re.I)
        if token.lower() not in _exchanges), _publisher_suffix.sub('', title)))
    # An institution making a small-company stock call is not itself the subject.
    if _analyst_call.search(text):
        text = _attribution.sub('', text, count=1)
    text = re.sub(r'\bat (?:ubs|barclays|jpmorgan|goldman sachs|morgan stanley)\b(?=.{0,45}\bconference\b)', 'at', text)
    text = re.sub(r'\b\d[\d,.]*\s*(?:usd|eur|gbp|jpy|chf|cad|aud|nzd)\b', 'quoted amount', text)
    text = re.sub(r'\bcpi(?= card group\b)', '', text)
    if re.search(r'\b(?:biopharma|biotech|pharmaceutical|therapeutics|drug|clinical|oncology)\b', text):
        text = re.sub(r'\bpipeline\b|\bsummit\x27s\b', '', text)
    if re.search(r'\b(?:sales|marketing|recruitment|clinical|drug|commercial) pipeline\b|\bpipeline\b.{0,55}\b(?:in arr|in mrr|candidates|therapeutics)\b', text):
        text = re.sub(r'\bpipeline\b', 'business backlog', text)
    text = re.sub(r'\bdollar (?:tree|general)\b', 'retail chain', text)
    text = re.sub(r'\b(?:a|common) rut\b', 'habit', text)
    text = re.sub(r'\badp(?= stock\b)', 'payroll company', text)
    text = re.sub(r'\b(?:credo|research solutions) technology(?= shares?\b)', 'company', text)
    text = re.sub(r'\bglobal-e online\b', 'online retailer', text)
    return text


def tags(value):
    return list(dict.fromkeys(term.strip() for term in value.split(',') if term.strip()))


def matching_terms(title, value, aliases=True):
    text = normalized(title)
    return [term for term, pattern in term_patterns(value, aliases) if pattern.search(text)]


def first_literal_term(text, value):
    if not matches(text, value, aliases=False):
        return ''
    return next((term for term, pattern in term_patterns(value, False) if pattern.search(text)), '')


@lru_cache(maxsize=128)
def term_patterns(value, aliases=True):
    return tuple(zip(tags(value), patterns(value, aliases)))


def migrate_include(value, version):
    if version >= PROFILE['version'] or not value.strip():
        return value
    if version >= 3:
        previous = {normalized(term) for term in PRESET if term not in PROFILE['preset_additions']}
        current = {normalized(term) for term in tags(value)}
        # Only extend a broad preset-based profile. A short curated Include list
        # remains intentional, and removed old keywords are never reseeded.
        if len(previous & current) < len(previous) * .75:
            return value
        result = list(dict.fromkeys([*tags(value), *PROFILE['preset_additions']]))
        upgraded = ', '.join(result)
        return upgraded if len(result) <= 500 and len(upgraded) <= MAX_RULE_CHARS else value
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
    article = urlsplit(url)
    speech_path = re.search(r'/(?:speeches?|press/key|press/inter)/', article.path, re.I)
    verified_article = official_host(url, '', PROFILE['official_domains'])
    dedicated = bool(speech_path and verified_article) or (any(word in feed.path.lower() for word in ('speeches', 'press_monetary', 'cb-speeches')) and feed.hostname != 'news.google.com')
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
def profile_rules(include, exclude, enabled, filter_policy=''):
    # Intern long rule strings once instead of retaining a duplicate per story.
    return include, exclude, bool(enabled), canonical_policy(filter_policy)


def classify(title, source_id='', url='', feed_url='', include='', exclude='', enabled=False, filter_policy=''):
    return _classify(title, source_id, url, feed_url, profile_rules(include, exclude, bool(enabled), filter_policy))


@lru_cache(maxsize=32768)
def _classify(title, source_id, url, feed_url, profile):
    include, exclude, enabled, filter_policy = profile
    options = parse_policy(filter_policy)
    exclusion = next(iter(matching_terms(title, exclude)), '')
    if exclusion:
        return {'included': False, 'reason': 'Excluded keyword · ' + exclusion, 'keyword': exclusion}
    if enabled:
        headline = title = _publisher_suffix.sub('', title)
        if options.metadata and (_not_release.search(title) or _category.search(title)):
            return {'included': False, 'reason': 'Excluded · quote/category page or routine filing/invitation', 'keyword': ''}
        if options.non_market and (_consumer.search(title) or re.search(r'\b(?:pattinson|007|bezos)\b.{0,70}\bbond\b|\bbond\b.{0,70}\b(?:pattinson|007)\b|\bpick.{0,45}as bond\b', title, re.I)) and not _company_event.search(title):
            return {'included': False, 'reason': 'Excluded · consumer/entertainment or nonfinancial meaning', 'keyword': ''}
        if options.routine and _treasury_notice.search(title) and not _notice_driver.search(title) and not matches(title, _banks) and not matches(title, _companies):
            return {'included': False, 'reason': 'Excluded · routine Treasury crime notice', 'keyword': ''}
        if options.routine and (_promotion.search(title) or (_retrospective_quote.search(title) and not _material_driver.search(market_text(title) if options.subject_context else title))):
            return {'included': False, 'reason': 'Excluded · promotion or routine single-stock recap', 'keyword': ''}
        if options.routine and ((_routine.search(title) and not _systemic.search(title)) or (_invitation.search(title) and not official_policy(title, url, feed_url) and not matches(title, _banks))):
            return {'included': False, 'reason': 'Excluded · routine personnel/promotional/retrospective story', 'keyword': ''}
        if options.subject_context:
            title = market_text(title)
    if enabled and options.protect_official and official_policy(title, url, feed_url):
        return {'included': True, 'reason': 'Official central-bank policy/speech', 'keyword': ''}
    if enabled and options.protect_official and official_host(url, feed_url, PROFILE['official_economic_domains'] + PROFILE['official_domains']) and _rx['official_economic'].search(title):
        return {'included': True, 'reason': 'Official economic release', 'keyword': ''}
    if enabled and options.protect_official and official_host(url, feed_url, PROFILE['official_fiscal_domains']) and _rx['official_fiscal_release'].search(title):
        return {'included': True, 'reason': 'Official funding/intervention/sanctions release', 'keyword': ''}
    if enabled and options.routine:
        noise = routine_reason(_publisher_attribution.sub('publisher reports', headline), company=bool(matches(title, _companies)))
        if noise:
            return {'included': False, 'reason': 'Excluded · ' + noise, 'keyword': ''}
    if enabled and options.protect_remarks and financial_remarks(title, url, feed_url):
        return {'included': True, 'reason': 'Target-market remarks · financial news source', 'keyword': ''}
    hits = matching_terms(title, include)
    if not hits:
        return {'included': False, 'reason': 'No include match', 'keyword': ''}
    if not enabled:
        return {'included': True, 'reason': 'Included · ' + hits[0], 'keyword': hits[0]}
    text = normalized(title)
    # These are topic guards, not global country/crypto exclusions. Cross-asset
    # transmission, named index companies and explicit user Exclude stay visible.
    if options.crypto_only and _rx['crypto'].search(text) and not _rx['crypto_bridge'].search(text) and not matches(text, _companies):
        return {'included': False, 'reason': 'Excluded · crypto-only news', 'keyword': hits[0]}
    if options.retail_quotes and _rx['local_quote'].search(text) and not _rx['local_quote_bridge'].search(text):
        return {'included': False, 'reason': 'Excluded · local retail metal quote', 'keyword': hits[0]}
    geopolitics = _rx['geopolitics'].search(text) and _rx['geo_event'].search(text)
    other_market = first_literal_term(text, options.other_market_terms) if options.other_markets else ''
    exception, currency_driver, cross_market = '', None, False
    if other_market and options.cross_market:
        exception = first_literal_term(text, options.exceptions)
        currency_driver = _currency_driver.search(text) or _macro_driver.search(text) or _fiscal_driver.search(text)
        cross_market = exception or currency_driver or _rx['semiconductor_policy'].search(text) or _rx['sector_bellwethers'].search(text) or _cross_market_risk.search(text) or geopolitics or _systemic.search(text)
    if options.other_markets and other_market and not cross_market:
        return {'included': False, 'reason': 'Excluded · other-market domestic news · ' + other_market, 'keyword': hits[0]}
    if options.non_market and _rx['noise'].search(text) and not matches(text, _companies) and not _market_event.search(text):
        return {'included': False, 'reason': 'Excluded · non-market topic', 'keyword': hits[0]}
    catalyst = catalyst_reason(text)
    if catalyst:
        return {'included': True, 'reason': 'Included · ' + catalyst, 'keyword': hits[0]}
    if options.other_markets and other_market and cross_market:
        why = exception or (currency_driver[0] if currency_driver else 'global policy, sector or systemic event')
        return {'included': True, 'reason': 'Included · cross-market exception · ' + why, 'keyword': hits[0]}
    country_macro = bool(_rx['country_macro'].search(text))
    market_context = matches(text, _strong) or country_macro or _rx['global_market'].search(text) or _rx['market_transmission'].search(text) or _rx['semiconductor_policy'].search(text) or _rx['sector_bellwethers'].search(text) or (_rx['crypto'].search(text) and _rx['crypto_bridge'].search(text))
    politics = _rx['politics'].search(text)
    # Avoid a broad geography tag becoming its own circular market context.
    for term in hits:
        if not options.broad_context or normalized(term) not in CONTEXTUAL:
            return {'included': True, 'reason': 'Included · ' + term, 'keyword': term}
    if market_context or geopolitics or politics:
        context = 'macro' if country_macro else 'geopolitics' if geopolitics else 'policy/fiscal' if politics else 'target market'
        return {'included': True, 'reason': f'Included · {hits[0]} ({context})', 'keyword': hits[0]}
    return {'included': False, 'reason': 'No target-market context · ' + hits[0], 'keyword': hits[0]}
