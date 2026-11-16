"""Literal, boundary-aware keyword rules and conservative preview candidates."""
from functools import lru_cache
import re
import unicodedata
import json
from pathlib import Path

MAX_KEYWORDS = 500
MAX_RULE_CHARS = 16000
_currency = r'(usd|eur|gbp|jpy|chf|cad|aud|nzd|cny|cnh|xau|xag)'
_variants = json.loads(Path(__file__).with_name('relevance.json').read_text(encoding='utf-8'))['aliases']


def normalized(value):
    value = ' '.join(unicodedata.normalize('NFKC', value).lower().translate(str.maketrans({'’': "'", '‘': "'", '‐': '-', '‑': '-', '‒': '-', '–': '-', '—': '-'})).split())
    return re.sub(r'\b' + _currency + r'[/_-]?' + _currency + r'\b', r'\1 \2', value)


@lru_cache(maxsize=256)
def patterns(value):
    terms = list(dict.fromkeys(part.strip() for part in re.split(r'[,\n]', value) if part.strip()))
    if len(terms) > MAX_KEYWORDS or len(value) > MAX_RULE_CHARS:
        raise ValueError(f'Use at most {MAX_KEYWORDS} keywords and {MAX_RULE_CHARS} characters')
    return tuple(re.compile(r'(?<!\w)' + _variants.get(normalized(term), re.escape(normalized(term))) + r'(?!\w)') for term in terms)


@lru_cache(maxsize=128)
def combined_pattern(value):
    rules = patterns(value)
    return re.compile('|'.join(pattern.pattern for pattern in rules)) if rules else None


def matches(title, value):
    pattern = combined_pattern(value)
    return int(bool(pattern and pattern.search(normalized(title))))


_event = re.compile(r'\b(fed|fomc|ecb|boe|boj|boc|rba|rbnz|snb|opec|cpi|pce|payrolls|inflation|central bank|interest rates?|rate (?:hike|cut|decision)|treasury|auction)\b', re.I)
_preview = re.compile(r'\b(preview|ahead of|set to|expected to|economists polled|consensus|priced in|markets? (?:price|prices|pricing|imply|implies)|odds|probability|chance of|\d+(?:\.\d+)?\s*(?:%|per cent|percent)\s*(?:priced|chance|probability))\b', re.I)
_after = re.compile(r'\b(raised|raises|hiked|hikes|cut|cuts|held|holds|delivered|announced|released|after|following)\b', re.I)


def priority_reason(title, summary):
    # Source-provided text only, never article-body extraction or inferred odds.
    text = title + '\n' + summary
    if not _event.search(text) or not _preview.search(text):
        return ''
    if _after.search(title) and not re.search(r'\b(preview|ahead of|expected to|set to|next|upcoming)\b', title, re.I):
        return ''
    return 'Expectations candidate · verify event timing'
