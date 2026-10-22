"""Agent-authored impact assessments for Alert, separate from provider importance."""
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import re
from typing import Literal
from uuid import uuid4

from pydantic import Field, model_validator
from .contracts import Payload
from .data_lock import data_lock
from .highlights import HIGHLIGHTS_PATH, LOCK, read_pins
from .external_sources import DIRECTORY, external_history
from .highlight_journal import JournalSource
from .highlight_metadata import _append, _read


class ImpactRequest(Payload):
    source: Literal['highlight', 'external']
    reference: str = Field(min_length=1, max_length=160)
    broker: str = Field(default='', max_length=160)
    level: Literal['high', 'medium', 'low']
    reason: str = Field(min_length=1, max_length=2000)
    as_of_utc: datetime
    sources: list[JournalSource] = Field(min_length=1, max_length=30)
    expected_version: str | None = Field(default=None, pattern=r'^[0-9a-f]{32}$')

    @model_validator(mode='after')
    def valid_assessment(self):
        if self.source == 'highlight':
            if not re.fullmatch(r'[0-9a-f]{32}', self.reference) or not self.broker.strip():
                raise ValueError('Use an exact Highlight ID and broker')
        elif self.broker or not re.fullmatch(r'[a-z0-9]+(?:-[a-z0-9]+)*', self.reference):
            raise ValueError('External assessments use the stable key without a broker')
        if not self.reason.strip() or not any(source.kind == 'web' for source in self.sources):
            raise ValueError('Impact needs a reason and direct web evidence')
        if self.as_of_utc.tzinfo is None or self.as_of_utc.utcoffset() is None or self.as_of_utc > datetime.now(timezone.utc):
            raise ValueError('Use a timezone-aware assessment cutoff no later than now')
        self.as_of_utc = self.as_of_utc.astimezone(timezone.utc)
        return self


class ImpactVersion(ImpactRequest):
    id: str = Field(pattern=r'^[0-9a-f]{32}$')
    saved_utc: datetime


def impact_key(item):
    return f"highlight:{item['broker']}:{item['reference']}" if item['source'] == 'highlight' else f"external:{item['reference']}"


def _history(pins_path):
    entries = _read(Path(pins_path).parent / 'alert-impact', ImpactVersion)
    groups = {}
    for entry in entries:
        groups.setdefault(impact_key(entry), []).append(entry)
    ordered = []
    for key in sorted(groups):
        members, children = groups[key], {}
        for item in members:
            if item['expected_version'] in children:
                raise ValueError('Impact history has conflicting successors; preserve the files')
            children[item['expected_version']] = item
        current, count = children.get(None), 0
        while current is not None and count < len(members):
            ordered.append(current)
            count += 1
            current = children.get(current['id'])
        if current is not None or count != len(members):
            raise ValueError('Impact history is incomplete or cyclic; preserve the files')
    return ordered


def impact_snapshot(broker='', pins_path=HIGHLIGHTS_PATH, after_revision=None, reference=None, source=None):
    with LOCK:
        entries = [item for item in _history(pins_path)
                   if (item['source'] == 'external' or item['broker'] == broker)
                   and (reference is None or item['reference'] == reference)
                   and (source is None or item['source'] == source)]
        # Link assessments to exact broker occurrence IDs, including archived
        # pins. Names, current provider importance and other brokers never match.
        pins = {(pin['source_id'], pin['id']): pin for pin in read_pins(pins_path)} if any(item['source'] == 'highlight' for item in entries) else {}
        entries = [{**item, 'value_ids': pins.get((item['broker'], item['reference']), {}).get('value_ids', [])}
                   if item['source'] == 'highlight' else item for item in entries]
        revision = hashlib.sha256(json.dumps(entries, sort_keys=True).encode()).hexdigest()
        result = {'broker': broker, 'revision': revision}
        if revision == after_revision:
            return {**result, 'unchanged': True}
        latest = {}
        for item in entries:
            latest[impact_key(item)] = item
        return {**result, 'items': [{**item, 'key': key} for key, item in latest.items()]}


def append_impact(request, pins_path=HIGHLIGHTS_PATH, external_directory=DIRECTORY):
    with LOCK, data_lock(Path(pins_path).parent):
        if request.source == 'highlight':
            if not any(pin['id'] == request.reference and pin['source_id'] == request.broker for pin in read_pins(pins_path)):
                raise ValueError('Highlight not found for this broker')
        elif not external_history(request.reference, external_directory):
            raise ValueError('External Source not found')
        key = impact_key(request.model_dump())
        history = [item for item in _history(pins_path) if impact_key(item) == key]
        previous = history[-1]['id'] if history else None
        if request.expected_version != previous:
            raise ValueError('Impact changed; read the latest version before saving an update')
        entry = ImpactVersion(**request.model_dump(), id=uuid4().hex, saved_utc=datetime.now(timezone.utc))
        return {**_append(Path(pins_path).parent / 'alert-impact', entry), 'saved_utc': entry.saved_utc.isoformat(), 'key': key}
