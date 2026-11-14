"""Calendar subscriptions and selected reminder schedules."""
from collections import defaultdict
from copy import deepcopy
import hashlib
from pathlib import Path

from .calendar_store import CalendarStore



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
    store = CalendarStore(Path(database), readonly=True)
    try:
        with engine.lock:
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
        return result
    finally:
        store.close()
