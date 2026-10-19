"""Compact agent-authored theses. UI reads; the analyst CLI appends versions.

Raw observations, Highlight lifecycles and detailed research journals are separate.
"""
from datetime import date, datetime, timedelta, timezone
import hashlib
import json
import os
from pathlib import Path
import re
import tempfile
from threading import RLock
from typing import Literal
from uuid import uuid4

from pydantic import Field, model_validator
from .contracts import Payload
from .calendar_clock import publication_time_known
from .currencies import CURRENCIES
from .data_lock import data_lock
from .external_sources import DIRECTORY as EXTERNAL_DIRECTORY, external_snapshot
from .highlight_journal import JournalSource, read_journal
from .highlights import HIGHLIGHTS_PATH, highlight_snapshot

PATH = Path(__file__).resolve().parents[1] / 'Market Analyst Workflow' / 'thesis' / 'journal.json'
JAKARTA = timezone(timedelta(hours=7))
LOCK = RLock()
ID = r'^[0-9a-f]{32}$'
ThesisChange = Literal['Baseline', 'Materially strengthened', 'Strengthened', 'Unchanged', 'Weakened', 'Reversed']


def pair_scope(scope):
    if len(scope) != 6 or scope[:3] == scope[3:] or any(c not in CURRENCIES for c in (scope[:3], scope[3:])):
        raise ValueError('Thesis needs a pair from the eight supported currencies')
    return (scope[:3], scope[3:])


class ThesisTarget(Payload):
    kind: Literal['highlight', 'external']
    reference: str = Field(min_length=1, max_length=160)
    source_id: str | None = Field(default=None, min_length=1, max_length=160)
    event_at: datetime | None = None
    event_date: date | None = None

    @model_validator(mode='after')
    def valid_target(self):
        if self.kind == 'highlight':
            if not re.fullmatch(ID, self.reference) or not self.source_id:
                raise ValueError('A Highlight target needs its exact ID and broker')
        elif self.source_id or not re.fullmatch(r'[a-z0-9]+(?:-[a-z0-9]+)*', self.reference):
            raise ValueError('An external target needs its key without a broker')
        if self.event_at:
            if self.event_at.tzinfo is None:
                raise ValueError('Event time needs an explicit offset')
            self.event_at = self.event_at.astimezone(timezone.utc)
        if bool(self.event_at) == bool(self.event_date):
            raise ValueError('Use an exact stage time or an unconfirmed-hour source date')
        return self


class ThesisRequest(Payload):
    scope: str = Field(pattern=r'^[A-Z]{6}$')
    collection: Literal['pair', 'across'] = 'pair'
    as_of_utc: datetime
    title: str = Field(min_length=1, max_length=500)
    verdict: Literal['STRONG BUY', 'BUY', 'MIXED', 'SELL', 'STRONG SELL']
    thesis: str = Field(min_length=1, max_length=8000)
    horizon: str = Field(default='Intraday', min_length=1, max_length=300)
    sources: list[JournalSource] = Field(min_length=1, max_length=30)
    note: str = Field(default='', max_length=4000)
    provenance: Literal['assessment', 'reconstruction'] = 'assessment'
    change: ThesisChange | None = None
    change_reason: str = Field(default='', max_length=2000)
    compared_with: str | None = Field(default=None, pattern=ID)
    as_of_precision: Literal['minute', 'date'] = 'minute'
    target: ThesisTarget | None = None
    # Link a full MT5 research report without copying its body into this record.
    journal_id: str | None = Field(default=None, pattern=ID)
    row_id: str | None = Field(default=None, pattern=ID)
    expected_version: str | None = Field(default=None, pattern=ID)

    @model_validator(mode='after')
    def valid_assessment(self):
        pair_scope(self.scope)
        if self.as_of_utc.tzinfo is None or self.as_of_utc > datetime.now(timezone.utc):
            raise ValueError('Assessment cutoff needs an explicit offset and cannot be in the future')
        self.as_of_utc = self.as_of_utc.astimezone(timezone.utc)
        if any(not getattr(self, key).strip() for key in ('title', 'thesis', 'horizon')):
            raise ValueError('Title, thesis and horizon cannot be blank')
        if not any(source.kind == 'web' for source in self.sources):
            raise ValueError('Theses require direct web evidence')
        if self.provenance == 'reconstruction' and not self.note.strip():
            raise ValueError('A reconstruction must explain its retrospective provenance')
        if self.change is not None and not self.change_reason.strip():
            raise ValueError('Explain the evidence behind the thesis change')
        if self.change == 'Baseline' and self.compared_with is not None:
            raise ValueError('A baseline has no earlier comparison')
        if self.change not in (None, 'Baseline') and not self.compared_with:
            raise ValueError('A thesis change needs the exact earlier assessment version')
        if self.change is None and (self.change_reason or self.compared_with):
            raise ValueError('Comparison evidence needs a thesis-change label')
        if self.journal_id and (not self.target or self.target.kind != 'highlight'):
            raise ValueError('A detailed journal link needs its Highlight target')
        if self.target and self.target.event_at and self.as_of_utc < self.target.event_at:
            raise ValueError('Release assessment cutoff cannot precede its event; do not save a release result before publication')
        if self.target and self.target.event_date and self.as_of_utc.astimezone(JAKARTA).date() < self.target.event_date:
            raise ValueError('Release assessment cannot precede its source date')
        return self


