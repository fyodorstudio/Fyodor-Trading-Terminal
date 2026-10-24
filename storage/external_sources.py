"""Sourced macro events outside the broker feed; independent, immutable versions."""
from datetime import date, datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import re
import tempfile
from threading import RLock
from typing import Literal
from uuid import uuid4

from fastapi import HTTPException
from pydantic import Field, model_validator
from .contracts import Payload
from .currencies import CalendarCurrency, CURRENCIES
from .data_lock import data_lock
from .highlight_journal import JournalSource
from .research_instruments import Commodity, INSTRUMENTS

DIRECTORY = Path(__file__).resolve().parents[1] / 'Market Analyst Workflow' / 'external-sources'
LOCK = RLock()


class CalendarReference(Payload):
    source_id: str = Field(pattern=r'^Pepperstone-[A-Za-z0-9._-]+$', max_length=160)
    value_ids: list[str] = Field(min_length=1, max_length=512)

    @model_validator(mode='after')
    def validate_ids(self):
        if any(not value.isdigit() for value in self.value_ids) or len(set(self.value_ids)) != len(self.value_ids):
            raise ValueError('Calendar references require unique exact value IDs')
        return self


class ExternalRequest(Payload):
    key: str = Field(pattern=r'^[a-z0-9]+(?:-[a-z0-9]+)*$', max_length=160)
    title: str = Field(min_length=1, max_length=500)
    currencies: list[CalendarCurrency] = Field(default_factory=list, max_length=8)
    instruments: list[Commodity] = Field(default_factory=list, max_length=3)
    kind: Literal['scheduled', 'headline', 'watch']
    status: Literal['confirmed', 'reported', 'unverified']
    facts: str = Field(min_length=1, max_length=12000)
    interpretation: str = Field(default='', max_length=8000)
    event_at: datetime | None = None
    event_date: date | None = None
    published_utc: datetime | None = None
    time_note: str = Field(min_length=1, max_length=2000)
    sources: list[JournalSource] = Field(min_length=1, max_length=30)
    expected_version: str | None = Field(default=None, pattern=r'^[0-9a-f]{32}$')
    calendar_reference: CalendarReference | None = None
    show_on_chart: bool = Field(default=False, exclude=True)

    @model_validator(mode='after')
    def valid_record(self):
        if not self.currencies and not self.instruments or len(set(self.instruments)) != len(self.instruments):
            raise ValueError('Choose affected currencies or unique commodity identities; never invent currency relevance')
        if len(set(self.currencies)) != len(self.currencies):
            raise ValueError('Currencies must be unique')
        if any(not getattr(self, field).strip() for field in ('title', 'facts', 'time_note')):
            raise ValueError('Title, facts and timing note cannot be blank')
        if not any(source.kind == 'web' for source in self.sources):
            raise ValueError('External sources need direct web evidence')
        for field in ('event_at', 'published_utc'):
            value = getattr(self, field)
            if value is not None:
                if value.tzinfo is None or value.utcoffset() is None:
                    raise ValueError('Exact times need an explicit UTC offset')
                setattr(self, field, value.astimezone(timezone.utc))
        if self.published_utc and self.published_utc > datetime.now(timezone.utc):
            raise ValueError('Publication cannot be in the future; use event_at for schedules')
        if self.event_at and self.event_date:
            raise ValueError('Use an exact event time or a source date, not both')
        if self.kind == 'watch' and (self.event_at or self.event_date):
            raise ValueError('Unscheduled watch items must not invent an event time')
        if self.kind == 'scheduled' and not (self.event_at or self.event_date):
            raise ValueError('Scheduled events need a verified time or source date')
        return self


class ExternalVersion(ExternalRequest):
    id: str = Field(pattern=r'^[0-9a-f]{32}$')
    saved_utc: datetime
    archived: bool = False
    chart_icon_request_id: str | None = Field(default=None, pattern=r'^[0-9a-f]{32}$')


class LifecycleRequest(Payload):
    expected_version: str = Field(pattern=r'^[0-9a-f]{32}$')


class ChartRequest(Payload):
    version_id: str = Field(pattern=r'^[0-9a-f]{32}$')
    request_id: str = Field(pattern=r'^[0-9a-f]{32}$')


