"""Legacy manual News file support for migration and older backups."""
from datetime import date
import json
import os
from pathlib import Path
import tempfile
from uuid import uuid4
from urllib.parse import urlsplit
from pydantic import Field, model_validator
from .contracts import Payload
from .currencies import CURRENCIES
from .data_lock import data_lock

class NewsEntry(Payload):
    date: date
    currencies: list[str] = Field(min_length=1, max_length=8)
    title: str = Field(min_length=1, max_length=300)
    details: str = Field(default='', max_length=20000)
    url: str = Field(default='', max_length=2000)

    @model_validator(mode='after')
    def validate_entry(self):
        self.title = self.title.strip()
        self.url = self.url.strip()
        if not self.title or len(set(self.currencies)) != len(self.currencies) or any(c not in CURRENCIES for c in self.currencies):
            raise ValueError('Enter a title and select currencies')
        if self.url:
            parsed = urlsplit(self.url)
            if parsed.scheme not in ('https', 'http') or not parsed.hostname or parsed.username or parsed.password or any(c.isspace() for c in self.url):
                raise ValueError('Source must be an HTTP or HTTPS URL')
        return self

def read_news(directory):
    path = Path(directory) / 'news.json'
    if not path.exists():
        return {'items': []}
    body = json.loads(path.read_text(encoding='utf-8'))
    if not isinstance(body, dict) or not isinstance(body.get('items'), list):
        raise ValueError('Invalid saved news')
    ids = set()
    for item in body['items']:
        identity = item.get('id')
        if not isinstance(identity, str) or not identity or identity in ids:
            raise ValueError('Invalid news entry ID')
        ids.add(identity)
        NewsEntry.model_validate({k: v for k, v in item.items() if k != 'id'})
    return body

def write_news(directory, entry=None, identity=None, delete=False):
    directory = Path(directory)
    with data_lock(directory):
        body = read_news(directory)
        items = body['items']
        existing = next((i for i, item in enumerate(items) if item['id'] == identity), None)
        if identity and existing is None:
            raise KeyError('News entry not found')
        if delete:
            items.pop(existing)
        else:
            item = {'id': identity or uuid4().hex, **entry.model_dump(mode='json')}
            if existing is None:
                items.append(item)
            else:
                items[existing] = item
        body['items'] = sorted(items, key=lambda item: (item['date'], item['id']), reverse=True)
        filename = None
        try:
            with tempfile.NamedTemporaryFile(mode='w', encoding='utf-8', dir=directory, prefix='.news-', delete=False) as output:
                filename = output.name
                json.dump(body, output, ensure_ascii=False, indent=2)
                output.flush()
                os.fsync(output.fileno())
            os.replace(filename, directory / 'news.json')
        finally:
            if filename and Path(filename).exists():
                Path(filename).unlink()
        return body
