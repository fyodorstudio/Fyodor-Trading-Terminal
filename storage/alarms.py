"""Durable, occurrence-specific reminders. No calendar/research writes or AI execution."""
from datetime import datetime, timezone, timedelta
import hashlib
from copy import deepcopy
import json
import os
from pathlib import Path
import tempfile
from threading import RLock
import time

from .calendar_store import CalendarStore
from .highlights import HIGHLIGHTS_PATH, highlight_snapshot
from .external_sources import DIRECTORY, external_snapshot

JAKARTA = timezone(timedelta(hours=7))
DEFAULT_SETTINGS = {'enabled': True, 'release_minutes': 2}


def read_events(database, highlights=HIGHLIGHTS_PATH, external=DIRECTORY):
    store = CalendarStore(Path(database), readonly=True)
    try:
        pins = highlight_snapshot(store, path=highlights)['items']
    finally:
        store.close()
    result = []
    for pin in pins:
        # Preserve separate decision/statement/conference stages. Never guess an hour.
        observed = [e for e in pin['events'] if e.get('availability') == 'observed']
        times = sorted({e['release_at'] for e in observed if e['time_mode'] == 0 and e['release_at'] is not None})
        source_date = datetime.fromtimestamp(pin['server_time'], timezone.utc).date().isoformat() if pin['server_time'] else None
        for stage_index, at in enumerate(times or [None]):
            result.append({'key': f"highlight:{pin['source_id']}:{pin['id']}:{stage_index}", 'reference': pin['id'],
                'source': 'highlight', 'broker': pin['source_id'], 'title': pin['label'], 'currencies': [pin['currency']],
                'at': at, 'date': source_date if at is None else None, 'eligible': at is not None and not pin['missing_value_ids'],
                'note': 'Pinned calendar occurrence. Stored schedule; confirm the official time during preparation.'})
    offset = 0
    while True:
        page = external_snapshot(external, limit=500, offset=offset)
        for item in page['items']:
            at = datetime.fromisoformat(item['event_at'].replace('Z', '+00:00')).timestamp() * 1000 if item['event_at'] else None
            result.append({'key': f"external:{item['key']}", 'reference': item['key'], 'source': 'external', 'broker': None,
                'title': item['title'], 'currencies': item['currencies'], 'at': at, 'date': item['event_date'],
                'eligible': at is not None and item['kind'] == 'scheduled' and item['status'] == 'confirmed',
                'note': item['time_note']})
        if page['next_offset'] is None:
            break
        offset = page['next_offset']
    return result


def prompt_for(event, stage):
    at = datetime.fromtimestamp(event['at'] / 1000, JAKARTA).strftime('%b %d, %Y %I:%M %p') if event['at'] else event['date'] or 'time unconfirmed'
    skill = 'assess-trade-now' if stage == 'prepare' else 'one-minute-before-release'
    identity = f"Highlight {event['reference']}, broker {event['broker']}" if event['source'] == 'highlight' else f"External Source {event['reference']}"
    return f"${skill} {event['title']} — {at} (Asia/Jakarta). {identity}. Focus on {', '.join(event['currencies'])} and the best-supported pair."


