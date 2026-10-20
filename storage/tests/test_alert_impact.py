import asyncio
from datetime import datetime, timedelta, timezone
import json
from unittest import TestCase
from unittest.mock import patch

import test_research_reports as fixtures
from test_research_reports import event
from storage.alert_impact import ImpactRequest, append_impact, impact_snapshot
from storage.app import create_app
from storage.external_sources import ExternalRequest, append_external, archive_external
from storage.highlights import HighlightRequest, pin_release, archive_pin


class AlertImpactTests(TestCase):
    setUp = fixtures.ResearchReportsTests.setUp
    tearDown = fixtures.ResearchReportsTests.tearDown
    add = fixtures.ResearchReportsTests.add

    def target(self):
        self.add([event('one', currency='USD', importance='high')])
        self.path = self.directory / 'highlights.json'
        return pin_release(self.store, HighlightRequest(source_id='Elev8-Demo2', currency='USD', label='CPI',
                           family_id='us-cpi', value_ids=['one']), self.path)['id']

    def request(self, reference, **changes):
        return ImpactRequest(**dict(source='highlight', reference=reference, broker='Elev8-Demo2', level='low',
            reason='The final release adds little new information to the policy outlook.', as_of_utc=datetime.now(timezone.utc),
            sources=[{'kind': 'web', 'label': 'Publisher', 'locator': 'https://www.bls.gov/'}], **changes))

    def test_versions_are_separate_broker_scoped_and_survive_archive(self):
        identity = self.target()
        pin_bytes = self.path.read_bytes()
        before = self.store.db.execute('SELECT value FROM data_revision WHERE id=1').fetchone()[0]
        first = append_impact(self.request(identity), self.path)
        self.assertEqual(json.loads(json.dumps(first))['id'], first['id'], 'CLI writes must return JSON after a successful save')
        snapshot = impact_snapshot('Elev8-Demo2', self.path)
        self.assertEqual(snapshot['items'][0]['level'], 'low')
        self.assertEqual(impact_snapshot('OtherBroker', self.path)['items'], [])
        self.assertTrue(impact_snapshot('Elev8-Demo2', self.path, snapshot['revision'])['unchanged'])
        with self.assertRaises(ValueError):
            append_impact(self.request(identity), self.path)
        updated_request = self.request(identity).model_copy(update={'expected_version': first['id'], 'level': 'high'})
        second = append_impact(updated_request, self.path)
        self.assertEqual(impact_snapshot('Elev8-Demo2', self.path)['items'][0]['id'], second['id'])
        self.assertEqual(len(list((self.directory / 'alert-impact').glob('*.json'))), 2)
        self.assertEqual(self.path.read_bytes(), pin_bytes)
        self.assertEqual(self.store.db.execute('SELECT value FROM data_revision WHERE id=1').fetchone()[0], before)
        archive_pin(identity, 'Elev8-Demo2', self.path, self.store)
        self.assertEqual(impact_snapshot('Elev8-Demo2', self.path)['items'][0]['id'], second['id'])
        archive_pin(identity, 'Elev8-Demo2', self.path, self.store, restore=True)
        self.assertEqual(impact_snapshot('Elev8-Demo2', self.path)['items'][0]['id'], second['id'])
        with self.assertRaises(ValueError):
            append_impact(self.request(identity).model_copy(update={'broker': 'OtherBroker'}), self.path)

    def test_external_identity_and_atomic_failure(self):
        identity = self.target()
        outside = self.directory / 'external'
        record = append_external(ExternalRequest(key='policy-chat', title='Policy chat', currencies=['USD'], kind='watch',
            status='confirmed', facts='Publisher lists a discussion.', time_note='No exact time verified.',
            sources=[{'kind': 'web', 'label': 'Publisher', 'locator': 'https://www.bls.gov/'}]), outside)
        request = self.request(identity).model_dump()
        request.update(source='external', reference='policy-chat', broker='')
        saved = append_impact(ImpactRequest(**request), self.path, outside)
        archive_external('policy-chat', record['id'], outside)
        self.assertEqual(impact_snapshot('OtherBroker', self.path)['items'][0]['id'], saved['id'])
        request.update(expected_version=saved['id'], level='medium')
        with patch('storage.highlight_metadata.os.replace', side_effect=OSError('disk full')), self.assertRaises(OSError):
            append_impact(ImpactRequest(**request), self.path, outside)
        self.assertEqual(impact_snapshot('', self.path)['items'][0]['id'], saved['id'])
        self.assertFalse(list((self.directory / 'alert-impact').glob('*.tmp')))
        request.update(reference='missing', expected_version=None)
        with self.assertRaises(ValueError):
            append_impact(ImpactRequest(**request), self.path, outside)

    def test_validation_and_read_only_revision_api(self):
        identity = self.target()
        original = self.request(identity).model_dump()
        for changes in ({'reason': ' '}, {'level': 'automatic'}, {'as_of_utc': datetime.now()},
                        {'as_of_utc': datetime.now(timezone.utc) + timedelta(days=1)}, {'reference': '../escape'},
                        {'sources': []}, {'sources': [{'kind': 'web', 'label': 'Bad', 'locator': 'javascript:alert(1)'}]}):
            with self.assertRaises(ValueError):
                ImpactRequest(**{**original, **changes})
        self.assertEqual(impact_snapshot('Elev8-Demo2', self.path)['items'], [])
        append_impact(self.request(identity), self.path)
        app = create_app(self.directory / 'data', run_collector=False, highlights_path=self.path)
        async def request(method, query=b'source_id=Elev8-Demo2'):
            messages = []
            async def receive(): return {'type': 'http.request', 'body': b'', 'more_body': False}
            async def send(message): messages.append(message)
            route = '/api/v1/alert-impact'
            await app({'type': 'http', 'http_version': '1.1', 'method': method, 'scheme': 'http', 'path': route,
                'raw_path': route.encode(), 'query_string': query, 'headers': [], 'client': ('127.0.0.1', 1),
                'server': ('127.0.0.1', 8002)}, receive, send)
            return messages[0]['status'], json.loads(messages[1]['body'])
        status, data = asyncio.run(request('GET'))
        self.assertEqual(status, 200)
        self.assertEqual(data['items'][0]['level'], 'low')
        self.assertTrue(asyncio.run(request('GET', f"source_id=Elev8-Demo2&after_revision={data['revision']}".encode()))[1]['unchanged'])
        self.assertEqual(asyncio.run(request('POST'))[0], 405)

    def test_equal_save_clocks_follow_predecessors_and_corruption_is_not_overwritten(self):
        from types import SimpleNamespace
        identity = self.target()
        cutoff = datetime.now(timezone.utc)
        request = self.request(identity).model_copy(update={'as_of_utc': cutoff})
        with patch('storage.alert_impact.datetime') as clock, patch('storage.alert_impact.uuid4',
                side_effect=[SimpleNamespace(hex='f' * 32), SimpleNamespace(hex='0' * 32)]):
            clock.now.return_value = cutoff
            first = append_impact(request, self.path)
            second = append_impact(request.model_copy(update={'expected_version': first['id'], 'level': 'high'}), self.path)
        self.assertEqual(impact_snapshot('Elev8-Demo2', self.path)['items'][0]['id'], second['id'])
        target = self.directory / 'alert-impact' / (second['id'] + '.json')
        broken = json.loads(target.read_text())
        broken['expected_version'] = 'a' * 32
        target.write_text(json.dumps(broken))
        before = target.read_bytes()
        with self.assertRaises(ValueError):
            append_impact(request.model_copy(update={'expected_version': second['id']}), self.path)
        self.assertEqual(target.read_bytes(), before)
