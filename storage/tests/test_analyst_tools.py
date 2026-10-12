import importlib.util
from datetime import datetime, timezone
import json
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch

TOOLS = Path(__file__).resolve().parents[2] / 'Market Analyst Workflow/tools'
sys.path.insert(0, str(TOOLS))
spec = importlib.util.spec_from_file_location('analyst_data', TOOLS / 'market_data.py')
analyst = importlib.util.module_from_spec(spec)
spec.loader.exec_module(analyst)
from ohlc import candle_utc, fetch_window, instant, read_saved, summarize
import test_research_reports as reports
from test_research_reports import event, START, DAY


class AnalystReportsTests(unittest.TestCase):
    def test_legacy_escaped_names_filtering_and_visible_pagination(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'legacy.md'
            row = '| 2026-09-11T12:30:00Z | USD | US | Core CPI \\| monthly | 2026-08-01 | high | 0.3% | 0.2% | 0.2% | — | +0.1 pp | +0.1 pp | 0 | 123 | 456 | 2026-10-01T00:00:00Z | export-snapshot | observed |\n'
            path.write_text('# Test\n\nQuestion\n\n## Selected interval\n' + row * 2 + '## Preceding context\n' + row, encoding='utf-8')
            brief, rows = analyst.load_report(path)
            self.assertEqual(brief, '# Test\n\nQuestion\n\n')
            self.assertEqual(rows[0]['name'], 'Core CPI | monthly')
            args = analyst.parser().parse_args(['report','latest','--match','CPI','--currency','USD','--limit','1'])
            result = analyst.select_rows(rows,args)
            self.assertEqual(result['matches'],2)
            self.assertEqual(result['next_offset'],1)
            args.offset = 1
            self.assertIsNone(analyst.select_rows(rows,args)['next_offset'])
            args.section = 'context'
            self.assertEqual(analyst.select_rows(rows,args)['matches'],1)


class AnalystCalendarTests(unittest.TestCase):
    setUp = reports.ResearchReportsTests.setUp
    tearDown = reports.ResearchReportsTests.tearDown
    add = reports.ResearchReportsTests.add
    def test_readonly_calendar_context_and_export_do_not_change_database(self):
        self.add([event('current',name='CPI',currency='USD'),event('prior',at=START-DAY,name='CPI',currency='USD'),event('new',name='Unknown type')])
        before = self.store.db.execute('SELECT value FROM data_revision WHERE id=1').fetchone()[0]
        args = analyst.parser().parse_args(['calendar','--broker','Elev8-Demo2','--scope','EURUSD',
            '--from','2026-09-09','--to','2026-09-10','--context-days','30','--section','context','--match','CPI',
            '--database',str(self.directory / 'data/calendar.sqlite3')])
        with patch.object(analyst,'ROOT',self.directory.resolve()):
            result = analyst.run(args)
        self.assertEqual(result['matches'],1)
        self.assertEqual(result['items'][0]['value_id'],'prior')
        args.export = True
        args.section = 'selected'
        original = analyst.save_report
        with patch.object(analyst,'ROOT',self.directory.resolve()), patch.object(analyst,'save_report',
            side_effect=lambda store, payload: original(store,payload,self.directory / 'report')):
            result = analyst.run(args)
        self.assertEqual(result['matches'],1)
        _, rows = analyst.load_report(Path(result['saved']['path']))
        self.assertEqual({row['value_id'] for row in rows},{'current','prior','new'},'A focused response must not constrain the saved evidence')
        self.assertEqual(self.store.db.execute('SELECT value FROM data_revision WHERE id=1').fetchone()[0],before)


class AnalystOhlcTests(unittest.TestCase):
    def setUp(self):
        self.event = instant('2026-09-11T12:30:00Z')
        start = instant('2026-08-01T00:00:00Z')
        self.bars = [{'time':start+i*60+10800,'open':1+i*.000001,'high':1+i*.000001+.00001,
            'low':1+i*.000001-.00001,'close':1+i*.000001,'tick_volume':50} for i in range(72000)]
        self.calls = []

    def get(self, route):
        from urllib.parse import parse_qs
        if route == 'health':
            return {'mt5':{'connected':True,'account_server':'Elev8-Demo2','generation':7}}
        params = parse_qs(route.split('?')[1]); position=int(params['start_pos'][0]); count=int(params['count'][0])
        self.calls.append((position,count))
        end = max(0,len(self.bars)-position)
        return {'symbol':'EURUSD','timeframe':'M1','start_pos':position,'source_generation':7,
            'bars':self.bars[max(0,end-count):end],'has_older':end>count}

    def test_binary_seek_and_complete_reaction_windows(self):
        result = fetch_window(self.get,'EURUSD','EURUSD','M1','2026-09-11T11:30:00Z','2026-09-11T15:00:00Z')
        self.assertEqual(len(result['bars']),210)
        self.assertLess(len(self.calls),32)
        self.assertEqual(sum(count==5000 for _,count in self.calls),1,'Seeking does not dump intervening month history')
        output = summarize(result,'2026-09-11T12:30:00Z')
        self.assertEqual(output['gap_count'],0)
        self.assertTrue(all(output['requested_edges_present'].values()))
        self.assertEqual(output['reactions'][0]['net_pips'],0)
        self.assertEqual(output['reactions'][-1]['net_pips'],1.2)
        self.assertNotIn('bars',output['reactions'][0])

    def test_missing_minutes_coarse_timeframes_and_jpy_pip_size(self):
        data={'pair':'USDJPY','timeframe':'M1','captured_utc':'2026-09-11T16:00:00Z','bars':[{'utc_time':self.event+(i-1)*60,
            'open':150,'high':150.02,'low':149.99,'close':150 if i==0 else 150.02} for i in range(122)]}
        output=summarize(data,'2026-09-11T12:30:00Z')
        self.assertEqual(output['reactions'][0]['net_pips'],2)
        data['bars']=[row for row in data['bars'] if row['utc_time']!=self.event+120]
        output=summarize(data,'2026-09-11T12:30:00Z')
        self.assertEqual(output['gap_count'],1)
        self.assertFalse(output['reactions'][1]['available'])
        data['timeframe']='H1'
        self.assertIn('reaction_unavailable',summarize(data,'2026-09-11T12:30:00Z'))

    def test_forming_candles_are_not_reported_as_completed_reactions(self):
        data={'pair':'EURUSD','timeframe':'M1','captured_utc':'2026-09-11T12:30:30Z',
            'bars':[{'utc_time':self.event-60,'open':1,'high':1,'low':1,'close':1},
                {'utc_time':self.event,'open':1,'high':1.01,'low':1,'close':1.01}]}
        output=summarize(data,'2026-09-11T12:30:00Z')
        self.assertFalse(output['last_bar_complete_at_capture'])
        self.assertFalse(output['reactions'][0]['available'])

    def test_clock_boundaries_unknown_brokers_generation_and_limits(self):
        self.assertEqual(candle_utc(self.event+10800,'Elev8-Demo2'),self.event)
        with self.assertRaises(ValueError):
            candle_utc(instant('2026-10-25T03:30:00Z'),'Elev8-Demo2')
        with self.assertRaises(ValueError):
            candle_utc(self.event,'OtherBroker')
        self.assertEqual(candle_utc(self.event+7200,'OtherBroker',7200),self.event)
        with self.assertRaises(ValueError):
            instant('2026-09-11T12:30:00')
        with self.assertRaisesRegex(ValueError,'bound reached'):
            fetch_window(self.get,'EURUSD','EURUSD','M1','2026-09-11T11:30:00Z','2026-09-11T15:00:00Z',max_requests=2)
        def changed(route):
            result=self.get(route)
            if route!='health':result['source_generation']=8
            return result
        with self.assertRaisesRegex(ValueError,'source changed'):
            fetch_window(changed,'EURUSD','EURUSD','M1','2026-09-11T11:30:00Z','2026-09-11T15:00:00Z')

    def test_saved_capture_can_be_reused_without_network(self):
        with tempfile.TemporaryDirectory() as directory:
            path=Path(directory)/'evidence.json'
            path.write_text(json.dumps({'symbol':'EURUSD','timeframe':'M1','observed_at':123000,
                'bars':[{'utc_time':self.event,'open':1,'high':1,'low':1,'close':1}]}))
            data=read_saved(path)
            self.assertEqual(data['pair'],'EURUSD')
            self.assertIn('1970',data['captured_utc'])


if __name__=='__main__':
    unittest.main()
