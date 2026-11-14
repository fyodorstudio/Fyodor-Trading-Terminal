"""Small, file-backed corrections applied when reading the MT5 calendar."""
from datetime import datetime
from decimal import Decimal
from functools import lru_cache
from hashlib import sha256
import json
import math
from pathlib import Path

from .calendar_clock import broker_offset

DIRECTORY = Path(__file__).resolve().parents[1] / 'config/calendar-overrides'
VALUE_FIELDS = ('actual', 'forecast', 'previous', 'revised_previous')


class CalendarOverrides:
    def __init__(self, directory=DIRECTORY):
        self.rows = {}
        for path in sorted(directory.glob('*.json')):
            document = json.loads(path.read_text(encoding='utf-8'))
            if document.get('schema') != 1:
                raise ValueError(f'Invalid calendar overrides: {path.name}')
            for row in document['releases']:
                key = (document['event_id'], row['value_id'])
                if key in self.rows or not all(isinstance(value, str) and value.isdigit() for value in key):
                    raise ValueError(f'Invalid or duplicate calendar release: {key}')
                changes = row['set']
                if not changes or set(changes) - {*VALUE_FIELDS, 'released_at'}:
                    raise ValueError(f'Invalid correction fields: {key}')
                for field in VALUE_FIELDS:
                    value = changes.get(field)
                    if value is not None and (type(value) not in (int, float) or not math.isfinite(value)):
                        raise ValueError(f'Invalid {field}: {key}')
                release = None
                if 'released_at' in changes:
                    instant = datetime.fromisoformat(changes['released_at'])
                    if instant.utcoffset() is None:
                        raise ValueError(f'Release time needs a timezone: {key}')
                    release = round(instant.timestamp() * 1000)
                self.rows[key] = {**changes, '_release_at': release,
                                  '_currency': document['currency'], '_country': document['country']}
        self.revision = sha256(json.dumps(sorted(self.rows.items()), sort_keys=True).encode()).hexdigest()[:16]

    def actual_ids(self, event_id, currency, country):
        return [value for (event, value), row in self.rows.items()
                if event == event_id and (row['_currency'], row['_country']) == (currency, country)
                and row.get('actual') is not None]

    def apply(self, broker, event):
        change = self.rows.get((event['event_id'], event['value_id']))
        if not change or (event['currency'], event['country_code']) != (change['_currency'], change['_country']):
            return event
        event = dict(event)
        for field in VALUE_FIELDS:
            if field in change:
                event[field] = change[field]
                event[field + '_raw_scaled_1e6'] = (str(int(Decimal(str(change[field])) * 1000000))
                                                    if change[field] is not None else None)
        if change['_release_at'] is not None:
            event.update(time_mode=0, release_at=change['_release_at'],
                         chart_time_seconds=chart_time(broker, change['_release_at']), timing_basis='manual-override')
        return event

    def install(self, db):
        # TEMP data belongs to this connection; exported MT5 records stay intact.
        db.create_function('calendar_chart_time', 2, chart_time, deterministic=True)
        db.execute('''CREATE TEMP TABLE calendar_overrides (
            event_id TEXT, value_id TEXT, currency TEXT, country TEXT, release_at INTEGER,
            PRIMARY KEY(event_id,value_id))''')
        db.executemany('INSERT INTO calendar_overrides VALUES (?,?,?,?,?)',
                       [(event, value, row['_currency'], row['_country'], row['_release_at'])
                        for (event, value), row in self.rows.items()])
        db.execute('''CREATE TEMP VIEW calendar_readings AS
            SELECT e.*,a.job_id absence_job,t.capture_offset_seconds,t.profile,
                coalesce(o.release_at,t.release_at) release_at,
                CASE WHEN o.release_at IS NOT NULL THEN calendar_chart_time(e.source_id,o.release_at)
                    ELSE t.chart_time_seconds END chart_time_seconds,
                CASE WHEN o.release_at IS NOT NULL THEN 'manual-override' ELSE t.basis END basis
            FROM main.events e
            LEFT JOIN main.event_timing t USING(source_id,value_id)
            LEFT JOIN main.query_absences a USING(source_id,value_id)
            LEFT JOIN calendar_overrides o ON o.value_id=e.value_id
                AND o.event_id=CAST(json_extract(e.payload,'$.event_id') AS TEXT)
                AND o.currency=e.currency AND o.country=json_extract(e.payload,'$.country_code')''')


def chart_time(broker, release_at):
    utc = release_at // 1000
    offset = broker_offset(broker, utc)
    return utc + offset if offset is not None else None


@lru_cache(maxsize=1)
def calendar_overrides():
    # Editing correction files takes effect after restarting storage.
    return CalendarOverrides()
