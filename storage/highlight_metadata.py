"""Prompt-only preparation and discovered limitations, outside calendar observations."""
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import tempfile
from typing import Literal
from uuid import uuid4

from pydantic import Field, model_validator
from fastapi import HTTPException
from .contracts import Payload
from .currencies import CURRENCIES, CalendarCurrency
from .data_lock import data_lock
from .highlights import HIGHLIGHTS_PATH, LOCK, read_pins
from .highlight_journal import JournalSource


class PromptRequest(Payload):
    scope: str = Field(pattern=r'^[A-Z]{3}([A-Z]{3})?$')
    prepare_prompt: str = Field(min_length=1, max_length=8000)
    release_prompt: str = Field(min_length=1, max_length=8000)

    @model_validator(mode='after')
    def valid_scope(self):
        currencies = [self.scope[:3]] + ([self.scope[3:]] if len(self.scope) == 6 else [])
        if any(item not in CURRENCIES for item in currencies) or len(set(currencies)) != len(currencies):
            raise ValueError('Choose a supported currency or pair')
        if not self.prepare_prompt.strip() or not self.release_prompt.strip():
            raise ValueError('Both preparation and release prompts must contain text')
        return self


class SavedPrompt(PromptRequest):
    id: str = Field(pattern=r'^[0-9a-f]{32}$')
    highlight_id: str = Field(pattern=r'^[0-9a-f]{32}$')
    source_id: str
    saved_utc: str


class LimitationRequest(Payload):
    key: str = Field(pattern=r'^[a-z0-9]+(?:-[a-z0-9]+)*$', max_length=160)
    currency: CalendarCurrency
    kind: Literal['missing-release', 'schedule-mismatch', 'unverified-time', 'data-conflict']
    title: str = Field(min_length=1, max_length=500)
    description: str = Field(min_length=1, max_length=12000)
    action: str = Field(min_length=1, max_length=6000)
    checked_utc: datetime
    status: Literal['open', 'resolved'] = 'open'
    official_schedule: str = Field(default='', max_length=2000)
    stored_schedule: str = Field(default='', max_length=2000)
    sources: list[JournalSource] = Field(min_length=1, max_length=30)

    @model_validator(mode='after')
    def valid_issue(self):
        if self.checked_utc.tzinfo is None or self.checked_utc > datetime.now(timezone.utc):
            raise ValueError('Use a timezone-aware verification time no later than now')
        if not any(source.kind == 'web' for source in self.sources):
            raise ValueError('Discovered limitations need official web evidence')
        if any(not getattr(self, key).strip() for key in ('title', 'description', 'action')):
            raise ValueError('Limitation fields cannot be blank')
        return self


class SavedLimitation(LimitationRequest):
    id: str = Field(pattern=r'^[0-9a-f]{32}$')
    source_id: str
    saved_utc: str


def _folder(pins_path, kind, identity=None):
    import re
    if identity is not None and not re.fullmatch(r'[0-9a-f]{32}', identity):
        raise ValueError('Invalid Highlight identity')
    folder = Path(pins_path).parent / kind
    return folder / identity if identity else folder


def _read(folder, model):
    files = list(folder.glob('*.json'))
    if len(files) > 10000:
        raise ValueError('Metadata exceeded its record bound; preserve the files')
    entries = [model.model_validate_json(path.read_text(encoding='utf-8')).model_dump(mode='json') for path in files]
    if any(path.stem != entry['id'] for path, entry in zip(files, entries)):
        raise ValueError('Metadata identity mismatch; preserve the files')
    return sorted(entries, key=lambda entry: (entry['saved_utc'], entry['id']))


def _append(folder, entry):
    folder.mkdir(parents=True, exist_ok=True)
    if len(list(folder.glob('*.json'))) >= 10000:
        raise ValueError('Metadata capacity reached; preserve existing records')
    target = folder / f'{entry.id}.json'
    if target.exists():
        raise ValueError('Metadata version already exists; never overwrite history')
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
    return {'id': entry.id, 'path': str(target), 'saved_utc': entry.saved_utc}


def read_prompts(identity, pins_path=HIGHLIGHTS_PATH):
    entries = _read(_folder(pins_path, 'prompts', identity), SavedPrompt)
    if any(entry['highlight_id'] != identity for entry in entries):
        raise ValueError('Prompt occurrence mismatch; preserve the files')
    return entries


def append_prompt(identity, source_id, request, pins_path=HIGHLIGHTS_PATH):
    with LOCK, data_lock(Path(pins_path).parent):
        pin = next((pin for pin in read_pins(pins_path) if pin['id'] == identity and pin['source_id'] == source_id), None)
        if pin is None:
            raise HTTPException(404, 'Highlight not found for this broker')
        if pin['currency'] not in (request.scope[:3], request.scope[3:]):
            raise ValueError('Prompt scope must contain the Highlight currency')
        entry = SavedPrompt(**request.model_dump(), id=uuid4().hex, highlight_id=identity, source_id=source_id,
            saved_utc=datetime.now(timezone.utc).isoformat())
        return _append(_folder(pins_path, 'prompts', identity), entry)


def append_limitation(source_id, request, pins_path=HIGHLIGHTS_PATH):
    with LOCK, data_lock(Path(pins_path).parent):
        _read(_folder(pins_path, 'limitations'), SavedLimitation)
        entry = SavedLimitation(**request.model_dump(), id=uuid4().hex, source_id=source_id,
            saved_utc=datetime.now(timezone.utc).isoformat())
        return _append(_folder(pins_path, 'limitations'), entry)


def limitations_snapshot(source_id, pins_path=HIGHLIGHTS_PATH, after_revision=None):
    with LOCK:
        entries = [entry for entry in _read(_folder(pins_path, 'limitations'), SavedLimitation) if entry['source_id'] == source_id]
        revision = hashlib.sha256(json.dumps(entries, sort_keys=True).encode()).hexdigest()
        result = {'source_id': source_id, 'revision': revision}
        if revision == after_revision:
            return {**result, 'unchanged': True}
        latest = {}
        for entry in entries:
            latest[entry['key']] = entry
        return {**result, 'items': sorted(latest.values(), key=lambda entry: (entry['status'] == 'resolved', entry['currency'], entry['title']))}
