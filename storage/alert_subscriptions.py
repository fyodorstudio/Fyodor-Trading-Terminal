"""Alarm selection is independent of browsing, pins and research lifecycles."""
from collections import defaultdict
from copy import deepcopy
from datetime import datetime, timezone
import hashlib
from pathlib import Path

from .calendar_store import CalendarStore

TARGET = 'Pepperstone-Demo'


def calendar_subscription(store, broker, ids, title, enabled):
    if not isinstance(broker, str) or not broker.startswith('Pepperstone-'):
        raise ValueError('Choose a Pepperstone calendar source')
    if not isinstance(ids, list) or not 1 <= len(ids) <= 512 or any(not isinstance(i, str) or not i.isdigit() for i in ids):
        raise ValueError('Calendar reminder requires exact value IDs')
    if not isinstance(title, str) or not title.strip() or len(title) > 500 or type(enabled) is not bool:
        raise ValueError('Invalid calendar reminder')
    rows = store.values(broker, ids)
    clocks = {row['release_at'] for row in rows}
    if len(rows) != len(set(ids)) or len(clocks) != 1 or None in clocks or any(row['time_mode'] != 0 or row['availability'] != 'observed' for row in rows):
        raise ValueError('Every selected series must have the same verified publication time')
    if len({(row['country_code'], row['currency']) for row in rows}) != 1:
        raise ValueError('Unrelated countries or currencies cannot share a calendar reminder')
    identity = hashlib.sha256((broker + ':' + ','.join(sorted(set(ids)))).encode()).hexdigest()[:32]
    return f'calendar:{broker}:{identity}', {'broker': broker, 'value_ids': sorted(set(ids)), 'title': title.strip(), 'enabled': enabled}


def load_selected_schedule(database, engine):
    # Legacy loader is retained for saved research and one-time choice migration.
    from .alarms import read_events
    from .external_sources import DIRECTORY, external_snapshot
    store = CalendarStore(Path(database), readonly=True)
    try:
        with engine.lock:
            previous = deepcopy(engine.state)
            try:
                if engine.state.get('selection_version') != 2:
                    legacy = read_events(database)
                    subscriptions, issues, migrated = {}, [], []
                    for item in legacy:
                        selected = engine.state['overrides'].get(item['key'], True)
                        if item['source'] == 'external':
                            engine.state['overrides'].setdefault(item['key'], selected)
                            continue
                        if not item['eligible'] or item['at'] is None or item['at'] <= engine.clock() * 1000:
                            continue
                        original = store.values(item['broker'], item.get('value_ids', []))
                        target = store.values(TARGET, item.get('value_ids', []))
                        def identity(row):
                            return tuple(row.get(k) for k in ('event_id', 'currency', 'country_code', 'period_seconds', 'time_mode', 'release_at'))
                        old = {row['value_id']: row for row in original}
                        if len(target) != len(old) or not old or any(identity(row) != identity(old[row['value_id']]) for row in target):
                            issues.append({'key': item['key'], 'title': item['title'], 'reason': 'No exact Pepperstone occurrence match; old reminder retired to avoid hidden Elev8 delivery.'})
                            continue
                        try:
                            key, subscription = calendar_subscription(store, TARGET, [row['value_id'] for row in target], item['title'], selected)
                        except ValueError as error:
                            issues.append({'key': item['key'], 'title': item['title'], 'reason': str(error)})
                            continue
                        # Conflicting prior choices are surfaced, never silently rearmed.
                        if key in subscriptions and subscriptions[key]['enabled'] != selected:
                            subscription['enabled'] = False
                            issues.append({'key': key, 'title': item['title'], 'reason': 'Conflicting old alarm choices; transferred off.'})
                        subscriptions[key] = subscription
                        migrated.append({'from': item['key'], 'to': key, 'enabled': subscription['enabled']})
                    engine.state.update(selection_version=2, calendar_subscriptions=subscriptions,
                        migration={'completed_utc': datetime.now(timezone.utc).isoformat(), 'matches': migrated, 'issues': issues})
                    engine.save()
            except Exception:
                engine.state = previous
                raise
            subscriptions = deepcopy(engine.state.get('calendar_subscriptions', {}))
        result = []
        for key, subscription in subscriptions.items():
            rows = store.values(subscription['broker'], subscription['value_ids'])
            stages = defaultdict(list)
            for row in rows:
                stages[row['release_at']].append(row)
            for at, members in stages.items():
                stage_key = key if len(stages) == 1 else f'{key}:{at}'
                result.append({'key': stage_key, 'reference': key, 'source': 'calendar', 'broker': subscription['broker'],
                    'value_ids': [r['value_id'] for r in members], 'title': subscription['title'], 'currencies': sorted({r['currency'] for r in members}),
                    'at': at, 'date': None, 'eligible': at is not None and len(rows) == len(subscription['value_ids'])
                        and all(r['time_mode'] == 0 and r['availability'] == 'observed' for r in members),
                    'default_enabled': subscription['enabled'], 'note': 'Verified broker publication. Alarm choice is independent of date and filters.'})
        offset = 0
        while True:
            page = external_snapshot(DIRECTORY, visibility='all', limit=500, offset=offset)
            for item in page['items']:
                at = datetime.fromisoformat(item['event_at'].replace('Z', '+00:00')).timestamp() * 1000 if item['event_at'] else None
                result.append({'key': f"external:{item['key']}", 'reference': item['key'], 'source': 'external', 'broker': None,
                    'title': item['title'], 'currencies': item['currencies'], 'at': at, 'date': item['event_date'],
                    'eligible': not item['archived'] and at is not None and item['kind'] == 'scheduled' and item['status'] == 'confirmed',
                    'default_enabled': False, 'note': item['time_note']})
            if page['next_offset'] is None:
                break
            offset = page['next_offset']
        return result
    finally:
        store.close()
