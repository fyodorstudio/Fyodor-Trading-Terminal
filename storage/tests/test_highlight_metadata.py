import asyncio
from datetime import datetime, timezone
from unittest import TestCase
from unittest.mock import patch
from fastapi import HTTPException

import test_research_reports as fixtures
from test_research_reports import event
from storage.highlights import HighlightRequest, pin_release, highlight_snapshot, archive_pin
from storage.highlight_metadata import PromptRequest, append_prompt, read_prompts, LimitationRequest, append_limitation, limitations_snapshot
from storage.app import create_app


class HighlightMetadataTests(TestCase):
    setUp = fixtures.ResearchReportsTests.setUp
    tearDown = fixtures.ResearchReportsTests.tearDown
    add = fixtures.ResearchReportsTests.add

    def test_same_clock_resolution_is_not_reopened_by_uuid_order(self):
        from types import SimpleNamespace
        opened = self.limitation(checked_utc='2026-10-23T00:00:00Z')
        resolved = self.limitation(checked_utc='2026-10-23T00:00:00Z', status='resolved')
        with patch('storage.highlight_metadata.datetime') as clock, patch('storage.highlight_metadata.uuid4', side_effect=[SimpleNamespace(hex='f'*32), SimpleNamespace(hex='a'*32)]):
            clock.now.return_value = datetime(2026, 10, 24, 19, 0, tzinfo=timezone.utc)
            clock.fromisoformat.side_effect = datetime.fromisoformat
            append_limitation('Elev8-Demo2', opened, self.directory/'highlights.json')
            append_limitation('Elev8-Demo2', resolved, self.directory/'highlights.json')
        self.assertEqual(limitations_snapshot('Elev8-Demo2', self.directory/'highlights.json')['items'][0]['status'], 'resolved')

    def pin(self):
        self.add([event('one',currency='USD')])
        self.path = self.directory/'highlights.json'
        return pin_release(self.store,HighlightRequest(source_id='Elev8-Demo2',currency='USD',label='CPI',family_id='us-cpi',value_ids=['one']),self.path)['id']

    def limitation(self, **overrides):
        data=dict(key='cpi-clock',currency='USD',kind='schedule-mismatch',title='CPI time needs verification',
            description='The stored hour differs from the official schedule.',action='Verify the official time before measuring candles.',
            checked_utc=datetime.now(timezone.utc),sources=[{'kind':'web','label':'BLS','locator':'https://www.bls.gov/schedule/'}],
            official_schedule='12:30 UTC',stored_schedule='13:30 UTC')
        data.update(overrides)
        return LimitationRequest(**data)

    def test_prompt_only_save_preserves_journal_calendar_and_pin_file(self):
        identity=self.pin()
        before=self.path.read_bytes()
        snapshot=highlight_snapshot(self.store,'Elev8-Demo2',self.path)
        revision=self.store.db.execute('SELECT value FROM data_revision WHERE id=1').fetchone()[0]
        first=append_prompt(identity,'Elev8-Demo2',PromptRequest(scope='EURUSD',prepare_prompt='Prepare CPI scenarios.',release_prompt='Verify actual CPI.'),self.path)
        second=append_prompt(identity,'Elev8-Demo2',PromptRequest(scope='EURUSD',prepare_prompt='Refresh CPI expectations.',release_prompt='Compare actuals with the saved expectations.'),self.path)
        self.assertEqual([item['id'] for item in read_prompts(identity,self.path)],[first['id'],second['id']])
        updated=highlight_snapshot(self.store,'Elev8-Demo2',self.path,after_revision=snapshot['revision'])
        self.assertNotIn('unchanged',updated)
        self.assertEqual(updated['items'][0]['journal'],[],'Crafting prompts does not impersonate macro research')
        self.assertEqual(self.path.read_bytes(),before)
        self.assertEqual(self.store.db.execute('SELECT value FROM data_revision WHERE id=1').fetchone()[0],revision)
        with self.assertRaises(ValueError):
            append_prompt(identity,'Elev8-Demo2',PromptRequest(scope='AUDJPY',prepare_prompt='Prepare.',release_prompt='Interpret.'),self.path)
        with self.assertRaises(HTTPException):
            append_prompt(identity,'OtherBroker',PromptRequest(scope='EURUSD',prepare_prompt='Prepare.',release_prompt='Interpret.'),self.path)
        archive_pin(identity,'Elev8-Demo2',self.path,self.store)
        self.assertEqual(len(highlight_snapshot(self.store,'Elev8-Demo2',self.path,visibility='archived')['items'][0]['prompts']),2)

    def test_limitations_keep_versions_isolate_brokers_and_invalidate_revision(self):
        append_limitation('Elev8-Demo2',self.limitation(),self.directory/'highlights.json')
        first=limitations_snapshot('Elev8-Demo2',self.directory/'highlights.json')
        self.assertEqual(first['items'][0]['status'],'open')
        self.assertTrue(limitations_snapshot('Elev8-Demo2',self.directory/'highlights.json',first['revision'])['unchanged'])
        append_limitation('Elev8-Demo2',self.limitation(status='resolved',description='Publisher corrected the schedule.'),self.directory/'highlights.json')
        append_limitation('OtherBroker',self.limitation(key='other-clock'),self.directory/'highlights.json')
        updated=limitations_snapshot('Elev8-Demo2',self.directory/'highlights.json',first['revision'])
        self.assertEqual(len(updated['items']),1)
        self.assertEqual(updated['items'][0]['status'],'resolved')
        self.assertNotEqual(updated['revision'],first['revision'])
        self.assertEqual(len(list((self.directory/'limitations').glob('*.json'))),3)
        with patch('storage.highlight_metadata.os.replace',side_effect=OSError('disk full')),self.assertRaises(OSError):
            append_limitation('Elev8-Demo2',self.limitation(key='new-clock'),self.directory/'highlights.json')
        self.assertEqual(limitations_snapshot('Elev8-Demo2',self.directory/'highlights.json')['revision'],updated['revision'])
        self.assertFalse(list((self.directory/'limitations').glob('*.tmp')))

    def test_real_limits_api_is_read_only_and_revision_aware(self):
        import json
        target=self.directory/'highlights.json'
        append_limitation('Elev8-Demo2',self.limitation(),target)
        app=create_app(self.directory/'data',run_collector=False,highlights_path=target)
        async def request(method,query=b''):
            messages=[]
            async def receive(): return {'type':'http.request','body':b'','more_body':False}
            async def send(message): messages.append(message)
            route='/api/v1/highlight-limitations'
            await app({'type':'http','http_version':'1.1','method':method,'scheme':'http','path':route,'raw_path':route.encode(),
                'query_string':query,'headers':[], 'client':('127.0.0.1',1),'server':('127.0.0.1',8002)},receive,send)
            return messages[0]['status'],json.loads(messages[1]['body'])
        status,data=asyncio.run(request('GET',b'source_id=Elev8-Demo2'))
        self.assertEqual(status,200)
        self.assertEqual(len(data['items']),1)
        status,same=asyncio.run(request('GET',f"source_id=Elev8-Demo2&after_revision={data['revision']}".encode()))
        self.assertEqual(status,200); self.assertTrue(same['unchanged'])
        self.assertEqual(asyncio.run(request('POST',b'source_id=Elev8-Demo2'))[0],405)
