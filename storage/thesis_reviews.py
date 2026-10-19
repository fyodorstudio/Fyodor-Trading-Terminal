"""Dated review context shared by exact, immutable opportunity versions."""
from datetime import date, datetime, timezone
import json
import os
from pathlib import Path
import tempfile
from threading import RLock
from typing import Literal
from uuid import uuid4

from pydantic import Field, model_validator
from .contracts import Payload
from .currencies import CURRENCIES, CalendarCurrency
from .data_lock import data_lock
from .highlight_journal import JournalSource

ID = r'^[0-9a-f]{32}$'
CATEGORIES = ('policy', 'inflation', 'labor', 'growth', 'other')
LOCK = RLock()


def currencies(scope):
    if scope == 'ALL':
        return tuple(CURRENCIES)
    from .thesis import pair_scope
    return pair_scope(scope)


class BackdropEvidence(Payload):
    published_on: date | None
    summary: str = Field(min_length=1, max_length=1500)
    verified_utc: datetime
    sources: list[JournalSource] = Field(min_length=1, max_length=8)
    publication_note: str = Field(default='', max_length=500)


class BackdropCell(Payload):
    currency: CalendarCurrency
    category: Literal['policy', 'inflation', 'labor', 'growth', 'other']
    evidence: list[BackdropEvidence] = Field(default_factory=list, max_length=6)
    gap: str = Field(default='', max_length=1500)


class ReviewRequest(Payload):
    scope: str
    as_of_utc: datetime
    takeaway: str = Field(min_length=1, max_length=2000)
    horizon: str = Field(min_length=1, max_length=300)
    backdrop: list[BackdropCell] = Field(min_length=10, max_length=40)
    opportunity_ids: list[str] = Field(default_factory=list, max_length=28)
    limitations: str = Field(default='', max_length=4000)
    note: str = Field(default='', max_length=4000)
    provenance: Literal['assessment', 'reconstruction'] = 'assessment'
    review_id: str | None = Field(default=None, pattern=ID)
    expected_version: str | None = Field(default=None, pattern=ID)

    @model_validator(mode='after')
    def valid_review(self):
        wanted = {(currency, category) for currency in currencies(self.scope) for category in CATEGORIES}
        actual = [(cell.currency, cell.category) for cell in self.backdrop]
        if len(actual) != len(set(actual)) or set(actual) != wanted:
            raise ValueError('Save a complete five-category backdrop for every reviewed currency, with explicit gaps')
        if self.as_of_utc.tzinfo is None or self.as_of_utc > datetime.now(timezone.utc):
            raise ValueError('Review cutoff needs an explicit offset and cannot be in the future')
        self.as_of_utc = self.as_of_utc.astimezone(timezone.utc)
        if not self.takeaway.strip() or not self.horizon.strip() or self.provenance == 'reconstruction' and not self.note.strip():
            raise ValueError('Keep the takeaway, horizon and reconstruction provenance explicit')
        if len(set(self.opportunity_ids)) != len(self.opportunity_ids) or any(
                len(identity) != 32 or any(c not in '0123456789abcdef' for c in identity) for identity in self.opportunity_ids):
            raise ValueError('Link unique exact assessment version IDs')
        for cell in self.backdrop:
            if not cell.evidence and not cell.gap.strip():
                raise ValueError('An unresearched cell needs an explicit evidence gap')
            for item in cell.evidence:
                if not item.summary.strip() or not any(source.kind == 'web' for source in item.sources):
                    raise ValueError('Backdrop evidence needs a summary and direct web evidence')
                if item.verified_utc.tzinfo is None or item.verified_utc > self.as_of_utc:
                    raise ValueError('Evidence verification cannot follow the review cutoff')
                item.verified_utc = item.verified_utc.astimezone(timezone.utc)
                if item.published_on is None and not item.publication_note.strip():
                    raise ValueError('Unknown publication dates need an explanation')
                # A source date is preserved as a date, never a fabricated publication hour.
                from .thesis import JAKARTA
                if item.published_on and item.published_on > item.verified_utc.astimezone(JAKARTA).date():
                    raise ValueError('Future releases belong in Alert, not occurred backdrop evidence')
        return self


class ReviewEntry(ReviewRequest):
    id: str = Field(pattern=ID)
    review_id: str = Field(pattern=ID)
    saved_utc: datetime


class ReviewBook(Payload):
    version: Literal[1] = 1
    reviews: list[ReviewEntry] = Field(default_factory=list, max_length=10000)


def read_reviews(journal_path):
    path = Path(journal_path).with_name('reviews.json')
    if not path.exists():
        return []
    items = ReviewBook.model_validate_json(path.read_text(encoding='utf-8')).model_dump(mode='json')['reviews']
    latest, seen = {}, set()
    for item in items:
        prior = latest.get(item['review_id'])
        if item['id'] in seen or item['expected_version'] != (prior['id'] if prior else None):
            raise ValueError('Review history is incomplete or conflicting; preserve the file')
        if prior and (item['scope'], item['as_of_utc']) != (prior['scope'], prior['as_of_utc']):
            raise ValueError('Corrections retain the original review scope and cutoff; new assessments create new reviews')
        seen.add(item['id']); latest[item['review_id']] = item
    return items


