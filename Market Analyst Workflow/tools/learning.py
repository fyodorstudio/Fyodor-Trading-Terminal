"""Foreground learning commands. Captures reuse the existing locked OHLC helper."""
from collections import Counter
from datetime import timedelta
from pathlib import Path
import csv
import json

from storage.analyst_learning import episodes, outcomes, reports, reviews
from storage.analyst_learning.store import digest, directory, instant, read, stamp, write
from storage.data_lock import data_lock
from ohlc import capture_lock, fetch_window, read_saved


def state(journal_path, args):
    if args.read_only:
        receipt = {'status': 'read_only', 'added': 0}
        frozen = episodes.source_episodes(journal_path)
    else:
        receipt = episodes.sync(journal_path)
        frozen = read(directory(journal_path) / 'episodes.json', {'episodes': []})['episodes']
    rows = episodes.select(episodes.windows(frozen, args.as_of or stamp()), args.scope, args.from_date, args.to_date)
    return receipt, rows


def cache_directory(root):
    return root / 'storage/data/analyst-learning/candles'


def prices(root, args):
    paths = sorted(cache_directory(root).glob('*.json'))
    paths += [Path(path) for path in (args.input or [])]
    return [(path, read_saved(path)) for path in dict.fromkeys(paths)]


def measurement_ends(row, now):
    """Only matured endpoints; sensitivities and overdue exposure retain separate labels."""
    ends = [instant(row['end_utc'])]
    for minutes in (120, 1440):
        ending = instant(row['delivered_utc']) + timedelta(minutes=minutes)
        if ending <= instant(now):
            ends.append(ending)
    if row.get('checkpoint_overdue_seconds', 0) > 0:
        ends.append(instant(row.get('next_delivery_utc') or now))
    return ends


def window_revision(row, now):
    return digest({'end': row['end_utc'], 'next_delivery': row.get('next_delivery_utc'),
        'overdue': row.get('checkpoint_overdue_seconds', 0),
        'secondary_due': [minutes for minutes in (120, 1440)
            if instant(row['delivered_utc']) + timedelta(minutes=minutes) <= instant(now)]})


