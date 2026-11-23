"""Verified releases assembled from publisher schedules and attributed readings."""
from datetime import date, datetime, time, timedelta, timezone
from functools import lru_cache
from hashlib import sha256
from pathlib import Path
from urllib.parse import urlsplit
import json
import math

from .calendar_clock import PROFILES
from .calendar_overrides import chart_time


ROOT = Path(__file__).resolve().parents[1]
DIRECTORY = ROOT / 'config/calendar-overrides/publisher'
CATALOG = ROOT / 'frontend/src/economic-calendar/catalog/source-events.json'


def as_millis(value):
    instant = datetime.fromisoformat(value)
    if instant.utcoffset() is None:
        raise ValueError(f'A timezone is required: {value}')
    return round(instant.timestamp() * 1000)


def forecast_cutoff(value):
    if len(value) == 10:
        # A date-only source predates the release only if the whole date does.
        return int(datetime.combine(date.fromisoformat(value) + timedelta(days=1), time(), timezone.utc).timestamp()) * 1000
    return as_millis(value)


def verify_source(source):
    label, url = source['name'], urlsplit(source['url'])
    if not isinstance(label, str) or not label.strip() or url.scheme != 'https' or not url.hostname or url.username or url.password:
        raise ValueError('A source name and public HTTPS URL are required')


def series_key(series):
    return series['event_id'], series['country'], series['currency']


def occurrence_key(event):
    return (event['event_id'], event['country_code'], event['currency'], event['period_seconds'],
            event['release_at'], event['unit'], event['multiplier'])


def read_evidence(path):
    document = json.loads(path.read_text(encoding='utf-8-sig'))
    if document['schema'] != 1 or not isinstance(document['releases'], list):
        raise ValueError(f'Invalid calendar evidence: {path.name}')
    return document['releases']


@lru_cache(maxsize=1)
def load_catalog():
    return {(row['id'], row['country'], row['currency']): row
            for row in json.loads(CATALOG.read_text(encoding='utf-8'))}


