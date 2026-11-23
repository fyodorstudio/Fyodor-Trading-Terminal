"""Compare dated publisher evidence with the original MT5 observations."""
from collections import Counter, defaultdict
from datetime import date, datetime, time, timedelta, timezone
from pathlib import Path
from tempfile import NamedTemporaryFile
import json

from .calendar_evidence import CalendarEvidence, DIRECTORY, as_millis, forecast_cutoff, load_catalog, occurrence_key, read_evidence, series_key


JAKARTA = timezone(timedelta(hours=7))


def read_selection(path):
    selection = json.loads(path.read_text(encoding='utf-8-sig'))
    if selection['schema'] != 1 or not isinstance(selection['series'], list):
        raise ValueError('Invalid MFDI series export')
    return {series_key(series) for series in selection['series']}


def audit(store, broker, first, last, selected, records):
    start, end = (int(datetime.combine(day, time(), JAKARTA).timestamp()) * 1000
                  for day in (date.fromisoformat(first), date.fromisoformat(last) + timedelta(days=1)))
    if end <= start:
        raise ValueError('The audit date range is empty')
    expected = CalendarEvidence(records)
    by_series, by_occurrence = defaultdict(list), defaultdict(list)
    effective = defaultdict(list)
    rows = store.db.execute('''SELECT * FROM broker_calendar_readings
        WHERE source_id=? AND server_time>=? AND server_time<?''', (broker, start // 1000 - 86400, end // 1000 + 86400)).fetchall()
    for row, displayed in zip(rows, store.event_rows(rows), strict=True):
        at = row['release_at']
        at_or_date = at if at is not None else (row['server_time'] - 7 * 3600) * 1000
        if not start <= at_or_date < end:
            continue
        event = {**json.loads(row['payload']), 'release_at': at, 'available': row['absence_job'] is None}
        identity = occurrence_key(event)
        by_series[identity[:3]].append(event)
        by_occurrence[identity].append(event)
        if at is not None:
            effective[identity].append(displayed)
    comparisons = []
    for identity, expected_row in expected.rows.items():
        if not start <= expected_row['release_at'] < end:
            continue
        exact = by_occurrence[identity]
        live = [event for event in exact if event['available']]
        near = [event for event in by_series[identity[:3]] if event['period_seconds'] == expected_row['period_seconds']
                and event['release_at'] is not None and abs(event['release_at'] - expected_row['release_at']) <= 3600000]
        status = ('verify_time_or_unit' if not exact and near else 'missing' if not exact
                  else 'archived_only' if not live else 'matched')
        fields = {field: {'verified': expected_row[field], 'mt5': sorted({event[field] for event in live}, key=str)}
                  for field in ('actual', 'forecast', 'previous') if field in expected_row}
        if status == 'matched' and any(item['mt5'] != [item['verified']] for item in fields.values()):
            status = 'discrepancy'
        comparisons.append({'series': identity[:3], 'release_at': expected_row['release_at'], 'status': status,
                            'value_ids': [event['value_id'] for event in (exact or near)], 'fields': fields,
                            'sources': expected_row['calendar_sources']})
    catalog = load_catalog()
    comparisons_by_series = Counter(tuple(item['series']) for item in comparisons)
    coverage = []
    for key in sorted(selected, key=lambda key: (key[2], key[1], key[0])):
        rows = by_series[key]
        observed = [row for row in rows if row['available']]
        coverage.append({'series': key, 'name': catalog.get(key, {}).get('name'), 'observed_rows': len(observed),
                         'blank_actual_rows': sum(row['actual'] is None for row in observed),
                         'archived_rows': len(rows) - len(observed), 'publisher_releases_checked': comparisons_by_series[key]})
    candidates = []
    for identity, rows in effective.items():
        if identity[:3] not in selected or not 0 < identity[4] <= store.clock() * 1000:
            continue
        if not identity[3] or any(row['actual'] is not None and (row['availability'] == 'observed' or row.get('actual_override_source')) for row in rows):
            continue
        if store.evidence.rows.get(identity, {}).get('actual') is not None:
            continue
        candidates.append({'series': identity[:3], 'period_seconds': identity[3], 'release_at': identity[4],
                           'status': 'blank_actual' if any(row['availability'] == 'observed' for row in rows) else 'archived_only',
                           'value_ids': [row['value_id'] for row in rows]})
    return {'source_id': broker, 'from': first, 'through': last, 'coverage': coverage,
            'actual_candidates': sorted(candidates, key=lambda item: (item['release_at'], item['series'])),
            'comparisons': comparisons}


def import_evidence(records, folder=DIRECTORY):
    """Merge verified fields by occurrence without dropping previously captured values."""
    target = folder / 'verified-releases.json'

    def key(row):
        series = row['series']
        return (*series_key(series), row['period'], as_millis(row['released_at']), series['unit'], series['multiplier'])

    original = read_evidence(target) if target.exists() else []
    merged = {key(row): row for row in original}
    for record in records:
        identity = key(record)
        previous = merged.get(identity, {})
        if (previous.get('forecast') is not None and record.get('forecast') is not None
                and forecast_cutoff(previous['forecast']['as_of']) > forecast_cutoff(record['forecast']['as_of'])):
            record = {**record, 'forecast': previous['forecast']}
        merged[identity] = {**previous, **record}
    updated = sorted(merged.values(), key=key)
    CalendarEvidence([*(row for path in sorted(folder.glob('*.json')) if path != target for row in read_evidence(path)), *updated])
    if updated == original:
        return False
    folder.mkdir(parents=True, exist_ok=True)
    with NamedTemporaryFile('w', encoding='utf-8', dir=folder, suffix='.tmp', delete=False) as handle:
        temporary = Path(handle.name)
        json.dump({'schema': 1, 'releases': updated}, handle, indent=2, ensure_ascii=False)
        handle.write('\n')
    try:
        temporary.replace(target)
    finally:
        temporary.unlink(missing_ok=True)
    return True
