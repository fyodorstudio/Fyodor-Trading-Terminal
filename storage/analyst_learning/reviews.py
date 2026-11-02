"""Agent-authored case analysis and versioned lessons with evidence gates."""
from typing import Literal
from uuid import uuid4
from pydantic import Field, model_validator
from ..contracts import Payload
from ..data_lock import data_lock
from .contracts import TAGS
from .store import digest, directory, instant, read, stamp, write


class CaseReview(Payload):
    episode_id: str
    outcome_id: str
    classification: Literal['source_omission', 'misweighting', 'stale_assumption', 'checkpoint_failure',
        'later_surprise', 'supported_reasoning_adverse_outcome', 'supported_reasoning_aligned_outcome', 'no_lesson', 'insufficient_evidence']
    analysis: str = Field(min_length=40, max_length=6000)
    known_before_cutoff: str = Field(min_length=20, max_length=2500)
    subsequent_information: str = Field(min_length=20, max_length=2500)
    source_evidence: list[dict] = Field(default_factory=list, max_length=12)
    expected_version: str | None = None
    revision_note: str = Field(default='', max_length=1500)


class LessonRequest(Payload):
    key: str = Field(pattern=r'^[a-z0-9]+(?:-[a-z0-9]+)*$', max_length=120)
    kind: Literal['process', 'hypothesis']
    status: Literal['trial', 'active', 'retired']
    currencies: list[str] = Field(min_length=1, max_length=8)
    mechanism_tags: list[str] = Field(min_length=1, max_length=6)
    situation: str = Field(min_length=20, max_length=1500)
    rule: str = Field(min_length=30, max_length=2000)
    exceptions: str = Field(min_length=30, max_length=2000)
    supporting_reviews: list[str] = Field(min_length=1, max_length=30)
    contrary_reviews: list[str] = Field(default_factory=list, max_length=30)
    validation_note: str = Field(min_length=30, max_length=2500)
    expected_version: str | None = None
    revision_note: str = Field(default='', max_length=1500)

    @model_validator(mode='after')
    def valid_scope(self):
        from ..currencies import CURRENCIES
        if len(set(self.currencies)) != len(self.currencies) or any(c not in CURRENCIES for c in self.currencies):
            raise ValueError('Lesson currencies must be distinct supported currencies')
        if len(set(self.mechanism_tags)) != len(self.mechanism_tags) or any(t not in TAGS for t in self.mechanism_tags):
            raise ValueError('Lesson mechanism tags are invalid')
        if set(self.supporting_reviews).intersection(self.contrary_reviews):
            raise ValueError('A review cannot be both supporting and contrary evidence')
        return self


def append_review(journal_path, request, now=None):
    request = CaseReview.model_validate(request)
    target = directory(journal_path)
    with data_lock(target):
        episodes = {e['id']: e for e in read(target / 'episodes.json', {'episodes': []})['episodes']}
        outcomes = {o['id']: o for o in read(target / 'outcomes.json', {'outcomes': []})['outcomes']}
        outcomes.update({o['id']: o for o in read(target / 'daily-outcomes.json', {'outcomes': []})['outcomes']})
        episode, outcome = episodes.get(request.episode_id), outcomes.get(request.outcome_id)
        if not episode or not outcome or outcome['episode_id'] != episode['id']:
            raise ValueError('Review needs an existing episode and its recorded outcome')
        available = outcome['observation']['status'] in ('complete', 'partial') or (
            outcome.get('phase') == 'final' and outcome.get('after_verdict', {}).get('status') in ('complete', 'partial'))
        if not available and request.classification not in ('insufficient_evidence', 'checkpoint_failure'):
            raise ValueError('Unavailable outcomes cannot substantiate an outcome diagnosis')
        if request.classification in ('source_omission', 'misweighting', 'later_surprise') and not request.source_evidence:
            raise ValueError('A causal diagnosis needs dated source evidence, not price alone')
        for evidence in request.source_evidence:
            if not isinstance(evidence, dict) or not str(evidence.get('url', '')).startswith(('https://', 'http://')) or not evidence.get('claim') or not evidence.get('availability_note'):
                raise ValueError('Review source evidence needs URL, claim and publication-availability qualification')
            published = evidence.get('published_at')
            if published:
                when = instant(published)
                if when > instant(now or stamp()):
                    raise ValueError('Source publication cannot be future')
                if evidence.get('used_as_pre_cutoff') and when > instant(episode['cutoff_utc']):
                    raise ValueError('Later evidence cannot be labelled available before the original cutoff')
            elif evidence.get('used_as_pre_cutoff'):
                raise ValueError('Unknown publication times cannot establish precise pre-cutoff availability')
        book = read(target / 'reviews.json', {'version': 1, 'reviews': []})
        previous = next((r for r in reversed(book['reviews']) if r['episode_id'] == episode['id']), None)
        if request.expected_version != (previous['id'] if previous else None) or previous and not request.revision_note.strip():
            raise ValueError('Review changed; read its version and explain the correction')
        record = {**request.model_dump(mode='json'), 'id': uuid4().hex, 'recorded_utc': now or stamp(),
            'episode_hash': episode['input_hash'], 'outcome_hash': digest(outcome), 'method': 'agent_review_not_independent_replay'}
        book['reviews'].append(record)
        write(target / 'reviews.json', book)
        return record


