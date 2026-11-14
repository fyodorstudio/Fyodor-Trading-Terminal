"""Global manually entered events, shared by chart, Detail and Heatmap."""
from datetime import date, datetime, timedelta, timezone
from hashlib import sha256
import json
import os
from pathlib import Path
import tempfile
from uuid import uuid4
from urllib.parse import urlsplit
from threading import RLock

from fastapi import HTTPException
from pydantic import Field, model_validator
from .contracts import Payload
from .data_lock import data_lock
from .legacy_news import read_news
from .legacy_wildcards import _read as read_old_rows

JAKARTA = timezone(timedelta(hours=7))
_lock = RLock()


class WildcardEntry(Payload):
    date: date
    at: datetime | None = None
    title: str = Field(min_length=1, max_length=300)
    details: str = Field(default='', max_length=20000)
    url: str = Field(default='', max_length=2000)
    archived: bool = False

    @model_validator(mode='after')
    def content(self):
        self.title, self.url = self.title.strip(), self.url.strip()
        if not self.title or not 2015 <= self.date.year <= 2100:
            raise ValueError('Enter a title and a date between 2015 and 2100')
        if self.at is not None:
            if self.at.tzinfo is None or self.at.utcoffset() is None:
                raise ValueError('Wildcard time must include a timezone')
            self.at = self.at.astimezone(timezone.utc)
            if self.at.astimezone(JAKARTA).date() != self.date:
                raise ValueError('Wildcard date must match its Jakarta date')
        if self.url:
            parsed = urlsplit(self.url)
            if parsed.scheme not in ('http', 'https') or not parsed.hostname or parsed.username or parsed.password or any(c.isspace() for c in self.url):
                raise ValueError('Source must be an HTTP or HTTPS URL')
        return self


class WildcardChange(WildcardEntry):
    expected_revision: int = Field(ge=0, strict=True)


def _write(directory, body):
    encoded = (json.dumps(body, ensure_ascii=False, indent=2) + '\n').encode('utf-8')
    if len(encoded) > 32 * 1024 * 1024:
        raise ValueError('Wildcards exceed 32 MB')
    temporary = None
    try:
        with tempfile.NamedTemporaryFile(prefix='.wildcards-', dir=directory, delete=False) as output:
            temporary = Path(output.name)
            output.write(encoded)
            output.flush()
            os.fsync(output.fileno())
        os.replace(temporary, directory / 'wildcards.json')
    finally:
        if temporary is not None:
            temporary.unlink(missing_ok=True)


def _read(root):
    directory = root / 'wildcards'
    path = directory / 'wildcards.json'
    if not path.exists():
        items = []
        for entry in read_news(root / 'manual-news')['items']:
            items.append({'id': 'news-' + entry['id'], **WildcardEntry.model_validate({k: v for k, v in entry.items() if k not in ('id', 'currencies')}).model_dump(mode='json')})
        # Old stores were broker-specific. Identical notes become one global event;
        # differing notes remain separate. Original files are never modified.
        seen = set()
        for legacy in ('cross-asset-wildcards', 'heatmap-wildcards'):
            for old in sorted((root / legacy).glob('*.json')):
                saved = json.loads(old.read_text(encoding='utf-8'))
                for row in read_old_rows(old.parent, saved['source_id'])['rows']:
                    for day, text in row['notes'].items():
                        identity = sha256(json.dumps([row['title'], day, text, row['archived']], ensure_ascii=False).encode()).hexdigest()
                        if identity in seen:
                            continue
                        seen.add(identity)
                        entry = WildcardEntry(date=day, title=row['title'], details=text, archived=row['archived'])
                        items.append({'id': 'note-' + identity, **entry.model_dump(mode='json')})
        items.sort(key=lambda row: (row['date'], row['at'] or '', row['id']), reverse=True)
        body = {'schema': 1, 'revision': 0, 'items': items}
        _write(directory, body)
        return body
    if path.stat().st_size > 32 * 1024 * 1024:
        raise ValueError('Wildcards exceed 32 MB')
    body = json.loads(path.read_text(encoding='utf-8'))
    if body.get('schema') != 1 or type(body.get('revision')) is not int or body['revision'] < 0 or not isinstance(body.get('items'), list):
        raise ValueError('Invalid Wildcards storage')
    identities = set()
    for entry in body['items']:
        identity = entry['id']
        if not isinstance(identity, str) or not identity or identity in identities:
            raise ValueError('Invalid wildcard identity')
        identities.add(identity)
        WildcardEntry.model_validate({k: v for k, v in entry.items() if k != 'id'})
    return body


def wildcard_snapshot(root):
    root = Path(root)
    with _lock, data_lock(root / 'wildcards'):
        return _read(root)


def change_wildcard(root, revision, entry=None, identity=None, delete=False):
    root = Path(root)
    with _lock, data_lock(root / 'wildcards'):
        body = _read(root)
        if body['revision'] != revision:
            raise HTTPException(409, 'Wildcards changed elsewhere. Reload and reapply your edit.')
        position = next((i for i, row in enumerate(body['items']) if row['id'] == identity), None)
        if identity and position is None:
            raise HTTPException(404, 'Wildcard not found')
        if delete:
            body['items'].pop(position)
        else:
            row = {'id': identity or uuid4().hex, **entry.model_dump(mode='json')}
            if position is None:
                body['items'].append(row)
            else:
                body['items'][position] = row
        body['revision'] += 1
        body['items'].sort(key=lambda row: (row['date'], row['at'] or '', row['id']), reverse=True)
        _write(root / 'wildcards', body)
        return body
