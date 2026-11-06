"""Bounded per-series reads for latest observations, never an Events lookback."""
from datetime import datetime, timedelta, timezone
from calendar import monthrange
from decimal import Decimal
from hashlib import sha256
import time

from .currency_details import read_records
from .currency_news import encoded
from .detail_registry import registry
from .event_tiers import metric_tier


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


def series_readings(store, broker, metric, now_ms):
    if not metric['broker_event_id']:
        return None, None
    # Two index seeks per mapped metric, including infrequent releases outside
    # 31 days. Do not load raw observation histories into a routine snapshot.
    day = (datetime.fromtimestamp(now_ms / 1000, timezone.utc) + timedelta(hours=7)).date().isoformat()
    common = '''SELECT e.*,a.job_id absence_job,t.release_at,t.chart_time_seconds,
        t.capture_offset_seconds,t.basis,t.profile FROM events e
        LEFT JOIN event_timing t USING(source_id,value_id)
        LEFT JOIN query_absences a USING(source_id,value_id)
        WHERE e.source_id=? AND e.currency=? AND CAST(json_extract(e.payload,'$.event_id') AS TEXT)=?
        AND json_extract(e.payload,'$.country_code')=? AND json_extract(e.payload,'$.unit')=?
        AND json_extract(e.payload,'$.multiplier')=?'''
    params = (broker, metric['currency'], metric['broker_event_id'], metric['broker_country'], metric['broker_unit'], metric['broker_multiplier'])
    latest = store.db.execute(common + ''' AND json_extract(e.payload,'$.actual') IS NOT NULL
        AND (t.release_at<=? OR (t.release_at IS NULL AND date(e.server_time,'unixepoch')<=?))
        ORDER BY coalesce(nullif(json_extract(e.payload,'$.period_seconds'),0),e.server_time) DESC,
        e.server_time DESC,e.value_id DESC LIMIT 1''', (*params, now_ms, day)).fetchall()
    next_rows = store.db.execute(common + ''' AND a.job_id IS NULL
        AND ((t.release_at>? AND json_extract(e.payload,'$.actual') IS NULL)
          OR (t.release_at IS NULL AND date(e.server_time,'unixepoch')>? AND json_extract(e.payload,'$.actual') IS NULL))
        ORDER BY e.server_time,e.value_id LIMIT 1''', (*params, now_ms, day)).fetchall()
    return tuple(broker_reading(store.event_rows(rows)[0], metric) if rows else None for rows in (latest, next_rows))


def policy_history(store, broker, currencies, now_ms):
    """Six calendar months of completed USD/CAD decisions, without raw archive scans.

    Other fundamentals intentionally have no historical projection yet: today's
    observations/revisions must never masquerade as information known at a meeting.
    """
    if len(currencies) != 2 or set(currencies) != {'USD', 'CAD'}:
        return None
    today = (datetime.fromtimestamp(now_ms / 1000, timezone.utc) + timedelta(hours=7)).date()
    month = today.year * 12 + today.month - 1 - 6
    year, month = divmod(month, 12)
    start = today.replace(year=year, month=month + 1, day=min(today.day, monthrange(year, month + 1)[1]))
    start_ms = int((datetime.combine(start, datetime.min.time(), timezone.utc) - timedelta(hours=7)).timestamp() * 1000)
    history = {}
    for currency in currencies:
        metric = next(m for m in registry()['metrics'] if m['id'] == currency.lower() + '.rate')
        rows = store.db.execute('''SELECT e.*,a.job_id absence_job,t.release_at,t.chart_time_seconds,
            t.capture_offset_seconds,t.basis,t.profile FROM events e
            LEFT JOIN event_timing t USING(source_id,value_id)
            LEFT JOIN query_absences a USING(source_id,value_id)
            WHERE e.source_id=? AND e.currency=? AND CAST(json_extract(e.payload,'$.event_id') AS TEXT)=?
            AND e.server_time BETWEEN ? AND ?
            AND json_extract(e.payload,'$.country_code')=? AND json_extract(e.payload,'$.unit')=?
            AND json_extract(e.payload,'$.multiplier')=? AND json_extract(e.payload,'$.actual') IS NOT NULL
            ORDER BY e.server_time DESC,e.value_id DESC''',
            (broker, currency, metric['broker_event_id'], start_ms // 1000 - 172800, now_ms // 1000 + 172800,
             metric['broker_country'], metric['broker_unit'], metric['broker_multiplier'])).fetchall()
        decisions = []
        for event in store.event_rows(rows):
            reading = broker_reading(event, metric)
            if (reading['at'] is not None and not start_ms <= reading['at'] <= now_ms
                    or reading['at'] is None and not start.isoformat() <= reading['date'] <= today.isoformat()):
                continue
            # The broker's Fed measure is the upper bound. Never invent a lower bound.
            day = datetime.fromtimestamp(reading['at'] / 1000, timezone.utc).date().isoformat() if reading['at'] is not None else reading['date']
            reading['source_url'] = (f'https://www.federalreserve.gov/newsevents/pressreleases/monetary{day.replace("-", "")}a.htm'
                if currency == 'USD' else f'https://www.bankofcanada.ca/{day[:4]}/{day[5:7]}/fad-press-release-{day}/')
            decisions.append(reading)
        decisions.sort(key=lambda r: (r['at'] if r['at'] is not None else int(datetime.fromisoformat(r['date']).replace(tzinfo=timezone.utc).timestamp() * 1000), r['value_id']), reverse=True)
        history[currency] = decisions
    return {'from_date': start.isoformat(), 'through_date': today.isoformat(), 'decisions': history}


