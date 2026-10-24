import json
from datetime import datetime, timezone
from unittest import TestCase
from unittest.mock import patch

import test_research_reports as fixtures
from test_research_reports import event, START, DAY
from storage.highlights import HighlightRequest, pin_release, archive_pin, highlight_snapshot, read_pins
from storage.highlight_journal import JournalRequest, append_journal, read_journal
from storage.data_lock import data_lock


class JournalTests(TestCase):
    setUp = fixtures.ResearchReportsTests.setUp
    tearDown = fixtures.ResearchReportsTests.tearDown
    add = fixtures.ResearchReportsTests.add

    def test_equal_wall_clocks_preserve_append_order_without_invented_times(self):
        from types import SimpleNamespace
        identity = self.seed()
        actual_clock = datetime(2026, 10, 24, 19, 0, tzinfo=timezone.utc)
        with patch('storage.highlight_journal.datetime') as clock, patch('storage.highlight_journal.uuid4', side_effect=[SimpleNamespace(hex='f'*32), SimpleNamespace(hex='a'*32)]):
            clock.now.return_value = actual_clock
            clock.fromisoformat.side_effect = datetime.fromisoformat
            first = append_journal(self.store, identity, 'Elev8-Demo2', self.research(), self.path)
            second = append_journal(self.store, identity, 'Elev8-Demo2', self.research(phase='after'), self.path)
        entries = read_journal(identity, self.path)
        self.assertEqual([item['id'] for item in entries], [first['id'], second['id']])
        self.assertEqual(entries[0]['saved_utc'], entries[1]['saved_utc'])

    def test_upcoming_family_index_covers_full_source_inventory(self):
        from test_analyst_tools import analyst
        from upcoming import family_index
        index = family_index(analyst.ROOT)
        catalog = analyst.ROOT/'frontend/src/economic-calendar/catalog/source-events.json'
        for event in json.loads(catalog.read_text(encoding='utf-8')):
            self.assertIn((event['country'],event['currency'],event['id']),index)
        self.assertEqual(index[('AU','AUD','36010006')]['id'],'au-labor')
        self.assertEqual(index[('US','USD','840030006')]['id'],'us-cpi')

    def seed(self):
        self.add([event('one', currency='USD', country_code='US', event_id='840030005', actual=None, actual_raw_scaled_1e6=None)])
        self.path = self.directory/'highlights.json'
        self.request = HighlightRequest(source_id='Elev8-Demo2', currency='USD', label='US CPI', family_id='us-cpi',
            value_ids=['one'], event_ids=['840030005'])
        return pin_release(self.store, self.request, self.path)['id']

    def research(self, **overrides):
        body = dict(phase='before', scope='EURUSD', as_of_utc='2026-09-01T00:00:00Z',
            body='Rates may remain higher.\n\nAssess the complete package.', direction='Mixed/no clear edge', confidence='Low',
            counterevidence='Employment weakness.', sources=[{'kind':'web','label':'Official CPI','locator':'https://www.bls.gov/cpi/'}],
            expectations=[{'provider':'Broker, provider unknown','as_of_utc':'2026-09-01T00:00:00Z','values':'Monthly CPI 0.4%'}],
            release_prompt='Verify CPI and the EUR backdrop; keep price separate.')
        body.update(overrides)
        return JournalRequest(**body)

    def test_versions_preserve_readings_and_do_not_touch_calendar_or_pins(self):
        identity = self.seed()
        before = self.path.read_bytes()
        revision = self.store.db.execute('SELECT value FROM data_revision WHERE id=1').fetchone()[0]
        first = append_journal(self.store, identity, 'Elev8-Demo2', self.research(), self.path)
        self.assertEqual(self.path.read_bytes(), before)
        self.assertEqual(self.store.db.execute('SELECT value FROM data_revision WHERE id=1').fetchone()[0], revision)
        snapshot = highlight_snapshot(self.store, 'Elev8-Demo2', self.path)
        self.add([event('one',currency='USD',country_code='US',event_id='840030005',actual=.5,actual_raw_scaled_1e6='500000',revision=1)])
        second = append_journal(self.store, identity, 'Elev8-Demo2', self.research(phase='after',direction='USD supportive',price_reaction='Initial decline reversed'), self.path)
        correction = append_journal(self.store, identity, 'Elev8-Demo2', self.research(correction_of=first['id'],body='Corrected reasoning.'), self.path)
        entries = read_journal(identity, self.path)
        self.assertEqual([item['id'] for item in entries], [first['id'], second['id'], correction['id']])
        self.assertIsNone(entries[0]['readings'][0]['actual'])
        self.assertEqual(entries[1]['readings'][0]['actual'], .5)
        self.assertEqual(entries[0]['body'], self.research().body)
        updated = highlight_snapshot(self.store,'Elev8-Demo2',self.path,after_revision=snapshot['revision'])
        self.assertNotIn('unchanged',updated)
        self.assertEqual(len(updated['items'][0]['journal']),3)
        self.assertEqual(self.path.read_bytes(),before)

    def test_legacy_migration_archive_freeze_and_restore(self):
        identity = self.seed()
        legacy = read_pins(self.path)
        for item in legacy:
            item.pop('archived_utc'); item.pop('archived_snapshot')
        self.path.write_text(json.dumps({'version':1,'pins':legacy}),encoding='utf-8')
        old = self.path.read_bytes()
        self.assertEqual(highlight_snapshot(self.store,'Elev8-Demo2',self.path)['items'][0]['id'], identity)
        self.assertEqual(self.path.read_bytes(),old,'Reading legacy pins never migrates them')
        saved = append_journal(self.store,identity,'Elev8-Demo2',self.research(),self.path)
        archive_pin(identity,'Elev8-Demo2',self.path,self.store)
        self.assertEqual(highlight_snapshot(self.store,'Elev8-Demo2',self.path)['items'],[])
        archived = highlight_snapshot(self.store,'Elev8-Demo2',self.path,visibility='archived')['items'][0]
        self.assertEqual(archived['journal'][0]['id'],saved['id'])
        self.add([event('one',currency='USD',country_code='US',event_id='840030005',at=START+30*DAY,actual=.9,actual_raw_scaled_1e6='900000',revision=2)])
        frozen = highlight_snapshot(self.store,'Elev8-Demo2',self.path,visibility='archived')['items'][0]
        self.assertEqual(frozen['events'],archived['events'])
        archive_pin(identity,'Elev8-Demo2',self.path,self.store,restore=True)
        live = highlight_snapshot(self.store,'Elev8-Demo2',self.path)['items'][0]
        self.assertEqual(live['id'],identity)
        self.assertEqual(live['events'][0]['actual'],.9)
        self.assertEqual(live['journal'][0]['readings'],archived['journal'][0]['readings'])
        archive_pin(identity,'Elev8-Demo2',self.path,self.store)
        self.assertEqual(pin_release(self.store,self.request,self.path)['id'],identity,'Re-pin restores the same occurrence')

    def test_invalid_scope_source_correction_and_atomic_failure_preserve_history(self):
        identity = self.seed()
        saved = append_journal(self.store,identity,'Elev8-Demo2',self.research(),self.path)
        with self.assertRaises(ValueError):
            append_journal(self.store,identity,'Elev8-Demo2',self.research(scope='AUDJPY'),self.path)
        with self.assertRaises(ValueError):
            append_journal(self.store,identity,'Elev8-Demo2',self.research(correction_of='f'*32),self.path)
        with self.assertRaises(ValueError):
            self.research(sources=[{'kind':'web','label':'Bad','locator':'javascript:alert(1)'}])
        with patch('storage.highlight_journal.os.replace',side_effect=OSError('disk full')), self.assertRaises(OSError):
            append_journal(self.store,identity,'Elev8-Demo2',self.research(),self.path)
        from types import SimpleNamespace
        with patch('storage.highlight_journal.uuid4',return_value=SimpleNamespace(hex=saved['id'])), self.assertRaises(ValueError):
            append_journal(self.store,identity,'Elev8-Demo2',self.research(),self.path)
        self.assertEqual([item['id'] for item in read_journal(identity,self.path)],[saved['id']])
        self.assertFalse(list((self.directory/'journal'/identity).glob('*.tmp')))
        before = self.path.read_bytes()
        with data_lock(self.directory), self.assertRaises(ValueError):
            archive_pin(identity,'Elev8-Demo2',self.path,self.store)
        self.assertEqual(self.path.read_bytes(),before,'Cross-process writer conflict never loses pins')

    def test_offline_cli_append_and_grouped_upcoming(self):
        identity = self.seed()
        from test_analyst_tools import analyst
        import upcoming
        payload = self.directory/'entry.json'
        payload.write_text(self.research().model_dump_json(),encoding='utf-8')
        database = str(self.directory/'data/calendar.sqlite3')
        snapshot = analyst.highlight_snapshot
        with patch.object(analyst,'ROOT',self.directory.resolve()), \
             patch.object(analyst,'highlight_snapshot',side_effect=lambda store,broker,**kwargs: snapshot(store,broker,self.path,**kwargs)), \
             patch.object(analyst,'append_journal',side_effect=lambda store,identity,broker,request: append_journal(store,identity,broker,request,self.path)), \
             patch.object(analyst,'read_journal',side_effect=lambda identity: read_journal(identity,self.path)):
            saved = analyst.run(analyst.parser().parse_args(['journal','append',identity,'--broker','Elev8-Demo2','--input',str(payload),'--database',database]))
            read = analyst.run(analyst.parser().parse_args(['journal','read',identity,'--broker','Elev8-Demo2','--database',database]))
        self.assertEqual(read['items'][0]['id'],saved['id'])
        root = analyst.ROOT
        self.add([event('core',currency='USD',country_code='US',event_id='840030006'),
            event('future',currency='USD',country_code='US',event_id='840030005',at=START+30*DAY)])
        args = analyst.parser().parse_args(['upcoming','--broker','Elev8-Demo2','--scope','USD','--as-of',
            datetime.fromtimestamp(START-DAY,timezone.utc).isoformat(),'--days','40','--family','us-cpi','--limit','1'])
        with patch.object(upcoming,'highlight_snapshot',side_effect=lambda store,broker,**kwargs: snapshot(store,broker,self.path,**kwargs)):
            result = upcoming.upcoming_snapshot(self.store,args,root,timezone.utc)
            args.offset = 1
            next_page = upcoming.upcoming_snapshot(self.store,args,root,timezone.utc)
        self.assertEqual(result['matches'],2)
        self.assertEqual(len(result['items'][0]['value_ids']),2,'Headline/core form one occurrence')
        self.assertEqual(result['items'][0]['highlights'][0]['id'],identity)
        self.assertEqual(result['next_offset'],1)
        self.assertEqual(next_page['items'][0]['prior_investigations'][0]['highlight_id'],identity)
