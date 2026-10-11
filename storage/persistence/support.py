import json

HISTORY_START = 1420070400  # 2015-01-01, raw broker-server calendar clock.
DAY = 86400


def canonical(value: object) -> str:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), allow_nan=False)


def merged_intervals(intervals):
    result = []
    for start, end in sorted(intervals):
        if result and start <= result[-1][1]:
            result[-1] = (result[-1][0], max(end, result[-1][1]))
        else:
            result.append((start, end))
    return result


def missing_intervals(start: int, end: int, covered):
    result = []
    cursor = start
    for left, right in merged_intervals(covered):
        if right <= cursor or left >= end:
            continue
        if left > cursor:
            result.append((cursor, min(left, end)))
        cursor = max(cursor, right)
    if cursor < end:
        result.append((cursor, end))
    return result
