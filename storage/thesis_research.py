"""Thesis developments and assessments: one append-only research ledger.

Calendar observations, External Sources and reminder choices remain independent.
Older daily reviews are projected without rewriting their saved history.
"""
from datetime import date, datetime, timezone
from hashlib import sha256
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
from .thesis_reviews import CurrencyCheckpoint, DailyDirection, read_reviews

LOCK = RLock()
ID = r'^[0-9a-f]{32}$'


def _clock(value, label, latest=None):
    if value.tzinfo is None or value > (latest or datetime.now(timezone.utc)):
        raise ValueError(f'{label} needs an offset and cannot follow its verification/cutoff')
    return value.astimezone(timezone.utc)


class DevelopmentImpact(Payload):
    currency: CalendarCurrency
    implication: str = Field(min_length=1, max_length=2000)
    thesis_effect: str = Field(min_length=1, max_length=2000)


class ResearchReference(Payload):
    kind: Literal['external', 'calendar']
    key: str = Field(min_length=1, max_length=200)
    broker: str | None = None
    value_ids: list[str] = Field(default_factory=list, max_length=40)

    @model_validator(mode='after')
    def valid_reference(self):
        if self.kind == 'calendar' and (not self.broker or not self.value_ids):
            raise ValueError('Calendar references retain the exact broker and value IDs')
        if self.kind == 'external' and (self.broker or self.value_ids):
            raise ValueError('External references use their stable key, not invented calendar IDs')
        return self


class Development(Payload):
    key: str = Field(pattern=r'^[a-z0-9]+(?:-[a-z0-9]+)*$', max_length=180)
    title: str = Field(min_length=1, max_length=300)
    facts: str = Field(min_length=1, max_length=6000)
    published_on: date
    published_at: datetime | None = None
    event_at: datetime | None = None
    timing_note: str = Field(default='', max_length=1500)
    verified_utc: datetime
    sources: list[JournalSource] = Field(min_length=1, max_length=12)
    impacts: list[DevelopmentImpact] = Field(default_factory=list, max_length=8)
    instruments: list[Commodity] = Field(default_factory=list, max_length=3)
    instrument_note: str = Field(default='', max_length=1500)
    commodity_implication: str = Field(default='', max_length=2000)
    commodity_thesis_effect: str = Field(default='', max_length=2000)
    references: list[ResearchReference] = Field(default_factory=list, max_length=12)
    expected_version: str | None = Field(default=None, pattern=ID)
    revision_note: str = Field(default='', max_length=1500)

    @model_validator(mode='after')
    def valid_development(self):
        from .thesis import JAKARTA
        self.verified_utc = _clock(self.verified_utc, 'Source verification')
        if self.published_on > self.verified_utc.astimezone(JAKARTA).date():
            raise ValueError('Future events belong in checkpoints, not occurred developments')
        if self.published_at:
            self.published_at = _clock(self.published_at, 'Publication', self.verified_utc)
            if self.published_at.astimezone(JAKARTA).date() != self.published_on:
                raise ValueError('Publication date and instant must agree in Jakarta')
        if self.event_at:
            self.event_at = _clock(self.event_at, 'Event time', self.verified_utc)
        if not self.published_at and not self.timing_note.strip():
            raise ValueError('Unknown publication hours need a timing explanation')
        if len({x.currency for x in self.impacts}) != len(self.impacts):
            raise ValueError('Record each currency implication once per development')
        if (not self.impacts and not self.instruments) or len(set(self.instruments)) != len(self.instruments):
            raise ValueError('A development needs currency impacts or supported commodity identities')
        if self.instruments and not all(x.strip() for x in (self.instrument_note,self.commodity_implication,self.commodity_thesis_effect)):
            raise ValueError('Commodity research retains instrument identity, implication and thesis effect')
        if not any(s.kind == 'web' for s in self.sources) or any(not x.strip() for x in [self.title, self.facts,
                *[v for impact in self.impacts for v in (impact.implication, impact.thesis_effect)]]):
            raise ValueError('Developments need sourced facts and nonblank currency interpretations')
        return self


