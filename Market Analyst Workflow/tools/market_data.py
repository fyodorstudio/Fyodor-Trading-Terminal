"""Small, read-only analyst queries. Run from any directory with the repo's Python."""
import argparse
import csv
from contextlib import closing
from datetime import date, datetime, timedelta, timezone
import json
from pathlib import Path
import re
import sqlite3
import sys
from urllib.error import URLError
from urllib.request import urlopen
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError
from fastapi import HTTPException

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))
from storage.calendar_store import CalendarStore
from storage.research_reports import REPORT_DIRECTORY, ResearchRequest, collect_evidence, evidence_row, save_report
from ohlc import fetch_window, read_saved, summarize, write_evidence


def get_json(base, route):
    with urlopen(base.rstrip('/') + '/api/v1/' + route, timeout=15) as response:
        return json.load(response)


def local_path(name):
    path = Path(name)
    if not path.is_absolute():
        path = ROOT / path if (ROOT / path).exists() else REPORT_DIRECTORY / path
    path = path.resolve()
    if not path.is_relative_to(ROOT):
        raise ValueError('Use a file inside the Lite repository')
    return path


def report_path(name):
    if name == 'latest':
        files = sorted(REPORT_DIRECTORY.glob('*.md'), key=lambda p: p.stat().st_mtime, reverse=True)
        if not files:
            raise ValueError('No reports in Market Analyst Workflow/report')
        return files[0]
    return local_path(name)


def load_report(path):
    text = path.read_text(encoding='utf-8-sig')
    brief = text.split('## Selected interval', 1)[0]
    evidence = re.search(r'^Evidence file: (.+)$', text, re.MULTILINE)
    if evidence:
        companion = (path.parent / evidence[1].strip()).resolve()
        if companion.parent != path.parent.resolve():
            raise ValueError('Evidence companion must be beside the report')
        with companion.open(encoding='utf-8-sig', newline='') as source:
            rows = list(csv.DictReader(source, delimiter='\t'))
        counts = re.search(r'Selected readings: (\d+) · preceding context readings: (\d+)', brief)
        if not counts or any(sum(row.get('section') == section for row in rows) != int(counts[index])
            for section, index in (('selected',1),('context',2))) or len(rows) != int(counts[1]) + int(counts[2]):
            raise ValueError('Evidence companion counts do not match the brief; restore the complete export')
        return brief, rows
    # Compatibility with existing full-table reports. Parse escaped pipes.
    fields = ['time', 'currency', 'country', 'name', 'period', 'importance', 'actual', 'forecast', 'previous',
        'revised_previous', 'actual_minus_forecast', 'actual_minus_previous', 'revision', 'event_id', 'value_id',
        'captured_utc', 'timing_basis', 'availability']
    rows, section = [], 'selected'
    for line in text.splitlines():
        if line.startswith('## Preceding context'):
            section = 'context'
        if re.match(r'^\| \d{4}-\d{2}-\d{2}', line):
            cells = [item.strip().replace('\\|', '|') for item in re.split(r'(?<!\\)\|', line)[1:-1]]
            if len(cells) != len(fields):
                raise ValueError('Malformed legacy report row')
            rows.append(dict(zip(fields, cells), section=section))
    return brief, rows


def select_rows(rows, args):
    terms = [word.casefold() for word in (args.match or '').split('|') if word]
    result = [row for row in rows if (args.section == 'all' or row['section'] == args.section)
        and (not args.currency or row['currency'] == args.currency)
        and (args.command != 'report' or not args.from_date or row['time'][:10] >= args.from_date)
        and (args.command != 'report' or not args.to_date or row['time'][:10] <= args.to_date)
        and (not terms or any(word in (row['name'] + ' ' + row['event_id']).casefold() for word in terms))]
    if not args.rows and not args.match:
        groups = {}
        for row in result:
            key = (row['section'], row['time'], row['currency'], row['country'])
            group = groups.setdefault(key, {'section': key[0], 'time': key[1], 'currency': key[2], 'country': key[3],
                'readings': 0, 'preview_names': []})
            group['readings'] += 1
            if row['name'] not in group['preview_names'] and len(group['preview_names']) < 4:
                group['preview_names'].append(row['name'])
        result = list(groups.values())
    return {'mode': 'rows' if args.rows or args.match else 'release-index (names are previews)',
        'total_readings': len(rows), 'matches': len(result), 'offset': args.offset,
        'next_offset': args.offset + args.limit if args.offset + args.limit < len(result) else None,
        'items': result[args.offset:args.offset + args.limit]}


