"""Retained publication/capture clocks without replaying superseded archives."""
from datetime import datetime, timezone
import json

from .calendar_clock import project, publication_time_known
from decimal import Decimal
from .ledger_catalog import series_key



def period_key(event, metric):
    seconds = event.get('period_seconds')
    if not seconds:
        # Policy decisions do not necessarily have an economic reference period.
        if metric['frequency'] != 'decision':
            return None
        seconds = event['server_time_seconds']
    day = datetime.fromtimestamp(seconds, timezone.utc).date()
    if metric['frequency'] == 'monthly':
        day = day.replace(day=1)
    elif metric['frequency'] == 'quarterly':
        day = day.replace(month=3 * ((day.month - 1) // 3) + 1, day=1)
    return day.isoformat()


def broker_matches(event, metric):
    return (event['event_id'] == metric['broker_event_id'] and event['currency'] == metric['currency']
            and event['country_code'] == metric['broker_country'] and event['unit'] == metric['broker_unit']
            and event['multiplier'] == metric['broker_multiplier'])


def broker_value(event, field='actual'):
    raw = event.get(field + '_raw_scaled_1e6')
    return float(Decimal(raw) / 1000000) if raw is not None else event.get(field)


def broker_reading(event, metric):
    return {'value_id': event['value_id'], 'event_id': event['event_id'], 'period': period_key(event, metric),
            'name': event['name'], 'value': broker_value(event), 'forecast': broker_value(event, 'forecast'),
            'previous': broker_value(event, 'previous'), 'revised_previous': broker_value(event, 'revised_previous'),
            'at': event['release_at'], 'date': datetime.fromtimestamp(event['server_time_seconds'], timezone.utc).date().isoformat(),
            'availability': event['availability'], 'captured_at': datetime.fromtimestamp(event['observed_at'], timezone.utc).isoformat()}


def retained_entries(store, broker, rows, key, metric, now_ms, offsets, transitions):
    result, last, revision, priority = [], None, -1, -1
    today = datetime.fromtimestamp(now_ms/1000 + 7*3600, timezone.utc).date().isoformat()
    for row in rows:
        if row['observed_at']*1000 > now_ms:
            transitions.append(round(row['observed_at']*1000))
            continue
        event = json.loads(row['payload'])
        if series_key(event) != key:
            continue
        incoming = 0 if row['origin'] == 'archive' else 1
        if event['revision'] < revision or incoming < priority:
            continue
        revision, priority = event['revision'], incoming
        provenance = row['provenance']
        offset_key = (provenance, row['observed_at'])
        if offset_key not in offsets:
            offsets[offset_key] = store._capture_offset(broker, row['observed_at'], json.loads(provenance))[0]
        at, _ = project(broker, event['server_time_seconds'], offsets[offset_key]) if publication_time_known(event) else (None, None)
        event.update(release_at=at, observed_at=row['observed_at'], availability='observed')
        event = store.overrides.apply(broker, event)
        at = event['release_at']
        reading = broker_reading(event, metric)
        day = datetime.fromtimestamp(at/1000+7*3600, timezone.utc).date().isoformat() if at is not None else reading['date']
        # Preserve scheduled occurrences without revealing premature provider actuals.
        if at is not None and at > now_ms or at is None and day > today:
            if reading['value'] is not None:
                transitions.append(at if at is not None else int(datetime.fromisoformat(day).replace(tzinfo=timezone.utc).timestamp()*1000)-7*3600000)
            reading['value'] = None
        signature = tuple(reading[k] for k in ('value', 'previous', 'revised_previous', 'forecast', 'at', 'date', 'period')) + (event['impact'],)
        if signature == last:
            continue
        last = signature
        result.append({**reading, 'day': day, 'known_at': round(row['observed_at']*1000), 'impact': event['impact']})
    return result