class ThesisEntry(ThesisRequest):
    id: str = Field(pattern=ID)
    row_id: str = Field(pattern=ID)
    saved_utc: datetime


class ThesisBook(Payload):
    version: Literal[1] = 1
    entries: list[ThesisEntry] = Field(default_factory=list, max_length=10000)


class PlannedEvent(Payload):
    title: str = Field(min_length=1, max_length=500)
    at: datetime | None = None
    note: str = Field(default='', max_length=2000)
    sources: list[JournalSource] = Field(min_length=1, max_length=30)


class PlannedDay(Payload):
    scope: str
    date: date
    events: list[PlannedEvent] = Field(default_factory=list, max_length=30)

    @model_validator(mode='after')
    def valid_day(self):
        pair_scope(self.scope)
        for event in self.events:
            if event.at and (event.at.tzinfo is None or event.at.astimezone(JAKARTA).date() != self.date):
                raise ValueError('Planned event time needs an explicit offset and its Jakarta date')
        return self


class ThesisPlan(Payload):
    version: Literal[1] = 1
    checked_utc: datetime
    days: list[PlannedDay] = Field(default_factory=list, max_length=1000)

    @model_validator(mode='after')
    def valid_plan(self):
        if self.checked_utc.tzinfo is None or self.checked_utc > datetime.now(timezone.utc):
            raise ValueError('Schedule check needs an explicit offset and cannot be in the future')
        if len({(day.scope, day.date) for day in self.days}) != len(self.days):
            raise ValueError('Keep one planning row per pair and Jakarta date')
        return self


def planned_days(path, scope, month, assessments):
    plan_path = Path(path).with_name('plan.json')
    if not plan_path.exists():
        return []
    plan = ThesisPlan.model_validate_json(plan_path.read_text(encoding='utf-8'))
    assessed = {datetime.fromisoformat(row['as_of_utc']).astimezone(JAKARTA).date() for row in assessments}
    return [{**day.model_dump(mode='json'), 'checked_utc': plan.checked_utc.isoformat()}
        for day in sorted(plan.days, key=lambda day: day.date)
        if day.scope == scope and day.date.isoformat().startswith(month + '-') and day.date not in assessed]


def read_theses(path=PATH):
    path = Path(path)
    if not path.exists():
        return []
    entries = ThesisBook.model_validate_json(path.read_text(encoding='utf-8')).model_dump(mode='json')['entries']
    latest, ids = {}, set()
    for item in entries:
        prior = latest.get(item['row_id'])
        if item['id'] in ids or item['expected_version'] != (prior['id'] if prior else None):
            raise ValueError('Thesis version history is incomplete or conflicting; preserve the file')
        if prior and (item['scope'], item['target'], item['collection']) != (prior['scope'], prior['target'], prior['collection']):
            raise ValueError('Thesis corrections must retain their pair, collection and occurrence')
        ids.add(item['id']); latest[item['row_id']] = item
    return entries