class DevelopmentEntry(Development):
    id: str = Field(pattern=ID)
    saved_utc: datetime


class CurrencyAssessment(Payload):
    currency: CalendarCurrency
    direction: DailyDirection | None = None
    evidence_keys: list[str] = Field(default_factory=list, max_length=200)
    background_keys: list[str] = Field(default_factory=list, max_length=100)
    gap: str = Field(default='', max_length=3000)
    checkpoints: list[CurrencyCheckpoint] = Field(default_factory=list, max_length=30)


class ResearchRequest(Payload):
    as_of_utc: datetime
    period_start: date
    period_end: date
    currencies: list[CalendarCurrency] = Field(default_factory=lambda: list(CURRENCIES), min_length=1, max_length=8)
    developments: list[Development] = Field(default_factory=list, max_length=500)
    assessments: list[CurrencyAssessment] = Field(default_factory=list, max_length=8)
    provenance: Literal['assessment', 'reconstruction'] = 'assessment'
    note: str = Field(default='', max_length=4000)

    @model_validator(mode='after')
    def valid_request(self):
        from .thesis import JAKARTA
        self.as_of_utc = _clock(self.as_of_utc, 'Research cutoff')
        if self.period_start > self.period_end or self.period_end > self.as_of_utc.astimezone(JAKARTA).date():
            raise ValueError('Use an ordered occurred-news date range ending by the research cutoff')
        if self.provenance == 'reconstruction' and self.as_of_utc.astimezone(JAKARTA).date() != self.period_end:
            raise ValueError('A reconstruction uses its historical information cutoff on the interval end date')
        recorded = getattr(self, 'saved_utc', None) or datetime.now(timezone.utc)
        if self.provenance != 'reconstruction' and (self.period_end < recorded.astimezone(JAKARTA).date()
                or self.as_of_utc.astimezone(JAKARTA).date() < recorded.astimezone(JAKARTA).date()):
            raise ValueError('Past research periods/cutoffs require labelled reconstruction; do not replace live verdicts')
        if len(set(self.currencies)) != len(self.currencies) or len({a.currency for a in self.assessments}) != len(self.assessments):
            raise ValueError('Research currencies and assessments must be unique')
        if not self.developments and not self.assessments and not getattr(self, 'id', None):
            raise ValueError('Save findings or an explicit assessment/gap')
        if len({d.key for d in self.developments}) != len(self.developments):
            raise ValueError('One development per stable key in a batch')
        for d in self.developments:
            if (self.provenance != 'reconstruction' and d.verified_utc > self.as_of_utc) or (d.published_at and d.published_at > self.as_of_utc) or (d.event_at and d.event_at > self.as_of_utc):
                raise ValueError('Do not import post-cutoff evidence into research')
            if not set(x.currency for x in d.impacts).intersection(self.currencies) and not d.instruments:
                raise ValueError('A development must affect the requested research scope')
        for a in self.assessments:
            if a.currency not in self.currencies:
                raise ValueError('Assessment outside the declared research scope')
            if set(a.evidence_keys).intersection(a.background_keys):
                raise ValueError('Keep interval evidence and older active background separate')
            for cp in [*a.checkpoints, *([a.direction.reassessment] if a.direction and a.direction.reassessment else [])]:
                cp.verified_utc = _clock(cp.verified_utc, 'Schedule verification', None if self.provenance == 'reconstruction' else self.as_of_utc)
                if bool(cp.event_at) == bool(cp.event_date) or not cp.note.strip() or not any(s.kind == 'web' for s in cp.sources):
                    raise ValueError('Upcoming checkpoints need one clock/date, direct web evidence and relevance')
                if cp.event_at:
                    if cp.event_at.tzinfo is None or cp.event_at <= self.as_of_utc:
                        raise ValueError('Resolve elapsed stages rather than storing them as upcoming')
                    cp.event_at = cp.event_at.astimezone(timezone.utc)
                elif cp.event_date < self.as_of_utc.astimezone(JAKARTA).date():
                    raise ValueError('Upcoming date precedes the research cutoff')
            if not a.direction:
                if not a.gap.strip():
                    raise ValueError('An unresolved assessment needs an explicit gap; do not force a verdict')
                continue
            if not a.evidence_keys and not a.background_keys:
                raise ValueError('A fresh verdict must reference its recorded developments or active background')
            if len(set([*a.evidence_keys,*a.background_keys])) != len(a.evidence_keys)+len(a.background_keys):
                raise ValueError('Evidence references must be unique')
            d = a.direction
            if d.basis != 'standalone' or not d.intensity or not d.horizon.strip() or not d.reason.strip():
                raise ValueError('Assess broad standalone pressure with qualitative intensity and a horizon')
            d.verified_utc = _clock(d.verified_utc, 'Currency assessment', None if self.provenance == 'reconstruction' else self.as_of_utc)
            if not any(s.kind == 'web' for s in d.sources):
                raise ValueError('Assessments need direct source evidence')
            if bool(d.reassessment) == bool(d.reassessment_gap.strip()):
                raise ValueError('Choose the next material checkpoint or explain the exact scheduling gap')
            if d.evidence_anchor:
                anchor = d.evidence_anchor
                if bool(anchor.event_at) == bool(anchor.event_date):
                    raise ValueError('Evidence anchors retain one real event clock or date')
                if anchor.event_at:
                    anchor.event_at = _clock(anchor.event_at, 'Evidence anchor', self.as_of_utc)
                elif anchor.event_date > self.as_of_utc.astimezone(JAKARTA).date():
                    raise ValueError('An evidence anchor cannot be future')
            if d.reassessment:
                cp = d.reassessment
                cp.verified_utc = _clock(cp.verified_utc, 'Checkpoint verification', None if self.provenance == 'reconstruction' else self.as_of_utc)
                if bool(cp.event_at) == bool(cp.event_date) or not cp.note.strip():
                    raise ValueError('Checkpoint needs one verified scheduled clock/date and its transmission channel')
                if cp.event_at:
                    if cp.event_at.tzinfo is None or cp.event_at <= self.as_of_utc:
                        raise ValueError('Resolve elapsed checkpoints before selecting the next one')
                    cp.event_at = cp.event_at.astimezone(timezone.utc)
                elif cp.event_date < self.as_of_utc.astimezone(JAKARTA).date():
                    raise ValueError('Checkpoint source date precedes this assessment')
        if self.provenance == 'reconstruction' and not self.note.strip():
            raise ValueError('Label the historical information set and retrospective research explicitly')
        return self