def display_zone(name):
    if name == 'UTC':
        return timezone.utc
    if name == 'Asia/Jakarta':
        return timezone(timedelta(hours=7), name)
    match = re.fullmatch(r'UTC([+-])(\d{2}):(\d{2})', name)
    if match:
        hours, minutes = int(match[2]), int(match[3])
        if hours <= 14 and minutes < 60 and (hours < 14 or minutes == 0):
            return timezone(timedelta(minutes=(hours * 60 + minutes) * (1 if match[1] == '+' else -1)))
        raise ValueError('Invalid UTC offset')
    try:
        return ZoneInfo(name)
    except ZoneInfoNotFoundError as error:
        raise ValueError('Timezone unavailable; use UTC, Asia/Jakarta, or a verified UTC offset') from error


def calendar_request(args):
    zone = display_zone(args.zone)
    start, end = date.fromisoformat(args.from_date), date.fromisoformat(args.to_date)
    return ResearchRequest(source_id=args.broker, title=args.name or f'{args.scope} research {start} to {end}',
        scope=args.scope, kind='historical', from_date=start, to_date=end,
        from_utc_ms=int(datetime.combine(start, datetime.min.time(), zone).timestamp() * 1000),
        to_utc_ms=int(datetime.combine(end + timedelta(days=1), datetime.min.time(), zone).timestamp() * 1000),
        timezone=args.zone, context_days=args.context_days, question=args.question)


def query_options(parser):
    parser.add_argument('--match', help='Case-insensitive name/ID substrings; | separates alternatives')
    parser.add_argument('--currency', choices=['USD','EUR','GBP','JPY','CHF','CAD','AUD','NZD'])
    parser.add_argument('--section', choices=['all','selected','context'], default='selected')
    parser.add_argument('--rows', action='store_true', help='Show readings rather than a release index')
    parser.add_argument('--limit', type=int, choices=range(1, 501), metavar='1..500', default=20)
    parser.add_argument('--offset', type=int, default=0)


def parser():
    root = argparse.ArgumentParser(description=__doc__)
    commands = root.add_subparsers(dest='command', required=True)
    status = commands.add_parser('status', help='Broker availability and stored source IDs; no account credentials')
    status.add_argument('--bridge', default='http://127.0.0.1:8001')
    status.add_argument('--database', default='storage/data/calendar.sqlite3')
    listing = commands.add_parser('reports', help='Recent brief and OHLC artifact paths')
    listing.add_argument('--limit', type=int, choices=range(1, 51), metavar='1..50', default=5)
    report = commands.add_parser('report', help='Read a brief and query its complete TSV or legacy Markdown')
    report.add_argument('path', nargs='?', default='latest')
    report.add_argument('--from', dest='from_date')
    report.add_argument('--to', dest='to_date')
    query_options(report)
    calendar = commands.add_parser('calendar', help='Query a read-only calendar snapshot; no service required')
    calendar.add_argument('--broker', required=True)
    calendar.add_argument('--scope', required=True, help='USD or EURUSD, using the eight supported currencies')
    calendar.add_argument('--from', dest='from_date', required=True, help='Inclusive display date YYYY-MM-DD')
    calendar.add_argument('--to', dest='to_date', required=True)
    calendar.add_argument('--zone', default='UTC')
    calendar.add_argument('--context-days', type=int, default=0)
    calendar.add_argument('--database', default='storage/data/calendar.sqlite3')
    calendar.add_argument('--export', action='store_true', help='Save the complete unfiltered scope, then show the focused query')
    calendar.add_argument('--name')
    calendar.add_argument('--question', default='')
    query_options(calendar)
    candles = commands.add_parser('ohlc', help='Fetch a bounded UTC window or reuse saved candles; print a small summary')
    candles.add_argument('--pair', default='EURUSD')
    candles.add_argument('--symbol', help='Exact MT5 symbol when the broker uses a suffix')
    candles.add_argument('--timeframe', choices=['M1','M5','M15','M30','H1','H4','D1'], default='M1')
    candles.add_argument('--from', dest='from_utc')
    candles.add_argument('--to', dest='to_utc')
    candles.add_argument('--event', help='Verified UTC release instant; enables reaction measurements')
    candles.add_argument('--input', help='Reuse saved .ohlc.json or the earlier M1 evidence JSON offline')
    candles.add_argument('--bridge', default='http://127.0.0.1:8001')
    candles.add_argument('--broker-offset-seconds', type=int, help='Explicit historical offset for a broker without a profile')
    candles.add_argument('--max-requests', type=int, choices=range(2, 65), metavar='2..64', default=32)
    return root


