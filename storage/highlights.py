"""Persistent release pins shared by the terminal and read-only analyst helper."""
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import tempfile
from threading import RLock
from uuid import uuid4

from fastapi import HTTPException
from pydantic import Field
from .calendar_clock import publication_time_known
from .contracts import Payload
from .currencies import CalendarCurrency

HIGHLIGHTS_PATH = Path(__file__).resolve().parents[1] / 'Market Analyst Workflow' / 'highlights.json'
LOCK = RLock()


class HighlightRequest(Payload):
    source_id: str = Field(min_length=1, max_length=160)
    label: str = Field(min_length=1, max_length=500)
    family_id: str = Field(min_length=1, max_length=100)
    currency: CalendarCurrency
    value_ids: list[str] = Field(min_length=1, max_length=512)
    event_ids: list[str] = Field(default_factory=list, max_length=512)
    join_window_seconds: int = Field(default=0, ge=0, le=3600)


class HighlightPin(HighlightRequest):
    id: str = Field(pattern=r'^[0-9a-f]{32}$')
    pinned_utc: str = Field(min_length=1, max_length=50)


def read_pins(path=HIGHLIGHTS_PATH):
    path = Path(path)
    if not path.exists():
        return []
    data = json.loads(path.read_text(encoding='utf-8'))
    if not isinstance(data, dict) or data.get('version') != 1 or not isinstance(data.get('pins'), list) or len(data['pins']) > 200:
        raise ValueError('Unsupported Highlight file; preserve it and restore a valid copy')
    return [HighlightPin.model_validate(pin).model_dump() for pin in data['pins']]


def write_pins(path, pins):
    path = Path(path)
    pins = [HighlightPin.model_validate(pin).model_dump() for pin in pins]
    path.parent.mkdir(parents=True, exist_ok=True)
    name = None
    try:
        with tempfile.NamedTemporaryFile(mode='w', encoding='utf-8', dir=path.parent, delete=False) as output:
            name = output.name
            json.dump({'version': 1, 'pins': pins}, output, ensure_ascii=False, separators=(',', ':'))
            output.flush()
            os.fsync(output.fileno())
        os.replace(name, path)
    finally:
        if name is not None:
            Path(name).unlink(missing_ok=True)


def pin_release(store, request, path=HIGHLIGHTS_PATH):
    ids = list(dict.fromkeys(request.value_ids))
    if any(not value or len(value) > 32 for value in ids):
        raise HTTPException(422, 'Invalid release value IDs')
    with LOCK, store.lock:
        events = store.values(request.source_id, ids)
        if len(events) != len(ids) or any(event['currency'] != request.currency for event in events):
            raise HTTPException(404, 'Release readings are unavailable for this broker and currency')
        if max(event['server_time_seconds'] for event in events) - min(event['server_time_seconds'] for event in events) > 172800:
            raise HTTPException(422, 'Pin one release occurrence at a time')
        event_ids = list(dict.fromkeys(request.event_ids or [event['event_id'] for event in events]))
        if any(not value.isdigit() or len(value) > 20 for value in event_ids):
            raise HTTPException(422, 'Invalid release series IDs')
        pins = read_pins(path)
        existing = next((pin for pin in pins if pin['source_id'] == request.source_id and set(pin['value_ids']) & set(ids)), None)
        if existing:
            existing['value_ids'] = list(dict.fromkeys([*existing['value_ids'], *ids]))
            existing['event_ids'] = list(dict.fromkeys([*existing['event_ids'], *event_ids]))
            identity = existing['id']
        else:
            if len(pins) >= 200:
                raise HTTPException(409, 'Remove an existing Highlight before adding another')
            identity = uuid4().hex
            pins.append({**request.model_dump(), 'id': identity, 'value_ids': ids, 'event_ids': event_ids,
                'pinned_utc': datetime.now(timezone.utc).isoformat(timespec='seconds')})
        write_pins(path, pins)
        return {'id': identity}


