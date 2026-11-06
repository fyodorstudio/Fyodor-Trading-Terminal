"""Ledger definitions: canonical Detail measures plus every captured broker series."""
from functools import lru_cache
import json

from .detail_registry import ROOT, registry


def series_key(event):
    return (event['currency'], event['country_code'], str(event['event_id']), event['unit'], event['multiplier'])


@lru_cache(maxsize=1)
def source_catalog():
    rows = json.loads((ROOT/'frontend/src/economic-calendar/catalog/source-events.json').read_text(encoding='utf-8'))
    return {(r['currency'], r['country'], r['id']): r for r in rows}


def raw_unit(event):
    if event['unit'] == 1:
        return '%'
    if event['unit'] == 3:
        return ' h'
    return {1: 'k', 2: 'M', 3: 'B', 4: 'T'}.get(event['multiplier'], ' pts' if event['unit'] == 0 else '')


def canonical_definition(metric):
    return {**{k: metric[k] for k in ('id', 'currency', 'category', 'label', 'unit', 'definition', 'frequency')},
            'canonical': True, 'country': metric['broker_country'], 'event_id': metric['broker_event_id'],
            'source_url': metric.get('source_url', registry()['sources'][metric['source']]['url']), 'entries': []}


def raw_definition(event):
    catalog = source_catalog().get((event['currency'], event['country_code'], str(event['event_id'])), {})
    category = {'prices': 'inflation', 'jobs': 'labour', 'money': 'policy', 'gdp': 'growth',
                'business': 'activity', 'consumer': 'consumer'}.get(catalog.get('sector'), catalog.get('sector', 'other'))
    label = event['name'] or catalog.get('name') or f"MT5 event {event['event_id']}"
    return {'id': '.'.join((event['currency'].lower(), 'calendar', event['country_code'], str(event['event_id']),
                            str(event['unit']), str(event['multiplier']))),
            'currency': event['currency'], 'category': category, 'label': label, 'unit': raw_unit(event),
            'definition': f"{label}; {event['country_code']}; broker calendar series {event['event_id']}",
            'frequency': 'broker', 'canonical': False, 'country': event['country_code'], 'event_id': str(event['event_id']),
            'source_url': 'https://www.mql5.com/en/economic-calendar', 'entries': []}


def metric_key(metric):
    return (metric['currency'], metric['broker_country'], metric['broker_event_id'], metric['broker_unit'], metric['broker_multiplier'])
