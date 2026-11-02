"""Optional prospective evidence for evaluation; older Thesis records stay valid."""
from datetime import datetime
from typing import Literal
from pydantic import Field, model_validator
from ..contracts import Payload
from ..currencies import CURRENCIES

TAGS = ('policy', 'inflation', 'labour', 'activity', 'fiscal', 'funding', 'energy', 'risk', 'trade', 'haven', 'guidance')


class PairRecommendation(Payload):
    intensity: Literal['slight', 'moderate', 'strong']
    rank: int = Field(ge=1, le=28)
    strongest_opposition: str = Field(min_length=20, max_length=1200)
    invalidation: str = Field(min_length=20, max_length=1200)


class RelativePreference(Payload):
    pair: str = Field(pattern=r'^[A-Z]{6}$')
    verdict: Literal['BUY', 'SELL']
    reason: str = Field(min_length=20, max_length=1000)
    recommendation: PairRecommendation | None = Field(default=None, exclude_if=lambda value: value is None)

    @model_validator(mode='after')
    def valid_pair(self):
        if self.pair[:3] == self.pair[3:] or any(c not in CURRENCIES for c in (self.pair[:3], self.pair[3:])):
            raise ValueError('Relative preference needs two distinct supported currencies')
        return self


class AssessmentEvaluation(Payload):
    until_utc: datetime
    mechanism_tags: list[str] = Field(min_length=1, max_length=6)
    intensity_reason: str = Field(min_length=20, max_length=1200)
    strongest_opposition: str = Field(min_length=20, max_length=1200)
    invalidation: str = Field(min_length=20, max_length=1200)
    lesson_ids: list[str] = Field(default_factory=list, max_length=6)
    review_ids: list[str] = Field(default_factory=list, max_length=12, exclude_if=lambda value: not value)
    relative_preferences: list[RelativePreference] = Field(default_factory=list, max_length=7)

    @model_validator(mode='after')
    def validate_context(self):
        if self.until_utc.tzinfo is None:
            raise ValueError('Evaluation end needs an explicit timezone')
        if len(set(self.mechanism_tags)) != len(self.mechanism_tags) or any(t not in TAGS for t in self.mechanism_tags):
            raise ValueError('Use distinct supported mechanism tags')
        if len(set(self.lesson_ids)) != len(self.lesson_ids):
            raise ValueError('Lesson references must be unique')
        if len(set(self.review_ids)) != len(self.review_ids):
            raise ValueError('Reviewed case references must be unique')
        if len({p.pair for p in self.relative_preferences}) != len(self.relative_preferences):
            raise ValueError('Record a pair preference once per assessment')
        return self
