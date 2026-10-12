"""Bounded MT5 history navigation and measured reactions, without trading calls."""
from datetime import datetime, timezone
import json
import math
from pathlib import Path
from urllib.error import HTTPError
from urllib.parse import urlencode

from storage.calendar_clock import broker_offset, PROFILES
from storage.currencies import CURRENCIES

STEPS = {'M1':60, 'M5':300, 'M15':900, 'M30':1800, 'H1':3600, 'H4':14400, 'D1':86400}


def instant(value):
    parsed = datetime.fromisoformat(value.replace('Z', '+00:00'))
    if parsed.tzinfo is None:
        raise ValueError('Use an explicit timezone in OHLC instants, preferably Z for UTC')
    return int(parsed.timestamp())


def utc_stamp(seconds):
    return datetime.fromtimestamp(seconds, timezone.utc).isoformat(timespec='seconds').replace('+00:00', 'Z')


def candle_utc(raw, broker, explicit_offset=None):
    if broker in PROFILES:
        candidates = [raw-offset for offset in (7200,10800) if broker_offset(broker, raw-offset) == offset]
        if len(candidates) != 1:
            raise ValueError('Candle has an ambiguous/unverified historical broker clock; no UTC instant guessed')
        return candidates[0]
    if explicit_offset is None or abs(explicit_offset) > 50400:
        raise ValueError('Broker has no historical clock profile; supply a verified --broker-offset-seconds')
    return raw - explicit_offset


def validate_pair(pair):
    if len(pair) != 6 or pair[:3] == pair[3:] or any(currency not in CURRENCIES for currency in (pair[:3],pair[3:])):
        raise ValueError('Choose a pair of distinct supported currencies')


def fetch_window(get, pair, symbol, timeframe, from_utc, to_utc, offset=None, max_requests=32):
    validate_pair(pair)
    start, end = instant(from_utc), instant(to_utc)
    if not 0 <= start < end or end - start > STEPS[timeframe] * 50000:
        raise ValueError('Choose a valid OHLC interval of at most 50,000 timeframe slots')
    health = get('health')['mt5']
    if not health.get('connected'):
        raise ValueError('MT5 is disconnected; reuse saved OHLC evidence or connect the terminal')
    broker, generation = health['account_server'], health['generation']
    if broker not in PROFILES and offset is None:
        raise ValueError('Broker has no historical clock profile; supply a verified --broker-offset-seconds')
    calls = 0

    def page(position, count):
        nonlocal calls
        if calls >= max_requests or position > 10_000_000:
            raise ValueError('History request bound reached; narrow the range or raise --max-requests (max 64)')
        calls += 1
        try:
            result = get('ohlc?' + urlencode({'symbol':symbol,'timeframe':timeframe,'start_pos':position,'count':count}))
        except HTTPError as error:
            if error.code == 404 and position:
                return [], False
            raise
        if (result['symbol'],result['timeframe'],result['start_pos'],result['source_generation']) != (symbol,timeframe,position,generation):
            raise ValueError('MT5 source changed or returned a different page; retry against a consistent source')
        bars = []
        for row in result['bars']:
            if any(not math.isfinite(float(row[key])) for key in ('open','high','low','close')):
                raise ValueError('Non-finite candle price')
            if not row['low'] <= min(row['open'],row['close']) <= max(row['open'],row['close']) <= row['high']:
                raise ValueError('Invalid candle OHLC bounds')
            bars.append({**row, 'utc_time': candle_utc(row['time'], broker, offset)})
        if any(a['utc_time'] >= b['utc_time'] for a,b in zip(bars,bars[1:])):
            raise ValueError('Candle page is not strictly chronological')
        return bars, result['has_older']

    latest, _ = page(0,2)
    if not latest:
        raise ValueError('No candle history available')
    # Positional binary seek reads two bars per probe, not every intervening day.
    position = 0
    if latest[-1]['utc_time'] >= end:
        low, high = 0, 1024
        while True:
            probe, _ = page(high,2)
            if not probe or probe[-1]['utc_time'] < end:
                break
            low, high = high, min(high * 2,10_000_000)
            if low == high:
                raise ValueError('No requested history within the bridge positional limit')
        while high - low > 1:
            middle = (low + high) // 2
            probe, _ = page(middle,2)
            if not probe or probe[-1]['utc_time'] < end:
                high = middle
            else:
                low = middle
        # Include a small overlap: live bar positions can advance during seek.
        position = max(0, high - 10)
    rows, duplicates = {}, 0
    while True:
        bars, older = page(position,5000)
        if not bars:
            break
        for row in bars:
            if start <= row['utc_time'] < end:
                previous = rows.get(row['utc_time'])
                if previous is not None:
                    duplicates += 1
                    if previous != row:
                        raise ValueError('Overlapping history changed during capture; retry')
                rows[row['utc_time']] = row
        if bars[0]['utc_time'] <= start or not older:
            break
        # Overlap avoids losing a bar when positions shift at the live edge.
        position += max(1, len(bars)-10)
    selected = sorted(rows.values(), key=lambda row: row['utc_time'])
    if not selected:
        raise ValueError('No candles in the requested interval; historical MT5 availability is limited')
    final_health = get('health')['mt5']
    if (final_health.get('account_server'),final_health.get('generation')) != (broker,generation):
        raise ValueError('Broker changed during OHLC capture; retry')
    return {'schema':'fyodor-analyst-ohlc/1', 'pair':pair, 'symbol':symbol, 'timeframe':timeframe,
        'broker':broker, 'source_generation':generation, 'from_utc':utc_stamp(start), 'to_utc':utc_stamp(end),
        'captured_utc':utc_stamp(int(datetime.now(timezone.utc).timestamp())), 'bridge_ohlc_requests':calls,
        'clock_basis':PROFILES.get(broker, f'explicit historical offset {offset}'), 'overlap_duplicates':duplicates,
        'bars':selected}


