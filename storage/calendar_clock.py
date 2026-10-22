"""Derived display clocks; never change the exported MT5 timestamp or payload.

CalendarValueHistory expresses history with the retrieval-time server offset.
Native candles use each broker's date-specific clock. Profiles are shared with
the frontend; an unfamiliar broker is never assigned another broker's rule.
"""
from datetime import datetime, timezone
from functools import lru_cache
import json
from pathlib import Path

PROFILE_VERSION = "elev8-eet-eest-v1"
CLOCK_PROFILES = json.loads((Path(__file__).resolve().parents[1] / 'config' / 'broker-clock-profiles.json').read_text(encoding='utf-8'))
PROFILES = {source: profile['version'] for source, profile in CLOCK_PROFILES.items()}


def publication_time_known(event):
    # Tentative is permanent series metadata. Actual plus the supplied clock
    # identifies its published numerical observation, unlike a pending schedule.
    return event['time_mode'] == 0 or (event['time_mode'] == 3
        and event['actual'] is not None and event['server_time_seconds'] % 86400 != 0)


@lru_cache(maxsize=128)
def transitions(year, rule='eu-eet-eest'):
    if rule == 'us-ny-close':
        # US Eastern DST: second Sunday in March 07:00 UTC, first Sunday
        # in November 06:00 UTC. Broker candles follow the New York close.
        def sunday(month, ordinal, hour):
            first = datetime(year, month, 1, hour, tzinfo=timezone.utc)
            return int(first.timestamp()) + ((6 - first.weekday()) % 7 + 7 * (ordinal - 1)) * 86400
        return sunday(3, 2, 7), sunday(11, 1, 6)
    # Directive 2000/84/EC: last Sundays of March/October, 01:00 UTC.
    def last_sunday(month):
        last = datetime(year, month, 31, 1, tzinfo=timezone.utc)
        return int(last.timestamp()) - ((last.weekday() + 1) % 7) * 86400
    return last_sunday(3), last_sunday(10)


def broker_offset(source_id, utc_seconds):
    profile = CLOCK_PROFILES.get(source_id)
    if not profile:
        return None
    try:
        year = datetime.fromtimestamp(utc_seconds, timezone.utc).year
    except (ValueError, OverflowError, OSError):
        return None
    # The start of the 2015 raw range can project into late December 2014.
    if not profile['firstYear'] <= year <= profile['lastYear']:
        return None
    if profile['rule'] == 'fixed':
        return profile['offsetSeconds']
    if profile['rule'] not in ('eu-eet-eest', 'us-ny-close'):
        return None
    start, end = transitions(year, profile['rule'])
    return 10800 if start <= utc_seconds < end else 7200


def project(source_id, server_time, capture_offset):
    if capture_offset is None or server_time <= 0:
        return None, None
    utc = server_time - capture_offset
    historical_offset = broker_offset(source_id, utc)
    return utc * 1000, utc + historical_offset if historical_offset is not None else None


def chart_utc(source_id, chart_seconds):
    profile = CLOCK_PROFILES.get(source_id)
    if not profile:
        return None
    offsets = (profile['offsetSeconds'],) if profile['rule'] == 'fixed' else (7200, 10800)
    candidates = [chart_seconds-offset for offset in offsets if broker_offset(source_id, chart_seconds-offset) == offset]
    return candidates[0] if len(candidates) == 1 else None
