"""Capture read-only local context and validate an analyst's source/pin receipt.

This checks recorded work, not semantic completeness of the world's news feed.
"""
from datetime import datetime, timedelta, timezone
import json
from pathlib import Path
import subprocess
import sys
from urllib.parse import urlsplit

CURRENCIES = ('USD', 'EUR', 'GBP', 'JPY', 'CHF', 'CAD', 'AUD', 'NZD')
LOCAL_FAMILIES = ('highlights', 'limitations', 'external', 'upcoming')


def instant(value):
    parsed = datetime.fromisoformat(value.replace('Z', '+00:00'))
    if parsed.tzinfo is None:
        raise ValueError('Clocks need an explicit timezone')
    return parsed.astimezone(timezone.utc)


def currencies(scope):
    scope = scope.upper()
    result = list(CURRENCIES) if scope == 'ALL' else [scope[:3]] + ([scope[3:]] if len(scope) == 6 else [])
    if scope != 'ALL' and len(scope) not in (3, 6) or any(x not in CURRENCIES for x in result) or len(set(result)) != len(result):
        raise ValueError('Choose ALL, a supported currency or a pair')
    return result


def required_sources(scope):
    required = [(family, 'ALL') for family in LOCAL_FAMILIES]
    for currency in currencies(scope):
        required.extend((family, currency) for family in ('news', 'policy', 'statistics'))
        if currency == 'USD':
            required.extend((family, currency) for family in ('treasury-auctions', 'treasury-buybacks', 'market-operations'))
    return required


def collect_pages(run, arguments, limit):
    items, pages, offset, revision = [], [], 0, None
    while True:
        page = run([*arguments, '--limit', str(limit), '--offset', str(offset)])
        current = page.get('calendar_revision', page.get('revision'))
        if pages and current is not None and revision != current:
            raise ValueError('Local source changed during pagination; repeat this capture')
        revision = current
        if page.get('offset', offset) != offset or not isinstance(page.get('items'), list):
            raise ValueError('Invalid local source page')
        pages.append(page)
        items.extend(page['items'])
        next_offset = page.get('next_offset')
        if next_offset is None:
            if len(items) != page.get('matches', len(items)):
                raise ValueError('Local source count disagrees with complete pages')
            return {'pages': pages, 'items': items, 'matches': len(items), 'next_offset': None}
        if next_offset != offset + limit or next_offset >= 10000:
            raise ValueError('Invalid or excessive local pagination; preserve the gap')
        offset = next_offset


def capture(root, output, scope, broker, cutoff=None, days=7, read_only=False, runner=None, release_at=None, deadline=None):
    root, output = Path(root).resolve(), Path(output).resolve()
    if not output.is_relative_to(root) or output == root:
        raise ValueError('Use a dedicated output directory inside Lite')
    currencies(scope)
    if days < 7:
        raise ValueError('Discovery horizon must be at least seven days')
    now = datetime.now(timezone.utc).isoformat()
    cutoff = instant(cutoff or now).isoformat()
    if instant(cutoff) > instant(now):
        raise ValueError('Assessment cutoff cannot be in the future')
    release = instant(release_at) if release_at else None
    deadline = instant(deadline) if deadline else release + timedelta(minutes=5) if release else None
    if deadline and (not release or deadline < release):
        raise ValueError('A release deadline needs the verified release instant and cannot precede it')
    output.mkdir(parents=True, exist_ok=True)
    if any((output / name).exists() for name in ['discovery.json', *[family + '.json' for family in LOCAL_FAMILIES]]):
        raise ValueError('Discovery evidence already exists; use a new output directory')
    def command(arguments):
        result = subprocess.run([sys.executable, str(root / 'Market Analyst Workflow/tools/market_data.py'), *arguments],
            cwd=root, capture_output=True, text=True, encoding='utf-8', timeout=30, check=True)
        return json.loads(result.stdout)
    runner = runner or command
    queries = {
        'highlights': (['highlights', '--broker', broker, '--visibility', 'all'], 500),
        'limitations': (['limitations', '--broker', broker], 100),
        'external': (['external', '--scope', scope.lower() if scope.upper() == 'ALL' else scope.upper(), '--visibility', 'all'], 500),
        # Include the boundary day so a rolling seven-day horizon does not lose overnight stages.
        'upcoming': (['upcoming', '--broker', broker, '--scope', scope.lower() if scope.upper() == 'ALL' else scope.upper(),
                      '--as-of', cutoff, '--days', str(min(90, days + 1))], 500),
    }
    sources, gaps = [], []
    for family, (arguments, limit) in queries.items():
        source = dict(id='local-' + family, family=family, currency='ALL', status='checked',
                      checked_utc=datetime.now(timezone.utc).isoformat(), evidence_path=family + '.json', note='')
        try:
            snapshot = collect_pages(runner, arguments, limit)
            (output / source['evidence_path']).write_text(json.dumps(snapshot, indent=2), encoding='utf-8')
            if family == 'upcoming' and days >= 90:
                source['note'] = f'Broker index is bounded to 90 days; web schedules must cover the requested {days}-day horizon.'
        except (OSError, ValueError, subprocess.SubprocessError) as error:
            source.update(status='unavailable', note=str(error), attempts=['local CLI: ' + ' '.join(arguments)])
            source.pop('evidence_path')
            gaps.append('local-' + family + ': ' + str(error))
        source['checked_utc'] = datetime.now(timezone.utc).isoformat()
        sources.append(source)
    for family, currency in required_sources(scope):
        if currency != 'ALL':
            sources.append(dict(id=f'{currency.lower()}-{family}', family=family, currency=currency,
                status='pending', checked_utc=None, url='', evidence_path='', note=''))
    receipt = dict(scope=scope.upper(), broker=broker, as_of_utc=cutoff, started_utc=now,
        horizon_days=days, discovery_completed_utc=None, backdrop_started_utc=None,
        read_only=read_only, coverage='partial', gaps=gaps, sources=sources, events=[])
    if release:
        receipt.update(mode='release', release_at_utc=release.isoformat(), deadline_utc=deadline.isoformat())
    path = output / 'discovery.json'
    path.write_text(json.dumps(receipt, indent=2), encoding='utf-8')
    return {'path': str(path), 'as_of_utc': cutoff, 'pending_web_checks': sum(s['status'] == 'pending' for s in sources), 'gaps': gaps}


