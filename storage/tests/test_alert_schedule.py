import json
import asyncio
import os
from copy import deepcopy
from datetime import datetime, timezone
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest import TestCase
from unittest.mock import patch

from storage.alert_calendar import day_snapshot
from storage.alert_subscriptions import calendar_subscription, load_selected_schedule
from storage.alarms import AlarmEngine
from storage.calendar_store import CalendarStore
from storage.app import create_app
from storage.alarm_service import create_alarm_app
from test_calendar_storage import event


class AlertScheduleTests(TestCase):
    def setUp(self):
        self.temp = TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.database = Path(self.temp.name) / 'calendar.sqlite3'
        self.store = CalendarStore(self.database)
        self.addCleanup(self.store.close)
        self.now = datetime(2026, 10, 22, 16, tzinfo=timezone.utc).timestamp()
        self.at = int(self.now + 7200) * 1000
        self.manifest = {'calendar_from_timestamp': '1420070400', 'calendar_to_timestamp': '1800000000', 'calendar_currencies': 'USD,EUR,GBP,JPY,CHF,CAD,AUD,NZD',
            'snapshot_trade_server_timestamp': str(int(self.now + 10800)), 'snapshot_gmt_timestamp': str(int(self.now))}
        self.rows = [event(value_id=str(i), event_id=str(840030004 + i), currency='USD', country_code='US',
            name=f'CPI {i}', server_time_seconds=int(self.at / 1000 + 10800), actual=None, forecast=.2) for i in (1, 2)]
        for source in ('Elev8-Demo2', 'Pepperstone-Demo'):
            self.store.import_rows(f'seed-{source}', source, self.manifest, {}, self.rows)

    def test_jakarta_date_edges_date_only_and_no_chart_clock_or_mutation(self):
        edge = datetime(2026, 10, 22, 17, tzinfo=timezone.utc).timestamp()
        extra = [event(value_id=str(10 + i), currency='USD', country_code='US', server_time_seconds=int(at + 10800))
                 for i, at in enumerate((edge - 1, edge, edge + 86400 - 1, edge + 86400))]
        extra.append(event(value_id='20', time_mode=1, currency='USD', country_code='US',
            server_time_seconds=int(datetime(2026, 10, 23, tzinfo=timezone.utc).timestamp())))
        self.store.import_rows('edges', 'Pepperstone-Demo', self.manifest, {}, extra)
        # An incomplete/unknown chart profile must not affect publication-day
        # membership. Pepperstone itself now has a verified native profile.
        self.store.db.execute("UPDATE event_timing SET chart_time_seconds=NULL,profile=NULL WHERE source_id='Pepperstone-Demo'")
        self.store.db.commit()
        count = self.store.db.execute('SELECT count(*) FROM observations').fetchone()[0]
        statements = []
        self.store.db.set_trace_callback(statements.append)
        day = day_snapshot(self.store, 'Pepperstone-Demo', '2026-10-23')
        self.store.db.set_trace_callback(None)
        event_reads = [sql for sql in statements if 'SELECT e.*' in sql]
        self.assertEqual(len(event_reads), 1, 'A date fetch performs one bounded event read')
        plan = ' '.join(row[3] for row in self.store.db.execute('EXPLAIN QUERY PLAN ' + event_reads[0]))
        self.assertIn('events_range', plan)
        self.assertIn('server_time>?', plan, 'Full broker history is not scanned on each poll')
        ids = {r['value_id'] for r in day['events']}
        self.assertTrue({'1', '2', '11', '12', '20'} <= ids)
        self.assertFalse({'10', '13'} & ids, 'Jakarta midnight, not server midnight, defines timed membership')
        self.assertTrue(all(r['chart_time_seconds'] is None for r in day['events']))
        self.assertEqual(self.store.db.execute('SELECT count(*) FROM observations').fetchone()[0], count)
        unchanged = day_snapshot(self.store, 'Pepperstone-Demo', '2026-10-23', day['revision'])
        self.assertTrue(unchanged['unchanged'])
        self.assertNotIn('events', unchanged)
        with self.assertRaises(ValueError):
            day_snapshot(self.store, 'Pepperstone-Demo', '2026-02-30')

    def test_calendar_selection_validates_identity_and_is_default_off(self):
        key, subscription = calendar_subscription(self.store, 'Pepperstone-Demo', ['1', '2'], 'US CPI', True)
        self.assertTrue(key.startswith('calendar:Pepperstone-Demo:'))
        for broker, ids in [('Elev8-Demo2', ['1']), ('Pepperstone-Demo', ['999']), ('Pepperstone-Demo', ['text'])]:
            with self.assertRaises(ValueError):
                calendar_subscription(self.store, broker, ids, 'CPI', True)
        engine = AlarmEngine(Path(self.temp.name) / 'state.json', lambda jobs: None, lambda: self.now)
        candidate = {'key': key, 'reference': key, 'source': 'calendar', 'broker': 'Pepperstone-Demo', 'title': 'US CPI',
            'currencies': ['USD'], 'at': self.at, 'date': None, 'eligible': True, 'default_enabled': False, 'note': '', 'value_ids': ['1', '2']}
        engine.reconcile([candidate])
        self.assertFalse(engine.snapshot()['events'][0]['selected'])
        self.assertFalse(engine.state['jobs'])
        engine.mutate({'expected_revision': engine.state['revision'], 'action': 'subscribe', 'key': key, 'subscription': subscription, 'event': candidate})
        self.assertTrue(engine.snapshot()['events'][0]['selected'])
        self.assertEqual(sum(j['status'] == 'pending' for j in engine.state['jobs'].values()), 1)
        engine.mutate({'expected_revision': engine.state['revision'], 'action': 'settings', 'settings': {'enabled': False, 'release_minutes': 2}})
        self.assertTrue(engine.snapshot()['events'][0]['selected'], 'Global pause does not erase the choice')
        self.assertFalse(engine.snapshot()['events'][0]['armed'])
        restored = AlarmEngine(engine.path, lambda jobs: None, lambda: self.now)
        self.assertEqual(restored.state['calendar_subscriptions'][key], subscription)

    def test_exact_migration_preserves_off_choices_and_reports_missing_matches(self):
        legacy = [dict(key='old-on', reference='pin', source='highlight', broker='Elev8-Demo2', title='CPI', currencies=['USD'],
            at=self.at, date=None, eligible=True, note='', value_ids=['1']),
            dict(key='old-off', reference='pin2', source='highlight', broker='Elev8-Demo2', title='Core CPI', currencies=['USD'],
            at=self.at, date=None, eligible=True, note='', value_ids=['2']),
            dict(key='unmatched', reference='pin3', source='highlight', broker='Elev8-Demo2', title='Missing', currencies=['USD'],
            at=self.at, date=None, eligible=True, note='', value_ids=['999'])]
        engine = AlarmEngine(Path(self.temp.name) / 'state.json', lambda jobs: None, lambda: self.now)
        engine.state['overrides']['old-off'] = False
        with patch('storage.alarms.read_events', return_value=legacy), patch('storage.external_sources.external_snapshot', return_value={'items': [], 'next_offset': None}):
            loaded = load_selected_schedule(self.database, engine)
            self.assertEqual(len(loaded), 2)
            self.assertTrue(all(item['broker'] == 'Pepperstone-Demo' for item in loaded))
            engine.reconcile(loaded)
            self.assertEqual(sum(item['selected'] for item in engine.snapshot()['events']), 1)
            self.assertEqual(len(engine.state['migration']['matches']), 2)
            self.assertEqual(len(engine.state['migration']['issues']), 1)
            before = deepcopy(engine.state)
            load_selected_schedule(self.database, engine)
            self.assertEqual(engine.state, before, 'Migration is idempotent and preserves its receipt')
            self.assertEqual(json.loads(engine.path.read_text())['selection_version'], 2)

    def test_schedule_change_and_atomic_failure_never_drop_or_partially_arm_choices(self):
        engine = AlarmEngine(Path(self.temp.name) / 'state.json', lambda jobs: None, lambda: self.now)
        engine.state.update(selection_version=2, calendar_subscriptions={})
        key, subscription = calendar_subscription(self.store, 'Pepperstone-Demo', ['1', '2'], 'CPI', True)
        engine.state['calendar_subscriptions'][key] = subscription
        with patch('storage.external_sources.external_snapshot', return_value={'items': [], 'next_offset': None}):
            loaded = load_selected_schedule(self.database, engine)
        engine.reconcile(loaded)
        before = deepcopy(engine.state)
        with patch.object(engine, 'save', side_effect=OSError('disk full')):
            with self.assertRaises(OSError):
                engine.mutate({'action': 'toggle-many', 'expected_revision': engine.state['revision'], 'keys': [key], 'enabled': False})
        self.assertEqual(engine.state, before)
        self.assertTrue(engine.snapshot()['events'][0]['selected'])

    def test_real_date_and_subscription_api_validate_and_preserve_raw_data(self):
        async def request(app, path, query=b'', body=None):
            sent, received = [], False
            async def receive():
                nonlocal received
                if received:
                    await asyncio.sleep(60)
                received = True
                return {'type': 'http.request', 'body': json.dumps(body).encode() if body is not None else b'', 'more_body': False}
            async def send(message): sent.append(message)
            await app({'type': 'http', 'http_version': '1.1', 'method': 'POST' if body is not None else 'GET', 'scheme': 'http',
                'path': path, 'raw_path': path.encode(), 'query_string': query, 'headers': [(b'content-type', b'application/json')],
                'client': ('127.0.0.1', 1), 'server': ('127.0.0.1', 8003), 'asgi': {'version': '3.0', 'spec_version': '2.4'}}, receive, send)
            return sent[0]['status'], json.loads(b''.join(m.get('body', b'') for m in sent[1:]))
        async def run():
            app = create_app(Path(self.temp.name), run_collector=False)
            async with app.router.lifespan_context(app):
                status, day = await request(app, '/api/v1/alert-calendar', b'source_id=Pepperstone-Demo&date=2026-10-23')
                self.assertEqual(status, 200)
                self.assertEqual({r['value_id'] for r in day['events']}, {'1', '2'})
                self.assertEqual((await request(app, '/api/v1/alert-calendar', b'source_id=Pepperstone-Demo&date=2026-02-30'))[0], 422)
            with patch.dict(os.environ, {'FYODOR_STORAGE_DATA_DIR': self.temp.name}):
                worker = create_alarm_app(Path(self.temp.name) / 'api-alarms', loader=lambda: [], notify=lambda jobs: None, clock=lambda: self.now)
            async with worker.router.lifespan_context(worker):
                await asyncio.sleep(.02)
                _, snapshot = await request(worker, '/alarms')
                action = {'action': 'subscribe', 'broker': 'Pepperstone-Demo', 'value_ids': ['1', '2'], 'title': 'CPI',
                    'enabled': True, 'expected_revision': snapshot['revision'], 'event': {'at': 1, 'eligible': True}}
                status, saved = await request(worker, '/alarms', body=action)
                self.assertEqual(status, 200)
                self.assertEqual(saved['events'][0]['at'], self.at, 'Client-supplied clocks and eligibility are ignored')
                self.assertEqual(len(saved['jobs']), 1, 'The component package gets one reminder')
                self.assertEqual((await request(worker, '/alarms', body=action))[0], 409, 'Stale optimistic writes cannot replace a choice')
                action.update(broker='Elev8-Demo2', expected_revision=saved['revision'])
                self.assertEqual((await request(worker, '/alarms', body=action))[0], 409)
            self.assertEqual(self.store.values('Pepperstone-Demo', ['1'])[0]['forecast'], .2)
        asyncio.run(run())