def read_saved(path):
    data = json.loads(Path(path).read_text(encoding='utf-8-sig'))
    if not data.get('bars') or any('utc_time' not in row for row in data['bars']):
        raise ValueError('Saved candles need verified utc_time; raw server clocks are insufficient')
    data.setdefault('pair', data.get('symbol',''))
    validate_pair(data['pair'])
    data.setdefault('captured_utc', utc_stamp(data['observed_at']/1000) if data.get('observed_at') else 'unavailable')
    return data


def summarize(data, event=None):
    bars = sorted(data['bars'], key=lambda row: row['utc_time'])
    step = STEPS[data['timeframe']]
    if any(a['utc_time'] >= b['utc_time'] for a,b in zip(bars,bars[1:])):
        raise ValueError('Saved candles contain duplicate UTC instants')
    captured = data.get('captured_utc')
    captured_at = instant(captured) if captured and captured != 'unavailable' else None
    gaps = [{'after_utc':utc_stamp(a['utc_time']), 'before_utc':utc_stamp(b['utc_time'])}
        for a,b in zip(bars,bars[1:]) if b['utc_time'] - a['utc_time'] != step]
    result = {key:data.get(key) for key in ('pair','symbol','broker','timeframe','captured_utc','clock_basis','bridge_ohlc_requests')}
    result.update({'bars':len(bars), 'first_utc':utc_stamp(bars[0]['utc_time']), 'last_bar_open_utc':utc_stamp(bars[-1]['utc_time']),
        'first_open':bars[0]['open'], 'last_close':bars[-1]['close'], 'low':min(row['low'] for row in bars),
        'high':max(row['high'] for row in bars), 'gap_count':len(gaps), 'gap_preview':gaps[:8],
        'last_bar_complete_at_capture': bars[-1]['utc_time'] + step <= captured_at if captured_at is not None else None,
        'note':'Broker OHLC; intrabar order and executable bid/ask spreads are not established. Gaps may be sessions or unavailable history.'})
    if data.get('from_utc') and data.get('to_utc'):
        result['requested_edges_present'] = {'start':bars[0]['utc_time'] == instant(data['from_utc']),
            'end':bars[-1]['utc_time'] + step == instant(data['to_utc'])}
    if event:
        at = instant(event)
        lookup = {row['utc_time']:row for row in bars}
        if step != 60 or at % 60 or at-60 not in lookup:
            result['reaction_unavailable'] = 'Use M1 with the full pre-release minute and a minute-aligned verified release instant'
        else:
            baseline = lookup[at-60]['close']
            pip = .01 if data['pair'][3:] == 'JPY' else .0001
            reactions = []
            for minutes in (1,5,15,30,60,120):
                window = [lookup.get(t) for t in range(at,at+minutes*60,60)]
                if any(row is None for row in window) or captured_at is None or at+minutes*60 > captured_at:
                    reactions.append({'minutes':minutes, 'available':False})
                    continue
                reactions.append({'minutes':minutes, 'close_utc':utc_stamp(at+minutes*60), 'close':window[-1]['close'],
                    'net_pips':round((window[-1]['close']-baseline)/pip,1), 'low':min(row['low'] for row in window),
                    'high':max(row['high'] for row in window)})
            result.update({'event_utc':utc_stamp(at),'baseline_close':baseline,'reactions':reactions})
    return result


def write_evidence(data, directory, folder=None):
    from storage.research_reports import create_report_folder
    own_folder = folder is None
    directory = Path(folder) if folder else create_report_folder(directory,
        f"{data['pair']}-{data['timeframe']}-{data['from_utc'][:10]}-candles")
    path = directory / f"{data['pair']}-{data['timeframe']}-{instant(data['from_utc'])}-{datetime.now(timezone.utc):%Y%m%d-%H%M%S-%f}.ohlc.json"
    created = False
    try:
        with path.open('x', encoding='utf-8') as output:
            created = True
            json.dump(data,output,ensure_ascii=False,separators=(',',':'))
    except (OSError, TypeError, ValueError):
        if created:
            path.unlink(missing_ok=True)
        if own_folder:
            directory.rmdir()
        raise
    return path.resolve()