def validate_receipt(receipt, directory, external_lookup, highlight_lookup, now=None):
    """Lookup callbacks independently inspect current stores; tests use isolated stores."""
    directory = Path(directory).resolve()
    now = now or datetime.now(timezone.utc)
    scope = set(currencies(receipt['scope']))
    cutoff, started = instant(receipt['as_of_utc']), instant(receipt['started_utc'])
    errors, gaps = [], []
    if cutoff > now or started > now:
        errors.append('Receipt cutoff/start is in the future')
    if receipt.get('horizon_days', 0) < 7:
        errors.append('At least seven days of schedule coverage are required')
    completed = instant(receipt['discovery_completed_utc']) if receipt.get('discovery_completed_utc') else None
    backdrop = instant(receipt['backdrop_started_utc']) if receipt.get('backdrop_started_utc') else None
    if completed is None or completed < started or completed > now:
        errors.append('Initial discovery needs its real completion clock')
    if backdrop and (not completed or backdrop < completed or backdrop > now):
        errors.append('Backdrop started before immediate discovery completed or has a future clock')
    sources = receipt.get('sources', [])
    finished = instant(receipt['finished_utc']) if receipt.get('finished_utc') else None
    release = instant(receipt['release_at_utc']) if receipt.get('release_at_utc') else None
    deadline = instant(receipt['deadline_utc']) if receipt.get('deadline_utc') else None
    bounded_stop = (receipt.get('mode') == 'release' and receipt.get('stop_reason') == 'release_deadline'
                    and release is not None and deadline is not None and finished is not None
                    and release <= deadline <= finished <= now and started <= finished and bool(receipt.get('stop_note')))
    if receipt.get('stop_reason') == 'release_deadline' and not bounded_stop:
        errors.append('Release deferral needs its elapsed declared deadline, real finish clock and explanation')
    if finished and not started <= finished <= now:
        errors.append('Receipt needs a valid actual finish clock')
    if len({s['id'] for s in sources}) != len(sources):
        errors.append('Source IDs must be unique')
    indexed = {s['id']: s for s in sources}
    covered = {(s.get('family'), s.get('currency')) for s in sources}
    for family, currency in required_sources(receipt['scope']):
        if (family, currency) not in covered:
            errors.append(f'Missing required source: {currency} {family}')
    for source in sources:
        name, status = source['id'], source.get('status')
        local = source.get('family') in LOCAL_FAMILIES
        checks = source.get('checks', [])
        for check in checks:
            at = instant(check['checked_utc']) if check.get('checked_utc') else None
            if not at or not started <= at <= now:
                errors.append(f'{name}: recorded retrieval has an invalid clock')
            if at and finished and at > finished:
                errors.append(f'{name}: retrieval is later than this receipt finish clock')
            route = urlsplit(check.get('url', ''))
            if route.scheme not in ('http', 'https') or not route.netloc or route.username or route.password or not (check.get('tool_reference') or check.get('retrieval_method')):
                errors.append(f'{name}: recorded retrieval needs its actual route and tool reference')
            if check.get('outcome') == 'opened':
                body = (directory / check.get('evidence_path', '')).resolve()
                if not body.is_relative_to(directory) or not body.is_file() or not body.stat().st_size:
                    errors.append(f'{name}: recorded opened evidence is missing')
            elif check.get('outcome') != 'failed' or not check.get('note'):
                errors.append(f'{name}: failed retrieval needs its actual failure note')
        if status in ('partial', 'deferred'):
            if local or not bounded_stop or not source.get('note') or status == 'partial' and not checks:
                errors.append(f'{name}: unfinished coverage needs recorded checks or an explicit elapsed release-deadline deferral')
            gaps.append(name)
            continue
        if status == 'unavailable':
            attempts = {c.get('url') for c in checks if c.get('outcome') == 'failed'} if checks else set(source.get('attempts', []))
            if not source.get('note') or len(attempts) < (1 if local else 2):
                errors.append(f'{name}: unavailable source needs route attempts and a specific gap')
            gaps.append(name)
        elif status != 'checked':
            errors.append(f'{name}: required source is still pending')
        if status not in ('checked', 'unavailable'):
            continue
        checked = instant(source['checked_utc']) if source.get('checked_utc') else None
        if not checked or not started <= checked <= now:
            errors.append(f'{name}: missing/invalid actual retrieval clock')
        if status != 'checked':
            continue
        path = (directory / source.get('evidence_path', '')).resolve()
        if not path.is_relative_to(directory) or not path.is_file() or not path.stat().st_size:
            errors.append(f'{name}: opened-source evidence is missing or outside this receipt')
            continue
        if local:
            snapshot = json.loads(path.read_text(encoding='utf-8-sig'))
            pages = snapshot.get('pages', [])
            if not pages or snapshot.get('next_offset') is not None or pages[-1].get('next_offset') is not None:
                errors.append(f'{name}: local pagination is incomplete')
            if sum(len(p.get('items', [])) for p in pages) != snapshot.get('matches'):
                errors.append(f'{name}: local snapshot count is incomplete')
        else:
            url = urlsplit(source.get('url', ''))
            if url.scheme not in ('https', 'http') or not url.netloc or url.username or url.password:
                errors.append(f'{name}: missing direct opened-source URL')
            if not (source.get('tool_reference') or source.get('retrieval_method')):
                errors.append(f'{name}: record the source-open tool reference or retrieval method')
    events = receipt.get('events', [])
    if not events and not receipt.get('no_material_events_reason'):
        errors.append('No candidates recorded: provide the source-grounded reason')
    for event in events:
        name = event['key']
        affected = set(event.get('currencies', []))
        if not affected or not affected.intersection(scope) or not affected.issubset(CURRENCIES):
            errors.append(f'{name}: candidate does not match the requested currency scope')
        links = event.get('source_ids', [])
        if not links or any(x not in indexed or not (indexed[x].get('status') == 'checked'
                or any(check.get('outcome') == 'opened' for check in indexed[x].get('checks', []))) for x in links):
            errors.append(f'{name}: candidate needs checked source evidence')
        if not event.get('stage') or not event.get('decision_note'):
            errors.append(f'{name}: missing stage or inclusion/exclusion reason')
        available = instant(event['available_utc']) if event.get('available_utc') else None
        if not available and not event.get('availability_note'):
            errors.append(f'{name}: evidence availability is unresolved without a note')
        if available and available > now:
            errors.append(f'{name}: evidence availability is in the future')
        if event.get('used_for_prompt_verdict') and (not available or available > cutoff):
            errors.append(f'{name}: later/unknown information leaked into prompt-time verdict')
        at = instant(event['event_at']) if event.get('event_at') else None
        if at and event.get('event_date'):
            errors.append(f'{name}: exact and date-only event clocks must remain separate')
        if not event.get('material'):
            continue
        if at and cutoff - timedelta(hours=1) <= at <= cutoff + timedelta(hours=6) and not event.get('surface'):
            errors.append(f'{name}: material imminent/just-elapsed stage was omitted')
        pin = event.get('pin', {})
        status = pin.get('status')
        if receipt.get('read_only'):
            if status != 'read_only':
                errors.append(f'{name}: read-only override must suppress pin mutations')
            continue
        if status == 'failed':
            if not pin.get('note'):
                errors.append(f'{name}: failed pin needs a concrete failure note')
            gaps.append(name)
            continue
        if status not in ('saved', 'existing', 'restored'):
            errors.append(f'{name}: verified material discovery has not been pinned')
            continue
        saved = instant(pin['saved_utc']) if pin.get('saved_utc') else None
        if status in ('saved', 'restored'):
            discovered = instant(event.get('discovered_utc', receipt['started_utc']))
            if not saved or not started <= saved <= now:
                errors.append(f'{name}: missing actual pin save clock')
            if not started <= discovered <= now or saved and discovered > saved:
                errors.append(f'{name}: invalid actual discovery clock')
            if backdrop and saved and saved > backdrop and discovered <= backdrop:
                errors.append(f'{name}: pin was deferred until after backdrop work')
        if pin.get('source') == 'external':
            stored = external_lookup(pin.get('reference'))
            if not stored or stored.get('archived') or not set(stored.get('currencies', [])).intersection(affected):
                errors.append(f'{name}: active scoped external pin was not found')
                continue
            actual_at = instant(stored['event_at']) if stored.get('event_at') else None
            if actual_at != at or stored.get('event_date') != event.get('event_date'):
                errors.append(f'{name}: saved external stage/time differs from the discovery')
            if (at or event.get('event_date')) and not stored.get('chart_icon_request_id'):
                errors.append(f'{name}: persisted Show icon on chart request is missing')
        elif pin.get('source') == 'highlight':
            stored = highlight_lookup(pin.get('reference'))
            if not stored or stored.get('archived_utc') or stored.get('source_id') != receipt['broker'] or stored.get('currency') not in affected:
                errors.append(f'{name}: active exact broker pin was not found')
            elif set(pin.get('value_ids', [])) != set(stored.get('value_ids', [])) or not pin.get('value_ids'):
                errors.append(f'{name}: broker value IDs were not verified')
            elif at and stored.get('release_at') != round(at.timestamp() * 1000):
                errors.append(f'{name}: current broker stage/time differs from the discovery')
            elif event.get('event_date') and (stored.get('release_at') is not None or stored.get('event_date') != event['event_date']):
                errors.append(f'{name}: current broker date-only stage differs from the discovery')
        else:
            errors.append(f'{name}: invalid pin source')
    if gaps and (receipt.get('coverage') != 'partial' or not receipt.get('gaps')):
        errors.append('Unavailable sources/pins must be disclosed as partial coverage with gaps')
    if receipt.get('coverage') not in ('complete', 'partial'):
        errors.append('Coverage must be complete or partial')
    return {'valid': not errors, 'coverage': receipt.get('coverage'), 'errors': errors, 'gap_references': gaps,
        'coverage_complete': not gaps and not errors and receipt.get('coverage') == 'complete',
        'note': 'Checks recorded source coverage and current pins; does not guarantee exhaustive news discovery.'}


