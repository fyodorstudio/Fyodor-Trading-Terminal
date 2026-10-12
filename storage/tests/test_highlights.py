import asyncio
import json
from pathlib import Path
from unittest.mock import patch
from unittest import TestCase
import test_research_reports as fixtures
from test_research_reports import event, START, DAY
from storage.highlights import HighlightRequest, pin_release, delete_pin, highlight_snapshot, read_pins
from storage.app import create_app


class HighlightTests(TestCase):
    setUp = fixtures.ResearchReportsTests.setUp
    tearDown = fixtures.ResearchReportsTests.tearDown
    add = fixtures.ResearchReportsTests.add
    # Reuse the inventory fixture, without inheriting unrelated report tests.
    def seed_pin(self, **overrides):
        body = dict(source_id='Elev8-Demo2', label='US CPI / core CPI', family_id='us-cpi', currency='USD',
            value_ids=['one'], event_ids=['987654321'])
        body.update(overrides)
        return HighlightRequest(**body)

    def test_pin_survives_release_rescheduling_revision_and_restart(self):
        self.add([event('one', currency='USD', actual=None, actual_raw_scaled_1e6=None)])
        path = self.directory/'highlights.json'
        identity = pin_release(self.store, self.seed_pin(), path)['id']
        first = highlight_snapshot(self.store, 'Elev8-Demo2', path)
        self.assertEqual(first['items'][0]['events'][0]['actual'], None)
        self.assertEqual(highlight_snapshot(self.store, 'Elev8-Demo2', path, first['revision'])['unchanged'], True)
        self.add([event('one', currency='USD', at=START+60*DAY, revision=2)])
        second = highlight_snapshot(self.store, 'Elev8-Demo2', path)
        self.assertEqual(second['items'][0]['id'], identity)
        self.assertEqual(second['items'][0]['events'][0]['revision'], 2)
        self.assertEqual(second['items'][0]['events'][0]['actual_raw_scaled_1e6'], '300001')
        self.assertNotEqual(first['revision'], second['revision'])
        self.assertEqual(len(read_pins(path)), 1, 'An elapsed or moved event is never removed automatically')
        self.assertEqual(pin_release(self.store, self.seed_pin(), path)['id'], identity, 'Re-pinning is idempotent')
        self.assertEqual(highlight_snapshot(self.store, 'OtherBroker', path)['items'], [])
        delete_pin(identity, 'Elev8-Demo2', path)
        self.assertEqual(highlight_snapshot(self.store, 'Elev8-Demo2', path)['items'], [])

    def test_series_added_after_pin_and_next_month_stays_separate(self):
        self.add([event('one', currency='USD'), event('next', currency='USD', at=START+30*DAY)])
        path = self.directory/'highlights.json'
        pin_release(self.store, self.seed_pin(), path)
        self.add([event('two', currency='USD', event_id='987654322')])
        pin_release(self.store, self.seed_pin(event_ids=['987654321','987654322']), path)
        snapshot = highlight_snapshot(self.store, 'Elev8-Demo2', path)
        self.assertEqual({row['value_id'] for row in snapshot['items'][0]['events']}, {'one','two'})
        before = path.read_bytes()
        self.assertEqual(read_pins(path)[0]['value_ids'], ['one'], 'Agent queries never rewrite the pin file')
        self.assertEqual(path.read_bytes(), before)
        highlight_snapshot(self.store, 'Elev8-Demo2', path, persist_related=True)
        self.assertEqual(set(read_pins(path)[0]['value_ids']), {'one', 'two'}, 'Live Highlight binds newly discovered series')
        self.add([event('two',currency='USD',event_id='987654322',at=START+3*DAY,revision=2)])
        self.assertEqual({row['value_id'] for row in highlight_snapshot(self.store,'Elev8-Demo2',path)['items'][0]['events']}, {'one','two'})
        with self.store.lock, self.store.db:
            self.store.db.execute('INSERT INTO query_absences VALUES (?,?,?,?)', ('Elev8-Demo2','one','test',START))
        absent = highlight_snapshot(self.store, 'Elev8-Demo2', path)
        self.assertEqual(absent['items'][0]['events'][0]['availability'], 'not-returned-by-latest-query')

    def test_rescheduled_member_does_not_join_intervening_months_or_another_period(self):
        self.add([event('one',currency='USD'), event('two',currency='USD',event_id='987654322')])
        path=self.directory/'highlights.json'
        pin_release(self.store,self.seed_pin(value_ids=['one','two'],event_ids=['987654321','987654322']),path)
        self.add([event('two',currency='USD',event_id='987654322',at=START+60*DAY,revision=1),
            event('between',currency='USD',at=START+30*DAY),
            event('different-period',currency='USD',event_id='987654322',at=START+60*DAY,period_seconds=START+30*DAY)])
        result=highlight_snapshot(self.store,'Elev8-Demo2',path,persist_related=True)
        self.assertEqual({row['value_id'] for row in result['items'][0]['events']},{'one','two'})
        self.assertEqual(set(read_pins(path)[0]['value_ids']),{'one','two'})

    def test_invalid_pin_and_atomic_write_failure_preserve_existing(self):
        self.add([event('one', currency='USD')])
        path = self.directory/'highlights.json'
        pin_release(self.store, self.seed_pin(), path)
        before = path.read_bytes()
        with patch('storage.highlights.os.replace', side_effect=OSError('disk full')), self.assertRaises(OSError):
            pin_release(self.store, self.seed_pin(), path)
        self.assertEqual(path.read_bytes(), before)
        self.assertFalse(list(self.directory.glob('tmp*')))
        from fastapi import HTTPException
        with self.assertRaises(HTTPException):
            pin_release(self.store, self.seed_pin(currency='AUD'), path)
        with self.assertRaises(HTTPException):
            delete_pin(read_pins(path)[0]['id'], 'OtherBroker', path)
        self.assertEqual(path.read_bytes(), before)
        path.write_text('[]', encoding='utf-8')
        with self.assertRaises(ValueError):
            pin_release(self.store, self.seed_pin(), path)
        self.assertEqual(path.read_text(encoding='utf-8'), '[]', 'An invalid file is never overwritten')

    def test_real_asgi_api_and_offline_analyst_read_same_pins(self):
        self.add([event('one', currency='USD')])
        target = self.directory/'highlights.json'
        app = create_app(self.directory/'data', run_collector=False, highlights_path=target)
        app.state.store = self.store
        async def request(method, path, body=None, query=b''):
            messages=[]
            async def receive(): return {'type':'http.request','body':json.dumps(body).encode() if body else b'', 'more_body':False}
            async def send(message): messages.append(message)
            await app({'type':'http','http_version':'1.1','method':method,'scheme':'http','path':path,'raw_path':path.encode(),
                'query_string':query,'headers':[(b'content-type',b'application/json')], 'client':('127.0.0.1',1),'server':('127.0.0.1',8002)},receive,send)
            return messages[0]['status'], json.loads(messages[1]['body'])
        status, saved = asyncio.run(request('POST','/api/v1/highlights',self.seed_pin().model_dump()))
        self.assertEqual(status,200)
        status, snapshot = asyncio.run(request('GET','/api/v1/highlights',query=b'source_id=Elev8-Demo2'))
        self.assertEqual(status,200)
        self.assertEqual(snapshot['items'][0]['id'], saved['id'])
        from test_analyst_tools import analyst
        args=analyst.parser().parse_args(['highlights','--broker','Elev8-Demo2','--database',str(self.directory/'data/calendar.sqlite3'),'--summary'])
        original=analyst.highlight_snapshot
        with patch.object(analyst,'ROOT',self.directory.resolve()), patch.object(analyst,'highlight_snapshot',side_effect=lambda store, broker: original(store,broker,target)):
            result=analyst.run(args)
            index=analyst.run(analyst.parser().parse_args(['highlights','--database',str(self.directory/'data/calendar.sqlite3')]))
            args.highlight_id=[saved['id']]
            focused=analyst.run(args)
            args.highlight_id=['other-occurrence']
            missing=analyst.run(args)
        self.assertEqual(result['items'][0]['highlight_id'], saved['id'])
        self.assertEqual(result['items'][0]['actual'], '0.300001%')
        self.assertEqual(result['items'][0]['revision'], 0)
        self.assertIn('captured_utc',result['items'][0])
        self.assertNotIn('server_time_seconds',result['items'][0])
        self.assertEqual(focused['items'],result['items'])
        self.assertEqual(missing['items'],[])
        self.assertIsNotNone(index['items'][0]['latest_capture_utc'])
        self.assertIn(index['items'][0]['publisher_status'], ('live','offline','unavailable'))
        status,_=asyncio.run(request('DELETE','/api/v1/highlights/'+saved['id'],query=b'source_id=Elev8-Demo2'))
        self.assertEqual(status,200)
        self.assertEqual(read_pins(target)[0]['id'], saved['id'])
        self.assertIsNotNone(read_pins(target)[0]['archived_utc'])
        status, archived = asyncio.run(request('GET','/api/v1/highlights',query=b'source_id=Elev8-Demo2&visibility=archived'))
        self.assertEqual(status,200)
        self.assertEqual(archived['items'][0]['events'], snapshot['items'][0]['events'])
        status,_ = asyncio.run(request('POST','/api/v1/highlights/'+saved['id']+'/restore',query=b'source_id=Elev8-Demo2'))
        self.assertEqual(status,200)
        self.assertIsNone(read_pins(target)[0]['archived_utc'])
