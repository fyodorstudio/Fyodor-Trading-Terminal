"""On-demand currency news. Immutable refreshes with one atomic latest index.

No web ingestion, price reads, reminders or research happen on a panel read.
"""
from datetime import datetime, timedelta, timezone
from hashlib import sha256
import json
import os
from pathlib import Path
import tempfile
from threading import RLock
from typing import Literal
from urllib.parse import urlsplit

from pydantic import ConfigDict, Field, model_validator

from .contracts import Payload
from .currencies import CalendarCurrency, CURRENCIES
from .data_lock import data_lock

DIRECTORY = Path(os.environ.get('FYODOR_STORAGE_DATA_DIR', Path(__file__).resolve().parent / 'data')).resolve() / 'currency-news'
LOCK = RLock()


class NewsPayload(Payload):
    model_config = ConfigDict(extra='forbid', str_strip_whitespace=True)


def clock(value):
    if value.tzinfo is None or value.utcoffset() is None:
        raise ValueError('News clocks require an explicit UTC offset')
    return value.astimezone(timezone.utc)


class NewsSource(NewsPayload):
    label: str = Field(min_length=1, max_length=160)
    url: str = Field(min_length=1, max_length=2000)

    @model_validator(mode='after')
    def valid_url(self):
        parsed = urlsplit(self.url)
        if parsed.scheme not in ('http', 'https') or not parsed.hostname or parsed.username or parsed.password or any(c.isspace() for c in self.url):
            raise ValueError('Use a direct HTTP(S) source URL without credentials')
        return self


class NewsItem(NewsPayload):
    summary: str = Field(min_length=1, max_length=1800)
    published_at: datetime | None = None
    timing_note: str = Field(default='', max_length=500)
    sources: list[NewsSource] = Field(min_length=1, max_length=8)

    @model_validator(mode='after')
    def timing(self):
        if self.published_at is not None:
            self.published_at = clock(self.published_at)
        elif not self.timing_note:
            raise ValueError('Unknown publication time requires a timing note; use background, not fresh news')
        return self


class CurrencyNews(NewsPayload):
    currency: CalendarCurrency
    checked_at: datetime
    coverage: Literal['checked', 'partial', 'unavailable']
    coverage_note: str = Field(default='', max_length=1200)
    items: list[NewsItem] = Field(default_factory=list, max_length=12)
    background: list[NewsItem] = Field(default_factory=list, max_length=8)
    implication: Literal['supportive', 'negative', 'mixed', 'no_clear_signal']
    reason: str = Field(min_length=1, max_length=1800)

    @model_validator(mode='after')
    def coverage_and_times(self):
        self.checked_at = clock(self.checked_at)
        if self.checked_at > datetime.now(timezone.utc):
            raise ValueError('A source check cannot be in the future')
        if self.coverage != 'checked' and not self.coverage_note:
            raise ValueError('Incomplete coverage needs its specific gap')
        if self.coverage == 'unavailable' and (self.items or self.implication != 'no_clear_signal'):
            raise ValueError('Unavailable coverage cannot supply fresh news or a fresh directional implication')
        if not self.items and self.implication != 'no_clear_signal':
            raise ValueError('Older background alone cannot establish a fresh news implication')
        for item in self.items + self.background:
            if item.published_at and item.published_at > self.checked_at:
                raise ValueError('Publication cannot follow the source check')
        return self


class NewsRefresh(NewsPayload):
    window_hours: int = Field(default=3, ge=1, le=24, strict=True)
    rows: list[CurrencyNews] = Field(min_length=1, max_length=8)

    @model_validator(mode='after')
    def windows(self):
        if len({r.currency for r in self.rows}) != len(self.rows):
            raise ValueError('Only one result per currency in a refresh')
        for row in self.rows:
            start = row.checked_at - timedelta(hours=self.window_hours)
            if any(i.published_at is None or i.published_at < start for i in row.items):
                raise ValueError('Fresh items need a publication time inside the requested window')
            if any(i.published_at is not None and i.published_at >= start for i in row.background):
                raise ValueError('Known recent publications belong in fresh items, not older background')
        return self