def refresh(root, journal_path, args, get_json):
    if args.read_only:
        raise ValueError('Read-only learning uses prepare/report/case, not refresh')
    receipt, rows = state(journal_path, args)
    now = args.as_of or stamp()
    target = directory(journal_path)
    book = read(target / 'outcomes.json', {'version': 1, 'outcomes': []})
    prior = {(o['episode_id'], o['end_utc']): o for o in book['outcomes']}
    matured = [r for r in rows if r.get('window_status') == 'matured']
    def needs_capture(row):
        old = prior.get((row['id'], row['end_utc'])) or {}
        observations = [old.get('observation', {})]
        observations.extend(value for value in old.get('secondary_observations', {}).values() if value.get('status') != 'pending')
        if row.get('checkpoint_overdue_seconds', 0) > 0:
            observations.append(old.get('post_checkpoint_observation') or {})
        return (old.get('window_revision') != window_revision(row, now)
            or any(value.get('status') != 'complete' for value in observations))
    work = [r for r in matured if needs_capture(r)]
    documents = prices(root, args)
    attempts, captured = [], []
    if args.capture and work:
        start = min(instant(r['delivered_utc']) for r in work).replace(second=0, microsecond=0) - timedelta(minutes=1)
        end = min(instant(now), max(end for r in work for end in measurement_ends(r, now))).replace(second=0, microsecond=0)
        # Never turn a backfill into an unbounded live scan; old work is processed in <= 30-day chunks.
        end = min(end, start + timedelta(days=30))
        if end > start:
            attempts_path = target / 'capture-attempts.json'
            history = read(attempts_path, {'attempts': []})['attempts']
            for symbol, _ in outcomes.LEGS.values():
                if len(attempts) >= args.max_symbols:
                    break
                covered = any(d.get('pair') == symbol and instant(d['from_utc']) <= start
                    and instant(d['to_utc']) >= end and instant(d['captured_utc']) >= end for _, d in documents)
                if covered:
                    continue
                last = next((a for a in reversed(history) if a['symbol'] == symbol
                    and a['from_utc'] == stamp(start) and a['to_utc'] == stamp(end)), None)
                if last and not last['ok'] and instant(now) - instant(last['at']) < timedelta(minutes=30):
                    continue
                attempt = {'symbol': symbol, 'from_utc': stamp(start), 'to_utc': stamp(end), 'at': stamp(), 'ok': False}
                try:
                    with capture_lock(args.bridge):
                        data = fetch_window(lambda route: get_json(args.bridge, route), symbol, symbol, 'M1',
                            stamp(start), stamp(end), max_requests=args.max_requests)
                    if data['broker'] != 'Pepperstone-Demo':
                        raise ValueError('Learning capture needs the verified Pepperstone source')
                    path = cache_directory(root) / (symbol + '-' + digest(data)[:24] + '.json')
                    if not path.exists():
                        write(path, data)
                    documents.append((path, data))
                    attempt.update(ok=True, path=str(path), bridge_requests=data['bridge_ohlc_requests'])
                    captured.append(str(path))
                except (ValueError, OSError, RuntimeError) as error:
                    attempt['error'] = str(error)
                attempts.append(attempt)
                # Persist each bounded attempt, so an interrupted batch retains progress.
                with data_lock(target):
                    latest = read(attempts_path, {'attempts': []})
                    latest['attempts'].append(attempt)
                    write(attempts_path, latest)
    tape = outcomes.PriceTape(documents, now)
    data_revision = digest(sorted(tape.provenance))
    all_windows = episodes.windows(read(target / 'episodes.json', {'episodes': []})['episodes'], now)
    generated = []
    for row in matured:
        previous = prior.get((row['id'], row['end_utc']))
        secondary_due = previous and any(value.get('status') == 'pending'
            and instant(row['delivered_utc']) + timedelta(minutes=int(minutes)) <= instant(now)
            for minutes, value in previous['secondary_observations'].items())
        context_revision = window_revision(row, now)
        if (previous and previous.get('data_revision') == data_revision
                and previous.get('window_revision') == context_revision and not secondary_due):
            generated.append(previous)
            continue
        observation = tape.measure(row)
        secondary = {}
        for minutes in (120, 1440):
            ending = instant(row['delivered_utc']) + timedelta(minutes=minutes)
            secondary[str(minutes)] = tape.measure(row, stamp(ending))
        preferences = []
        for preference in (row.get('evaluation') or {}).get('relative_preferences', []):
            counterpart = preference['pair'][3:] if row['currency'] == preference['pair'][:3] else preference['pair'][:3]
            matching = [r for r in all_windows
                if r['currency'] == counterpart and r.get('end_utc') and r.get('window_status') in ('matured', 'pending')
                and instant(r['delivered_utc']) <= instant(row['delivered_utc']) < instant(r['end_utc'])
                and r.get('basis_eligible')]
            if not matching:
                preferences.append({'pair': preference['pair'], 'status': 'unavailable', 'gap': 'No overlapping current counterpart assessment.'})
            else:
                other = max(matching, key=lambda r: r['delivered_utc'])
                end = min(instant(row['end_utc']), instant(other['end_utc']))
                preferences.append(tape.preference(row, preference, stamp(end)))
        # Observation content includes only prices available through the chosen window.
        # Provenance/capture time may change without manufacturing another result for identical prices.
        checkpoint_observation = None
        checkpoint = (row.get('direction') or {}).get('reassessment')
        if row.get('checkpoint_overdue_seconds', 0) > 0 and checkpoint and checkpoint.get('event_at'):
            exposed = {**row, 'delivered_utc': checkpoint['event_at']}
            checkpoint_observation = tape.measure(exposed, row.get('next_delivery_utc') or now)
            checkpoint_observation['interpretation'] = 'Movement while reassessment was overdue; not scored as the original forecast window.'
        identity = digest({'episode_hash': row['input_hash'], 'end': row['end_utc'], 'window_revision': context_revision,
            'observation': {k: v for k, v in observation.items() if k != 'provenance'},
            'secondary': {k: {a: b for a, b in v.items() if a != 'provenance'} for k, v in secondary.items()},
            'checkpoint_observation': {k: v for k, v in (checkpoint_observation or {}).items() if k != 'provenance'}, 'preferences': preferences})
        generated.append({'id': identity, 'episode_id': row['id'], 'episode_hash': row['input_hash'],
            'protocol_id': row['protocol_id'], 'end_utc': row['end_utc'], 'window_basis': row.get('window_basis'),
            'data_revision': data_revision, 'window_revision': context_revision,
            'recorded_utc': stamp(), 'observation': observation, 'secondary_observations': secondary,
            'relative_preferences': preferences, 'post_checkpoint_observation': checkpoint_observation})
    with data_lock(target):
        book = read(target / 'outcomes.json', {'version': 1, 'outcomes': []})
        known = {o['id'] for o in book['outcomes']}
        added = [o for o in generated if o['id'] not in known]
        if added:
            book['outcomes'].extend(added)
            write(target / 'outcomes.json', book)
    return {'snapshot': receipt, 'matured': len(matured), 'new_outcomes': len(added),
        'capture_attempts': attempts, 'captured': captured, 'coverage': dict(Counter(o['observation']['status'] for o in generated)),
        'pending': sum(r.get('window_status') == 'pending' for r in rows),
        'next_action': 'Review material matured cases with learning case/review; preserve explicit gaps. Current verdict delivery takes priority.'}