def detail_snapshot(store, broker, currencies, directory, after_revision=None, now_ms=None):
    now_ms = int(time.time() * 1000) if now_ms is None else now_ms
    metrics, focus = read_records(directory, currencies=currencies)
    result_rows = []
    today = (datetime.fromtimestamp(now_ms / 1000, timezone.utc) + timedelta(hours=7)).date().isoformat()
    with store.lock:
        source = store.db.execute('SELECT id FROM sources WHERE id=?', (broker,)).fetchone()
        for metric in registry()['metrics']:
            if metric['currency'] not in currencies:
                continue
            latest, upcoming = series_readings(store, broker, metric, now_ms)
            check = metrics.get(metric['id'])
            official = check['observation'] if check else None
            official_latest = bool(official and (not latest or not latest['period'] or official['period'] >= latest['period']))
            comparison = 'not_checked'
            ref = official.get('broker_reference') if official else None
            if official and latest:
                if official['period'] != latest['period']:
                    comparison = 'different_period'
                elif ref and ref['source_id'] == broker and ref['value_id'] == latest['value_id']:
                    comparison = 'conflict' if abs(official['value'] - latest['value']) > 0.0000005 else 'matched'
                else:
                    comparison = 'different_vintage'
            schedules = check.get('next_releases') if check else None
            future = [s for s in schedules or [] if (datetime.fromisoformat(s['at']).timestamp()*1000 > now_ms if s['at'] else s['date'] >= today)]
            future.sort(key=lambda s: s['at'] or s['date'] + 'T23:59:59+00:00')
            result_rows.append({**metric, 'tier': metric_tier(metric), 'broker': latest, 'broker_next': upcoming,
                'official': official, 'official_latest': official_latest, 'comparison': comparison,
                'check': {k: check[k] for k in ('checked_at', 'coverage', 'coverage_note', 'sources', 'schedule_checked_at')} if check else None,
                'next_releases': future, 'schedule_known': schedules is not None,
                'schedule_elapsed': bool(schedules and not future)})
        history = policy_history(store, broker, currencies, now_ms)
    content = {'schema': 1, 'broker': broker, 'currencies': currencies, 'source_available': source is not None,
               'categories': registry()['categories'], 'sources': registry()['sources'], 'metrics': result_rows,
               'focus': [focus[c] for c in currencies if c in focus], 'policy_history': history}
    revision = sha256(encoded(content)).hexdigest()
    if after_revision == revision:
        return {'schema': 1, 'broker': broker, 'currencies': currencies, 'revision': revision, 'unchanged': True}
    return {**content, 'revision': revision}


def prepare_details(snapshot, now_ms=None):
    now_ms = int(time.time() * 1000) if now_ms is None else now_ms
    tasks = []
    for metric in snapshot['metrics']:
        reasons = []
        official, latest, check = metric['official'], metric['broker'], metric['check']
        if not official:
            reasons.append('official_observation_needed')
        if latest and (not official or latest['period'] is None or latest['period'] > official['period']):
            reasons.append('new_or_unmapped_broker_period')
        if metric['comparison'] == 'conflict':
            reasons.append('unresolved_source_conflict')
        if check and check['coverage'] != 'checked':
            reasons.append('incomplete_previous_check')
        if not metric['schedule_known']:
            reasons.append('official_schedule_not_checked')
        if metric['schedule_elapsed']:
            reasons.append('scheduled_publication_elapsed')
        if not check or now_ms - datetime.fromisoformat(check['checked_at']).timestamp()*1000 >= 86400000:
            reasons.append('publisher_revision_check_due')
        if check and (not check['schedule_checked_at'] or now_ms - datetime.fromisoformat(check['schedule_checked_at']).timestamp()*1000 >= 86400000):
            reasons.append('publisher_schedule_recheck_due')
        tasks.append({'metric_id': metric['id'], 'currency': metric['currency'], 'label': metric['label'], 'tier': metric['tier'],
            'definition': metric['definition'], 'unit': metric['unit'], 'source': metric['source'],
            **({'source_url': metric['source_url']} if metric.get('source_url') else {}),
            'official': {k: official[k] for k in ('period', 'stage', 'value', 'verified_at')} if official else None,
            'broker': {k: latest[k] for k in ('value_id', 'period', 'value', 'at')} if latest else None,
            'last_checked_at': check['checked_at'] if check else None, 'needs': reasons})
    due = [m for m in tasks if m['needs']]
    unchanged = [{'metric_id': m['metric_id'], 'official': m['official'], 'last_checked_at': m['last_checked_at']}
                 for m in tasks if not m['needs']]
    used = {m['source'] for m in due}
    return {'broker': snapshot['broker'], 'currencies': snapshot['currencies'], 'metrics': due,
            'unchanged': unchanged, 'counts': {'total': len(tasks), 'needs_check': len(due), 'unchanged': len(unchanged)},
            'sources': {k: v for k, v in snapshot['sources'].items() if k in used}, 'focus': snapshot['focus'],
            'note': 'Local preparation only. Check official publisher revisions and schedules even when MT5 is unchanged. Reuse evidence across Detail and News; preserve independent check clocks.'}