def _versions(directory):
    files = list(Path(directory).glob('*.json'))
    if len(files) > 10000:
        raise ValueError('External source capacity exceeded; preserve the files')
    versions = []
    for path in files:
        raw = json.loads(path.read_text(encoding='utf-8'))
        metadata = Path(directory) / 'chart-requests' / path.name
        if metadata.exists():
            request = ChartRequest.model_validate_json(metadata.read_text(encoding='utf-8'))
            if request.version_id != path.stem or raw.get('chart_icon_request_id') not in (None, request.request_id):
                raise ValueError('External chart request identity mismatch; preserve the files')
            raw['chart_icon_request_id'] = request.request_id
        item = ExternalVersion.model_validate(raw).model_dump(mode='json')
        if path.stem != item['id']:
            raise ValueError('External source identity mismatch; preserve the files')
        versions.append(item)
    # Windows wall clocks can tie across consecutive writes. The optimistic
    # predecessor chain, not a UUID/time sort, defines immutable version order.
    groups = {}
    for item in versions:
        groups.setdefault(item['key'], []).append(item)
    ordered = []
    for key in sorted(groups):
        members = groups[key]
        children = {}
        for item in members:
            previous = item['expected_version']
            if previous in children:
                raise ValueError('External source history has conflicting successors; preserve the files')
            children[previous] = item
        current, count = children.get(None), 0
        while current is not None and count < len(members):
            ordered.append(current); count += 1
            current = children.get(current['id'])
        if count != len(members) or current is not None:
            raise ValueError('External source history is incomplete or cyclic; preserve the files')
    return ordered


def _write(directory, item):
    directory = Path(directory)
    if len(list(directory.glob('*.json'))) >= 10000:
        raise ValueError('External source capacity reached; preserve existing records')
    target = directory / (item.id + '.json')
    if target.exists():
        raise ValueError('Never overwrite an external source version')
    temporary = None
    metadata_target = None
    metadata_temporary = None
    metadata_written = False
    try:
        # Old storage/alarm processes reject unknown fields. Keep new requests in
        # immutable sidecars ignored by their root-level *.json reader.
        if item.chart_icon_request_id:
            metadata_directory = directory / 'chart-requests'
            metadata_directory.mkdir(exist_ok=True)
            metadata_target = metadata_directory / target.name
            if metadata_target.exists():
                raise ValueError('Never overwrite an external chart request')
            with tempfile.NamedTemporaryFile(mode='w', encoding='utf-8', dir=metadata_directory, suffix='.tmp', delete=False) as output:
                metadata_temporary = output.name
                output.write(ChartRequest(version_id=item.id, request_id=item.chart_icon_request_id).model_dump_json())
                output.flush()
                os.fsync(output.fileno())
            os.replace(metadata_temporary, metadata_target)
            metadata_written = True
        with tempfile.NamedTemporaryFile(mode='w', encoding='utf-8', dir=directory, suffix='.tmp', delete=False) as output:
            temporary = output.name
            output.write(item.model_dump_json(indent=2, exclude={'chart_icon_request_id'}))
            output.flush()
            os.fsync(output.fileno())
        os.replace(temporary, target)
    finally:
        if temporary:
            Path(temporary).unlink(missing_ok=True)
        if metadata_temporary:
            Path(metadata_temporary).unlink(missing_ok=True)
        if metadata_written and not target.exists():
            metadata_target.unlink(missing_ok=True)
    return {'key': item.key, 'id': item.id, 'path': str(target), 'saved_utc': item.saved_utc.isoformat()}


def append_external(request, directory=DIRECTORY):
    with LOCK, data_lock(Path(directory)):
        previous = next((item for item in reversed(_versions(directory)) if item['key'] == request.key), None)
        if (previous and request.expected_version != previous['id']) or (not previous and request.expected_version):
            raise ValueError('External source changed; read its latest version before appending a correction')
        if request.show_on_chart and (request.kind == 'watch' or not (request.event_at or request.event_date)):
            raise ValueError('A chart icon needs a verified date or time')
        identity = uuid4().hex
        item = ExternalVersion(**request.model_dump(), id=identity, saved_utc=datetime.now(timezone.utc),
                               archived=previous['archived'] if previous else False,
                               chart_icon_request_id=identity if request.show_on_chart else (previous or {}).get('chart_icon_request_id'))
        return _write(directory, item)


