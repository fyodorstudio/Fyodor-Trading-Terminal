"""Validated, editable automatic filters shared by readers and alert delivery."""
from functools import lru_cache
import json
from pathlib import Path

from pydantic import BaseModel, ConfigDict, Field, field_validator

from .rules import patterns, MAX_RULE_CHARS

DEFAULTS = json.loads(Path(__file__).with_name('relevance.json').read_text(encoding='utf-8'))['filter_defaults']


class FilterPolicy(BaseModel):
    model_config = ConfigDict(extra='forbid', strict=True)
    other_markets: bool = DEFAULTS['other_markets']
    crypto_only: bool = DEFAULTS['crypto_only']
    retail_quotes: bool = DEFAULTS['retail_quotes']
    non_market: bool = DEFAULTS['non_market']
    routine: bool = DEFAULTS['routine']
    metadata: bool = DEFAULTS['metadata']
    subject_context: bool = DEFAULTS['subject_context']
    broad_context: bool = DEFAULTS['broad_context']
    protect_official: bool = DEFAULTS['protect_official']
    protect_remarks: bool = DEFAULTS['protect_remarks']
    cross_market: bool = DEFAULTS['cross_market']
    other_market_terms: str = Field(default=DEFAULTS['other_market_terms'], max_length=MAX_RULE_CHARS)
    exceptions: str = Field(default=DEFAULTS['exceptions'], max_length=MAX_RULE_CHARS)

    @field_validator('other_market_terms', 'exceptions')
    @classmethod
    def keywords(cls, value):
        patterns(value)
        return value


@lru_cache(maxsize=128)
def parse_policy(value=''):
    if len(value) > 16000:
        raise ValueError('Automatic filter settings exceed 16000 characters')
    return FilterPolicy.model_validate_json(value or '{}')


def canonical_policy(value=''):
    # Only overrides travel in URLs, preserving small default reading queries.
    return json.dumps(parse_policy(value).model_dump(exclude_defaults=True), ensure_ascii=False, sort_keys=True, separators=(',', ':'))
