import json
from datetime import datetime, timezone
from unittest import TestCase
from unittest.mock import patch

import test_research_reports as fixtures
from test_research_reports import event
from storage.app import create_app
from storage.external_sources import ExternalRequest, append_external, archive_external
from storage.highlights import HighlightRequest, pin_release, archive_pin
from storage.thesis import ThesisRequest, ThesisPlan, append_thesis, read_theses, thesis_snapshot, highlighted_stages, PATH


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

    def stages(self, scope='NZDCHF', source_id='Elev8-Demo2'):
        return highlighted_stages(self.store, scope, source_id, self.pins, self.external)

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

    def test_explicit_stage_save_preserves_raw_data_and_history(self):
        self.paths(); identity = self.seed_pin()
        stages = self.stages()
        self.assertEqual(len(stages), 2)
        self.assertEqual([row['stage'] for row in stages], ['Decision', 'Press conference'])
        self.assertEqual(self.stages(source_id='OtherBroker'), [])
        self.assertEqual(self.stages(scope='EURUSD'), [])
        before = self.pins.read_bytes()
        revision = self.store.status()['revision']
        target = self.stages()[0]['target']
        with self.assertRaises(ValueError):
            self.request(target=target, as_of_utc='2026-07-08T01:59:00Z')
        saved = self.save(target=target, as_of_utc='2026-07-08T02:05:00Z', title='RBNZ decision')
        updated = self.snapshot()
        self.assertNotIn('pending', updated)
        self.assertEqual(updated['past'][0]['row_id'], saved['row_id'])
        with self.assertRaises(ValueError):
            self.save(target=target)
        self.save(target=target, expected_version=saved['id'], thesis='Updated guidance.')
        self.assertEqual(len(self.snapshot()['past']), 1)
        self.assertEqual(self.pins.read_bytes(), before)
        self.assertEqual(self.store.status()['revision'], revision)
        archive_pin(identity, 'Elev8-Demo2', self.pins, self.store)
        self.assertEqual(len(self.snapshot()['past']), 1)

    def test_rescheduled_target_rejected_and_unknown_hour_preserved(self):
        self.paths(); self.seed_pin()
        target = self.stages()[0]['target']
        at = int(datetime(2026, 7, 9, 2, tzinfo=timezone.utc).timestamp())
        self.add([event('one', at=at, currency='NZD', country_code='NZ', name='Rescheduled decision', revision=1)])
        with self.assertRaises(ValueError):
            self.save(target=target)
        self.add([event('one', at=at, currency='NZD', country_code='NZ', time_mode=1, revision=2)])
        row = next(row for row in self.stages() if row['target']['event_date'])
        self.assertIsNone(row['target']['event_at'])
        self.assertEqual(row['date'], '2026-07-09')
        # Tentative series metadata can retain time_mode=3 after a numerical
        # publication. Reuse the storage clock contract for its verified clock.
        self.add([event('one', at=at, currency='NZD', country_code='NZ', time_mode=3, revision=3)])
        row = next(row for row in self.stages() if row['stage'] != 'Press conference')
        self.assertIsNotNone(row['target']['event_at'])
        self.assertIsNone(row['target']['event_date'])

    def test_optional_external_link_preserved_without_pending_reads(self):
        self.paths()
        source = dict(kind='web', label='Official', locator='https://www.snb.ch/')
        record = ExternalRequest(key='swiss-stage', title='Swiss date-only release', currencies=['CHF'], kind='scheduled',
            status='confirmed', event_date='2026-07-20', facts='Scheduled release', time_note='Hour unknown', sources=[source])
        saved = append_external(record, self.external)
        target = self.stages(source_id=None)[0]['target']
        self.assertEqual(target['event_date'], '2026-07-20')
        self.assertIsNone(target['event_at'])
        self.save(target=target, as_of_utc='2026-07-20T06:00:00Z')
        archive_external(record.key, saved['id'], self.external)
        self.assertEqual(len(self.snapshot()['past']), 1)
        with patch('storage.thesis.highlighted_stages', side_effect=AssertionError('Thesis reads must not query pins')):
            snapshot = self.snapshot(source_id=None)
        self.assertNotIn('pending', snapshot)
        self.assertEqual(len(snapshot['past']), 1)

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

    def test_deleted_pair_records_preserve_shared_currency_research(self):
        from storage.thesis_reviews import read_reviews
        from storage.thesis_research import research_snapshot
        self.assertEqual(read_theses(PATH), [])
        reviews = read_reviews(PATH)
        self.assertEqual(len(reviews), 40)
        self.assertEqual(sum(bool(r['currency_views']) for r in reviews), 39)
        self.assertTrue(all(not r['opportunity_ids'] for r in reviews))
        self.assertTrue(any(view.get('news') for r in reviews for view in r['currency_views']))
        data = research_snapshot(PATH, '2026-10-01', '2026-10-29')
        self.assertEqual({a['currency'] for a in data['assessments']}, {'USD', 'EUR', 'GBP', 'JPY', 'CHF', 'CAD', 'AUD', 'NZD'})
        self.assertTrue(data['developments'])

    def test_change_comparison_is_immutable_pair_specific_and_earlier(self):
        self.paths()
        first = self.save(change='Baseline', change_reason='Starting case.')
        prior_raw = json.loads(self.path.read_text(encoding='utf-8'))['entries'][0]
        self.save(as_of_utc='2026-07-16T01:00:00Z', change='Weakened', change_reason='Fresh contrary evidence; no opposite case.', compared_with=first['id'])
        row = self.snapshot()['past'][0]
        self.assertEqual(row['verdict'], 'BUY')
        self.assertEqual(row['change'], 'Weakened')
        self.assertEqual(row['comparison']['id'], first['id'])
        self.assertEqual(json.loads(self.path.read_text(encoding='utf-8'))['entries'][0], prior_raw)
        mixed = self.save(as_of_utc='2026-07-16T12:00:00Z', verdict='MIXED', change='Weakened',
                          change_reason='The buy case loses its edge.', compared_with=first['id'])
        with self.assertRaises(ValueError):
            self.save(as_of_utc='2026-07-17T00:00:00Z', change='Strengthened',
                      change_reason='Must compare with a directional case.', compared_with=mixed['id'])
        for changes in [dict(change='Strengthened'), dict(change='Baseline', compared_with=first['id']),
                        dict(change='Weakened', compared_with='f'*32),
                        dict(change='Weakened', compared_with=first['id'], as_of_utc='2026-07-14T00:00:00Z'),
                        dict(change='Weakened', compared_with=first['id'], scope='EURUSD'),
                        dict(change='Weakened', compared_with=first['id'], verdict='SELL'),
                        dict(change='Reversed', compared_with=first['id'])]:
            with self.assertRaises(ValueError):
                self.save(**{**dict(as_of_utc='2026-07-17T00:00:00Z', change_reason='Evidence.'), **changes})
        reversal = self.save(as_of_utc='2026-07-17T00:00:00Z', verdict='SELL', change='Reversed', compared_with=first['id'], change_reason='Opposite mechanism established.')
        self.assertEqual(self.snapshot()['past'][0]['id'], reversal['id'])

    def test_planning_days_are_separate_and_replaced_only_by_saved_assessments(self):
        self.paths(); self.save()
        journal_before = self.path.read_bytes()
        plan = {'version': 1, 'checked_utc': '2026-10-17T00:00:00Z', 'days': [
            {'scope': 'NZDCHF', 'date': '2026-07-15', 'events': []},
            {'scope': 'NZDCHF', 'date': '2026-07-16', 'events': []},
            {'scope': 'EURCHF', 'date': '2026-07-17', 'events': []}]}
        plan_path = self.path.with_name('plan.json')
        plan_path.write_text(json.dumps(plan), encoding='utf-8')
        view = self.snapshot()
        self.assertEqual([row['date'] for row in view['planned']], ['2026-07-16'])
        self.assertNotIn('verdict', view['planned'][0])
        self.assertEqual(journal_before, self.path.read_bytes())
        plan['days'][1]['events'] = [{'title': 'Release', 'at': None,
            'sources': [{'kind': 'web', 'label': 'Official', 'locator': 'https://www.rbnz.govt.nz/'}]}]
        plan_path.write_text(json.dumps(plan), encoding='utf-8')
        self.assertNotEqual(view['revision'], self.snapshot()['revision'])
        self.save(as_of_utc='2026-07-15T18:00:00Z')  # July 16 Jakarta
        self.assertEqual(self.snapshot()['planned'], [])
        self.assertEqual(len(self.snapshot()['past']), 2)
        self.assertEqual(json.loads(plan_path.read_text(encoding='utf-8')), plan)
        bad = json.loads(json.dumps(plan))
        bad['days'][1]['events'][0]['at'] = '2026-07-17T00:00:00Z'
        with self.assertRaises(ValueError):
            ThesisPlan(**bad)
        bad['days'][1]['events'][0]['at'] = '2026-07-16T00:00:00'
        with self.assertRaises(ValueError):
            ThesisPlan(**bad)
        bad['days'][1]['events'][0]['at'] = None
        bad['days'][1]['verdict'] = 'SELL'
        with self.assertRaises(ValueError):
            ThesisPlan(**bad)

    def test_deleted_pair_planning_days_stay_empty(self):
        for scope, month in [('NZDCHF', '2026-10'), ('EURCHF', '2026-10'), ('NZDCHF', '2026-07')]:
            self.assertEqual(thesis_snapshot(None, scope, month)['planned'], [])

    def test_across_view_is_separate_preserves_versions_and_resolves_pair_comparisons(self):
        self.paths()
        old = self.save(change='Baseline', change_reason='Original pair case.')
        raw = self.path.read_bytes()
        across = self.save(collection='across', as_of_utc='2026-07-16T01:00:00Z',
            change='Weakened', change_reason='New contrary evidence.', compared_with=old['id'])
        second = self.save(collection='across', scope='EURCHF', as_of_utc='2026-07-16T01:00:00Z', verdict='STRONG SELL')
        view = self.snapshot(scope='ALL')
        self.assertEqual([row['scope'] for row in view['past']], ['EURCHF', 'NZDCHF'])
        self.assertEqual(view['past'][1]['comparison']['id'], old['id'])
        self.assertEqual(view['planned'], [])
        self.assertEqual([row['id'] for row in self.snapshot()['past']], [old['id']])
        self.assertEqual(json.loads(raw)['entries'], json.loads(self.path.read_bytes())['entries'][:1])
        self.save(collection='across', scope='EURCHF', row_id=second['row_id'], expected_version=second['id'], verdict='SELL')
        self.assertEqual(len(self.snapshot(scope='ALL')['past'][1]['versions']), 2)
        with self.assertRaises(ValueError):
            self.save(row_id=across['row_id'], expected_version=across['id'])
        self.assertTrue(self.snapshot(scope='ALL', after_revision=self.snapshot(scope='ALL')['revision'])['unchanged'])
        # Date grouping is based on Jakarta; this belongs in August, not July.
        self.save(collection='across', as_of_utc='2026-07-31T18:00:00Z')
        self.assertEqual(len(self.snapshot(scope='ALL', month='2026-08')['past']), 1)
        with self.assertRaises(ValueError):
            self.request(scope='ALL', collection='across')
