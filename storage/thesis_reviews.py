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
from .research_instruments import Commodity

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


class CurrencyCheckpoint(Payload):
    title: str = Field(min_length=1, max_length=300)
    event_at: datetime | None = None
    event_date: date | None = None
    verified_utc: datetime
    sources: list[JournalSource] = Field(min_length=1, max_length=8)
    note: str = Field(default='', max_length=1500)


class CurrencyView(Payload):
    currency: CalendarCurrency
    bias: str = Field(default='', max_length=160)
    summary: str = Field(default='', max_length=1500)
    counterweight: str = Field(default='', max_length=1000)
    sources: list[JournalSource] = Field(default_factory=list, max_length=8)
    news: list['CurrencyNews'] = Field(default_factory=list, max_length=30)
    news_gap: str = Field(default='', max_length=1500)
    checkpoints: list[CurrencyCheckpoint] = Field(default_factory=list, max_length=8)
    direction: 'DailyDirection | None' = None


class DirectionAnchor(Payload):
    title: str = Field(min_length=1, max_length=300)
    event_at: datetime | None = None
    event_date: date | None = None
    sources: list[JournalSource] = Field(min_length=1, max_length=8)
    note: str = Field(min_length=1, max_length=1500)


class DailyDirection(Payload):
    verdict: Literal['POTENTIAL STRENGTHENING', 'POTENTIAL WEAKENING']
    reason: str = Field(min_length=1, max_length=1500)
    verified_utc: datetime
    sources: list[JournalSource] = Field(min_length=1, max_length=8)
    basis: Literal['standalone'] | None = Field(default=None, exclude_if=lambda value: value is None)
    intensity: Literal['strong', 'moderate', 'slight'] | None = Field(default=None, exclude_if=lambda value: value is None)
    horizon: str = Field(default='', max_length=300, exclude_if=lambda value: not value)
    reassessment: CurrencyCheckpoint | None = None
    reassessment_gap: str = Field(default='', max_length=700)
    evidence_anchor: DirectionAnchor | None = Field(default=None, exclude_if=lambda value: value is None)
    review_status: Literal['complete', 'provisional'] | None = Field(default=None, exclude_if=lambda value: value is None)
    stage_note: str = Field(default='', max_length=700, exclude_if=lambda value: not value)

    @model_validator(mode='after')
    def valid_stage(self):
        if bool(self.review_status) != bool(self.stage_note.strip()) or not self.review_status and self.stage_note:
            raise ValueError('Review status and a nonblank reviewed-stage note belong together')
        return self


class OpportunityEvidence(Payload):
    expected_baseline: str = Field(min_length=1, max_length=1500)
    new_information: str = Field(min_length=1, max_length=1500)
    remaining_case: str = Field(min_length=1, max_length=1500)
    flow_channel: str = Field(min_length=1, max_length=1500)
    flow_basis: Literal['observed', 'reported', 'inferred']
    horizon: str = Field(min_length=1, max_length=300)
    market_feedback: str = Field(min_length=1, max_length=1500)
    verified_utc: datetime
    sources: list[JournalSource] = Field(min_length=1, max_length=8)


class OpportunityWindow(Payload):
    summary: str = Field(min_length=1, max_length=700)
    starts_at: datetime
    ends_at: datetime
    timing_note: str = Field(min_length=1, max_length=700)
    invalidation: str = Field(min_length=1, max_length=700)
    stage: Literal['active', 'conditional'] | None = None
    activation: str = Field(default='', max_length=700)
    evidence: OpportunityEvidence | None = None


class CurrencyOpportunity(OpportunityWindow):
    currency: CalendarCurrency


class CommodityOpportunity(OpportunityWindow):
    instrument: Commodity
    symbol: str = Field(min_length=1, max_length=160)
    provider: str = Field(min_length=1, max_length=300)
    instrument_type: Literal['spot', 'spot_cfd', 'futures', 'futures_cfd']
    contract_note: str = Field(min_length=1, max_length=700)
    verdict: Literal['BUY', 'SELL', 'STRONG BUY', 'STRONG SELL']
    checkpoints: list[CurrencyCheckpoint] = Field(default_factory=list, max_length=8)


class CurrencyNews(Payload):
    published_on: date
    published_at: datetime | None = None
    summary: str = Field(min_length=1, max_length=1500)
    verified_utc: datetime
    sources: list[JournalSource] = Field(min_length=1, max_length=8)