def request_external_chart_icon(key, expected_version, directory=DIRECTORY):
    """Append a chart request without rewriting facts or changing archive state."""
    with LOCK, data_lock(Path(directory)):
        history = external_history(key, directory)
        if not history:
            raise ValueError('External source not found')
        previous = history[-1]
        if previous['id'] != expected_version:
            raise ValueError('External source changed; read its latest version before requesting an icon')
        if previous['archived']:
            raise ValueError('Restore the record before requesting a chart icon')
        if previous['kind'] == 'watch' or not (previous['event_at'] or previous['event_date']):
            raise ValueError('A chart icon needs a verified date or time')
        identity = uuid4().hex
        return _write(directory, ExternalVersion(**{**previous, 'id': identity,
            'expected_version': expected_version, 'saved_utc': datetime.now(timezone.utc),
            'chart_icon_request_id': identity}))


def external_history(key, directory=DIRECTORY):
    if not re.fullmatch(r'[a-z0-9]+(?:-[a-z0-9]+)*', key) or len(key) > 160:
        raise ValueError('Invalid external source key')
    with LOCK:
        return [item for item in _versions(directory) if item['key'] == key]


def archive_external(key, expected_version, directory=DIRECTORY, restore=False):
    with LOCK, data_lock(Path(directory)):
        history = external_history(key, directory)
        if not history:
            raise HTTPException(404, 'External source not found')
        previous = history[-1]
        if expected_version != previous['id']:
            raise ValueError('External source changed; refresh before archiving/restoring')
        item = ExternalVersion(**{**previous, 'id': uuid4().hex, 'expected_version': expected_version,
                                  'saved_utc': datetime.now(timezone.utc), 'archived': not restore})
        return _write(directory, item)


def external_snapshot(directory=DIRECTORY, after_revision=None, visibility='active', scope='all',
                      from_date=None, to_date=None, match=None, limit=100, offset=0):
    if visibility not in ('active', 'archived', 'all') or not 1 <= limit <= 500 or offset < 0:
        raise ValueError('Invalid external source query')
    commodity = scope.upper() if scope.upper() in INSTRUMENTS else None
    currencies = [] if scope.lower() == 'all' or commodity else [scope[:3]] + ([scope[3:]] if len(scope) == 6 else [])
    if scope.lower() != 'all' and not commodity and (len(scope) not in (3, 6) or len(set(currencies)) != len(currencies) or any(c not in CURRENCIES for c in currencies)):
        raise ValueError('Choose all, a currency, a pair, BRENT, WTI or GOLD')
    start = date.fromisoformat(from_date) if from_date else None
    end = date.fromisoformat(to_date) if to_date else None
    if start and end and start > end:
        raise ValueError('Invalid external source date interval')
    with LOCK:
        versions = _versions(directory)
        latest, counts = {}, {}
        for item in versions:
            latest[item['key']] = item
            counts[item['key']] = counts.get(item['key'], 0) + 1
        items = []
        terms = [term.casefold() for term in (match or '').split('|') if term]
        for item in latest.values():
            if visibility != 'all' and item['archived'] != (visibility == 'archived'):
                continue
            if currencies and not set(currencies).intersection(item['currencies']):
                continue
            if commodity and commodity not in item['instruments'] and 'USD' not in item['currencies']:
                continue
            if terms and not any(term in (item['key'] + ' ' + item['title'] + ' ' + item['facts']).casefold() for term in terms):
                continue
            # Undated watch items remain visible in a dated scan; never assign them a release time.
            at = item['event_date'] or item['event_at'] or item['published_utc']
            if at and ((start and at[:10] < start.isoformat()) or (end and at[:10] > end.isoformat())):
                continue
            items.append({**item, 'version_count': counts[item['key']]})
        items.sort(key=lambda item: (item['event_at'] or item['event_date'] or item['published_utc'] or item['saved_utc'], item['key']), reverse=True)
        revision = hashlib.sha256(json.dumps(items, sort_keys=True).encode()).hexdigest()
        result = {'revision': revision, 'scope': scope, 'visibility': visibility, 'matches': len(items),
                  'offset': offset, 'next_offset': offset + limit if offset + limit < len(items) else None}
        if after_revision == revision:
            return {**result, 'unchanged': True}
        return {**result, 'items': items[offset:offset + limit]}