class AlarmEngine:
    def __init__(self, path, notify, clock=time.time):
        self.path, self.notify, self.clock = Path(path), notify, clock
        self.lock = RLock()
        self.events, self.error, self.refreshed_at = [], 'Schedule not loaded', None
        self.state = {'version': 1, 'revision': 0, 'settings': dict(DEFAULT_SETTINGS), 'overrides': {}, 'jobs': {}}
        if self.path.exists():
            data = json.loads(self.path.read_text(encoding='utf-8'))
            if data.get('version') != 1 or not isinstance(data.get('jobs'), dict) or not isinstance(data.get('overrides'), dict):
                raise ValueError('Invalid alarm state; preserve the file and restore a valid copy')
            self.state = data
            # Retire the old two-reminder schedule without losing pin choices or history.
            if 'prepare_minutes' in self.state['settings']:
                self.state['settings'] = {'enabled': self.state['settings']['enabled'], 'release_minutes': 2}
            self.validate_settings(self.state['settings'])
            for job in self.state['jobs'].values():
                if job['stage'] == 'prepare' and job['status'] in ('pending', 'snoozed', 'ringing'):
                    job.update(status='cancelled', error=None)
                elif job['status'] == 'ringing':
                    job.update(status='interrupted', error='Alarm worker restarted while this reminder was ringing')
            self.save()

    @staticmethod
    def validate_settings(settings):
        if set(settings) != set(DEFAULT_SETTINGS) or type(settings['enabled']) is not bool:
            raise ValueError('Invalid alarm settings')
        if type(settings['release_minutes']) is not int or not 1 <= settings['release_minutes'] <= 120:
            raise ValueError('Reminder offsets must be 1–120 minutes')

    def save(self):
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.state['revision'] += 1
        name = None
        try:
            with tempfile.NamedTemporaryFile(mode='w', encoding='utf-8', dir=self.path.parent, delete=False) as output:
                name = output.name
                json.dump(self.state, output, ensure_ascii=False, separators=(',', ':'))
                output.flush(); os.fsync(output.fileno())
            os.replace(name, self.path)
        finally:
            if name:
                Path(name).unlink(missing_ok=True)

    def enabled(self, event):
        return event['eligible'] and self.state['settings']['enabled'] and self.state['overrides'].get(event['key'], True)

    def reconcile(self, events, persist=True):
        with self.lock:
            previous = deepcopy(self.state)
            now, valid, changed = self.clock(), set(), False
            self.events, self.error, self.refreshed_at = events, None, self.clock()
            for event in events:
                if not self.enabled(event):
                    continue
                for stage, minutes in [('release', self.state['settings']['release_minutes'])]:
                    due = event['at'] / 1000 - minutes * 60
                    if due < now - 30 * 86400:
                        continue
                    identity = hashlib.sha256(f"{event['key']}:{event['at']}:{stage}:{minutes}".encode()).hexdigest()[:32]
                    valid.add(identity)
                    job = self.state['jobs'].get(identity)
                    if job is None:
                        self.state['jobs'][identity] = {'id': identity, 'event_key': event['key'], 'title': event['title'],
                            'at': event['at'], 'due': due, 'stage': stage, 'prompt': prompt_for(event, stage),
                            'status': 'pending' if due >= now else 'elapsed', 'error': None}
                        changed = True
                    else:
                        title, prompt = event['title'], prompt_for(event, stage)
                        if job['title'] != title or job['prompt'] != prompt:
                            job.update(title=title, prompt=prompt); changed = True
                        if job['status'] == 'cancelled' and due > now:
                            job.update(status='pending', error=None); changed = True
            for identity, job in self.state['jobs'].items():
                if identity not in valid and job['status'] in ('pending', 'snoozed', 'ringing'):
                    job['status'] = 'cancelled'; changed = True
            # Retain recent delivery history, without unbounded growth across years.
            expired = [key for key, job in self.state['jobs'].items() if job['due'] < now - 30 * 86400]
            for key in expired:
                del self.state['jobs'][key]; changed = True
            if changed and persist:
                try:
                    self.save()
                except OSError:
                    self.state = previous
                    raise

    def tick(self):
        with self.lock:
            # A stale/unreadable schedule must not fire superseded reminders.
            if self.error or not self.state['settings']['enabled'] or self.refreshed_at is None or self.clock() - self.refreshed_at > 15:
                return
            previous = deepcopy(self.state)
            now, groups, changed = self.clock(), {}, False
            for job in self.state['jobs'].values():
                due = job.get('snooze_until', job['due']) if job['status'] == 'snoozed' else job['due']
                if job['status'] not in ('pending', 'snoozed') or due > now:
                    continue
                if now - due > 90 or job['at'] / 1000 <= now:
                    job['status'] = 'missed'; changed = True; continue
                job.update(status='ringing', fired_at=now, error=None); changed = True
                groups.setdefault((job['at'], job['stage']), []).append(dict(job))
            if changed:
                try:
                    self.save()  # Claim durably before delivery; restarting never rings it twice.
                except OSError:
                    self.state = previous
                    raise
            for jobs in groups.values():
                try:
                    self.notify(jobs)
                except Exception as error:
                    for job in jobs:
                        self.state['jobs'][job['id']].update(status='failed', error=str(error))
                    self.save()

    def snapshot(self):
        with self.lock:
            jobs = sorted(self.state['jobs'].values(), key=lambda job: job.get('fired_at', job['due']), reverse=True)
            return {'application': 'fyodor-alarms', 'revision': self.state['revision'], 'now': self.clock() * 1000,
                'settings': dict(self.state['settings']), 'schedule_error': self.error or ('Alarm scheduler heartbeat is stale' if self.refreshed_at is None or self.clock() - self.refreshed_at > 15 else None), 'refreshed_at': self.refreshed_at,
                'native_available': os.name == 'nt',
                'events': [{**e, 'armed': self.enabled(e), 'prompt': prompt_for(e, 'release')} for e in self.events],
                'jobs': [dict(job) for job in jobs]}

    def mutate(self, request):
        with self.lock:
            previous = deepcopy(self.state)
            try:
                return self._mutate(request)
            except Exception:
                self.state = previous
                raise

    def _mutate(self, request):
        with self.lock:
            if request.get('expected_revision') != self.state['revision']:
                raise ValueError('Alarm settings changed. Refresh and try again.')
            action = request.get('action')
            if action == 'settings':
                self.validate_settings(request.get('settings', {}))
                self.state['settings'] = dict(request['settings'])
            elif action == 'toggle':
                event = next((e for e in self.events if e['key'] == request.get('key')), None)
                if not event or not event['eligible'] or type(request.get('enabled')) is not bool:
                    raise ValueError('This event has no verified, alarm-eligible time')
                self.state['overrides'][event['key']] = request['enabled']
            elif action in ('dismiss', 'snooze'):
                ids = request.get('ids')
                if not isinstance(ids, list) or not ids or len(ids) > 500 or any(identity not in self.state['jobs'] for identity in ids):
                    raise ValueError('Unknown reminder')
                now = self.clock()
                for identity in ids:
                    job = self.state['jobs'][identity]
                    if action == 'snooze' and (job['status'] != 'ringing' or now + 300 >= job['at'] / 1000):
                        raise ValueError('Five-minute snooze would reach the release; dismiss or prepare now')
                for identity in ids:
                    self.state['jobs'][identity].update(status='dismissed' if action == 'dismiss' else 'snoozed', snooze_until=now + 300)
            else:
                raise ValueError('Unknown alarm action')
            # Reconciliation and settings are one durable update, not two partial saves.
            self.reconcile(self.events, persist=False)
            self.save()
            return self.snapshot()
