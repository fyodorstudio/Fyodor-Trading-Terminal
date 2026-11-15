"""Policy organization from supplied feed text only; never infer trading direction."""
from functools import lru_cache
import re
from urllib.parse import parse_qs, urlsplit

# Institutions, rather than changing lists of office holders, identify currencies.
BANKS = (
    ('USD', 'Fed', r'fed|fomc|federal reserve', 'federalreserve.gov', ('fed-policy', 'fed-speeches')),
    ('EUR', 'ECB', r'ecb|european central bank', 'ecb.europa.eu', ('ecb',)),
    ('GBP', 'BoE', r'boe|bank of england', 'bankofengland.co.uk', ('boe-news', 'boe-speeches')),
    ('JPY', 'BoJ', r'boj|bank of japan', 'boj.or.jp', ('boj',)),
    ('CHF', 'SNB', r'snb|swiss national bank', 'snb.ch', ('snb',)),
    ('CAD', 'BoC', r'boc|bank of canada', 'bankofcanada.ca', ('boc-news', 'boc-speeches')),
    ('AUD', 'RBA', r'rba|reserve bank of australia', 'rba.gov.au', ('rba-news', 'rba-speeches')),
    ('NZD', 'RBNZ', r'rbnz|reserve bank of new zealand', 'rbnz.govt.nz', ('rbnz',)),
)
_banks = [(code, re.compile(r'\b(?:' + pattern + r')\b', re.I), domain, ids) for code, _, pattern, domain, ids in BANKS]
_policy = re.compile(r'\b(speech|speaks?|remarks?|says?|said|signals?|warns?|guidance|outlook|monetary|policy|minutes|rates?|hikes?|cuts?|holds?|tighten\w*|easing|hawkish|dovish|inflation|qe|qt)\b', re.I)
_wording = re.compile(r'\b(hawkish|dovish)\b', re.I)
_qualified = re.compile(r'\b(not|no|neither|less|hardly|isn.t|wasn.t|aren.t|weren.t)\b', re.I)


@lru_cache(maxsize=4096)
def policy_currencies(title, summary, source_id, url, feed_url=''):
    text = title + '\n' + summary
    host = (urlsplit(url).hostname or '').lower()
    feed = urlsplit(feed_url)
    feed_host = (feed.hostname or '').lower()
    google_scope = parse_qs(feed.query).get('q', [''])[0] if feed_host == 'news.google.com' else ''
    context = bool(_policy.search(text))
    codes = []
    for code, pattern, domain, ids in _banks:
        official = any(value == domain or value.endswith('.' + domain) for value in (host, feed_host))
        official |= bool(re.search(r'\bsite:' + re.escape(domain) + r'(?=[/\s)]|$)', google_scope, re.I))
        dedicated = official and source_id in ids and (source_id == 'fed-policy' or source_id.endswith('-speeches'))
        if dedicated or context and (official or pattern.search(text)):
            codes.append(code)
    return tuple(codes)


def policy_details(title, summary, source_id, url, feed_url=''):
    currencies = policy_currencies(title, summary, source_id, url, feed_url)
    if not currencies:
        return {'policy_banks': [], 'stance': '', 'stance_evidence': []}
    evidence, words, qualified = [], set(), False
    for origin, text in (('headline', title), ('feed summary', summary)):
        for sentence in re.split(r'(?<=[.!?])\s+|\n', text):
            matches = list(_wording.finditer(sentence))
            if not matches:
                continue
            words.update(match[1].lower() for match in matches)
            qualified |= bool(_qualified.search(sentence))
            # Keep a bounded excerpt around the actual wording, not an article extract.
            at = matches[0].start()
            start = max(0, at - 100)
            excerpt = ('…' if start else '') + sentence[start:start + 240] + ('…' if len(sentence) > start + 240 else '')
            if len(evidence) < 2 and not any(entry['text'] == excerpt for entry in evidence):
                evidence.append({'origin': origin, 'text': excerpt})
    stance = 'mixed' if len(words) > 1 else 'unclassified' if qualified or not words else next(iter(words))
    return {'policy_banks': [{'currency': code, 'bank': name} for code, name, *_ in BANKS if code in currencies],
            'stance': stance, 'stance_evidence': evidence}