def target_key(target):
    return json.dumps(target, sort_keys=True)


def highlighted_stages(store, scope, source_id, pins_path=HIGHLIGHTS_PATH, external_directory=EXTERNAL_DIRECTORY, visibility='active'):
    currencies = pair_scope(scope)
    rows = []
    pins = highlight_snapshot(store, source_id, pins_path, visibility=visibility)['items'] if source_id else []
    for pin in pins:
        if pin['currency'] not in currencies:
            continue
        stages = {}
        for event in pin['events']:
            at = event['release_at'] if publication_time_known(event) else None
            day = None if at is not None else datetime.fromtimestamp(event['server_time_seconds'], timezone.utc).date().isoformat()
            key = (at, day)
            stages.setdefault(key, []).append(event['name'])
        for (at, day), names in stages.items():
            target = ThesisTarget(kind='highlight', reference=pin['id'], source_id=pin['source_id'],
                event_at=datetime.fromtimestamp(at / 1000, timezone.utc) if at is not None else None, event_date=day).model_dump(mode='json')
            rows.append({'target': target, 'title': pin['label'], 'stage': ' / '.join(dict.fromkeys(names)),
                         'date': datetime.fromtimestamp(at / 1000, JAKARTA).date().isoformat() if at is not None else day})
    offset = 0
    while True:
        page = external_snapshot(external_directory, visibility=visibility, scope=scope, limit=500, offset=offset)
        for item in page['items']:
            # Undated watches are not silently assigned to the selected month.
            if not item['event_at'] and not item['event_date']:
                continue
            target = ThesisTarget(kind='external', reference=item['key'], event_at=item['event_at'], event_date=item['event_date']).model_dump(mode='json')
            rows.append({'target': target, 'title': item['title'], 'stage': 'External Source · ' + item['status'],
                         'date': datetime.fromisoformat(item['event_at']).astimezone(JAKARTA).date().isoformat() if item['event_at'] else item['event_date']})
        if page['next_offset'] is None:
            break
        offset = page['next_offset']
    return rows


