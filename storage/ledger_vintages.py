"""Retained publication/capture clocks without replaying superseded archives."""
from datetime import datetime, timezone
import json

from .calendar_clock import project, publication_time_known
from .detail_projection import broker_reading
from .ledger_catalog import series_key


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