def run(args):
    if getattr(args, 'offset', 0) < 0:
        raise ValueError('Offset must be non-negative')
    if args.command == 'status':
        result = {'report_directory': str(REPORT_DIRECTORY)}
        try:
            health = get_json(args.bridge, 'health')
            mt5 = health.get('mt5', {})
            result['bridge'] = {key: mt5.get(key) for key in ('connected','account_server','generation','last_error')}
        except (URLError, TimeoutError, OSError) as error:
            result['bridge'] = {'available': False, 'reason': str(error)}
        with closing(CalendarStore(local_path(args.database), readonly=True)) as store:
            result['revision'] = store.db.execute('SELECT value FROM data_revision WHERE id=1').fetchone()[0]
            result['sources'] = [dict(row) for row in store.db.execute('SELECT id,offset_seconds,server_now FROM sources ORDER BY id')]
        return result
    if args.command == 'reports':
        files = [p for p in REPORT_DIRECTORY.iterdir() if p.suffix in ('.md','.json') and p.is_file()]
        return {'directory': str(REPORT_DIRECTORY), 'total': len(files), 'items': [
            {'path': str(p), 'bytes': p.stat().st_size} for p in sorted(files, key=lambda p: p.stat().st_mtime, reverse=True)[:args.limit]]}
    if args.command == 'report':
        path = report_path(args.path)
        brief, rows = load_report(path)
        return {'path': str(path), 'brief': brief, **select_rows(rows, args)}
    if args.command == 'calendar':
        request = calendar_request(args)
        with closing(CalendarStore(local_path(args.database), readonly=True)) as store:
            if args.export:
                saved = save_report(store, request)
                brief, rows = load_report(Path(saved['path']))
                return {'saved': saved, 'brief': brief, **select_rows(rows, args)}
            selected, context, coverage, revision = collect_evidence(store, request)
            rows = [evidence_row(row, section) for section, items in (('selected',selected),('context',context)) for row in items]
            return {'scope': args.scope, 'broker': args.broker, 'zone': args.zone, 'revision': revision,
                'selected_readings': len(selected), 'context_readings': len(context), 'coverage_raw_broker_clock': coverage,
                'forecast_source': 'broker feed; provider/methodology may differ from web surveys', **select_rows(rows, args)}
    if args.command == 'ohlc':
        if args.input:
            data = read_saved(local_path(args.input))
            return {'evidence_path': str(local_path(args.input)), 'reused_saved_capture': True, **summarize(data, args.event)}
        if not args.from_utc or not args.to_utc:
            raise ValueError('OHLC needs --from and --to UTC instants, or --input')
        data = fetch_window(lambda route: get_json(args.bridge, route), args.pair, args.symbol or args.pair,
            args.timeframe, args.from_utc, args.to_utc, args.broker_offset_seconds, args.max_requests)
        path = write_evidence(data, REPORT_DIRECTORY)
        return {'evidence_path': str(path), **summarize(data, args.event)}


if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8')
    sys.stderr.reconfigure(encoding='utf-8')
    try:
        print(json.dumps(run(parser().parse_args()), ensure_ascii=False, indent=2))
    except (ValueError, OSError, sqlite3.Error, URLError, KeyError, HTTPException) as error:
        print(json.dumps({'error': error.detail if isinstance(error, HTTPException) else str(error)}, ensure_ascii=False), file=sys.stderr)
        sys.exit(2)