class ResearchRun(ResearchRequest):
    id: str = Field(pattern=ID)
    saved_utc: datetime
    developments: list[Development] = Field(default_factory=list, exclude=True)
    # Exact immutable versions used for each assessment, resolved at append time.
    evidence_versions: dict[str, list[str]] = Field(default_factory=dict)
    development_ids: list[str] = Field(default_factory=list)


class ResearchBook(Payload):
    version: Literal[1] = 1
    developments: list[DevelopmentEntry] = Field(default_factory=list)
    runs: list[ResearchRun] = Field(default_factory=list)


def research_path(journal_path):
    return Path(journal_path).with_name('research.json')


def read_research(journal_path):
    path = research_path(journal_path)
    if not path.exists():
        return {'version': 1, 'developments': [], 'runs': []}
    book = ResearchBook.model_validate_json(path.read_text(encoding='utf-8')).model_dump(mode='json')
    latest, ids = {}, set()
    for d in book['developments']:
        prior = latest.get(d['key'])
        if d['id'] in ids or d['expected_version'] != (prior['id'] if prior else None):
            raise ValueError('Research development history conflicts; preserve the ledger')
        latest[d['key']] = d; ids.add(d['id'])
    run_ids = set()
    for run in book['runs']:
        if run['id'] in run_ids or any(i not in ids for i in [*run['development_ids'],*[i for values in run['evidence_versions'].values() for i in values]]):
            raise ValueError('Research run references missing evidence; preserve the ledger')
        run_ids.add(run['id'])
    return book


