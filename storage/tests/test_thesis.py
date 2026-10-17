import json
from datetime import datetime, timezone
from unittest import TestCase
from unittest.mock import patch

import test_research_reports as fixtures
from test_research_reports import event
from storage.app import create_app
from storage.external_sources import ExternalRequest, append_external, archive_external
from storage.highlights import HighlightRequest, pin_release, archive_pin
from storage.thesis import ThesisRequest, append_thesis, read_theses, thesis_snapshot, PATH


class ThesisTests(TestCase):
    setUp = fixtures.ResearchReportsTests.setUp
    tearDown = fixtures.ResearchReportsTests.tearDown
    add = fixtures.ResearchReportsTests.add

    def paths(self):
        self.path = self.directory / 'thesis' / 'journal.json'
        self.pins = self.directory / 'highlights.json'
        self.external = self.directory / 'external'

    def request(self, **overrides):
        return ThesisRequest(**{**dict(scope='NZDCHF', as_of_utc='2026-07-15T06:00:00Z', title='Daily assessment',
            verdict='BUY', thesis='Rate-path support outweighs weak activity.', horizon='Intraday',
            sources=[dict(kind='web', label='Official', locator='https://www.rbnz.govt.nz/')]), **overrides})

    def save(self, **overrides):
        return append_thesis(self.store, self.request(**overrides), self.path, self.pins, self.external)

    def snapshot(self, **overrides):
        return thesis_snapshot(self.store, **{**dict(scope='NZDCHF', month='2026-07', source_id='Elev8-Demo2',
            path=self.path, pins_path=self.pins, external_directory=self.external), **overrides})

    def seed_pin(self):
        at = int(datetime(2026, 7, 8, 2, tzinfo=timezone.utc).timestamp())
        self.add([event('one', at=at, currency='NZD', country_code='NZ', name='Decision'),
                  event('two', at=at + 3600, currency='NZD', country_code='NZ', name='Press conference')])
        return pin_release(self.store, HighlightRequest(source_id='Elev8-Demo2', label='RBNZ', family_id='rbnz',
            currency='NZD', value_ids=['one', 'two'], event_ids=['987654321']), self.pins)['id']

    def test_versions_atomic_failure_conflicts_and_jakarta_month(self):
        self.paths()
        first = self.save()
        original = self.path.read_bytes()
        with self.assertRaises(ValueError):
            self.save(row_id=first['row_id'], verdict='SELL')
        with patch('storage.thesis.os.replace', side_effect=OSError('disk full')), self.assertRaises(OSError):
            self.save(row_id=first['row_id'], expected_version=first['id'], verdict='SELL')
        self.assertEqual(self.path.read_bytes(), original)
        second = self.save(row_id=first['row_id'], expected_version=first['id'], verdict='SELL', thesis='Fresh contrary evidence.')
        self.save(as_of_utc='2026-07-31T18:00:00Z', title='August Jakarta')
        snap = self.snapshot()
        self.assertEqual(len(snap['past']), 1)
        self.assertEqual(snap['past'][0]['id'], second['id'])
        self.assertEqual(snap['past'][0]['versions'][0]['thesis'], self.request().thesis)
        self.assertEqual(self.snapshot(month='2026-08')['past'][0]['title'], 'August Jakarta')
        self.assertTrue(self.snapshot(after_revision=snap['revision'])['unchanged'])
        self.assertEqual(self.snapshot(scope='EURUSD')['past'], [])
        self.assertEqual(len(read_theses(self.path)), 3)
        broken = json.loads(self.path.read_text(encoding='utf-8'))
        broken['entries'][1]['expected_version'] = None
        self.path.write_text(json.dumps(broken), encoding='utf-8')
        with self.assertRaises(ValueError):
            read_theses(self.path)

    def test_exact_stages_save_moves_only_matching_row_and_preserves_raw_data(self):
        self.paths(); identity = self.seed_pin()
        snap = self.snapshot()
        self.assertEqual(len(snap['pending']), 2)
        self.assertEqual([row['stage'] for row in snap['pending']], ['Decision', 'Press conference'])
        self.assertEqual(self.snapshot(source_id='OtherBroker')['pending'], [])
        self.assertEqual(self.snapshot(scope='EURUSD')['pending'], [])
        before = self.pins.read_bytes()
        revision = self.store.status()['revision']
        target = snap['pending'][0]['target']
        with self.assertRaises(ValueError):
            self.request(target=target, as_of_utc='2026-07-08T01:59:00Z')
        saved = self.save(target=target, as_of_utc='2026-07-08T02:05:00Z', title='RBNZ decision')
        updated = self.snapshot()
        self.assertEqual(len(updated['pending']), 1)
        self.assertEqual(updated['pending'][0]['stage'], 'Press conference')
        self.assertEqual(updated['past'][0]['row_id'], saved['row_id'])
        with self.assertRaises(ValueError):
            self.save(target=target)
        self.save(target=target, expected_version=saved['id'], thesis='Updated guidance.')
        self.assertEqual(len(self.snapshot()['past']), 1)
        self.assertEqual(self.pins.read_bytes(), before)
        self.assertEqual(self.store.status()['revision'], revision)
        archive_pin(identity, 'Elev8-Demo2', self.pins, self.store)
        self.assertEqual(self.snapshot()['pending'], [])
        self.assertEqual(len(self.snapshot()['past']), 1)

    def test_rescheduled_target_rejected_and_unknown_hour_preserved(self):
        self.paths(); self.seed_pin()
        target = self.snapshot()['pending'][0]['target']
        at = int(datetime(2026, 7, 9, 2, tzinfo=timezone.utc).timestamp())
        self.add([event('one', at=at, currency='NZD', country_code='NZ', name='Rescheduled decision', revision=1)])
        with self.assertRaises(ValueError):
            self.save(target=target)
        self.add([event('one', at=at, currency='NZD', country_code='NZ', time_mode=1, revision=2)])
        row = next(row for row in self.snapshot()['pending'] if row['target']['event_date'])
        self.assertIsNone(row['target']['event_at'])
        self.assertEqual(row['date'], '2026-07-09')
        # Tentative series metadata can retain time_mode=3 after a numerical
        # publication. Reuse the storage clock contract for its verified clock.
        self.add([event('one', at=at, currency='NZD', country_code='NZ', time_mode=3, revision=3)])
        row = next(row for row in self.snapshot()['pending'] if row['stage'] != 'Press conference')
        self.assertIsNotNone(row['target']['event_at'])
        self.assertIsNone(row['target']['event_date'])

    def test_external_pagination_source_date_and_month_boundary(self):
        self.paths()
        source = dict(kind='web', label='Official', locator='https://www.snb.ch/')
        record = ExternalRequest(key='swiss-stage', title='Swiss date-only release', currencies=['CHF'], kind='scheduled',
            status='confirmed', event_date='2026-07-20', facts='Scheduled release', time_note='Hour unknown', sources=[source])
        saved = append_external(record, self.external)
        snap = self.snapshot(source_id=None)
        target = snap['pending'][0]['target']
        self.assertEqual(target['event_date'], '2026-07-20')
        self.assertIsNone(target['event_at'])
        self.save(target=target, as_of_utc='2026-07-20T06:00:00Z')
        self.assertEqual(self.snapshot()['pending'], [])
        archive_external(record.key, saved['id'], self.external)
        self.assertEqual(len(self.snapshot()['past']), 1)
        # The first external page must not truncate the pending list. Also test
        # exact instants near UTC/Jakarta month boundaries and unassigned watches.
        pages = [dict(items=[dict(key='edge', title='July Jakarta', status='confirmed', event_at='2026-06-30T18:00:00Z', event_date=None)], next_offset=500),
                 dict(items=[dict(key='tail', title='Page two', status='reported', event_at=None, event_date='2026-07-21'),
                             dict(key='watch', title='Unscheduled', status='reported', event_at=None, event_date=None)], next_offset=None)]
        with patch('storage.thesis.external_snapshot', side_effect=pages) as query:
            rows = self.snapshot(source_id=None)['pending']
        self.assertEqual([row['title'] for row in rows], ['July Jakarta', 'Page two'])
        self.assertEqual(query.call_args_list[1].kwargs['offset'], 500)

    def test_validation_and_read_only_api(self):
        self.paths(); self.save()
        for changes in [dict(scope='NZDNZD'), dict(scope='XYZCHF'), dict(thesis=' '), dict(as_of_utc='2026-07-15T06:00:00'),
                        dict(as_of_utc='2099-01-01T00:00:00Z'), dict(provenance='reconstruction'),
                        dict(sources=[dict(kind='web', label='Unsafe', locator='javascript:alert(1)')])]:
            with self.assertRaises(ValueError):
                self.request(**changes)
        app = create_app(self.directory/'api', False, self.pins, self.external, self.path)
        app.state.store = self.store
        route = next(route for route in app.routes if getattr(route, 'path', '') == '/api/v1/theses')
        self.assertEqual(route.methods, {'GET'})
        before = self.path.read_bytes()
        data = route.endpoint('NZDCHF', '2026-07', None, None)
        self.assertEqual(data['past'][0]['scope'], 'NZDCHF')
        self.assertEqual(before, self.path.read_bytes())
        with self.assertRaises(ValueError):
            self.snapshot(month='2026-13')

    def test_committed_july_seed_contains_each_day_and_reconstruction_provenance(self):
        entries = read_theses(PATH)
        july = [entry for entry in entries if entry['scope'] == 'NZDCHF' and entry['as_of_utc'].startswith('2026-07')]
        self.assertEqual([entry['as_of_utc'][8:10] for entry in july], [f'{day:02d}' for day in range(1, 16)])
        self.assertTrue(all(entry['provenance'] == 'reconstruction' and entry['as_of_utc'][11:16] == '06:00' and entry['note'] for entry in july))
        self.assertTrue(all(entry['saved_utc'].startswith('2026-10') for entry in july))
