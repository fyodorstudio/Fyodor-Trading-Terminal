"""Agent-only, append-only research snapshots, separate from calendar observations."""
from datetime import datetime, timezone
import json
import os
from pathlib import Path
import tempfile
from typing import Literal
from uuid import uuid4

from fastapi import HTTPException
from pydantic import Field, model_validator
from .contracts import Payload
from .currencies import CURRENCIES
from .highlights import HIGHLIGHTS_PATH, LOCK, highlight_snapshot, read_pins
from .data_lock import data_lock


class JournalSource(Payload):
    kind: Literal['web', 'local']
    label: str = Field(min_length=1, max_length=300)
    locator: str = Field(min_length=1, max_length=2000)
    note: str = Field(default='', max_length=4000)

    @model_validator(mode='after')
    def safe_locator(self):
        if self.kind == 'web':
            from urllib.parse import urlsplit
            url = urlsplit(self.locator)
            if url.scheme not in ('http', 'https') or not url.netloc or url.username or url.password:
                raise ValueError('Web evidence needs a direct http(s) URL without credentials')
        else:
            root = Path(__file__).resolve().parents[1]
            path = Path(self.locator)
            if not path.is_absolute() or not path.resolve().is_relative_to(root):
                raise ValueError('Local evidence must be an absolute file inside Lite')
        return self


class JournalRequest(Payload):
    phase: Literal['before', 'after']
    scope: str = Field(pattern=r'^[A-Z]{3}([A-Z]{3})?$')
    as_of_utc: datetime
    body: str = Field(min_length=1, max_length=16000)
    direction: str = Field(min_length=1, max_length=500)
    confidence: str = Field(min_length=1, max_length=300)
    counterevidence: str = Field(min_length=1, max_length=8000)
    # Each provider retains its own text and capture time; never blend surveys.
    expectations: list[dict[str, str]] = Field(default_factory=list, max_length=30)
    sources: list[JournalSource] = Field(min_length=1, max_length=60)
    release_prompt: str = Field(min_length=1, max_length=8000)
    prior_highlight_ids: list[str] = Field(default_factory=list, max_length=30)
    correction_of: str | None = Field(default=None, pattern=r'^[0-9a-f]{32}$')
    price_reaction: str = Field(default='', max_length=8000)
    trade_outcome: str = Field(default='', max_length=8000)

    @model_validator(mode='after')
    def valid_research(self):
        currencies = [self.scope[:3]] + ([self.scope[3:]] if len(self.scope) == 6 else [])
        if any(item not in CURRENCIES for item in currencies) or len(set(currencies)) != len(currencies):
            raise ValueError('Choose a supported currency or pair')
        if self.as_of_utc.tzinfo is None or self.as_of_utc > datetime.now(timezone.utc):
            raise ValueError('Research needs a timezone-aware as-of time no later than now')
        for field in ('body', 'direction', 'confidence', 'counterevidence', 'release_prompt'):
            if not getattr(self, field).strip():
                raise ValueError(f'{field} cannot be blank')
        if any(set(item) != {'provider', 'as_of_utc', 'values'} or not all(item.values())
               or any(len(value) > 8000 for value in item.values()) for item in self.expectations):
            raise ValueError('Each expectation needs provider, as_of_utc and values')
        return self


class JournalEntry(JournalRequest):
    id: str = Field(pattern=r'^[0-9a-f]{32}$')
    saved_utc: str
    highlight_id: str
    source_id: str
    label: str
    release_at: int | None
    calendar_revision: int
    readings: list[dict]
    missing_value_ids: list[str]
    reading_vintage: str
    append_index: int | None = Field(default=None, ge=0)


def journal_directory(identity, pins_path=HIGHLIGHTS_PATH):
    import re
    if not re.fullmatch(r'[0-9a-f]{32}', identity):
        raise ValueError('Invalid Highlight identity')
    path = Path(pins_path)
    return path.parent / 'journal' / identity