def append_research(request, journal_path):
    path = research_path(journal_path); path.parent.mkdir(parents=True, exist_ok=True)
    with LOCK, data_lock(path.parent):
        book = read_research(journal_path)
        latest = {d['key']: d for d in book['developments']}
        created, reused = [], []
        for d in request.developments:
            previous = latest.get(d.key)
            fields = d.model_dump(mode='json')
            content = lambda x: {k: v for k, v in x.items() if k not in ('id', 'saved_utc', 'verified_utc', 'expected_version', 'revision_note')}
            if previous and content(previous) == content(fields):
                reused.append(previous['id']); continue
            if d.expected_version != (previous['id'] if previous else None):
                raise ValueError(f'{d.key}: development changed; read its latest version')
            if previous and not d.revision_note.strip():
                raise ValueError('Explain corrected facts or interpretation without overwriting history')
            if any(s.kind == 'local' and not Path(s.locator).is_file() for s in d.sources):
                raise ValueError('Local research evidence must exist')
            item = DevelopmentEntry(**d.model_dump(), id=uuid4().hex, saved_utc=datetime.now(timezone.utc)).model_dump(mode='json')
            book['developments'].append(item); latest[d.key] = item; created.append(item['id'])
        versions = {}
        for a in request.assessments:
            chosen = []
            for key in [*a.evidence_keys, *a.background_keys]:
                d = latest.get(key)
                if not d or a.currency not in [i['currency'] for i in d['impacts']]:
                    raise ValueError(f'{a.currency}: missing matching development {key}')
                if request.provenance != 'reconstruction' and datetime.fromisoformat(d['verified_utc']) > request.as_of_utc:
                    raise ValueError('Referenced evidence was verified after the chosen cutoff')
                in_period = request.period_start.isoformat() <= d['published_on'] <= request.period_end.isoformat()
                if key in a.evidence_keys and not in_period or key in a.background_keys and d['published_on'] >= request.period_start.isoformat():
                    raise ValueError('Evidence keys belong in the period; background keys precede it')
                chosen.append(d['id'])
            versions[a.currency] = chosen
            if a.direction:
                sources = [*a.direction.sources, *([*a.direction.reassessment.sources] if a.direction.reassessment else [])]
                if any(s.kind == 'local' and not Path(s.locator).is_file() for s in sources):
                    raise ValueError('Local assessment evidence must exist')
        # Developments live once in the ledger; runs store references, not copies.
        run_data = request.model_dump(exclude={'developments'})
        run = ResearchRun(**run_data, id=uuid4().hex, saved_utc=datetime.now(timezone.utc), evidence_versions=versions,
            development_ids=[latest[d.key]['id'] for d in request.developments]).model_dump(mode='json')
        book['runs'].append(run)
        temporary = None
        try:
            with tempfile.NamedTemporaryFile(mode='w', encoding='utf-8', dir=path.parent, suffix='.tmp', delete=False) as output:
                temporary = Path(output.name); json.dump(book, output, ensure_ascii=False, indent=2)
                output.flush(); os.fsync(output.fileno())
            os.replace(temporary, path)
        finally:
            if temporary: temporary.unlink(missing_ok=True)
        persisted = read_research(journal_path)
        if persisted['runs'][-1]['id'] != run['id']:
            raise ValueError('Research read-back failed; preserve the ledger and inspect it')
        return {'id': run['id'], 'saved_utc': run['saved_utc'], 'created_development_ids': created,
                'reused_development_ids': reused, 'assessed_currencies': [a.currency for a in request.assessments],
                'period_start': request.period_start.isoformat(), 'period_end': request.period_end.isoformat(),
                'read_back_verified': True, 'path': str(path)}


