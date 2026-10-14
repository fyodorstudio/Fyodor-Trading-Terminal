import json
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest import TestCase
from unittest.mock import patch
from datetime import datetime, timezone
from types import SimpleNamespace

from fastapi import HTTPException
from storage.external_sources import ExternalRequest, append_external, archive_external, external_history, external_snapshot
from storage.app import create_app


class ExternalSourcesTests(TestCase):
    def setUp(self):
        self.temporary = TemporaryDirectory()
        self.directory = Path(self.temporary.name) / 'external-sources'

    def tearDown(self):
        self.temporary.cleanup()

    def request(self, **overrides):
        data = dict(key='treasury-20260819-buybacks', title='Treasury long-end buybacks', currencies=['USD'],
                    kind='headline', status='confirmed', facts='Treasury announced larger liquidity-support operations.',
                    event_at='2026-08-19T12:33:00Z', published_utc='2026-08-19T12:53:00Z',
                    time_note='Provider clock differs from the public-page publication.',
                    sources=[dict(kind='web', label='Treasury', locator='https://home.treasury.gov/news/press-releases/sb0607')])
        data.update(overrides)
        return ExternalRequest(**data)

    def test_append_conflicts_history_and_archive_preserve_original(self):
        first = append_external(self.request(), self.directory)
        original = Path(first['path']).read_bytes()
        with self.assertRaises(ValueError):
            append_external(self.request(facts='Stale overwrite attempt'), self.directory)
        second = append_external(self.request(expected_version=first['id'], facts='Sourced correction'), self.directory)
        with self.assertRaises(ValueError):
            archive_external(first['key'], first['id'], self.directory)
        archived = archive_external(first['key'], second['id'], self.directory)
        self.assertEqual(external_snapshot(self.directory)['items'], [])
        self.assertTrue(external_snapshot(self.directory, visibility='archived')['items'][0]['archived'])
        restored = archive_external(first['key'], archived['id'], self.directory, restore=True)
        self.assertEqual(external_snapshot(self.directory)['items'][0]['id'], restored['id'])
        self.assertEqual(len(external_history(first['key'], self.directory)), 4)
        self.assertEqual(Path(first['path']).read_bytes(), original)
        self.assertEqual(external_snapshot(self.directory)['items'][0]['version_count'], 4)

    def test_scope_dates_watch_paging_revision_and_empty_store(self):
        self.assertEqual(external_snapshot(self.directory)['matches'], 0)
        append_external(self.request(), self.directory)
        append_external(self.request(key='policy-watch', kind='watch', event_at=None, published_utc=None,
                                     currencies=['EUR', 'GBP'], status='unverified'), self.directory)
        append_external(self.request(key='date-only', kind='scheduled', event_at=None, event_date='2026-08-27',
                                     published_utc=None, currencies=['EUR']), self.directory)
        full = external_snapshot(self.directory, scope='EURUSD', limit=1)
        self.assertEqual(full['matches'], 3)
        self.assertEqual(full['next_offset'], 1)
        self.assertTrue(external_snapshot(self.directory, scope='EURUSD', after_revision=full['revision'])['unchanged'])
        self.assertEqual(external_snapshot(self.directory, scope='JPY')['items'], [])
        selected = external_snapshot(self.directory, scope='EURUSD', from_date='2026-08-19', to_date='2026-08-19')['items']
        self.assertEqual({entry['key'] for entry in selected}, {'treasury-20260819-buybacks', 'policy-watch'})
        self.assertEqual(external_snapshot(self.directory, match='treasury-20260819')['matches'], 1)
        for query in ({'scope': 'USDUSD'}, {'scope': 'XYZ'}, {'offset': -1}, {'from_date': '2026-08-20', 'to_date': '2026-08-19'}):
            with self.assertRaises(ValueError):
                external_snapshot(self.directory, **query)

    def test_invalid_timing_sources_and_blank_facts(self):
        for changes in (
            {'event_at': '2026-08-19T12:33:00'}, {'published_utc': '2099-01-01T00:00:00Z'},
            {'event_date': '2026-08-19'}, {'kind': 'watch'}, {'kind': 'scheduled', 'event_at': None},
            {'currencies': ['USD', 'USD']}, {'currencies': ['XYZ']}, {'facts': '  '},
            {'sources': [dict(kind='web', label='Unsafe', locator='javascript:alert(1)')]},
        ):
            with self.assertRaises(ValueError):
                self.request(**changes)
        with self.assertRaises(ValueError):
            external_history('../calendar', self.directory)

    def test_failed_atomic_write_and_corrupt_history_do_not_silently_disappear(self):
        first = append_external(self.request(), self.directory)
        with patch('storage.external_sources.os.replace', side_effect=OSError('Write failed')):
            with self.assertRaises(OSError):
                append_external(self.request(expected_version=first['id']), self.directory)
        self.assertEqual(len(external_history(first['key'], self.directory)), 1)
        self.assertEqual(list(self.directory.glob('*.tmp')), [])
        item = json.loads(Path(first['path']).read_text())
        item['id'] = 'f' * 32
        Path(first['path']).write_text(json.dumps(item))
        with self.assertRaises(ValueError):
            external_snapshot(self.directory)

    def test_api_uses_independent_directory_without_calendar_or_broker_ids(self):
        app = create_app(run_collector=False, external_directory=self.directory)
        endpoint = lambda path: next(route.endpoint for route in app.routes if getattr(route, 'path', '') == path)
        # GET and POST share a path; select explicitly by method.
        save = next(route.endpoint for route in app.routes if getattr(route, 'path', '') == '/api/v1/external-sources' and 'POST' in route.methods)
        saved = save(self.request())
        read = next(route.endpoint for route in app.routes if getattr(route, 'path', '') == '/api/v1/external-sources' and 'GET' in route.methods)
        self.assertEqual(read(None, 'active', 'all', 100, 0)['items'][0]['id'], saved['id'])
        self.assertEqual(endpoint('/api/v1/external-sources/{key}')(saved['key'])['items'][0]['id'], saved['id'])
        with self.assertRaises(HTTPException):
            archive_external('missing', 'a' * 32, self.directory)

    def test_tied_wall_clocks_follow_correction_chain_not_uuid_sort(self):
        with patch('storage.external_sources.datetime') as clock, patch('storage.external_sources.uuid4') as identity:
            clock.now.return_value = datetime(2026, 10, 13, 12, tzinfo=timezone.utc)
            identity.side_effect = [SimpleNamespace(hex='f'*32), SimpleNamespace(hex='a'*32), SimpleNamespace(hex='0'*32)]
            first = append_external(self.request(), self.directory)
            second = append_external(self.request(expected_version=first['id'], facts='Latest correction'), self.directory)
            self.assertEqual(external_snapshot(self.directory)['items'][0]['facts'], 'Latest correction')
            with self.assertRaises(ValueError):
                archive_external(first['key'], first['id'], self.directory)
            archive_external(first['key'], second['id'], self.directory)
        self.assertEqual(external_snapshot(self.directory)['items'], [])
        self.assertEqual([item['id'] for item in external_history(first['key'], self.directory)], ['f'*32, 'a'*32, '0'*32])
