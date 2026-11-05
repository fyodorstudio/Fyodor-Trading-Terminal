"""Shared editorial tiers; no broker importance or alarm writes."""
import json
from functools import lru_cache
from pathlib import Path


@lru_cache(maxsize=1)
def tier_catalog():
    return json.loads((Path(__file__).resolve().parents[1] / 'config/event-tiers.json').read_text(encoding='utf-8'))


def metric_tier(metric):
    entry = tier_catalog()['series'].get(metric.get('broker_event_id'))
    if entry and entry['currency'] == metric['currency'] and entry['country'] == metric['broker_country']:
        return entry['tier']
    return metric['tier']