def encoded(value):
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(',', ':')).encode('utf-8')


def atomic_write(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, name = tempfile.mkstemp(prefix='.news-', dir=path.parent)
    try:
        with os.fdopen(fd, 'wb') as handle:
            handle.write(encoded(value))
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(name, path)
    finally:
        Path(name).unlink(missing_ok=True)


def read_index(directory):
    path = Path(directory) / 'latest.json'
    if not path.exists():
        return {}
    index = json.loads(path.read_text(encoding='utf-8'))
    if not isinstance(index, dict) or any(c not in CURRENCIES or not isinstance(v, str) or len(v) != 64 or any(x not in '0123456789abcdef' for x in v) for c, v in index.items()):
        raise ValueError('Invalid news index; existing history has been preserved')
    return index


def read_rows(directory, index):
    runs = {}
    rows = []
    for currency in CURRENCIES:
        run_id = index.get(currency)
        if not run_id:
            rows.append({'currency': currency, 'snapshot': None})
            continue
        if run_id not in runs:
            doc = json.loads((Path(directory) / 'runs' / f'{run_id}.json').read_text(encoding='utf-8'))
            request = NewsRefresh.model_validate(doc['request'])
            if sha256(encoded(request.model_dump(mode='json'))).hexdigest() != run_id:
                raise ValueError('News history hash mismatch')
            saved_at = clock(datetime.fromisoformat(doc['saved_at']))
            runs[run_id] = (request, saved_at.isoformat())
        request, saved_at = runs[run_id]
        row = next((r for r in request.rows if r.currency == currency), None)
        if row is None:
            raise ValueError('News index references a missing currency')
        rows.append({'currency': currency, 'snapshot': {**row.model_dump(mode='json'),
            'window_hours': request.window_hours, 'run_id': run_id, 'saved_at': saved_at}})
    return rows


def news_snapshot(directory=DIRECTORY, after_revision=None):
    # Index replace is atomic; immutable run bodies need no reader lock.
    index = read_index(directory)
    revision = sha256(encoded(index)).hexdigest()
    result = {'schema': 1, 'revision': revision}
    return {**result, 'unchanged': True} if after_revision == revision else {**result, 'rows': read_rows(directory, index)}


def save_refresh(request: NewsRefresh, directory=DIRECTORY):
    directory = Path(directory)
    body = request.model_dump(mode='json')
    run_id = sha256(encoded(body)).hexdigest()
    with LOCK, data_lock(directory):
        index = read_index(directory)
        current = {r['currency']: r['snapshot'] for r in read_rows(directory, index)}
        for row in request.rows:
            previous = current[row.currency]
            if previous and index[row.currency] != run_id and row.checked_at <= datetime.fromisoformat(previous['checked_at']):
                raise ValueError(f'{row.currency} already has an equal or newer source check; investigate before saving')
        run_path = directory / 'runs' / f'{run_id}.json'
        created = not run_path.exists()
        if created:
            atomic_write(run_path, {'schema': 1, 'saved_at': datetime.now(timezone.utc).isoformat(), 'request': body})
        new_index = {**index, **{r.currency: run_id for r in request.rows}}
        try:
            atomic_write(directory / 'latest.json', new_index)
        except OSError:
            if created:
                run_path.unlink(missing_ok=True)
            raise
        readback = news_snapshot(directory)
        if any(next(r for r in readback['rows'] if r['currency'] == row.currency)['snapshot']['run_id'] != run_id for row in request.rows):
            raise ValueError('News read-back did not match the saved refresh')
        return {'saved': True, 'run_id': run_id, 'currencies': [r.currency for r in request.rows],
                'revision': readback['revision'], 'readback_verified': True}
