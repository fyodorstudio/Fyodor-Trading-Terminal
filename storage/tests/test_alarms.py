import asyncio
import json
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest import TestCase
from unittest.mock import patch

from storage.alarms import AlarmEngine, read_events
from storage.alarm_service import create_alarm_app


def event(key='cpi', at=1000000, **changes):
    return {**dict(key=key, reference=key, source='external', broker=None, title=key.upper(), currencies=['USD'],
        at=at, date=None, eligible=True, note='Confirmed official schedule'), **changes}


class AlarmTests(TestCase):
    def setUp(self):
        self.temp = TemporaryDirectory()
        self.path = Path(self.temp.name) / 'alarms.json'
        self.now, self.deliveries = 300, []
        self.engine = AlarmEngine(self.path, self.deliveries.append, lambda: self.now)

    def tearDown(self):
        self.temp.cleanup()

    def action(self, **request):
        return self.engine.mutate({'expected_revision': self.engine.state['revision'], **request})

    def advance(self, at, events=None):
        self.now = at
        self.engine.reconcile(events if events is not None else self.engine.events)
        self.engine.tick()

    def test_automatic_offsets_grouping_durable_dismiss_and_no_duplicate(self):
        self.engine.reconcile([event(), event('ppi')])
        self.assertEqual(len(self.engine.state['jobs']), 2)
        self.assertEqual(sorted({j['due'] for j in self.engine.state['jobs'].values()}), [880])
        self.advance(400)
        self.assertFalse(self.deliveries, 'No preparation notification')
        self.advance(880)
        self.assertEqual(len(self.deliveries), 1)
        self.assertEqual(len(self.deliveries[0]), 2, 'Simultaneous package rings once')
        self.assertIn('$one-minute-before-release', self.deliveries[0][0]['prompt'])
        self.assertIn('Asia/Jakarta', self.deliveries[0][0]['prompt'])
        ids = [j['id'] for j in self.deliveries[0]]
        self.action(action='dismiss', ids=ids)
        restored = AlarmEngine(self.path, self.deliveries.append, lambda: self.now)
        restored.reconcile([event(), event('ppi')]); restored.tick()
        self.assertEqual(len(self.deliveries), 1)
        self.assertTrue(all(restored.state['jobs'][i]['status'] == 'dismissed' for i in ids))
        self.advance(940)
        self.assertEqual(len(self.deliveries), 1)
        self.assertIn('$one-minute-before-release', self.deliveries[-1][0]['prompt'])

    def test_rescheduling_archive_toggle_and_settings_survive_restart(self):
        self.engine.reconcile([event()])
        self.action(action='toggle', key='cpi', enabled=False)
        self.assertTrue(all(j['status'] == 'cancelled' for j in self.engine.state['jobs'].values()))
        self.engine.reconcile([event(at=1100000)])
        self.assertFalse(self.engine.snapshot()['events'][0]['armed'])
        self.action(action='toggle', key='cpi', enabled=True)
        self.assertEqual(sum(j['status'] == 'pending' for j in self.engine.state['jobs'].values()), 1)
        self.advance(400)
        self.assertFalse(self.deliveries)
        self.advance(980)
        self.assertEqual(len(self.deliveries), 1)
        self.engine.reconcile([])
        self.assertFalse(any(j['status'] in ('pending', 'ringing') for j in self.engine.state['jobs'].values()))
        self.action(action='settings', settings={'enabled': False, 'release_minutes': 3})
        restarted = AlarmEngine(self.path, self.deliveries.append, lambda: self.now)
        self.assertEqual(restarted.state['settings']['release_minutes'], 3)
        self.assertFalse(restarted.state['settings']['enabled'])

    def test_legacy_state_retires_prepare_and_preserves_history_and_pin_choices(self):
        self.engine.reconcile([event()])
        data = json.loads(self.path.read_text())
        data['settings'] = {'enabled': True, 'prepare_minutes': 10, 'release_minutes': 1}
        data['overrides'] = {'other-pin': False}
        for identity, status in [('pending', 'pending'), ('snoozed', 'snoozed'), ('ringing', 'ringing'), ('past', 'dismissed')]:
            data['jobs'][identity] = {'id': identity, 'stage': 'prepare', 'status': status, 'due': 400, 'at': 1000000, 'error': None}
        self.path.write_text(json.dumps(data))
        restarted = AlarmEngine(self.path, self.deliveries.append, lambda: self.now)
        self.assertEqual(restarted.state['settings'], {'enabled': True, 'release_minutes': 2})
        self.assertEqual(restarted.state['overrides'], {'other-pin': False})
        self.assertEqual(restarted.state['jobs']['past']['status'], 'dismissed')
        for identity in ('pending', 'snoozed', 'ringing'):
            self.assertEqual(restarted.state['jobs'][identity]['status'], 'cancelled')
        restarted.reconcile([event()])
        self.now = 880; restarted.reconcile([event()]); restarted.tick()
        self.assertEqual(len(self.deliveries), 1)
        self.assertEqual([j['stage'] for j in self.deliveries[0]], ['release'])
        reloaded = AlarmEngine(self.path, self.deliveries.append, lambda: self.now)
        reloaded.reconcile([event()]); reloaded.tick()
        self.assertEqual(len(self.deliveries), 1, 'Migration and restarts never replay the invoke alarm')

    def test_late_pin_date_only_sleep_and_schedule_failure_do_not_ring_old_news(self):
        self.engine.reconcile([event(at=200000), event('unknown', at=None, date='2026-10-15', eligible=False)])
        self.engine.tick()
        self.assertFalse(self.deliveries)
        self.assertEqual(len(self.engine.state['jobs']), 1)
        self.engine.reconcile([event()])
        self.now = 950
        self.engine.tick()
        self.assertFalse(self.deliveries, 'Stale loader heartbeat suspends delivery')
        self.engine.reconcile(self.engine.events)
        self.engine.tick()
        self.assertEqual(len(self.deliveries), 1, 'Only the still-timely last-minute alarm may ring after resume')
        self.assertEqual(self.deliveries[0][0]['stage'], 'release')
        self.engine.reconcile([event('next', at=2000000)])
        self.now = 2100; self.engine.reconcile(self.engine.events); self.engine.tick()
        self.assertEqual(len(self.deliveries), 1, 'Never ring an entry reminder after its event')

    def test_snooze_conflicts_and_native_failure_are_visible(self):
        self.action(action='settings', settings={'enabled': True, 'release_minutes': 10})
        self.engine.reconcile([event()]); self.advance(400)
        identity = self.deliveries[0][0]['id']
        self.action(action='snooze', ids=[identity])
        self.advance(700)
        self.assertEqual(len(self.deliveries), 2)
        with self.assertRaises(ValueError):
            self.engine.mutate({'expected_revision': -1, 'action': 'dismiss', 'ids': [identity]})
        self.action(action='dismiss', ids=[identity])
        self.action(action='settings', settings={'enabled': True, 'release_minutes': 2})
        self.engine.notify = lambda _: (_ for _ in ()).throw(OSError('Windows unavailable'))
        self.advance(880)
        job = next(j for j in self.engine.state['jobs'].values() if j['due'] == 880)
        self.assertEqual(job['status'], 'failed')
        self.assertIn('Windows unavailable', job['error'])
        for settings in ({'enabled': True, 'prepare_minutes': 1, 'release_minutes': 10}, {'enabled': True, 'release_minutes': True}, {'enabled': True, 'release_minutes': 0}):
            with self.assertRaises(ValueError):
                self.action(action='settings', settings=settings)

    def test_loader_stages_pagination_and_readonly_source_contract(self):
        def reading(at, identity):
            return dict(release_at=at, value_id=identity, time_mode=0, availability='observed')
        pins = [{'id': 'p', 'source_id': 'demo', 'label': 'Policy stages', 'currency': 'AUD', 'server_time': 1000,
            'missing_value_ids': [], 'events': [reading(1000000, 'a'), reading(1600000, 'b')]}]
        class Store:
            closed = False
            def close(self): self.closed = True
        store = Store()
        pages = [dict(items=[dict(key='date-only', title='Unknown hour', event_at=None, event_date='2026-10-15',
            currencies=['USD'], status='confirmed', kind='scheduled', time_note='Hour unconfirmed')], next_offset=500),
            dict(items=[], next_offset=None)]
        with patch('storage.alarms.CalendarStore', return_value=store) as constructor, patch('storage.alarms.highlight_snapshot', return_value={'items': pins}), patch('storage.alarms.external_snapshot', side_effect=pages) as external:
            items = read_events('fixture.sqlite3')
            constructor.assert_called_once_with(Path('fixture.sqlite3'), readonly=True)
            self.assertTrue(store.closed)
            self.assertEqual(len(items), 3)
            self.assertFalse(items[-1]['eligible'])
            self.assertEqual(external.call_args.kwargs['offset'], 500)
            self.assertEqual(len({i['key'] for i in items}), 3)

    def test_failed_write_never_claims_delivery_or_persists_partial_settings(self):
        self.engine.reconcile([event()])
        before = self.path.read_bytes()
        with patch.object(self.engine, 'save', side_effect=OSError('Disk full')):
            with self.assertRaises(OSError):
                self.action(action='settings', settings={'enabled': False, 'release_minutes': 1})
            self.assertTrue(self.engine.state['settings']['enabled'])
            self.assertEqual(self.engine.state['settings']['release_minutes'], 2)
            self.now = 880
            self.engine.reconcile(self.engine.events)
            with self.assertRaises(OSError):
                self.engine.tick()
            self.assertFalse(self.deliveries)
            self.assertEqual(self.path.read_bytes(), before)
            self.assertFalse(any(j['status'] == 'ringing' for j in self.engine.state['jobs'].values()))

    def test_real_api_loopback_guards_test_button_and_persistence(self):
        async def run():
            app = create_alarm_app(Path(self.temp.name) / 'api', loader=lambda: [event()], notify=self.deliveries.append, clock=lambda: self.now)
            async with app.router.lifespan_context(app):
                await asyncio.sleep(.05)
                async def request(method='GET', body=None, headers=None):
                    messages, received = [], False
                    async def receive():
                        nonlocal received
                        if received:
                            await asyncio.sleep(3600)
                        received = True
                        return {'type': 'http.request', 'body': json.dumps(body).encode() if body else b'', 'more_body': False}
                    async def send(message): messages.append(message)
                    await app({'type': 'http', 'http_version': '1.1', 'method': method, 'scheme': 'http', 'path': '/alarms', 'raw_path': b'/alarms',
                        'query_string': b'', 'headers': [(k.encode(), v.encode()) for k, v in (headers if headers is not None else {'content-type': 'application/json'}).items()],
                        'client': ('127.0.0.1', 1), 'server': ('127.0.0.1', 8003), 'asgi': {'version': '3.0', 'spec_version': '2.4'}}, receive, send)
                    return messages[0]['status'], json.loads(b''.join(m.get('body', b'') for m in messages[1:]))
                _, data = await request()
                self.assertEqual(data['application'], 'fyodor-alarms')
                denied, _ = await request('POST', {'action': 'test'}, {'origin': 'https://evil.example', 'content-type': 'application/json'})
                self.assertEqual(denied, 403)
                self.assertEqual((await request('POST', {'action': 'test'}, {}))[0], 415)
                self.assertEqual((await request('POST', {'action': 'test'}))[0], 200)
                self.assertEqual(self.deliveries[-1][0]['stage'], 'test')
                status, updated = await request('POST', {'action': 'toggle', 'key': 'cpi', 'enabled': False, 'expected_revision': data['revision']})
                self.assertEqual(status, 200)
                self.assertFalse(updated['events'][0]['armed'])
                self.assertEqual((await request(headers={'host': 'evil.example'}))[0], 403)
        asyncio.run(run())
