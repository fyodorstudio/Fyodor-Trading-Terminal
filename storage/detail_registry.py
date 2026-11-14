"""Shared currency scope and explicit, source-specific metric identities."""
import json
import re
from functools import lru_cache
from pathlib import Path

from .currencies import CURRENCIES

ROOT = Path(__file__).resolve().parents[1]


@lru_cache(maxsize=1)
def registry():
    return json.loads((ROOT / 'config/calendar-measures.json').read_text(encoding='utf-8'))


def resolve_scope(scope):
    if scope.upper() == 'ALL':
        return list(CURRENCIES)
    aliases = json.loads((ROOT / 'config/chart-currency-scopes.json').read_text(encoding='utf-8'))
    for alias in sorted(aliases, key=len, reverse=True):
        if re.fullmatch(re.escape(alias) + r'(?:[._].*|[a-z]*)', scope):
            return aliases[alias]
    match = re.fullmatch(r'([A-Z]{3})([A-Z]{3})?(?:[._-].*|[a-z]*)', scope)
    currencies = [part for part in match.groups() if part] if match else []
    if not currencies or len(set(currencies)) != len(currencies) or any(c not in CURRENCIES for c in currencies):
        raise ValueError('Choose a supported currency, FX pair or chart currency index')
    return currencies
