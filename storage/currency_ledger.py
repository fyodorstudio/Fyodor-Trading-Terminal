"""Complete, currency-shared calendar-year Ledger reads; no research or writes."""
from collections import OrderedDict, defaultdict
from datetime import datetime, timedelta, timezone
from hashlib import sha256
import json
import time

from .currency_news import encoded
from .currencies import CURRENCIES
from .detail_registry import registry
from .ledger_catalog import canonical_definition, metric_key, raw_definition, series_key
from .ledger_vintages import retained_entries
from .persistence.support import HISTORY_START, missing_intervals


def _currency_year(store, broker, currency, year, revision, now_ms):
    cache = getattr(store, '_ledger_cache', None)
    if cache is None:
        cache = store._ledger_cache = OrderedDict()
    # Stable polls never replay vintages. Only a DB revision or the next retained
    # capture/publication boundary can change this currency's projection.
    key = (broker, currency, year, revision)
    source = store.db.execute('SELECT server_now FROM sources WHERE id=?',(broker,)).fetchone()
    server_now = source[0] if source else 0
    if (key in cache and cache[key]['valid_from'] <= now_ms < cache[key]['valid_until']
            and cache[key]['source_now'] <= server_now < cache[key]['coverage_until']):
        cache.move_to_end(key)
        return cache[key]
    lo = int(datetime(year, 1, 1, tzinfo=timezone.utc).timestamp())-2*86400
    hi = int(datetime(year+1, 1, 1, tzinfo=timezone.utc).timestamp())+2*86400
    samples = store.db.execute('''SELECT value_id,payload FROM events
        WHERE source_id=? AND currency=? AND server_time BETWEEN ? AND ?
        ORDER BY server_time,value_id''', (broker, currency, lo, hi)).fetchall()
    definitions, metadata, unmapped, ids = {}, {}, [], {r['value_id'] for r in samples}
    keys_by_id = {}
    for metric in registry()['metrics']:
        if metric['currency'] != currency:
            continue
        definition = canonical_definition(metric)
        if metric['broker_event_id'] is None:
            unmapped.append(definition)
            continue
        definitions[metric_key(metric)] = definition
        metadata[metric_key(metric)] = metric
    for sample in samples:
        event = json.loads(sample['payload'])
        skey = series_key(event)
        keys_by_id[sample['value_id']] = skey
        if skey not in definitions or not definitions[skey]['canonical']:
            definitions[skey] = raw_definition(event)
            metadata[skey] = {'frequency': 'broker'}
    # Last three pre-year publications for every admitted series, including PPI
    # and unknown IDs. Each seek uses events_detail_series; no archive scan.
    for skey in definitions:
        _, country, event_id, unit, multiplier = skey
        if event_id is None:
            continue
        rows = store.db.execute('''SELECT value_id FROM events WHERE source_id=? AND currency=?
            AND CAST(json_extract(payload,'$.event_id') AS TEXT)=? AND server_time<?
            AND json_extract(payload,'$.country_code')=? AND json_extract(payload,'$.unit')=?
            AND json_extract(payload,'$.multiplier')=? AND json_extract(payload,'$.actual') IS NOT NULL
            ORDER BY server_time DESC,value_id DESC LIMIT 3''', (broker,currency,event_id,lo,country,unit,multiplier))
        for row in rows:
            ids.add(row[0]); keys_by_id[row[0]] = skey
    vintages = defaultdict(list)
    ordered_ids = sorted(ids)
    for offset in range(0, len(ordered_ids), 400):
        batch = ordered_ids[offset:offset+400]
        rows = store.db.execute(f'''SELECT value_id,payload,observed_at,provenance,origin FROM observations
            WHERE source_id=? AND value_id IN ({','.join('?' for _ in batch)})
            ORDER BY value_id,observed_at,json_extract(payload,'$.revision'),digest''', (broker,*batch)).fetchall()
        for row in rows:
            vintages[row['value_id']].append(row)
    offsets, transitions = {}, []
    for value_id, rows in vintages.items():
        skey = keys_by_id[value_id]
        if skey not in definitions:
            continue
        definitions[skey]['entries'].extend(retained_entries(store, broker, rows, skey, metadata[skey], now_ms, offsets, transitions))
    metrics = sorted([*definitions.values(),*unmapped], key=lambda m: (not m['canonical'],m['id']))
    covered = store._covered(broker,currency,server_now) if source else []
    expires = store.db.execute('SELECT min(expires) FROM coverage WHERE source_id=? AND currency=? AND expires>?',
                              (broker,currency,server_now)).fetchone()[0]
    coverage = {'missing': missing_intervals(lo+2*86400,hi-2*86400,covered)}
    result = {'metrics': metrics, 'coverage': coverage, 'digest': sha256(encoded([metrics,coverage])).hexdigest(),
              'valid_from': now_ms, 'valid_until': min(transitions,default=float('inf')),
              'source_now': server_now, 'coverage_until': expires if expires is not None else float('inf')}
    for old in list(cache):
        if old[:3] == key[:3]:
            del cache[old]
    cache[key] = result
    while len(cache) > 16:
        cache.popitem(last=False)
    return result


def ledger_snapshot(store, broker, after_revision=None, now_ms=None, year=None, currencies=None):
    now_ms = int(time.time()*1000) if now_ms is None else now_ms
    today = (datetime.fromtimestamp(now_ms/1000,timezone.utc)+timedelta(hours=7)).date()
    min_year = datetime.fromtimestamp(HISTORY_START,timezone.utc).year
    year = today.year if year is None else year
    currencies = list(currencies or ['USD','CAD'])
    if not min_year <= year <= today.year:
        raise ValueError(f'Ledger year must be between {min_year} and {today.year}')
    if len(set(currencies)) != len(currencies) or not all(c in CURRENCIES for c in currencies):
        raise ValueError('Choose supported Ledger currencies')
    with store.lock:
        revision = store.db.execute('SELECT value FROM data_revision WHERE id=1').fetchone()[0]
        parts = [_currency_year(store,broker,c,year,revision,now_ms) for c in currencies]
        available = store.db.execute('SELECT 1 FROM sources WHERE id=?',(broker,)).fetchone() is not None
    base = {'schema':1,'broker':broker,'currencies':currencies,'year':year,'min_year':min_year,'max_year':today.year,
            'from_date':f'{year}-01-01','through_date':f'{year}-12-31','source_available':available}
    digest = sha256(encoded([base,[p['digest'] for p in parts]])).hexdigest()
    if after_revision == digest:
        return {'schema':1,'broker':broker,'currencies':currencies,'year':year,'revision':digest,'unchanged':True}
    return {**base,'metrics':[m for part in parts for m in part['metrics']],
            'coverage':dict(zip(currencies,(p['coverage'] for p in parts))),'revision':digest}
