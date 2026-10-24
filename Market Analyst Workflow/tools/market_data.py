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
from ohlc import fetch_window, read_saved, summarize, write_evidence, capture_lock, cached_window
from storage.highlights import HIGHLIGHTS_PATH, HighlightRequest, highlight_snapshot, archive_pin, pin_release
from storage.highlight_journal import JournalRequest, append_journal, read_journal
from storage.thesis import ThesisRequest, append_thesis, thesis_snapshot
from storage.thesis_reviews import ReviewRequest, append_review, review_context
from storage.highlight_metadata import PromptRequest, append_prompt, read_prompts, LimitationRequest, append_limitation, limitations_snapshot
from storage.alert_impact import ImpactRequest, append_impact, impact_snapshot
from upcoming import upcoming_snapshot
from storage.external_sources import DIRECTORY as EXTERNAL_DIRECTORY, ExternalRequest, append_external, external_history, external_snapshot, archive_external, request_external_chart_icon
from external_runtime import preflight as external_preflight, require_writable as require_external_writable


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


def report_briefs(directory):
    """Discover evidence briefs without confusing adjacent analyst notes for reports."""
    files = []
    for path in Path(directory).rglob('*.md'):
        if not path.resolve().is_relative_to(ROOT):
            continue
        if path.name == 'brief.md':
            files.append(path)
        else:
            with path.open(encoding='utf-8-sig') as source:
                header = source.read(16384)
            if re.search(r'^## Selected interval(?: index)?\s*$', header, re.MULTILINE):
                files.append(path)
    return files


