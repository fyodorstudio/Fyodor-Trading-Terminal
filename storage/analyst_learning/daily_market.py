"""Bounded daily price cache and read-only Thesis projection, separate from live research."""
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from pathlib import Path
import json
import subprocess
import sys
import threading
import time
from ..data_lock import data_lock
from ..market_watch_daily import DailyMarketWatch
from . import episodes
from .daily import DailyBasket, PROTOCOL, PROTOCOL_ID, SOURCE, bounds, episode_day
from .store import digest, directory, instant, read, stamp, write


class DailyExcursionMarket:
    def __init__(self, journal_path, cache_path, fetch_health=None, reader=None, clock=time.time, enabled=True):
        self.journal = Path(journal_path)
        self.cache_path = Path(cache_path)
        self.fetch_health = fetch_health or DailyMarketWatch._health
        self.reader = reader or self._read
        self.clock, self.enabled = clock, enabled
        self.lock = threading.RLock()
        self.executor = ThreadPoolExecutor(max_workers=1, thread_name_prefix='thesis-prices')
        self.future = None
        self.documents, self.checked, self.errors, self.projections, self.baskets = {}, {}, {}, {}, {}
        self.document_signatures = {}
        self.context_key, self.frozen = None, []

    @staticmethod
    def _read(identity, day):
        result = subprocess.run([sys.executable, '-m', 'storage.analyst_learning.daily_worker'],
            input=json.dumps({'identity': identity, 'day': day}), text=True, capture_output=True, timeout=25,
            cwd=Path(__file__).resolve().parents[2], creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0))
        if result.returncode:
            raise ValueError('Daily FX history unavailable from the connected terminal')
        return json.loads(result.stdout)

    def close(self):
        self.executor.shutdown(wait=False, cancel_futures=True)

    def rows(self):
        paths = [self.journal.with_name('research.json'), self.journal.with_name('reviews.json')]
        key = tuple((p.stat().st_mtime_ns, p.stat().st_size) if p.exists() else None for p in paths)
        if key != self.context_key:
            self.frozen = episodes.source_episodes(self.journal)
            self.context_key = key
            self.projections.clear()
        return episodes.windows(self.frozen, stamp(datetime.fromtimestamp(self.clock(), timezone.utc)))

    def document(self, day):
        path = self.cache_path / (day + '.json')
        signature = (path.stat().st_mtime_ns, path.stat().st_size) if path.exists() else None
        if day not in self.documents or self.document_signatures.get(day) != signature:
            doc = read(path, None)
            if doc:
                self.documents[day] = doc
                self.document_signatures[day] = signature
                self.projections.clear()
                self.baskets.clear()
        return self.documents.get(day)

    def capture(self, day):
        """One day, one native attachment, fourteen sequential rate reads, no bridge changes."""
        try:
            before = self.fetch_health()
            if not before.get('connected') or not before.get('process_running') or before.get('account_server') != SOURCE or not before.get('terminal_path'):
                raise ValueError('Connected Pepperstone terminal unavailable')
            identity = {key: before.get(key) for key in ('terminal_path', 'account_login', 'account_server', 'generation')}
            doc = self.reader(identity, day)
            if doc.get('day') != day:
                raise ValueError('Daily reader returned a different day')
            after = self.fetch_health()
            if not after.get('connected') or not after.get('process_running') or any(after.get(key) != value for key, value in identity.items()):
                raise ValueError('Source changed during daily price read')
            DailyBasket(doc, stamp(datetime.fromtimestamp(self.clock(), timezone.utc)))
            doc['source_identity_hash'] = digest(identity)
            with self.lock:
                write(self.cache_path / (day + '.json'), doc)
                self.documents[day] = doc
                path = self.cache_path / (day + '.json')
                self.document_signatures[day] = (path.stat().st_mtime_ns, path.stat().st_size)
                self.errors.pop(day, None)
                self.projections.clear()
                self.baskets.clear()
                self.checked[day] = self.clock()
            return {'day': day, 'status': 'captured'}
        except (ValueError, OSError, subprocess.TimeoutExpired) as error:
            with self.lock:
                self.errors[day], self.checked[day] = str(error), self.clock()
                self.projections.clear()
            return {'day': day, 'status': 'unavailable', 'gap': str(error)}

    def due(self, day):
        doc = self.document(day)
        if doc and instant(doc['captured_utc']).timestamp() >= bounds(day)[1]:
            missing = any(doc['opens'].get(symbol) is None or not doc['samples'].get(symbol)
                for symbol in ('EURUSD','GBPUSD','AUDUSD','NZDUSD','USDJPY','USDCHF','USDCAD'))
            if missing and datetime.fromisoformat(day).weekday() < 5:
                last = self.checked.get(day, instant(doc['captured_utc']).timestamp())
                return self.clock() - last >= 300
            return False
        return self.clock() - self.checked.get(day, float('-inf')) >= (60 if day in self.errors else 30)

    def backfill(self, rows=None, max_days=2):
        rows = rows if rows is not None else self.rows()
        days = sorted({episode_day(r) for r in rows if r.get('direction')})
        attempts = []
        for day in days:
            if len(attempts) >= max_days:
                break
            if self.due(day):
                attempts.append(self.capture(day))
        values = self.project(rows, schedule=False)
        return {'attempts': attempts, 'assessments': len(values),
            'new_versions': self.last_write_count,
            'available': sum(v['day'].get('max_pct') is not None for v in values.values())}

    def persist(self, completed):
        # Freeze completed active windows immediately, then the whole day at rollover.
        completed = [(row,result,document) for row,result,document in completed if result['phase'] == 'final'
            or result['active_window'].get('phase') == 'final' and result['active_window']['status'] in ('complete', 'partial')]
        if not completed:
            return 0
        target = directory(self.journal)
        path = target / 'daily-outcomes.json'
        with data_lock(target):
            book = read(path, {'version': 1, 'protocols': {}, 'outcomes': []})
            known = {o['id'] for o in book['outcomes']}
            added = 0
            documents = {}
            for row,result,document in completed:
                frozen = result if result['phase'] == 'final' else {'protocol_id': result['protocol_id'],
                    'broker_day': result['broker_day'], 'active_window': result['active_window']}
                identity = digest({'episode_hash': row['input_hash'], 'result': frozen})
                if identity in known:
                    continue
                # Capture provenance matters at rollover even if the final prices did
                # not change; a pre-close capture cannot reproduce a final-day state.
                if id(document) not in documents:
                    documents[id(document)] = digest(document)
                evidence_hash = documents[id(document)]
                evidence = self.cache_path / 'versions' / (evidence_hash + '.json')
                if not evidence.exists():
                    write(evidence, document)
                book['outcomes'].append(dict(id=identity, episode_id=row['id'], episode_hash=row['input_hash'],
                    currency=row['currency'], verdict=row['direction']['verdict'], intensity=row['direction'].get('intensity'),
                    recorded_utc=stamp(), price_evidence=str(evidence), price_evidence_hash=evidence_hash,
                    observation=result['active_window'], **result))
                known.add(identity)
                added += 1
            if added:
                book['protocols'][PROTOCOL_ID] = PROTOCOL
                write(path, book)
            return added

    def project(self, rows, schedule=True):
        with self.lock:
            result, needed, completed = {}, [], []
            for row in rows:
                if not row.get('direction'):
                    continue
                day = episode_day(row)
                doc = self.document(day)
                if schedule and self.enabled and self.due(day):
                    needed.append(day)
                key = (row['id'], digest({k: row.get(k) for k in ('end_utc', 'end_reason', 'window_status', 'next_delivery_utc')}),
                    doc.get('captured_utc') if doc else None, self.clock() >= bounds(day)[1])
                value = self.projections.get(key)
                if value is None:
                    if doc:
                        basket_key = (day, doc['captured_utc'], self.clock() >= bounds(day)[1])
                        if basket_key not in self.baskets:
                            self.baskets[basket_key] = DailyBasket(doc, stamp(datetime.fromtimestamp(self.clock(), timezone.utc)))
                        value = self.baskets[basket_key].assessment(row)
                        completed.append((row,value,doc))
                        if day in self.errors:
                            value = {**value, 'refresh_gap': self.errors[day]}
                    else:
                        start, end = bounds(day)
                        value = dict(protocol_id=PROTOCOL_ID, basis=PROTOCOL['basis'], source_id=SOURCE, broker_day=day,
                            day_start_utc=stamp(datetime.fromtimestamp(start, timezone.utc)), day_end_utc=stamp(datetime.fromtimestamp(end, timezone.utc)),
                            phase='final' if self.clock() >= end else 'developing', delivery_utc=row['delivered_utc'],
                            day={'status': 'unavailable', 'gap': self.errors.get(day) or 'Price history loading.'},
                            after_verdict={'status': 'unavailable'}, active_window={'status': 'unavailable'}, feedback='unresolved', eligible=False)
                    self.projections[key] = value
                result[row['id'].split(':', 1)[1]] = value
            self.last_write_count = self.persist(completed)
            if needed and (self.future is None or self.future.done()):
                self.future = self.executor.submit(self.capture, sorted(set(needed), reverse=True)[0])
            return result

    def enrich(self, snapshot, after_revision=None):
        with self.lock:
            ids = {a['id'] for a in snapshot['assessments']}
            metrics = self.project([row for row in self.rows() if row['id'].split(':', 1)[1] in ids])
            assessments = [{**a, 'excursion': metrics[a['id']]} if a['id'] in metrics else a for a in snapshot['assessments']]
            revision = digest({'research': snapshot['revision'], 'metrics': metrics})
            identity = {key: snapshot[key] for key in ('schema', 'from', 'to', 'currency') if key in snapshot}
            return {**identity, 'revision': revision, 'unchanged': True} if revision == after_revision else {**snapshot, 'revision': revision, 'assessments': assessments}