class ReviewRequest(Payload):
    scope: str
    format: Literal['assessment', 'daily_news'] = 'assessment'
    as_of_utc: datetime
    takeaway: str = Field(default='', max_length=2000)
    horizon: str = Field(default='Published news', min_length=1, max_length=300)
    backdrop: list[BackdropCell] = Field(default_factory=list, max_length=40)
    opportunity_ids: list[str] = Field(default_factory=list, max_length=28)
    currency_views: list[CurrencyView] = Field(default_factory=list, max_length=8)
    entry_opportunities: list[CurrencyOpportunity] = Field(default_factory=list, max_length=8)
    commodity_opportunities: list[CommodityOpportunity] = Field(default_factory=list, max_length=3)
    opportunity_gap: str = Field(default='', max_length=1500)
    planning_as_of_utc: datetime | None = None
    limitations: str = Field(default='', max_length=4000)
    note: str = Field(default='', max_length=4000)
    provenance: Literal['assessment', 'reconstruction'] = 'assessment'
    review_id: str | None = Field(default=None, pattern=ID)
    expected_version: str | None = Field(default=None, pattern=ID)

    @model_validator(mode='after')
    def valid_review(self):
        from .thesis import JAKARTA
        daily = self.format == 'daily_news'
        wanted = {(currency, category) for currency in currencies(self.scope) for category in CATEGORIES}
        actual = [(cell.currency, cell.category) for cell in self.backdrop]
        if (not daily or actual) and (len(actual) != len(set(actual)) or set(actual) != wanted):
            raise ValueError('Save a complete five-category backdrop for every reviewed currency, with explicit gaps')
        if self.as_of_utc.tzinfo is None or self.as_of_utc > datetime.now(timezone.utc):
            raise ValueError('Review cutoff needs an explicit offset and cannot be in the future')
        self.as_of_utc = self.as_of_utc.astimezone(timezone.utc)
        recorded_at = getattr(self, 'saved_utc', None) or datetime.now(timezone.utc)
        if daily and self.as_of_utc.astimezone(JAKARTA).date() < recorded_at.astimezone(JAKARTA).date() and self.provenance != 'reconstruction':
            raise ValueError('A past daily news table must be labelled reconstruction')
        if (not daily and not self.takeaway.strip()) or not self.horizon.strip() or self.provenance == 'reconstruction' and not self.note.strip():
            raise ValueError('Keep the takeaway, horizon and reconstruction provenance explicit')
        if len(set(self.opportunity_ids)) != len(self.opportunity_ids) or any(
                len(identity) != 32 or any(c not in '0123456789abcdef' for c in identity) for identity in self.opportunity_ids):
            raise ValueError('Link unique exact assessment version IDs')
        selected = set(currencies(self.scope))
        if daily and (self.scope != 'ALL' or self.opportunity_ids or not self.currency_views):
            raise ValueError('Daily news needs all eight currency rows and no pair opportunities')
        if self.currency_views and (len(self.currency_views) != len(selected)
                or {item.currency for item in self.currency_views} != selected
                or not daily and any(not all(value.strip() for value in (item.bias, item.summary, item.counterweight))
                       or not any(source.kind == 'web' for source in item.sources) for item in self.currency_views)):
            raise ValueError('Save one standalone view for every reviewed currency')
        for view in self.currency_views:
            if daily and (view.bias or view.summary or view.counterweight or view.sources):
                raise ValueError('Daily news uses direction and news; omit legacy bias, summary, counterweight and sources fields')
            if view.direction:
                direction = view.direction
                if not daily or not direction.reason.strip() or not any(source.kind == 'web' for source in direction.sources):
                    raise ValueError('Daily directions need a dominant reason and direct web evidence')
                if direction.verified_utc.tzinfo is None or direction.verified_utc > recorded_at:
                    raise ValueError('Direction verification needs its real offset-aware clock, no later than now')
                direction.verified_utc = direction.verified_utc.astimezone(timezone.utc)
                if direction.basis == 'standalone':
                    if not direction.intensity or not direction.horizon.strip():
                        raise ValueError('Standalone currency directions need qualitative intensity and an assessment horizon')
                elif direction.intensity or direction.horizon:
                    raise ValueError('Qualitative intensity and horizon require an explicit standalone currency assessment')
                if not getattr(self, 'saved_utc', None) and not self.review_id and direction.basis != 'standalone':
                    raise ValueError('New daily reviews need standalone currency directions; do not copy a pair-leg bias')
                anchor = direction.evidence_anchor
                if anchor:
                    if not anchor.title.strip() or not anchor.note.strip() or not any(source.kind == 'web' for source in anchor.sources):
                        raise ValueError('Direction anchor needs a title, timing explanation and direct web evidence')
                    if anchor.event_at is not None:
                        if (anchor.event_date is not None or anchor.event_at.tzinfo is None
                                or anchor.event_at > min(self.as_of_utc, direction.verified_utc)):
                            raise ValueError('Direction anchor needs one verified past clock, no later than cutoff and verification')
                        anchor.event_at = anchor.event_at.astimezone(timezone.utc)
                    elif anchor.event_date is None or anchor.event_date > min(self.as_of_utc, direction.verified_utc).astimezone(JAKARTA).date():
                        raise ValueError('Direction anchor needs a past source date when its hour is unknown')
            if daily and not view.news and not view.news_gap.strip():
                raise ValueError('A currency without news needs an explicit coverage gap')
            for item in view.news:
                if not item.summary.strip() or not any(source.kind == 'web' for source in item.sources):
                    raise ValueError('News needs a summary and direct web evidence')
                if item.published_on != self.as_of_utc.astimezone(JAKARTA).date():
                    raise ValueError('News publication date must match the selected Jakarta day')
                if item.verified_utc.tzinfo is None or item.verified_utc > recorded_at:
                    raise ValueError('News verification needs its real offset-aware clock, no later than now')
                item.verified_utc = item.verified_utc.astimezone(timezone.utc)
                if item.published_on > item.verified_utc.astimezone(JAKARTA).date():
                    raise ValueError('News cannot be verified before its publication date')
                if item.published_at is not None:
                    if (item.published_at.tzinfo is None or item.published_at > self.as_of_utc
                            or item.published_at > item.verified_utc
                            or item.published_at.astimezone(JAKARTA).date() != item.published_on):
                        raise ValueError('News publication instant must match its date and precede cutoff and verification')
                    item.published_at = item.published_at.astimezone(timezone.utc)
        # Older saved news-only records remain readable; every new daily save is directional.
        directional = any(view.direction for view in self.currency_views) or bool(self.entry_opportunities or self.commodity_opportunities)
        if daily and (directional or not getattr(self, 'saved_utc', None)):
            if not all(view.direction for view in self.currency_views):
                raise ValueError('Choose strengthening or weakening for all eight currencies')
        if daily and not getattr(self, 'saved_utc', None) and not self.entry_opportunities and not self.commodity_opportunities and not self.opportunity_gap.strip():
            raise ValueError('An empty opportunity selection needs its evidence-based reason; do not force an entry')
        if (self.entry_opportunities or self.commodity_opportunities or self.opportunity_gap) and not daily:
            raise ValueError('Dated opportunity selections belong to daily news')
        if len({item.currency for item in self.entry_opportunities}) != len(self.entry_opportunities):
            raise ValueError('Summarize each selected currency once, strongest direction first')
        selected_day = self.as_of_utc.astimezone(JAKARTA).date()
        if len({item.instrument for item in self.commodity_opportunities}) != len(self.commodity_opportunities):
            raise ValueError('Summarize each commodity once; related oil contracts are one shared mechanism')
        for item in [*self.entry_opportunities, *self.commodity_opportunities]:
            if not getattr(self, 'saved_utc', None) and (not item.stage or not item.activation.strip() or not item.evidence):
                raise ValueError('New opportunities need active/conditional stage, activation and sourced economic evidence')
            if item.evidence:
                evidence = item.evidence
                if (any(not getattr(evidence, field).strip() for field in ('expected_baseline', 'new_information', 'remaining_case', 'flow_channel', 'horizon', 'market_feedback'))
                        or not any(source.kind == 'web' for source in evidence.sources)
                        or evidence.verified_utc.tzinfo is None or evidence.verified_utc > recorded_at):
                    raise ValueError('Opportunity evidence needs explicit mechanisms, direct web sources and its real verification clock')
                evidence.verified_utc = evidence.verified_utc.astimezone(timezone.utc)
            if not all(value.strip() for value in (item.summary, item.timing_note, item.invalidation)):
                raise ValueError('Currency entry summaries need a reason, timing explanation and invalidation')
            if (item.starts_at.tzinfo is None or item.ends_at.tzinfo is None or item.starts_at >= item.ends_at
                    or item.starts_at.astimezone(JAKARTA).date() != selected_day
                    or item.ends_at.astimezone(JAKARTA).date() != selected_day):
                raise ValueError('Entry windows must stay within the selected Jakarta date, start before end and include offsets')
            if self.provenance != 'reconstruction' and item.starts_at < self.as_of_utc:
                raise ValueError('Current entry windows start at or after the research cutoff')
            item.starts_at = item.starts_at.astimezone(timezone.utc)
            item.ends_at = item.ends_at.astimezone(timezone.utc)
        planning = self.planning_as_of_utc
        if planning is not None:
            if planning.tzinfo is None or not self.as_of_utc <= planning <= datetime.now(timezone.utc):
                raise ValueError('Planning cutoff needs an offset, at or after research and no later than now')
            self.planning_as_of_utc = planning.astimezone(timezone.utc)
        reassessments = [view.direction.reassessment for view in self.currency_views
            if view.direction and view.direction.reassessment]
        if any(not item.note.strip() for item in reassessments):
            raise ValueError('Explain why the selected checkpoint requires reassessing the currency verdict')
        if any(view.direction and view.direction.reassessment and view.direction.reassessment_gap.strip() for view in self.currency_views):
            raise ValueError('Choose a reassessment checkpoint or explain the schedule gap, not both')
        checkpoints = [checkpoint for view in [*self.currency_views, *self.commodity_opportunities] for checkpoint in view.checkpoints] + reassessments
        if checkpoints and planning is None:
            raise ValueError('Release preparation needs its own real planning cutoff')
        for item in checkpoints:
            if not item.title.strip() or not any(source.kind == 'web' for source in item.sources):
                raise ValueError('Release schedules need direct web evidence')
            if item.verified_utc.tzinfo is None or item.verified_utc > planning:
                raise ValueError('Schedule verification cannot follow the planning cutoff')
            item.verified_utc = item.verified_utc.astimezone(timezone.utc)
            upcoming_cutoff = self.as_of_utc if daily else planning
            if item.event_at is not None:
                if item.event_date is not None or item.event_at.tzinfo is None or item.event_at <= upcoming_cutoff:
                    raise ValueError('Timed upcoming stages need an offset, one clock and a future planning instant')
                item.event_at = item.event_at.astimezone(timezone.utc)
            elif item.event_date is not None:
                from .thesis import JAKARTA
                if item.event_date < upcoming_cutoff.astimezone(JAKARTA).date():
                    raise ValueError('Upcoming source dates cannot precede preparation')
            elif daily:
                raise ValueError('Daily upcoming news needs a scheduled date or instant')
            elif not item.note.strip():
                raise ValueError('Unscheduled catalysts need an explicit timing note')
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
        view_sources = [source for view in request.currency_views for source in view.sources]
        news_sources = [source for view in request.currency_views for item in view.news for source in item.sources]
        checkpoint_sources = [source for view in [*request.currency_views, *request.commodity_opportunities] for checkpoint in view.checkpoints for source in checkpoint.sources]
        checkpoint_sources += [source for view in request.currency_views if view.direction and view.direction.reassessment for source in view.direction.reassessment.sources]
        direction_sources = [source for view in request.currency_views if view.direction for source in view.direction.sources]
        direction_sources += [source for view in request.currency_views if view.direction and view.direction.evidence_anchor for source in view.direction.evidence_anchor.sources]
        opportunity_sources = [source for item in [*request.entry_opportunities, *request.commodity_opportunities] if item.evidence for source in item.evidence.sources]
        if any(source.kind == 'local' and not Path(source.locator).is_file() for source in view_sources + news_sources + checkpoint_sources + direction_sources + opportunity_sources):
            raise ValueError('Local currency evidence must exist when saved')
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
        if review.get('planning_as_of_utc') and datetime.fromisoformat(review['planning_as_of_utc']) > cutoff:
            review['planning_as_of_utc'] = None
            for view in review['currency_views']:
                view['checkpoints'] = []  # Later preparation is not historical knowledge.
                if view.get('direction'):
                    view['direction']['reassessment'] = None
                    view['direction']['reassessment_gap'] = 'Checkpoint prepared after this context cutoff.'
            for item in review['commodity_opportunities']:
                item['checkpoints'] = []
    if review and scope != 'ALL':
        review['backdrop'] = [cell for cell in review['backdrop'] if cell['currency'] in selected]
        review['opportunities'] = [item for item in review['opportunities'] if item['scope'] == scope]
        review['currency_views'] = [item for item in review['currency_views'] if item['currency'] in selected]
        review['entry_opportunities'] = [item for item in review['entry_opportunities'] if item['currency'] in selected]
        review['commodity_opportunities'] = []
    corrected = {(item['row_id'], item['as_of_utc']): item for item in entries}
    pair_entries = sorted([item for item in corrected.values() if scope == 'ALL' and item['collection'] == 'across' or item['scope'] == scope],
        key=lambda item: (item['as_of_utc'], item['saved_utc']), reverse=True)
    return {'scope': scope, 'cutoff_utc': cutoff.isoformat(), 'latest_review': review,
        'prior_review_takeaways': [{key: item[key] for key in ('id', 'as_of_utc', 'takeaway')} for item in ordered[1:4]],
        'latest_assessments': pair_entries[:4],
        'last_directional_assessment': next((item for item in pair_entries if item['verdict'] != 'MIXED'), None) if scope != 'ALL' else None,
        'note': 'Dated saved context, not fresh evidence. Refresh web sources. No automatic analysis, scheduling or writes.'}