def validate_file(path):
    from contextlib import closing
    from storage.calendar_store import CalendarStore
    from storage.calendar_clock import publication_time_known
    from storage.external_sources import external_snapshot
    from storage.highlights import highlight_snapshot
    path = Path(path).resolve()
    receipt = json.loads(path.read_text(encoding='utf-8-sig'))
    outside, offset = {}, 0
    while True:
        page = external_snapshot(scope=receipt['scope'].lower() if receipt['scope'] == 'ALL' else receipt['scope'], visibility='all', limit=500, offset=offset)
        outside.update((x['key'], x) for x in page['items'])
        if page['next_offset'] is None:
            break
        offset = page['next_offset']
    pins = {}
    if any(event.get('pin', {}).get('source') == 'highlight' for event in receipt.get('events', [])):
        root = Path(__file__).resolve().parents[2]
        with closing(CalendarStore(root / 'storage/data/calendar.sqlite3', readonly=True)) as store:
            snapshot = highlight_snapshot(store, receipt['broker'], visibility='all')
            for item in snapshot['items']:
                dates = {datetime.fromtimestamp(event['server_time_seconds'], timezone.utc).date().isoformat()
                         for event in item['events'] if not publication_time_known(event)}
                item['event_date'] = next(iter(dates)) if len(dates) == 1 else None
                pins[item['id']] = item
    result = validate_receipt(receipt, path.parent, outside.get, pins.get)
    if not result['valid']:
        raise ValueError('Discovery validation failed: ' + '; '.join(result['errors']))
    return result
