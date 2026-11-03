"""On-demand currency news. Immutable refreshes with one atomic latest index.

No web ingestion, price reads, reminders or research happen on a panel read.
"""
from datetime import date as Date, datetime, timedelta, timezone
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
JAKARTA = timezone(timedelta(hours=7))


class SavedNewsNotFound(LookupError):
    pass


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


def valid_id(value):
    return isinstance(value, str) and len(value) == 64 and all(x in '0123456789abcdef' for x in value)


def read_run(directory, run_id):
    if not valid_id(run_id):
        raise ValueError('Invalid saved refresh ID')
    doc = json.loads((Path(directory) / 'runs' / f'{run_id}.json').read_text(encoding='utf-8'))
    request = NewsRefresh.model_validate(doc['request'])
    if sha256(encoded(request.model_dump(mode='json'))).hexdigest() != run_id:
        raise ValueError('News history hash mismatch')
    saved_at = clock(datetime.fromisoformat(doc['saved_at']))
    if saved_at > datetime.now(timezone.utc) or any(row.checked_at > saved_at for row in request.rows):
        raise ValueError('Invalid news save clock')
    return request, saved_at.isoformat()


def read_state(directory, legacy_history=False):
    path = Path(directory) / 'latest.json'
    if not path.exists():
        return {}, {}
    state = json.loads(path.read_text(encoding='utf-8'))
    current_format = isinstance(state, dict) and state.get('schema') == 2
    index = state.get('latest') if current_format else state
    if not isinstance(index, dict) or any(c not in CURRENCIES or not valid_id(v) for c, v in index.items()):
        raise ValueError('Invalid news index; existing history has been preserved')
    history = state.get('history') if current_format else {}
    if not isinstance(history, dict):
        raise ValueError('Invalid news history index')
    for run_id, meta in history.items():
        if not valid_id(run_id) or not isinstance(meta, dict) or not isinstance(meta.get('saved_at'), str):
            raise ValueError('Invalid news history metadata')
        clock(datetime.fromisoformat(meta['saved_at']))
        currencies = meta.get('currencies')
        if not isinstance(currencies, list) or not 1 <= len(currencies) <= 8 or any(c not in CURRENCIES for c in currencies) or len(set(currencies)) != len(currencies):
            raise ValueError('Invalid saved refresh currencies')
    if current_format and any(run_id not in history for run_id in index.values()):
        raise ValueError('Latest news is missing its history entry')
    # Legacy bodies remain byte-for-byte intact. Reads never migrate files;
    # the next save atomically includes their metadata in the new index.
    if legacy_history and not current_format:
        for path in sorted((Path(directory) / 'runs').glob('*.json')):
            request, saved_at = read_run(directory, path.stem)
            history[path.stem] = {'saved_at': saved_at, 'currencies': [r.currency for r in request.rows]}
    return index, history


def read_rows(directory, index, runs=None):
    runs = {} if runs is None else runs
    rows = []
    for currency in CURRENCIES:
        run_id = index.get(currency)
        if not run_id:
            rows.append({'currency': currency, 'snapshot': None})
            continue
        if run_id not in runs:
            runs[run_id] = read_run(directory, run_id)
        request, saved_at = runs[run_id]
        row = next((r for r in request.rows if r.currency == currency), None)
        if row is None:
            raise ValueError('News index references a missing currency')
        rows.append({'currency': currency, 'snapshot': {**row.model_dump(mode='json'),
            'window_hours': request.window_hours, 'run_id': run_id, 'saved_at': saved_at}})
    return rows


def news_snapshot(directory=DIRECTORY, after_revision=None):
    # Index replace is atomic; immutable run bodies need no reader lock.
    index, _ = read_state(directory)
    revision = sha256(encoded(index)).hexdigest()
    result = {'schema': 1, 'revision': revision}
    return {**result, 'unchanged': True} if after_revision == revision else {**result, 'rows': read_rows(directory, index)}


def news_history(directory, selected_date, before=None, limit=50):
    selected_date = Date.fromisoformat(selected_date).isoformat()
    if not 1 <= limit <= 100:
        raise ValueError('History page limit must be between 1 and 100')
    _, history = read_state(directory, legacy_history=True)
    entries = [{'run_id': run_id, **meta} for run_id, meta in history.items()
        if datetime.fromisoformat(meta['saved_at']).astimezone(JAKARTA).date().isoformat() == selected_date]
    entries.sort(key=lambda m: (datetime.fromisoformat(m['saved_at']), m['run_id']), reverse=True)
    start = 0
    if before is not None:
        start = next((i + 1 for i, item in enumerate(entries) if item['run_id'] == before), None)
        if start is None:
            raise ValueError('History cursor does not belong to this date')
    page = entries[start:start + limit]
    return {'schema': 1, 'date': selected_date, 'runs': page,
        'next_before': page[-1]['run_id'] if page and start + limit < len(entries) else None}


def news_run(directory, run_id):
    _, history = read_state(directory, legacy_history=True)
    if run_id not in history:
        raise SavedNewsNotFound('Saved refresh not found')
    request, saved_at = read_run(directory, run_id)
    if history[run_id] != {'saved_at': saved_at, 'currencies': [r.currency for r in request.rows]}:
        raise ValueError('Saved refresh does not match its history entry')
    rows = read_rows(directory, {r.currency: run_id for r in request.rows}, {run_id: (request, saved_at)})
    return {'schema': 1, 'revision': run_id, 'run_id': run_id, 'saved_at': saved_at, 'rows': rows}


def save_refresh(request: NewsRefresh, directory=DIRECTORY):
    directory = Path(directory)
    body = request.model_dump(mode='json')
    run_id = sha256(encoded(body)).hexdigest()
    with LOCK, data_lock(directory):
        index, history = read_state(directory, legacy_history=True)
        current = {r['currency']: r['snapshot'] for r in read_rows(directory, index)}
        for row in request.rows:
            previous = current[row.currency]
            if previous and index[row.currency] != run_id and row.checked_at <= datetime.fromisoformat(previous['checked_at']):
                raise ValueError(f'{row.currency} already has an equal or newer source check; investigate before saving')
        run_path = directory / 'runs' / f'{run_id}.json'
        created = run_id not in history
        if created:
            # An uncommitted orphan from a terminated writer is replaced. Only
            # this atomic index publication admits a run into saved history.
            atomic_write(run_path, {'schema': 1, 'saved_at': datetime.now(timezone.utc).isoformat(), 'request': body})
        _, saved_at = read_run(directory, run_id)
        new_index = {**index, **{r.currency: run_id for r in request.rows}}
        new_history = {**history, run_id: {'saved_at': saved_at, 'currencies': [r.currency for r in request.rows]}}
        try:
            atomic_write(directory / 'latest.json', {'schema': 2, 'latest': new_index, 'history': new_history})
        except OSError:
            if created:
                run_path.unlink(missing_ok=True)
            raise
        readback = news_snapshot(directory)
        if any(next(r for r in readback['rows'] if r['currency'] == row.currency)['snapshot']['run_id'] != run_id for row in request.rows):
            raise ValueError('News read-back did not match the saved refresh')
        return {'saved': True, 'run_id': run_id, 'currencies': [r.currency for r in request.rows],
                'revision': readback['revision'], 'readback_verified': True}