def report_path(name):
    if name == 'latest':
        files = sorted(report_briefs(REPORT_DIRECTORY), key=lambda p: p.stat().st_mtime, reverse=True)
        if not files:
            raise ValueError('No reports in Market Analyst Workflow/report')
        return local_path(str(files[0]))
    path = local_path(name)
    if not path.exists() and Path(name).name == name:
        matches = list(REPORT_DIRECTORY.rglob(name))
        if len(matches) > 1:
            raise ValueError('Several reports match; use the path from pnpm analyst reports')
        if matches:
            path = local_path(str(matches[0]))
    if path.is_dir():
        if (path / 'brief.md').is_file():
            return local_path(str(path / 'brief.md'))
        briefs = [brief for brief in report_briefs(path) if brief.parent == path]
        if len(briefs) != 1:
            raise ValueError('Choose the brief path inside this report folder')
        path = local_path(str(briefs[0]))
    return path


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
        and (not args.event_id or row['event_id'] in args.event_id)
        and (args.command != 'report' or not args.from_date or row['time'][:10] >= args.from_date)
        and (args.command != 'report' or not args.to_date or row['time'][:10] <= args.to_date)
        and (not terms or any(word in (row['name'] + ' ' + row['event_id']).casefold() for word in terms))]
    if not args.rows and not args.match and not args.summary and not args.event_id:
        groups = {}
        for row in result:
            key = (row['section'], row['time'], row['currency'], row['country'])
            group = groups.setdefault(key, {'section': key[0], 'time': key[1], 'currency': key[2], 'country': key[3],
                'readings': 0, 'preview_names': []})
            group['readings'] += 1
            if row['name'] not in group['preview_names'] and len(group['preview_names']) < 4:
                group['preview_names'].append(row['name'])
        result = list(groups.values())
    row_mode = bool(args.rows or args.match or args.summary or args.event_id)
    if args.summary and row_mode:
        fields = ('highlight_id', 'source_id', 'section', 'time', 'currency', 'country', 'name', 'period', 'actual', 'forecast',
            'previous', 'revised_previous', 'revision', 'event_id', 'value_id', 'captured_utc', 'timing_basis', 'availability')
        result = [{key: row[key] for key in fields if key in row} for row in result]
    return {'mode': 'summary rows' if args.summary else 'rows' if row_mode else 'release-index (names are previews)',
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
    parser.add_argument('--summary', action='store_true', help='Compact readings; complete evidence remains available without this flag')
    parser.add_argument('--event-id', action='append', help='Exact series ID; repeat to select several IDs regardless of source names')
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
    highlights = commands.add_parser('highlights', help='Read pinned releases and current stored values offline, without chart filters')
    highlights.add_argument('--broker', help='Optional stored broker ID; otherwise read all pinned brokers')
    highlights.add_argument('--highlight-id', action='append', help='Exact pinned occurrence ID; repeat to select several pins')
    highlights.add_argument('--database', default='storage/data/calendar.sqlite3')
    highlights.add_argument('--visibility', choices=['active','archived','all'], default='active')
    query_options(highlights)
    thesis = commands.add_parser('thesis', help='Read the monthly Thesis dock or append a sourced assessment; never changes calendar or pins')
    thesis.add_argument('action', choices=['read', 'append', 'review-append', 'context'])
    thesis.add_argument('--scope', required=True, help='Pair for append/pair reads, or ALL to read Across All Currency')
    thesis.add_argument('--month', default='2026-10', help='Jakarta calendar month YYYY-MM')
    thesis.add_argument('--broker', help='Broker for optional linked MT5 release saves; daily records and reads need no broker')
    thesis.add_argument('--database', default='storage/data/calendar.sqlite3')
    thesis.add_argument('--input', help='ThesisRequest JSON file inside Lite for append; see docs/THESIS.md')
    thesis.add_argument('--as-of', help='Optional timezone-aware context cutoff; defaults to now, never changes evidence vintages')
    journal = commands.add_parser('journal', help='Read research versions or append an agent-authored JSON entry (calendar stays read-only)')
    journal.add_argument('action', choices=['read','append'])
    journal.add_argument('highlight_id')
    journal.add_argument('--broker', required=True)
    journal.add_argument('--input', help='JSON JournalRequest file inside Lite; required for append')
    journal.add_argument('--scope')
    journal.add_argument('--phase', choices=['before','after'])
    journal.add_argument('--limit', type=int, choices=range(1,101), default=10)
    journal.add_argument('--offset', type=int, default=0)
    journal.add_argument('--database', default='storage/data/calendar.sqlite3')
    prompt = commands.add_parser('prompt', help='Prepare/read occurrence-specific prompts without doing or saving macro analysis')
    prompt.add_argument('action', choices=['read','save'])
    prompt.add_argument('highlight_id')
    prompt.add_argument('--broker', required=True)
    prompt.add_argument('--input', help='PromptRequest JSON file for save')
    prompt.add_argument('--scope')
    prompt.add_argument('--limit', type=int, choices=range(1,101), default=10)
    prompt.add_argument('--offset', type=int, default=0)
    impact = commands.add_parser('impact', help='Read/save agent-assessed Alert impact, separate from broker importance')
    impact.add_argument('action', choices=['read', 'save'])
    impact.add_argument('--broker', default='')
    impact.add_argument('--source', choices=['highlight', 'external'])
    impact.add_argument('--reference', help='Exact Highlight ID or stable External Source key')
    impact.add_argument('--input', help='ImpactRequest JSON file for save; see docs/HIGHLIGHT-JOURNAL.md')
    limitations = commands.add_parser('limitations', help='Read/append discovered schedule or data limitations without changing the calendar')
    limitations.add_argument('action', choices=['read','append'], nargs='?', default='read')
    limitations.add_argument('--broker', required=True)
    limitations.add_argument('--input', help='LimitationRequest JSON file for append')
    limitations.add_argument('--limit', type=int, choices=range(1,101), default=20)
    limitations.add_argument('--offset', type=int, default=0)
    action = commands.add_parser('highlight', help='Explicit pin/archive/restore actions; never delete research')
    action.add_argument('action', choices=['pin','archive','restore'])
    action.add_argument('--highlight-id')
    action.add_argument('--broker', required=True)
    action.add_argument('--input', help='HighlightRequest JSON file for pin')
    action.add_argument('--database', default='storage/data/calendar.sqlite3')
    upcoming = commands.add_parser('upcoming', help='Grouped upcoming occurrences and related research across all eight currencies')
    upcoming.add_argument('--broker', required=True)
    upcoming.add_argument('--scope', default='all')
    upcoming.add_argument('--days', type=int, choices=range(1,91), default=14)
    upcoming.add_argument('--zone', default='Asia/Jakarta')
    upcoming.add_argument('--as-of', help='Timezone-aware schedule cutoff; does not reconstruct historical readings')
    upcoming.add_argument('--family', action='append')
    upcoming.add_argument('--category', action='append')
    upcoming.add_argument('--database', default='storage/data/calendar.sqlite3')
    upcoming.add_argument('--match')
    upcoming.add_argument('--currency', choices=['USD','EUR','GBP','JPY','CHF','CAD','AUD','NZD'])
    upcoming.add_argument('--limit', type=int, choices=range(1,501), default=20)
    upcoming.add_argument('--offset', type=int, default=0)
    candles = commands.add_parser('ohlc', help='Fetch a bounded UTC window or reuse saved candles; print a small summary')
    candles.add_argument('--pair', default='EURUSD', help='Forex pair or canonical commodity BRENT, WTI, GOLD; commodities require --symbol')
    candles.add_argument('--symbol', help='Exact MT5 symbol when the broker uses a suffix')
    candles.add_argument('--timeframe', choices=['M1','M5','M15','M30','H1','H4','D1'], default='M1')
    candles.add_argument('--from', dest='from_utc')
    candles.add_argument('--to', dest='to_utc')
    candles.add_argument('--event', help='Verified UTC release instant; enables reaction measurements')
    candles.add_argument('--input', help='Reuse saved .ohlc.json or the earlier M1 evidence JSON offline')
    candles.add_argument('--report', help='Attach a new capture to this report path/folder, or latest')
    candles.add_argument('--refresh', action='store_true', help='Fetch fresh candles instead of reusing a complete saved report window')
    candles.add_argument('--bridge', default='http://127.0.0.1:8001')
    candles.add_argument('--broker-offset-seconds', type=int, help='Explicit historical offset for a broker without a profile')
    candles.add_argument('--max-requests', type=int, choices=range(2, 65), metavar='2..64', default=32)
    discovery = commands.add_parser('discovery', help='Capture local coverage context and verify web-source/pin discovery receipts')
    discovery.add_argument('action', choices=['start', 'record', 'finish', 'validate'])
    discovery.add_argument('--scope')
    discovery.add_argument('--broker')
    discovery.add_argument('--as-of', help='Timezone-aware prompt cutoff; defaults to the first-observed clock')
    discovery.add_argument('--days', type=int, metavar='7+', default=7)
    discovery.add_argument('--output', help='New receipt directory inside Lite')
    discovery.add_argument('--input', help='Completed discovery.json inside Lite')
    discovery.add_argument('--read-only', action='store_true', help='Explicit user override: discovery without event pin mutations')
    discovery.add_argument('--release-at', help='Verified UTC release instant for a bounded release invocation')
    discovery.add_argument('--deadline', help='User-selected deadline; defaults to five minutes after --release-at')
    discovery.add_argument('--source-id', help='Exact pending web-family row to record incrementally')
    discovery.add_argument('--status', choices=['partial', 'checked', 'unavailable'], default='partial')
    discovery.add_argument('--outcome', choices=['opened', 'failed'], default='opened')
    discovery.add_argument('--url', help='Direct source URL actually opened/attempted')
    discovery.add_argument('--evidence', help='Saved source/tool body inside Lite; copied without replacing earlier evidence')
    discovery.add_argument('--tool-reference')
    discovery.add_argument('--retrieval-method')
    discovery.add_argument('--checked-at', help='Actual retrieval clock, if already recorded by the source-open tool')
    discovery.add_argument('--note', default='')
    discovery.add_argument('--stop-reason', choices=['complete', 'source_gaps', 'release_deadline'])
    external = commands.add_parser('external', help='Read/write separate sourced events and headlines outside the broker calendar')
    external.add_argument('action', choices=['list', 'read', 'preflight', 'append', 'archive', 'restore', 'show-on-chart'], nargs='?', default='list')
    external.add_argument('--storage', default='http://127.0.0.1:8002', help='Loopback storage runtime to check before external writes')
    external.add_argument('--key')
    external.add_argument('--input', help='ExternalRequest JSON inside Lite; append requires this')
    external.add_argument('--expected-version', help='Latest version ID; required for archive/restore/show-on-chart')
    external.add_argument('--scope', default='all', help='all, a currency, a pair, BRENT, WTI or GOLD')
    external.add_argument('--visibility', choices=['active', 'archived', 'all'], default='active')
    external.add_argument('--from', dest='from_date', help='Inclusive UTC day (date-only records retain source date)')
    external.add_argument('--to', dest='to_date')
    external.add_argument('--match')
    external.add_argument('--limit', type=int, choices=range(1, 501), default=20)
    external.add_argument('--offset', type=int, default=0)
    return root


def run(args):
    if getattr(args, 'offset', 0) < 0:
        raise ValueError('Offset must be non-negative')
    if args.command == 'discovery':
        from discovery_audit import capture, validate_file
        if args.action in ('record', 'finish'):
            from discovery_record import record_source, finish
            if not args.input:
                raise ValueError('Discovery record/finish needs --input with its receipt')
            if args.action == 'finish':
                return finish(local_path(args.input), args.stop_reason, args.note)
            if not args.source_id or not args.url:
                raise ValueError('Discovery record needs --source-id and --url')
            return record_source(local_path(args.input), args.source_id, args.status, args.url,
                local_path(args.evidence) if args.evidence else None, args.tool_reference, args.retrieval_method,
                args.note, args.outcome, args.checked_at, ROOT)
        if args.action == 'validate':
            if not args.input:
                raise ValueError('Discovery validate needs --input')
            return validate_file(local_path(args.input))
        if not args.scope or not args.broker or not args.output:
            raise ValueError('Discovery start needs --scope, --broker and --output')
        output = (ROOT / args.output).resolve() if not Path(args.output).is_absolute() else Path(args.output).resolve()
        return capture(ROOT, output, args.scope, args.broker, args.as_of, args.days, args.read_only,
                       release_at=args.release_at, deadline=args.deadline)
    if args.command == 'thesis':
        if args.action == 'context':
            from storage.thesis import PATH as THESIS_PATH
            return review_context(THESIS_PATH, args.scope, args.as_of)
        if args.action == 'review-append':
            if not args.input:
                raise ValueError('Review append needs --input; see docs/THESIS.md')
            request = ReviewRequest.model_validate_json(local_path(args.input).read_text(encoding='utf-8-sig'))
            if request.scope != args.scope:
                raise ValueError('Review scope differs from the command')
            from storage.thesis import PATH as THESIS_PATH
            return append_review(request, THESIS_PATH)
        if args.action == 'read':
            return thesis_snapshot(None, args.scope, args.month, args.broker)
        if not args.input:
            raise ValueError('Append needs --input with a ThesisRequest JSON file')
        request = ThesisRequest.model_validate_json(local_path(args.input).read_text(encoding='utf-8-sig'))
        if request.scope != args.scope or request.target and request.target.kind == 'highlight' and request.target.source_id != args.broker:
            raise ValueError('Thesis request pair/broker differs from the command')
        if request.target is None:
            return append_thesis(None, request)
        with closing(CalendarStore(local_path(args.database), readonly=True)) as store:
            return append_thesis(store, request)
    if args.command == 'external':
        if args.action == 'preflight':
            return external_preflight(EXTERNAL_DIRECTORY, args.storage)
        if args.action == 'show-on-chart':
            if not args.key or not args.expected_version:
                raise ValueError('Show-on-chart needs --key and --expected-version')
            runtime = require_external_writable(EXTERNAL_DIRECTORY, args.storage)
            return {**request_external_chart_icon(args.key, args.expected_version), 'runtime': runtime}
        if args.action == 'append':
            if not args.input:
                raise ValueError('Append needs --input with an ExternalRequest JSON file')
            request = ExternalRequest.model_validate_json(local_path(args.input).read_text(encoding='utf-8-sig'))
            runtime = require_external_writable(EXTERNAL_DIRECTORY, args.storage)
            return {**append_external(request), 'runtime': runtime}
        if args.action in ('archive', 'restore'):
            if not args.key or not args.expected_version:
                raise ValueError('Archive/restore needs --key and --expected-version')
            runtime = require_external_writable(EXTERNAL_DIRECTORY, args.storage)
            return {**archive_external(args.key, args.expected_version, restore=args.action == 'restore'), 'runtime': runtime}
        if args.action == 'read':
            if not args.key:
                raise ValueError('Read needs --key')
            entries = list(reversed(external_history(args.key)))
            return {'directory': str(EXTERNAL_DIRECTORY), 'key': args.key, 'matches': len(entries),
                    'next_offset': args.offset + args.limit if args.offset + args.limit < len(entries) else None,
                    'items': entries[args.offset:args.offset + args.limit]}
        return {'directory': str(EXTERNAL_DIRECTORY), **external_snapshot(visibility=args.visibility, scope=args.scope,
                from_date=args.from_date, to_date=args.to_date, match=args.match, limit=args.limit, offset=args.offset)}
    if args.command == 'impact':
        if args.action == 'save':
            if not args.input:
                raise ValueError('Impact save needs --input with its JSON request')
            return append_impact(ImpactRequest.model_validate_json(local_path(args.input).read_text(encoding='utf-8-sig')))
        return impact_snapshot(args.broker, reference=args.reference, source=args.source)
    if args.command in ('prompt', 'limitations'):
        if args.action in ('save', 'append'):
            if not args.input:
                raise ValueError('A metadata write needs --input with its JSON request')
            text = local_path(args.input).read_text(encoding='utf-8-sig')
            return append_prompt(args.highlight_id, args.broker, PromptRequest.model_validate_json(text)) if args.command == 'prompt' else append_limitation(args.broker, LimitationRequest.model_validate_json(text))
        if args.command == 'prompt':
            from storage.highlights import read_pins
            if not any(pin['id'] == args.highlight_id and pin['source_id'] == args.broker for pin in read_pins()):
                raise ValueError('Highlight not found for this broker')
            entries = [entry for entry in reversed(read_prompts(args.highlight_id)) if entry['source_id'] == args.broker and (not args.scope or entry['scope'] == args.scope)]
        else:
            entries = limitations_snapshot(args.broker)['items']
        return {'broker': args.broker, 'matches': len(entries), 'offset': args.offset,
            'next_offset': args.offset+args.limit if args.offset+args.limit < len(entries) else None,
            'items': entries[args.offset:args.offset+args.limit]}
    if args.command in ('highlight', 'journal', 'upcoming'):
        with closing(CalendarStore(local_path(args.database), readonly=True)) as store:
            if args.command == 'upcoming':
                return upcoming_snapshot(store, args, ROOT, display_zone(args.zone))
            if args.command == 'highlight':
                if args.action == 'pin':
                    if not args.input:
                        raise ValueError('Pin needs --input with a HighlightRequest JSON file')
                    request = HighlightRequest.model_validate_json(local_path(args.input).read_text(encoding='utf-8-sig'))
                    if request.source_id != args.broker:
                        raise ValueError('Pin broker differs from --broker')
                    return pin_release(store, request)
                if not args.highlight_id:
                    raise ValueError('Archive/restore needs --highlight-id')
                return archive_pin(args.highlight_id, args.broker, store=store, restore=args.action == 'restore')
            pins = highlight_snapshot(store, args.broker, visibility='all')['items']
            if not any(pin['id'] == args.highlight_id for pin in pins):
                raise ValueError('Highlight not found for this broker')
            if args.action == 'append':
                if not args.input:
                    raise ValueError('Append needs --input with a JournalRequest JSON file')
                request = JournalRequest.model_validate_json(local_path(args.input).read_text(encoding='utf-8-sig'))
                return append_journal(store, args.highlight_id, args.broker, request)
            entries = [entry for entry in read_journal(args.highlight_id) if (not args.scope or entry['scope'] == args.scope)
                       and (not args.phase or entry['phase'] == args.phase)]
            entries.reverse()
            return {'highlight_id': args.highlight_id, 'broker': args.broker, 'matches': len(entries), 'offset': args.offset,
                'next_offset': args.offset+args.limit if args.offset+args.limit < len(entries) else None, 'items': entries[args.offset:args.offset+args.limit]}
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
        files = [*report_briefs(REPORT_DIRECTORY), *[p for p in REPORT_DIRECTORY.rglob('*.json') if p.is_file() and p.resolve().is_relative_to(ROOT)]]
        return {'directory': str(REPORT_DIRECTORY), 'total': len(files), 'items': [
            {'path': str(p), 'bytes': p.stat().st_size} for p in sorted(files, key=lambda p: p.stat().st_mtime, reverse=True)[:args.limit]]}
    if args.command == 'report':
        path = report_path(args.path)
        brief, rows = load_report(path)
        return {'path': str(path), **({} if args.summary else {'brief': brief}), **select_rows(rows, args)}
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
            if args.report:
                raise ValueError('--report attaches new captures; --input reuses a file without moving it')
            data = read_saved(local_path(args.input))
            return {'evidence_path': str(local_path(args.input)), 'reused_saved_capture': True, **summarize(data, args.event)}
        if not args.from_utc or not args.to_utc:
            raise ValueError('OHLC needs --from and --to UTC instants, or --input')
        from storage.research_instruments import INSTRUMENTS
        if args.pair in INSTRUMENTS and not args.symbol:
            raise ValueError('Commodity captures need the verified exact broker --symbol; never assume a futures contract or CFD alias')
        folder = None
        expected_broker = None
        if args.report:
            path = report_path(args.report).resolve()
            folder = path.parent
            if not path.is_file() or folder == REPORT_DIRECTORY.resolve() or not folder.is_relative_to(REPORT_DIRECTORY.resolve()):
                raise ValueError('Attach candles to a brief inside its own report folder')
            header = re.search(r'^- Broker: (.+?) ·', path.read_text(encoding='utf-8-sig'), re.MULTILINE)
            expected_broker = header[1] if header else None
        if folder and expected_broker and not args.refresh and args.broker_offset_seconds is None:
            saved = cached_window(folder, args.pair, args.symbol or args.pair, args.timeframe, args.from_utc, args.to_utc, expected_broker)
            if saved:
                return {'evidence_path': str(saved[0]), 'reused_saved_capture': True, **summarize(saved[1], args.event)}
        def get(route):
            response = get_json(args.bridge, route)
            if route == 'health' and expected_broker and response['mt5'].get('account_server') != expected_broker:
                raise ValueError('Connected broker differs from the report; use its matching bridge or saved capture')
            return response
        with capture_lock(args.bridge):
            data = fetch_window(get, args.pair, args.symbol or args.pair,
                args.timeframe, args.from_utc, args.to_utc, args.broker_offset_seconds, args.max_requests)
        path = write_evidence(data, REPORT_DIRECTORY, folder)
        return {'evidence_path': str(path), **summarize(data, args.event)}
    if args.command == 'highlights':
        with closing(CalendarStore(local_path(args.database), readonly=True)) as store:
            snapshot = highlight_snapshot(store, args.broker) if args.visibility == 'active' else highlight_snapshot(store, args.broker, visibility=args.visibility)
        if args.highlight_id:
            snapshot['items'] = [pin for pin in snapshot['items'] if pin['id'] in args.highlight_id]
        if args.rows or args.summary or args.event_id:
            rows = [{**evidence_row(event, 'selected'), 'highlight_id': pin['id'], 'source_id': pin['source_id']}
                for pin in snapshot['items'] for event in pin['events']]
            return {'pins_path': str(HIGHLIGHTS_PATH), 'as_of_utc': snapshot['as_of_utc'],
                'calendar_revision': snapshot['calendar_revision'], **select_rows(rows, args)}
        terms = [word.casefold() for word in (args.match or '').split('|') if word]
        pins = [pin for pin in snapshot['items'] if (not args.currency or pin['currency'] == args.currency)
            and (not terms or any(word in (pin['label'] + ' ' + ' '.join(event['name'] for event in pin['events'])).casefold() for word in terms))]
        now = datetime.now(timezone.utc).timestamp() * 1000
        def timeline(pin):
            groups = {}
            for event in pin['events']:
                at = evidence_row(event, 'selected')['time']
                group = groups.setdefault(at, {'time': at, 'readings': 0, 'preview_names': []})
                group['readings'] += 1
                if event['name'] not in group['preview_names'] and len(group['preview_names']) < 4:
                    group['preview_names'].append(event['name'])
            return list(groups.values())
        return {'pins_path': str(HIGHLIGHTS_PATH), 'as_of_utc': snapshot['as_of_utc'], 'calendar_revision': snapshot['calendar_revision'],
            'matches': len(pins), 'next_offset': args.offset + args.limit if args.offset + args.limit < len(pins) else None,
            'items': [{'id': pin['id'], 'source_id': pin['source_id'], 'label': pin['label'], 'currency': pin['currency'], 'publisher_status': pin['publisher_status'],
                'release_utc': datetime.fromtimestamp(pin['release_at']/1000, timezone.utc).isoformat() if pin['release_at'] is not None else None,
                'seconds_until': round((pin['release_at']-now)/1000) if pin['release_at'] is not None else None,
                'readings': len(pin['events']), 'with_actuals': sum(event['actual'] is not None for event in pin['events']),
                'latest_capture_utc': datetime.fromtimestamp(max(event['observed_at'] for event in pin['events']),timezone.utc).isoformat() if pin['events'] else None,
                'missing_value_ids': pin['missing_value_ids'], 'archived_utc': pin['archived_utc'],
                'research': [{'id': entry['id'], 'phase': entry['phase'], 'scope': entry['scope'], 'as_of_utc': entry['as_of_utc'],
                              'direction': entry['direction']} for entry in pin['journal']],
                'prompt_scopes': sorted({entry['scope'] for entry in pin['prompts']}),
                'timeline': timeline(pin)} for pin in pins[args.offset:args.offset + args.limit]]}


if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8')
    sys.stderr.reconfigure(encoding='utf-8')
    try:
        print(json.dumps(run(parser().parse_args()), ensure_ascii=False, indent=2))
    except (ValueError, OSError, sqlite3.Error, URLError, KeyError, HTTPException) as error:
        print(json.dumps({'error': error.detail if isinstance(error, HTTPException) else str(error)}, ensure_ascii=False), file=sys.stderr)
        sys.exit(2)