class CalendarEvidence:
    def __init__(self, records):
        catalog = load_catalog()
        self.rows = {}
        for record in records:
            fields = ('actual', 'forecast', 'previous')
            series = record['series']
            key = series_key(series)
            if key not in catalog:
                raise ValueError(f'Add the series to the calendar catalogue first: {key}')
            at = as_millis(record['released_at'])
            period = int(datetime.strptime(record['period'], '%Y-%m-%d').replace(tzinfo=timezone.utc).timestamp())
            for name in ('unit', 'multiplier', 'digits'):
                if type(series[name]) is not int or series[name] < 0:
                    raise ValueError(f'Invalid {name} for {key}')
            verify_source(record['schedule'])
            sources = {'schedule': record['schedule']}
            changes = {}
            for field in fields:
                reading = record.get(field)
                if reading is None:
                    continue
                verify_source(reading)
                value = reading['value']
                if type(value) not in (int, float) or not math.isfinite(value):
                    raise ValueError(f'Invalid {field} for {key}')
                if field == 'forecast' and forecast_cutoff(reading['as_of']) >= at:
                    raise ValueError(f'Forecast evidence must predate the release: {key}')
                changes[field] = value
                sources[field] = {name: reading[name] for name in ('name', 'url', 'as_of') if name in reading}
            event = {'event_id': key[0], 'country_code': key[1], 'currency': key[2], 'country_name': key[1],
                     'name': catalog[key]['name'], 'event_code': '', 'release_at': at, 'period_seconds': period,
                     **{field: series[field] for field in ('unit', 'multiplier', 'digits')},
                     'impact': 'none', 'time_mode': 0, 'importance': record.get('importance', 'high'),
                     'revision': record.get('revision', 0), 'calendar_sources': sources, **changes}
            if event['importance'] not in ('none', 'low', 'medium', 'high') or type(event['revision']) is not int or event['revision'] < 0:
                raise ValueError(f'Invalid importance or revision for {key}')
            if record.get('stage'):
                if record['stage'] not in ('Flash', 'Preliminary', 'Final'):
                    raise ValueError(f'Invalid release stage for {key}')
                event['release_stage'] = record['stage']
            occurrence = occurrence_key(event)
            if occurrence in self.rows:
                raise ValueError(f'Duplicate calendar evidence: {occurrence}')
            event['value_id'] = 'ext-' + sha256(repr(occurrence).encode()).hexdigest()[:24]
            self.rows[occurrence] = event
        self.revision = sha256(json.dumps(list(self.rows.values()), sort_keys=True).encode()).hexdigest()[:16]

    @classmethod
    def load(cls, directory=DIRECTORY):
        return cls(record for path in sorted(directory.glob('*.json')) for record in read_evidence(path))

    def apply(self, event):
        evidence = self.rows.get(occurrence_key(event))
        if not evidence:
            return event
        changes = {field: evidence[field] for field in ('actual', 'forecast', 'previous') if field in evidence}
        updated = {**event, **changes, 'calendar_sources': {**event.get('calendar_sources', {}), **evidence['calendar_sources']}}
        if evidence.get('release_stage'):
            updated['release_stage'] = evidence['release_stage']
        for field in changes:
            # Existing consumers prefer exact raw values to the public numeric fields.
            updated.pop(field + '_raw_scaled_1e6', None)
        if 'actual' in changes:
            updated['actual_override_source'] = evidence['calendar_sources']['actual']['url']
        return updated

    def install(self, db):
        if not self.rows:
            db.execute('''CREATE TEMP VIEW calendar_readings AS
                SELECT b.*,1 displayed FROM broker_calendar_readings b''')
            return
        db.execute('''CREATE TEMP TABLE publisher_releases (
            source_id TEXT, value_id TEXT, server_time INTEGER, currency TEXT, payload TEXT, priority INTEGER,
            observed_at REAL, origin TEXT, absence_job TEXT, capture_offset_seconds INTEGER, profile TEXT,
            release_at INTEGER, chart_time_seconds INTEGER, basis TEXT,
            event_id TEXT, country TEXT, period INTEGER, unit INTEGER, multiplier INTEGER,
            PRIMARY KEY(source_id, value_id))''')
        db.execute('CREATE INDEX publisher_releases_range ON publisher_releases(source_id,server_time,currency)')
        db.execute('CREATE INDEX publisher_occurrence ON publisher_releases(source_id,event_id,release_at,period)')
        for broker, profile in PROFILES.items():
            for event in self.rows.values():
                at = event['release_at']
                native = chart_time(broker, at)
                if native is None:
                    continue
                payload = {'actual': None, 'forecast': None, 'previous': None, 'revised_previous': None,
                           **event, 'server_time_seconds': native}
                db.execute('INSERT INTO publisher_releases VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
                           (broker, event['value_id'], native, event['currency'], json.dumps(payload), 0, 0, 'publisher',
                            None, None, profile, at, native, 'publisher', event['event_id'], event['country_code'],
                            event['period_seconds'], event['unit'], event['multiplier']))
        match = '''b.source_id=s.source_id AND b.currency=s.currency AND b.release_at=s.release_at
            AND CAST(json_extract(b.payload,'$.event_id') AS TEXT)=s.event_id
            AND json_extract(b.payload,'$.country_code')=s.country AND json_extract(b.payload,'$.period_seconds')=s.period
            AND json_extract(b.payload,'$.unit')=s.unit AND json_extract(b.payload,'$.multiplier')=s.multiplier'''
        db.execute(f'''CREATE TEMP VIEW calendar_readings AS
            SELECT b.*, CASE WHEN b.absence_job IS NOT NULL AND EXISTS (
                SELECT 1 FROM publisher_releases s WHERE {match}) THEN 0 ELSE 1 END displayed
            FROM broker_calendar_readings b
            UNION ALL
            SELECT s.source_id,s.value_id,s.server_time,s.currency,s.payload,s.priority,s.observed_at,s.origin,
                   s.absence_job,s.capture_offset_seconds,s.profile,s.release_at,s.chart_time_seconds,s.basis,
                   NOT EXISTS (SELECT 1 FROM broker_calendar_readings b WHERE {match} AND b.absence_job IS NULL
                   AND b.server_time BETWEEN s.server_time-172800 AND s.server_time+172800) displayed
            FROM publisher_releases s''')