def append_review(request, journal_path):
    from .thesis import read_theses
    path = Path(journal_path).with_name('reviews.json')
    path.parent.mkdir(parents=True, exist_ok=True)
    with LOCK, data_lock(path.parent):
        history = read_reviews(journal_path)
        latest = {item['review_id']: item for item in history}
        previous = latest.get(request.review_id)
        if request.review_id and not previous:
            raise ValueError('Unknown review; omit review_id for a new dated assessment')
        if request.expected_version != (previous['id'] if previous else None):
            raise ValueError('Review changed; read the latest version before appending')
        if previous and (request.scope != previous['scope'] or request.as_of_utc != datetime.fromisoformat(previous['as_of_utc'])):
            raise ValueError('A new cutoff creates a new review; corrections preserve the original cutoff')
        entries = {item['id']: item for item in read_theses(journal_path)}
        for identity in request.opportunity_ids:
            item = entries.get(identity)
            if not item or datetime.fromisoformat(item['as_of_utc']) != request.as_of_utc or (
                    item['collection'] != 'across' if request.scope == 'ALL' else item['scope'] != request.scope or item['collection'] != 'pair'):
                raise ValueError('Link exact opportunity versions from this review scope, collection and cutoff')
        for cell in request.backdrop:
            if any(source.kind == 'local' and not Path(source.locator).is_file() for item in cell.evidence for source in item.sources):
                raise ValueError('Local evidence must exist when saved')
        entry = ReviewEntry(**{**request.model_dump(), 'review_id': request.review_id or uuid4().hex},
            id=uuid4().hex, saved_utc=datetime.now(timezone.utc))
        # Preserve every earlier review exactly, including absent legacy defaults.
        old = json.loads(path.read_text(encoding='utf-8'))['reviews'] if path.exists() else []
        temporary = None
        try:
            with tempfile.NamedTemporaryFile(mode='w', encoding='utf-8', dir=path.parent, suffix='.tmp', delete=False) as output:
                temporary = output.name
                json.dump({'version': 1, 'reviews': [*old, entry.model_dump(mode='json')]}, output, indent=2, ensure_ascii=False)
                output.flush(); os.fsync(output.fileno())
            os.replace(temporary, path)
        finally:
            if temporary:
                Path(temporary).unlink(missing_ok=True)
        return {'id': entry.id, 'review_id': entry.review_id, 'saved_utc': entry.saved_utc.isoformat(), 'path': str(path)}


def project_review(item, history, entries):
    by_id = {entry['id']: entry for entry in entries}
    opportunities = []
    for identity in item['opportunity_ids']:
        row = by_id.get(identity)
        if not row or datetime.fromisoformat(row['as_of_utc']) != datetime.fromisoformat(item['as_of_utc']) or (
                row['collection'] != 'across' if item['scope'] == 'ALL' else row['scope'] != item['scope'] or row['collection'] != 'pair'):
            raise ValueError('Review-linked assessment is missing; preserve both journals')
        versions = [entry for entry in entries if entry['row_id'] == row['row_id']]
        versions = versions[:next(index for index, entry in enumerate(versions) if entry['id'] == identity) + 1]
        prior = by_id.get(row['compared_with'])
        opportunities.append({**row, 'versions': versions,
            'comparison': {key: prior[key] for key in ('id', 'as_of_utc', 'verdict')} if prior else None})
    return {**item, 'versions': history, 'opportunities': opportunities}


def review_snapshots(journal_path, scope, month, entries, history=None):
    from .thesis import JAKARTA
    groups = {}
    for entry in read_reviews(journal_path) if history is None else history:
        if entry['scope'] == scope:
            groups.setdefault(entry['review_id'], []).append(entry)
    return sorted([project_review(history[-1], history, entries) for history in groups.values()
        if datetime.fromisoformat(history[-1]['as_of_utc']).astimezone(JAKARTA).strftime('%Y-%m') == month],
        key=lambda item: (item['as_of_utc'], item['saved_utc'], item['id']), reverse=True)


def review_context(journal_path, scope, as_of=None):
    from .thesis import read_theses
    cutoff = datetime.fromisoformat(as_of.replace('Z', '+00:00')) if as_of else datetime.now(timezone.utc)
    if cutoff.tzinfo is None or cutoff > datetime.now(timezone.utc):
        raise ValueError('Context cutoff needs an explicit offset no later than now')
    selected = set(currencies(scope))
    history = [item for item in read_reviews(journal_path) if datetime.fromisoformat(item['as_of_utc']) <= cutoff
        and selected.issubset(currencies(item['scope']))]
    latest = {item['review_id']: item for item in history}
    ordered = sorted(latest.values(), key=lambda item: (item['as_of_utc'], item['saved_utc']), reverse=True)
    entries = [item for item in read_theses(journal_path) if datetime.fromisoformat(item['as_of_utc']) <= cutoff]
    review = project_review(ordered[0], [ordered[0]], entries) if ordered else None
    if review:
        review.pop('versions')  # Context is bounded; monthly reads retain full correction history.
    if review and scope != 'ALL':
        review['backdrop'] = [cell for cell in review['backdrop'] if cell['currency'] in selected]
        review['opportunities'] = [item for item in review['opportunities'] if item['scope'] == scope]
    corrected = {(item['row_id'], item['as_of_utc']): item for item in entries}
    pair_entries = sorted([item for item in corrected.values() if scope == 'ALL' and item['collection'] == 'across' or item['scope'] == scope],
        key=lambda item: (item['as_of_utc'], item['saved_utc']), reverse=True)
    return {'scope': scope, 'cutoff_utc': cutoff.isoformat(), 'latest_review': review,
        'prior_review_takeaways': [{key: item[key] for key in ('id', 'as_of_utc', 'takeaway')} for item in ordered[1:4]],
        'latest_assessments': pair_entries[:4],
        'last_directional_assessment': next((item for item in pair_entries if item['verdict'] != 'MIXED'), None) if scope != 'ALL' else None,
        'note': 'Dated saved context, not fresh evidence. Refresh web sources. No automatic analysis, scheduling or writes.'}