def append_lesson(journal_path, request, now=None):
    request = LessonRequest.model_validate(request)
    target = directory(journal_path)
    with data_lock(target):
        reviews = {r['id']: r for r in read(target / 'reviews.json', {'reviews': []})['reviews']}
        if any(key not in reviews for key in [*request.supporting_reviews, *request.contrary_reviews]):
            raise ValueError('Lessons must reference recorded supporting and contrary case reviews')
        if any(reviews[key]['classification'] == 'insufficient_evidence' for key in request.supporting_reviews):
            raise ValueError('An unresolved case cannot substantiate a lesson')
        book = read(target / 'lessons.json', {'version': 1, 'lessons': []})
        previous = next((l for l in reversed(book['lessons']) if l['key'] == request.key), None)
        if previous and previous['kind'] != request.kind:
            raise ValueError('Lesson kind is fixed; do not relabel a directional hypothesis as a process correction')
        if request.expected_version != (previous['id'] if previous else None) or previous and not request.revision_note.strip():
            raise ValueError('Lesson changed; read its version and explain the correction')
        if request.kind == 'hypothesis' and request.status == 'active':
            if not previous:
                raise ValueError('Directional hypotheses start in trial, never active from retrospective wins')
            episodes = {e['id']: e for e in read(target / 'episodes.json', {'episodes': []})['episodes']}
            prospective = [episodes[reviews[key]['episode_id']] for key in request.supporting_reviews
                if previous['id'] in (episodes[reviews[key]['episode_id']].get('evaluation') or {}).get('lesson_ids', [])
                and instant(episodes[reviews[key]['episode_id']]['delivered_utc']) > instant(previous['recorded_utc'])]
            if len({e['delivered_utc'][:10] for e in prospective}) < 2 or not request.contrary_reviews:
                raise ValueError('Promotion needs prospective applications across distinct dates and reviewed contrary cases; this is not proof of edge')
        record = {**request.model_dump(mode='json'), 'id': uuid4().hex, 'recorded_utc': now or stamp(),
            'evidence_scope': 'Process improvement' if request.kind == 'process' else 'Limited reviewed evidence; no statistical edge established'}
        book['lessons'].append(record)
        write(target / 'lessons.json', book)
        return record


def retrieve(journal_path, currencies, tags=(), limit=5, as_of=None):
    latest = {l['key']: l for l in read(directory(journal_path) / 'lessons.json', {'lessons': []})['lessons']
        if not as_of or instant(l['recorded_utc']) <= instant(as_of)}
    ranked = []
    for lesson in latest.values():
        if lesson['status'] == 'retired' or not set(currencies).intersection(lesson['currencies']):
            continue
        overlap = len(set(tags).intersection(lesson['mechanism_tags']))
        if tags and not overlap:
            continue
        ranked.append((overlap, lesson['status'] == 'active', lesson['recorded_utc'], lesson))
    ranked.sort(key=lambda item: item[:3], reverse=True)
    return [{k: lesson[k] for k in ('id', 'key', 'kind', 'status', 'situation', 'rule', 'exceptions', 'validation_note', 'evidence_scope')}
        for *_, lesson in ranked[:limit]]