def append_thesis(store, request, path=PATH, pins_path=HIGHLIGHTS_PATH, external_directory=EXTERNAL_DIRECTORY):
    with LOCK, data_lock(Path(path).parent):
        entries = read_theses(path)
        if request.compared_with:
            prior = next((item for item in entries if item['id'] == request.compared_with), None)
            if not prior or prior['scope'] != request.scope or datetime.fromisoformat(prior['as_of_utc']) >= request.as_of_utc:
                raise ValueError('Compare with an earlier assessment version of the same pair')
            if prior['verdict'] == 'MIXED' and (request.change != 'Unchanged' or request.verdict != 'MIXED'):
                raise ValueError('For a directional change after MIXED, compare with the last supported directional case')
            side = lambda verdict: 1 if 'BUY' in verdict else -1 if 'SELL' in verdict else 0
            opposite = side(prior['verdict']) * side(request.verdict) == -1
            if (request.change == 'Reversed') != opposite:
                raise ValueError('Reversed means an established opposite buy/sell direction, not merely a weakened case')
        latest = {item['row_id']: item for item in entries}
        target = request.target.model_dump(mode='json') if request.target else None
        if target:
            stages = highlighted_stages(store, request.scope, request.target.source_id, pins_path, external_directory, visibility='all')
            if not any(target_key(row['target']) == target_key(target) for row in stages):
                raise ValueError('Occurrence, pair or stage changed; verify the linked release before saving')
        row_id = request.row_id
        if not row_id and target:
            row_id = next((key for key, item in latest.items() if item['scope'] == request.scope and item['target'] == target), None)
        previous = latest.get(row_id) if row_id else None
        if request.row_id and not previous:
            raise ValueError('Unknown Thesis row; omit row_id for a new assessment')
        if request.expected_version != (previous['id'] if previous else None):
            raise ValueError('Thesis changed; read the latest version before appending')
        if previous and (request.scope, target, request.collection) != (previous['scope'], previous['target'], previous['collection']):
            raise ValueError('Thesis corrections must retain their pair, collection and occurrence')
        if request.journal_id:
            journal = read_journal(request.target.reference, pins_path)
            if not any(item['id'] == request.journal_id and item['scope'] == request.scope and item['source_id'] == request.target.source_id for item in journal):
                raise ValueError('Detailed research link must reference this pair and Highlight')
        if any(source.kind == 'local' and not Path(source.locator).is_file() for source in request.sources):
            raise ValueError('Local evidence must exist when saved')
        entry = ThesisEntry(**{**request.model_dump(), 'row_id': row_id or uuid4().hex}, id=uuid4().hex, saved_utc=datetime.now(timezone.utc))
        book = ThesisBook(entries=[*entries, entry])
        target_path = Path(path)
        temporary = None
        try:
            with tempfile.NamedTemporaryFile(mode='w', encoding='utf-8', dir=target_path.parent, suffix='.tmp', delete=False) as output:
                temporary = output.name
                # Preserve legacy records exactly as stored; schema defaults are
                # read-time compatibility, not a rewrite of prior research.
                prior_records = json.loads(target_path.read_text(encoding='utf-8'))['entries'] if target_path.exists() else []
                output.write(json.dumps({'version': book.version, 'entries': [*prior_records, entry.model_dump(mode='json')]}, indent=2, ensure_ascii=False))
                output.flush(); os.fsync(output.fileno())
            os.replace(temporary, target_path)
        finally:
            if temporary:
                Path(temporary).unlink(missing_ok=True)
        return {'id': entry.id, 'row_id': entry.row_id, 'path': str(target_path), 'saved_utc': entry.saved_utc.isoformat()}


def thesis_snapshot(store, scope, month, source_id=None, path=PATH, pins_path=HIGHLIGHTS_PATH,
                    external_directory=EXTERNAL_DIRECTORY, after_revision=None):
    if scope != 'ALL':
        pair_scope(scope)
    if not re.fullmatch(r'\d{4}-\d{2}', month):
        raise ValueError('Use a calendar month YYYY-MM')
    date.fromisoformat(month + '-01')
    all_entries = read_theses(path)
    entries = [entry for entry in all_entries if entry['collection'] == 'across'] if scope == 'ALL' else [
        entry for entry in all_entries if entry['scope'] == scope and entry['collection'] == 'pair']
    groups = {}
    for entry in entries:
        groups.setdefault(entry['row_id'], []).append(entry)
    past = [{**history[-1], 'versions': history} for history in groups.values()
        if datetime.fromisoformat(history[-1]['as_of_utc']).astimezone(JAKARTA).strftime('%Y-%m') == month]
    by_id = {entry['id']: entry for entry in all_entries}
    for row in past:
        prior = by_id.get(row['compared_with'])
        row['comparison'] = {key: prior[key] for key in ('id', 'as_of_utc', 'verdict')} if prior else None
    past.sort(key=lambda item: (item['as_of_utc'], item['saved_utc'], item['row_id']), reverse=True)
    if scope == 'ALL':
        past.sort(key=lambda item: (-datetime.fromisoformat(item['as_of_utc']).timestamp(),
            -{'STRONG BUY': 2, 'STRONG SELL': 2, 'BUY': 1, 'SELL': 1, 'MIXED': 0}[item['verdict']], item['scope'], item['row_id']))
    planned = [] if scope == 'ALL' else planned_days(path, scope, month, past)
    content = {'schema': 1, 'scope': scope, 'month': month, 'source_id': source_id, 'past': past, 'planned': planned}
    revision = hashlib.sha256(json.dumps(content, sort_keys=True).encode()).hexdigest()
    return {'schema': 1, 'scope': scope, 'month': month, 'source_id': source_id, 'revision': revision,
            **({'unchanged': True} if revision == after_revision else {'past': past, 'planned': planned})}
