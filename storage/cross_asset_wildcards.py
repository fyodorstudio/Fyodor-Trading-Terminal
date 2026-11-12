"""Manual, date-only cross-asset notes. No calendar, news or alarm side effects."""
from datetime import date
from hashlib import sha256
import json
import os
from pathlib import Path
import tempfile
from threading import RLock

from fastapi import HTTPException
from pydantic import Field, model_validator

from .contracts import Payload
from .data_lock import data_lock

_lock = RLock()
MAX_BYTES = 8 * 1024 * 1024


class WildcardRow(Payload):
    id: str = Field(pattern=r'^[a-f0-9]{32}$')
    title: str = Field(min_length=1, max_length=120)
    archived: bool = False
    notes: dict[str, str] = Field(default_factory=dict, max_length=3660)

    @model_validator(mode='after')
    def content(self):
        self.title = ' '.join(self.title.split())
        if not self.title:
            raise ValueError('Enter a wildcard title')
        for day, text in self.notes.items():
            parsed = date.fromisoformat(day)
            if parsed.isoformat() != day or not 2015 <= parsed.year <= 2100:
                raise ValueError('Notes require a date between 2015 and 2100')
            if not text.strip() or len(text) > 20000:
                raise ValueError('Notes require 1–20000 characters; remove empty notes')
        return self


class WildcardSave(Payload):
    source_id: str = Field(min_length=1, max_length=160)
    expected_revision: int = Field(ge=0, strict=True)
    rows: list[WildcardRow] = Field(max_length=128)

    @model_validator(mode='after')
    def identities(self):
        if not self.source_id.strip() or len({row.id for row in self.rows}) != len(self.rows):
            raise ValueError('Use a broker and unique wildcard row IDs')
        return self


def _path(directory: Path, source_id: str):
    return directory / (sha256(source_id.encode('utf-8')).hexdigest() + '.json')


def _read(directory: Path, source_id: str):
    path = _path(directory, source_id)
    if not path.exists():
        return {'schema': 1, 'source_id': source_id, 'revision': 0, 'rows': []}
    if path.stat().st_size > MAX_BYTES:
        raise ValueError('Wildcard storage exceeds 8 MB')
    body = json.loads(path.read_text(encoding='utf-8'))
    if not isinstance(body, dict) or set(body) != {'schema', 'source_id', 'revision', 'rows'} or body['schema'] != 1 or body['source_id'] != source_id:
        raise ValueError('Unsupported wildcard snapshot')
    checked = WildcardSave.model_validate({'source_id': source_id, 'expected_revision': body['revision'], 'rows': body['rows']})
    return {**body, 'rows': [row.model_dump() for row in checked.rows]}


def wildcard_snapshot(directory: Path, source_id: str):
    # Readers see only the old or new complete atomic snapshot.
    with _lock:
        return _read(directory, source_id)


def save_wildcards(directory: Path, request: WildcardSave):
    with _lock, data_lock(directory):
        previous = _read(directory, request.source_id)
        if previous['revision'] != request.expected_revision:
            raise HTTPException(409, 'Wildcards changed elsewhere. Cancel, reload Wildcards, then reapply your edit.')
        body = {'schema': 1, 'source_id': request.source_id, 'revision': previous['revision'] + 1,
                'rows': [row.model_dump() for row in request.rows]}
        encoded = (json.dumps(body, ensure_ascii=False, indent=2) + '\n').encode('utf-8')
        if len(encoded) > MAX_BYTES:
            raise HTTPException(422, 'Wildcards exceed 8 MB. Export and remove old rows before adding more.')
        temporary = None
        try:
            with tempfile.NamedTemporaryFile(prefix='.wildcards-', dir=directory, delete=False) as handle:
                temporary = Path(handle.name)
                handle.write(encoded)
                handle.flush()
                os.fsync(handle.fileno())
            os.replace(temporary, _path(directory, request.source_id))
        finally:
            if temporary is not None:
                temporary.unlink(missing_ok=True)
        return body