def research_snapshot(journal_path, start, end, after_revision=None):
    """Range projection plus assessments known by its end; does no research/write."""
    from .thesis import JAKARTA
    start, end = date.fromisoformat(str(start)), date.fromisoformat(str(end))
    if start > end:
        raise ValueError('Choose an ordered research date range')
    book = read_research(journal_path)
    latest = {d['key']: d for d in book['developments']}
    history = read_reviews(journal_path)
    # Legacy reviews remain byte-for-byte intact. Only exact repeated facts merge.
    legacy_reviews = {r['review_id']: r for r in history if r['scope'] == 'ALL'}
    assessments = []
    for r in legacy_reviews.values():
        for v in r['currency_views']:
            legacy_key = lambda n: 'legacy-'+sha256(json.dumps([v['currency'],n['published_on'],n['summary'],n['sources']],sort_keys=True).encode()).hexdigest()[:32]
            if v.get('direction'):
                assessments.append(dict(id=r['id']+':'+v['currency'],currency=v['currency'],as_of_utc=r['as_of_utc'],saved_utc=r['saved_utc'],
                    provenance=r['provenance'],direction=v['direction'],gap=v.get('news_gap',''),evidence_ids=[legacy_key(n) for n in v.get('news',[])],background_ids=[],
                    period_start=datetime.fromisoformat(r['as_of_utc']).astimezone(JAKARTA).date().isoformat(),
                    period_end=datetime.fromisoformat(r['as_of_utc']).astimezone(JAKARTA).date().isoformat(),legacy=True,checkpoints=v.get('checkpoints',[])))
            for n in v.get('news', []):
                key=legacy_key(n)
                latest.setdefault(key,dict(id=key,key=key,title='Saved daily research',facts=n['summary'],published_on=n['published_on'],
                    published_at=n.get('published_at'),event_at=None,timing_note='Legacy saved item; event implication was not separately recorded.',
                    verified_utc=n['verified_utc'],saved_utc=r['saved_utc'],sources=n['sources'],references=[],revision_note='',expected_version=None,
                    impacts=[dict(currency=v['currency'],implication='',thesis_effect='')],legacy=True))
    by_id={d['id']:d for d in [*latest.values(),*book['developments']]}
    for run in book['runs']:
        for a in run['assessments']:
            ids=run['evidence_versions'].get(a['currency'],[])
            assessments.append(dict(id=run['id']+':'+a['currency'],currency=a['currency'],as_of_utc=run['as_of_utc'],saved_utc=run['saved_utc'],
                provenance=run['provenance'],direction=a['direction'],gap=a['gap'],period_start=run['period_start'],period_end=run['period_end'],
                evidence_ids=[i for i in ids if by_id[i]['key'] in a['evidence_keys']],background_ids=[i for i in ids if by_id[i]['key'] in a['background_keys']],legacy=False,checkpoints=a['checkpoints']))
    assessments=[a for a in assessments if datetime.fromisoformat(a['as_of_utc']).astimezone(JAKARTA).date()<=end]
    assessments.sort(key=lambda a:(a['as_of_utc'],a['saved_utc'],a['id']),reverse=True)
    earlier = {}
    bounded = []
    for a in assessments:
        if datetime.fromisoformat(a['as_of_utc']).astimezone(JAKARTA).date() < start:
            roles = earlier.setdefault(a['currency'],set())
            role = 'supported' if a['direction'] else 'attempt'
            if role in roles or role == 'attempt' and 'supported' in roles: continue
            roles.add(role)
        bounded.append(a)
    assessments = bounded
    # Include exact cited vintages for active background without changing them to latest corrections.
    background={i for a in assessments for i in [*a['background_ids'],*[i for i in a['evidence_ids'] if by_id[i]['published_on']<start.isoformat()]]}
    versions={}
    for d in book['developments']: versions.setdefault(d['key'],[]).append(d)
    developments=[{**d,'versions':versions.get(d['key'],[])} for d in latest.values()
                  if start.isoformat()<=d['published_on']<=end.isoformat()]
    included={d['id'] for d in developments}
    developments.extend({**by_id[i],'versions':versions.get(by_id[i]['key'],[])} for i in background if i not in included)
    developments.sort(key=lambda d:(d['published_on'],d.get('published_at') or '',d['key']),reverse=True)
    content={'schema':1,'from':start.isoformat(),'to':end.isoformat(),'developments':developments,'assessments':assessments}
    revision=sha256(json.dumps(content,sort_keys=True).encode()).hexdigest()
    return {'schema':1,'from':start.isoformat(),'to':end.isoformat(),'revision':revision,
            **({'unchanged':True} if revision==after_revision else content)}