def command(root, journal_path, args, get_json):
    if args.action == 'refresh':
        return refresh(root, journal_path, args, get_json)
    receipt, rows = state(journal_path, args)
    target = directory(journal_path)
    recorded = read(target / 'outcomes.json', {'outcomes': []})['outcomes']
    if args.action == 'prepare':
        reviewed = {r['episode_id'] for r in read(target / 'reviews.json', {'reviews': []})['reviews']}
        latest = {o['episode_id']: o for o in recorded}
        currencies = sorted({r['currency'] for r in rows})
        pending = [dict(episode_id=r['id'], currency=r['currency'], delivered_utc=r['delivered_utc'],
            outcome_id=latest[r['id']]['id'], observation_status=latest[r['id']]['observation']['status'],
            direction_result=latest[r['id']]['observation'].get('direction_result'),
            basis_eligible=r.get('basis_eligible', False), checkpoint_overdue_seconds=r.get('checkpoint_overdue_seconds', 0)) for r in rows
            if r['id'] not in reviewed and r['id'] in latest and r.get('window_status') == 'matured'
            and latest[r['id']]['end_utc'] == r['end_utc']]
        current = {}
        for row in rows:
            if row.get('window_status') != 'obsolete_correction':
                current[row['currency']] = row
        grades = Counter((r.get('direction') or {}).get('intensity') for r in current.values())
        calibration = ['All requested current grades match. Explain any researched relative dominance or genuine tie; do not force different grades.'] if len(current) > 1 and len(grades) == 1 else []
        pending.sort(key=lambda r: (not r['basis_eligible'], r['observation_status'] not in ('complete', 'partial'),
            -r['checkpoint_overdue_seconds'], r['delivered_utc']))
        queue = pending[:args.limit]
        aligned = next((r for r in pending if r['basis_eligible'] and r['direction_result'] == 'aligned'), None)
        if aligned and aligned not in queue and len(queue) > 1:
            queue[-1] = aligned
        return {'snapshot': receipt, 'lessons': reviews.retrieve(journal_path, currencies, args.tag, args.limit, args.as_of),
            'case_queue': queue, 'unreviewed_cases': len(pending),
            'unmeasured_matured': sum(r.get('window_status') == 'matured' and r['id'] not in latest for r in rows),
            'calibration_checks': calibration,
            'required': 'Freshly weigh direction and intensity, complete relevant equal-grade comparisons, choose the earliest material anchor. Apply lesson exceptions; do not force labels or wait for bookkeeping.'}
    if args.action == 'case':
        row = next((r for r in rows if r['id'] == args.episode), None)
        if not row:
            raise ValueError('Choose an episode ID in the requested scope/date range')
        # A blind evidence packet deliberately omits all measurements and later saved cases.
        if args.blind:
            return {'method': 'retrospective_evidence_packet_not_independent_forward_test',
                'packet_hash': row['input_hash'], 'evidence_context': {k: row[k] for k in
                    ('id', 'currency', 'cutoff_utc', 'saved_utc', 'delivered_utc', 'evidence')},
                'limitations': 'Original verdict, later outcomes and current lessons omitted. The model may still have prior knowledge; this is not proof of an independent blind replay.'}
        selected = next((o for o in reversed(recorded) if o['episode_id'] == row['id']
            and o['end_utc'] == row.get('end_utc') and row.get('window_status') == 'matured'), None)
        if selected:
            selected = {**selected, 'secondary_observations': {key: value if not value.get('terminal_utc')
                or instant(value['terminal_utc']) <= instant(args.as_of or stamp()) else {'status': 'pending'}
                for key, value in selected['secondary_observations'].items()}}
            post = selected.get('post_checkpoint_observation')
            if post and post.get('terminal_utc') and instant(post['terminal_utc']) > instant(args.as_of or stamp()):
                selected['post_checkpoint_observation'] = {'status': 'pending'}
        return {'episode': row, 'outcome': selected,
            'reviews': [r for r in read(target / 'reviews.json', {'reviews': []})['reviews'] if r['episode_id'] == row['id']]}
    if args.action in ('review', 'lesson'):
        if args.read_only:
            raise ValueError('Read-only learning cannot append reviews or lessons')
        if not args.input or len(args.input) != 1:
            raise ValueError('Review/lesson needs one --input JSON file')
        payload = json.loads(Path(args.input[0]).read_text(encoding='utf-8-sig'))
        return (reviews.append_review if args.action == 'review' else reviews.append_lesson)(journal_path, payload)
    if args.action == 'report':
        cutoff = args.as_of or stamp()
        # Historical exports cannot reveal a later measured overdue interval.
        bounded = []
        for result in recorded:
            post = result.get('post_checkpoint_observation')
            if post and post.get('terminal_utc') and instant(post['terminal_utc']) > instant(cutoff):
                result = {**result, 'post_checkpoint_observation': {'status': 'pending'}}
            bounded.append(result)
        report = {'as_of_utc': cutoff, 'scope': args.scope, 'from_jakarta': args.from_date,
            'to_jakarta': args.to_date, 'protocols': read(target / 'protocols.json', {}),
            **reports.summary(rows, bounded)}
        if args.output:
            output = Path(args.output)
            output.mkdir(parents=True, exist_ok=True)
            write(output / 'evaluation.json', report)
            (output / 'evaluation.md').write_text(reports.markdown(report), encoding='utf-8')
            if report['cases']:
                with (output / 'cases.csv').open('w', newline='', encoding='utf-8') as stream:
                    writer = csv.DictWriter(stream, fieldnames=list(report['cases'][0]))
                    writer.writeheader()
                    writer.writerows(report['cases'])
        return {**{k: v for k, v in report.items() if k != 'cases'},
            'output': str(args.output) if args.output else None, 'case_preview': report['cases'][-args.limit:]}
    if args.action == 'sync':
        return receipt
    raise ValueError('Unknown learning action')
