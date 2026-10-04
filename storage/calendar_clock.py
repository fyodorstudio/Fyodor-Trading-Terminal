"""Derived display clocks; never change the exported MT5 timestamp or payload.

CalendarValueHistory expresses history with the retrieval-time server offset.
Native EURUSD candles on Elev8-Demo2 instead use date-specific EET/EEST.
The profile is explicit: an unfamiliar broker is never assigned this rule.
"""
from datetime import datetime, timezone
from functools import lru_cache

PROFILE_VERSION = "elev8-eet-eest-v1"
PROFILES = {"Elev8-Demo2": PROFILE_VERSION}


@lru_cache(maxsize=128)
def transitions(year):
    # Directive 2000/84/EC: last Sundays of March/October, 01:00 UTC.
    def last_sunday(month):
        last = datetime(year, month, 31, 1, tzinfo=timezone.utc)
        return int(last.timestamp()) - ((last.weekday() + 1) % 7) * 86400
    return last_sunday(3), last_sunday(10)


def broker_offset(source_id, utc_seconds):
    if source_id not in PROFILES:
        return None
    try:
        year = datetime.fromtimestamp(utc_seconds, timezone.utc).year
    except (ValueError, OverflowError, OSError):
        return None
    # The start of the 2015 raw range can project into late December 2014.
    if not 2014 <= year <= 2031:
        return None
    start, end = transitions(year)
    return 10800 if start <= utc_seconds < end else 7200


def project(source_id, server_time, capture_offset):
    if capture_offset is None or server_time <= 0:
        return None, None
    utc = server_time - capture_offset
    historical_offset = broker_offset(source_id, utc)
    return utc * 1000, utc + historical_offset if historical_offset is not None else None