def delete_pin(identity, source_id, path=HIGHLIGHTS_PATH):
    with LOCK:
        pins = read_pins(path)
        remaining = [pin for pin in pins if not (pin['id'] == identity and pin['source_id'] == source_id)]
        if len(remaining) == len(pins):
            raise HTTPException(404, 'Highlight not found for this broker')
        write_pins(path, remaining)
        return {'removed': identity}


def highlight_snapshot(store, source_id=None, path=HIGHLIGHTS_PATH, after_revision=None, persist_related=False):
    with LOCK, store.lock:
        all_pins = read_pins(path)
        pins = [pin for pin in all_pins if source_id is None or pin['source_id'] == source_id]
        expanded = False
        calendar_revision = store.db.execute('SELECT value FROM data_revision WHERE id=1').fetchone()[0]
        source = store.db.execute('SELECT publisher_seen_at FROM sources WHERE id=?', (source_id,)).fetchone() if source_id else None
        source_status = 'live' if source and source[0] and store.clock() - source[0] < 30 else 'offline' if source else 'unavailable'
        revision = hashlib.sha256(json.dumps(pins, sort_keys=True).encode()).hexdigest() + f':{calendar_revision}'
        result = {'source_id': source_id, 'source_status': source_status, 'revision': revision, 'calendar_revision': calendar_revision,
            'as_of_utc': datetime.now(timezone.utc).isoformat(timespec='seconds')}
        if revision == after_revision:
            return {**result, 'unchanged': True}
        items = []
        for pin in pins:
            events = store.values(pin['source_id'], pin['value_ids'])
            # Discover additional series in the same publication window. Exact
            # value IDs retain rescheduled pins; never match the next monthly event.
            if events and pin['event_ids']:
                window = pin.get('join_window_seconds', 0)
                intervals = []
                for at in sorted({event['server_time_seconds'] for event in events}):
                    start, end = max(0, at - window), at + window + 1
                    if intervals and start <= intervals[-1][1]:
                        intervals[-1][1] = max(end, intervals[-1][1])
                    else:
                        intervals.append([start, end])
                related = []
                for start, end in intervals:
                    query = store.query(pin['source_id'], start, end, currency=pin['currency'], event_ids=pin['event_ids'], limit=5000)
                    if query['next_cursor'] is not None:
                        raise ValueError('Highlight publication window exceeded its bound')
                    related.extend(query['events'])
                periods = {}
                for event in events:
                    periods.setdefault(event['event_id'], set()).add(event['period_seconds'])
                related = [event for event in related if event['event_id'] not in periods or event['period_seconds'] in periods[event['event_id']]]
                by_id = {event['value_id']: event for event in events}
                by_id.update((event['value_id'], event) for event in store.values(pin['source_id'], [event['value_id'] for event in related]))
                events = sorted(by_id.values(), key=lambda event: (event['server_time_seconds'], event['value_id']))
                added = set(by_id) - set(pin['value_ids'])
                if added and persist_related:
                    if len(pin['value_ids']) + len(added) > 512:
                        raise ValueError('Highlight exceeded its series bound')
                    pin['value_ids'].extend(sorted(added))
                    expanded = True
            known = [event['release_at'] for event in events if publication_time_known(event) and event['release_at'] is not None]
            publisher = store.db.execute('SELECT publisher_seen_at FROM sources WHERE id=?', (pin['source_id'],)).fetchone()
            publisher_status = 'live' if publisher and publisher[0] and store.clock() - publisher[0] < 30 else 'offline' if publisher else 'unavailable'
            items.append({**pin, 'events': events, 'publisher_status': publisher_status, 'release_at': min(known) if known else None,
                'server_time': min((event['server_time_seconds'] for event in events), default=None),
                'missing_value_ids': sorted(set(pin['value_ids']) - {event['value_id'] for event in events})})
        items.sort(key=lambda pin: (pin['release_at'] if pin['release_at'] is not None else (pin['server_time'] or 0) * 1000, pin['id']))
        if expanded:
            write_pins(path, all_pins)
            result['revision'] = hashlib.sha256(json.dumps(pins, sort_keys=True).encode()).hexdigest() + f':{calendar_revision}'
        return {**result, 'items': items}