def read_journal(identity, pins_path=HIGHLIGHTS_PATH):
    folder = journal_directory(identity, pins_path)
    files = list(folder.glob('*.json'))
    if len(files) > 1000:
        raise ValueError('Journal exceeded its entry bound; preserve the files')
    entries = []
    for path in files:
        item = JournalEntry.model_validate_json(path.read_text(encoding='utf-8')).model_dump(mode='json')
        if item['highlight_id'] != identity or path.stem != item['id']:
            raise ValueError('Journal identity mismatch; preserve the files')
        entries.append(item)
    indices = [item['append_index'] for item in entries if item['append_index'] is not None]
    if len(indices) != len(set(indices)):
        raise ValueError('Journal append order conflicts; preserve the files')
    # Windows wall clocks can tie. Preserve actual clocks rather than fabricating
    # a later save time or using random UUID order for newly appended versions.
    return sorted(entries, key=lambda item: (item['append_index'] if item['append_index'] is not None else -1,
        datetime.fromisoformat(item['saved_utc']), item['id']))


def append_journal(store, identity, source_id, request, pins_path=HIGHLIGHTS_PATH):
    with LOCK, data_lock(Path(pins_path).parent), store.lock:
        pins = read_pins(pins_path)
        pin = next((item for item in pins if item['id'] == identity and item['source_id'] == source_id), None)
        if pin is None:
            raise HTTPException(404, 'Highlight not found for this broker')
        if pin['currency'] not in (request.scope[:3], request.scope[3:]):
            raise ValueError('Research scope must contain the Highlight currency')
        if not any(source.kind == 'web' for source in request.sources):
            raise ValueError('Fundamental research requires web evidence')
        if any(source.kind == 'local' and not Path(source.locator).is_file() for source in request.sources):
            raise ValueError('Local evidence must exist when research is saved')
        prior = [item for item in pins if item['id'] in request.prior_highlight_ids]
        if len(prior) != len(set(request.prior_highlight_ids)) or any(item['source_id'] != source_id or item['currency'] != pin['currency'] for item in prior):
            raise ValueError('Prior investigations must identify existing same-broker, same-currency Highlights')
        entries = read_journal(identity, pins_path)
        if len(entries) >= 1000:
            raise ValueError('Journal entry capacity reached; preserve existing research')
        if request.correction_of and not any(item['id'] == request.correction_of and item['scope'] == request.scope and item['phase'] == request.phase for item in entries):
            raise ValueError('Correction must reference an existing entry with the same phase and scope')
        snapshot = highlight_snapshot(store, source_id, pins_path, visibility='all')
        item = next(item for item in snapshot['items'] if item['id'] == identity)
        entry = JournalEntry(**request.model_dump(), id=uuid4().hex, saved_utc=datetime.now(timezone.utc).isoformat(),
            append_index=max([item['append_index'] for item in entries if item['append_index'] is not None] + [len(entries) - 1]) + 1,
            highlight_id=identity, source_id=source_id, label=pin['label'], release_at=item['release_at'],
            calendar_revision=snapshot['calendar_revision'], readings=item['events'], missing_value_ids=item['missing_value_ids'],
            reading_vintage='Stored readings captured when saved (or at archive time); not reconstructed release-day/as-of vintages.')
        folder = journal_directory(identity, pins_path)
        folder.mkdir(parents=True, exist_ok=True)
        target = folder / f'{entry.id}.json'
        if target.exists():
            raise ValueError('Journal identity already exists; existing research is never overwritten')
        temporary = None
        try:
            with tempfile.NamedTemporaryFile(mode='w', encoding='utf-8', dir=folder, suffix='.tmp', delete=False) as output:
                temporary = output.name
                output.write(entry.model_dump_json(indent=2))
                output.flush()
                os.fsync(output.fileno())
            os.replace(temporary, target)
        finally:
            if temporary:
                Path(temporary).unlink(missing_ok=True)
        return {'id': entry.id, 'highlight_id': identity, 'path': str(target), 'saved_utc': entry.saved_utc}
