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
from .data_lock import data_lock

HIGHLIGHTS_PATH = Path(__file__).resolve().parents[1] / 'Market Analyst Workflow' / 'highlights.json'
MAX_HIGHLIGHT_RECORDS = 10000
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
    archived_utc: str | None = None
    archived_snapshot: dict | None = None


def read_pins(path=HIGHLIGHTS_PATH):
    path = Path(path)
    if not path.exists():
        return []
    data = json.loads(path.read_text(encoding='utf-8'))
    if not isinstance(data, dict) or data.get('version') not in (1, 2) or not isinstance(data.get('pins'), list) or len(data['pins']) > MAX_HIGHLIGHT_RECORDS:
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
            json.dump({'version': 2, 'pins': pins}, output, ensure_ascii=False, separators=(',', ':'))
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
    with LOCK, data_lock(Path(path).parent), store.lock:
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
            existing['archived_utc'] = None
            existing['archived_snapshot'] = None
        else:
            if len(pins) >= MAX_HIGHLIGHT_RECORDS:
                raise HTTPException(409, f'Highlight file capacity reached ({MAX_HIGHLIGHT_RECORDS} active and archived records); existing records are preserved')
            identity = uuid4().hex
            pins.append({**request.model_dump(), 'id': identity, 'value_ids': ids, 'event_ids': event_ids,
                'pinned_utc': datetime.now(timezone.utc).isoformat(timespec='seconds')})
        write_pins(path, pins)
        return {'id': identity}


def archive_pin(identity, source_id, path=HIGHLIGHTS_PATH, store=None, restore=False):
    with LOCK, data_lock(Path(path).parent):
        pins = read_pins(path)
        pin = next((pin for pin in pins if pin['id'] == identity and pin['source_id'] == source_id), None)
        if pin is None:
            raise HTTPException(404, 'Highlight not found for this broker')
        if restore:
            pin['archived_utc'] = None
            pin['archived_snapshot'] = None
        elif not pin['archived_utc']:
            if store is not None:
                item = next(item for item in highlight_snapshot(store, source_id, path, visibility='all')['items'] if item['id'] == identity)
                pin['value_ids'] = list(dict.fromkeys([*pin['value_ids'], *[event['value_id'] for event in item['events']]]))
                pin['archived_snapshot'] = {key: item[key] for key in ('events', 'release_at', 'server_time', 'missing_value_ids')}
            pin['archived_utc'] = datetime.now(timezone.utc).isoformat(timespec='seconds')
        write_pins(path, pins)
        return {'id': identity, 'archived': not restore}


def delete_pin(identity, source_id, path=HIGHLIGHTS_PATH, store=None):
    """Compatibility for old clients: unpin now archives instead of deleting."""
    return archive_pin(identity, source_id, path, store)


def highlight_snapshot(store, source_id=None, path=HIGHLIGHTS_PATH, after_revision=None, persist_related=False, visibility='active'):
    if persist_related:
        with LOCK, data_lock(Path(path).parent):
            return _highlight_snapshot(store, source_id, path, after_revision, True, visibility)
    return _highlight_snapshot(store, source_id, path, after_revision, False, visibility)


def _highlight_snapshot(store, source_id, path, after_revision, persist_related, visibility):
    from .highlight_journal import read_journal
    from .highlight_metadata import read_prompts
    if visibility not in ('active', 'archived', 'all'):
        raise ValueError('Choose active, archived or all Highlights')
    with LOCK, store.lock:
        all_pins = read_pins(path)
        pins = [pin for pin in all_pins if (source_id is None or pin['source_id'] == source_id)
            and (visibility == 'all' or bool(pin['archived_utc']) == (visibility == 'archived'))]
        journals = {pin['id']: read_journal(pin['id'], path) for pin in pins}
        prompts = {pin['id']: read_prompts(pin['id'], path) for pin in pins}
        if any(entry['source_id'] != pin['source_id'] or pin['currency'] not in (entry['scope'][:3], entry['scope'][3:])
               for pin in pins for entry in journals[pin['id']]):
            raise ValueError('Journal broker or currency mismatch; preserve the research files')
        if any(entry['source_id'] != pin['source_id'] or pin['currency'] not in (entry['scope'][:3], entry['scope'][3:])
               for pin in pins for entry in prompts[pin['id']]):
            raise ValueError('Prompt broker or currency mismatch; preserve the prompt files')
        expanded = False
        calendar_revision = store.db.execute('SELECT value FROM data_revision WHERE id=1').fetchone()[0]
        source = store.db.execute('SELECT publisher_seen_at FROM sources WHERE id=?', (source_id,)).fetchone() if source_id else None
        source_status = 'live' if source and source[0] and store.clock() - source[0] < 30 else 'offline' if source else 'unavailable'
        signature = lambda: hashlib.sha256(json.dumps([pins, journals, prompts], sort_keys=True).encode()).hexdigest() + f':{calendar_revision}'
        revision = signature()
        result = {'highlight_schema': 2, 'source_id': source_id, 'source_status': source_status, 'revision': revision, 'calendar_revision': calendar_revision,
            'as_of_utc': datetime.now(timezone.utc).isoformat(timespec='seconds')}
        if revision == after_revision:
            return {**result, 'unchanged': True}
        items = []
        for pin in pins:
            if pin['archived_utc'] and pin['archived_snapshot'] is not None:
                items.append({**{key: value for key, value in pin.items() if key != 'archived_snapshot'},
                    **pin['archived_snapshot'], 'journal': journals[pin['id']], 'prompts': prompts[pin['id']], 'publisher_status': 'archived'})
                continue
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
            items.append({**{key: value for key, value in pin.items() if key != 'archived_snapshot'}, 'journal': journals[pin['id']], 'prompts': prompts[pin['id']], 'events': events, 'publisher_status': publisher_status, 'release_at': min(known) if known else None,
                'server_time': min((event['server_time_seconds'] for event in events), default=None),
                'missing_value_ids': sorted(set(pin['value_ids']) - {event['value_id'] for event in events})})
        items.sort(key=lambda pin: (pin['release_at'] if pin['release_at'] is not None else (pin['server_time'] or 0) * 1000, pin['id']))
        if expanded:
            write_pins(path, all_pins)
            result['revision'] = signature()
        return {**result, 'items': items}
