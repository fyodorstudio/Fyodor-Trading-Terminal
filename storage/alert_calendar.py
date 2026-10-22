"""Date browsing uses publication UTC, independently of historical chart clocks."""
from datetime import date, datetime, time, timedelta, timezone
import hashlib
import json
from .persistence.support import missing_intervals

JAKARTA = timezone(timedelta(hours=7))


def day_snapshot(store, source_id, day, after_revision=None):
    selected = date.fromisoformat(day)
    start = int(datetime.combine(selected, time(), JAKARTA).timestamp())
    end = start + 86400
    source_day = int(datetime.combine(selected, time(), timezone.utc).timestamp())
    with store.lock:
        record = store.db.execute('SELECT * FROM sources WHERE id=?', (source_id,)).fetchone()
        source = dict(record) if record else None
        if source:
            source['publisher_status'] = 'live' if source['publisher_seen_at'] and store.clock() - source['publisher_seen_at'] < 30 else 'offline'
        revision = store.db.execute('SELECT value FROM data_revision WHERE id=1').fetchone()[0]
        offset = source.get('offset_seconds') if source else None
        raw_start = start + (offset or 0)
        coverage = {currency: {'missing': missing_intervals(raw_start, raw_start + 86400, store._covered(source_id, currency, source['server_now']))}
                    for currency in ('USD', 'EUR', 'GBP', 'JPY', 'CHF', 'CAD', 'AUD', 'NZD')} if source else {}
        digest = hashlib.sha256(json.dumps(coverage, sort_keys=True).encode()).hexdigest()[:16]
        signature = f"{revision}:{source['publisher_status'] if source else 'missing'}:{digest}"
        result = {'source_id': source_id, 'date': day, 'revision': signature, 'source': source}
        if after_revision == signature:
            return {**result, 'unchanged': True}
        known = "(json_extract(e.payload,'$.time_mode')=0 OR (json_extract(e.payload,'$.time_mode')=3 AND json_extract(e.payload,'$.actual') IS NOT NULL AND e.server_time%86400!=0))"
        rows = store.db.execute(f'''SELECT e.*,a.job_id absence_job,t.release_at,t.chart_time_seconds,
            t.capture_offset_seconds,t.basis,t.profile FROM events e
            LEFT JOIN event_timing t USING(source_id,value_id)
            LEFT JOIN query_absences a USING(source_id,value_id)
            WHERE e.source_id=? AND e.server_time>=? AND e.server_time<? AND (
                ({known} AND t.release_at>=? AND t.release_at<?)
                OR ((NOT {known} OR t.release_at IS NULL)
                    AND e.server_time>=? AND e.server_time<?)) ORDER BY e.server_time,e.value_id''',
            # Ingestion bounds offsets to ±14 hours. Use the existing broker/time
            # index to inspect only the possible source days, not all history.
            (source_id, min(start - 50400, source_day), max(end + 50400, source_day + 86400),
             start * 1000, end * 1000, source_day, source_day + 86400)).fetchall()
        return {**result, 'events': store.event_rows(rows), 'coverage': coverage}
