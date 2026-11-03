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
from ohlc import candle_utc, fetch_window, instant, read_saved, summarize, write_evidence, capture_lock, cached_window
import test_research_reports as reports
from test_research_reports import event, START, DAY


class AnalystReportsTests(unittest.TestCase):
    def test_nested_reports_discovery_and_legacy_paths(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory).resolve()
            report_root = root / 'report'
            nested = report_root / 'CPI-20260911'
            nested.mkdir(parents=True)
            brief = nested / 'brief.md'
            brief.write_text('# CPI\n\n## Selected interval\n', encoding='utf-8')
            legacy = report_root / 'legacy.md'
            legacy.write_text('# Legacy\n\n## Selected interval\n', encoding='utf-8')
            (nested / 'analysis.md').write_text('# My analysis\nKeep my notes.', encoding='utf-8')
            (report_root / 'notes.md').write_text('# Newer notes\nNot a calendar export.', encoding='utf-8')
            with patch.object(analyst, 'ROOT', root), patch.object(analyst, 'REPORT_DIRECTORY', report_root):
                self.assertEqual(analyst.report_path('CPI-20260911'), brief)
                self.assertEqual(analyst.report_path('CPI-20260911/brief.md'), brief)
                self.assertEqual(analyst.report_path('legacy.md'), legacy)
                self.assertEqual(analyst.report_path('latest'), legacy)
                result = analyst.run(analyst.parser().parse_args(['reports']))
                self.assertEqual({row['path'] for row in result['items']}, {str(brief), str(legacy)})
                (report_root / 'other').mkdir()
                (report_root / 'other/brief.md').write_text('# Other')
                with self.assertRaisesRegex(ValueError, 'Several reports'):
                    analyst.report_path('brief.md')

    def test_legacy_folder_keeps_notes_separate_from_evidence_brief(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory).resolve()
            brief = root / 'legacy.md'
            brief.write_text('# Original export\n\n## Selected interval\n', encoding='utf-8')
            notes = root / 'analysis.md'
            notes.write_text('# Later interpretation\n', encoding='utf-8')
            with patch.object(analyst, 'ROOT', root), patch.object(analyst, 'REPORT_DIRECTORY', root):
                self.assertEqual(analyst.report_path(str(root)), brief)
                self.assertEqual(analyst.report_path('latest'), brief)
            self.assertEqual(notes.read_text(encoding='utf-8'), '# Later interpretation\n')

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


class AnalystExternalCommandsTests(unittest.TestCase):
    def test_chart_request_cli_preserves_facts_and_rejects_stale_version(self):
        from storage.external_sources import ExternalRequest, append_external, external_history, request_external_chart_icon
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            saved = append_external(ExternalRequest(key='policy-stage', title='Verified policy stage',
                currencies=['EUR'], kind='scheduled', status='confirmed', event_at='2026-10-22T12:00:00Z',
                facts='Preserve original evidence.', time_note='Official scheduled stage.',
                sources=[dict(kind='web', label='Publisher', locator='https://www.ecb.europa.eu/')]), root)
            args = analyst.parser().parse_args(['external', 'show-on-chart', '--key', 'policy-stage', '--expected-version', saved['id']])
            with patch.object(analyst, 'require_external_writable', return_value={'status': 'offline', 'can_write': True}), patch.object(analyst, 'request_external_chart_icon', side_effect=lambda key, version: request_external_chart_icon(key, version, root)):
                shown = analyst.run(args)
                self.assertNotEqual(shown['id'], saved['id'])
                history = external_history('policy-stage', root)
                self.assertEqual(len(history), 2)
                self.assertEqual(history[-1]['chart_icon_request_id'], shown['id'])
                self.assertEqual(history[-1]['facts'], history[0]['facts'])
                with self.assertRaisesRegex(ValueError, 'changed'):
                    analyst.run(args)
            args.expected_version = None
            with self.assertRaisesRegex(ValueError, 'expected-version'):
                analyst.run(args)


class AnalystOhlcTests(unittest.TestCase):
    def test_saved_window_reuse_and_capture_serialization(self):
        with tempfile.TemporaryDirectory() as directory:
            data={'pair':'EURUSD','symbol':'EURUSD','broker':'Elev8-Demo2','timeframe':'M1',
                'from_utc':'2026-09-11T12:30:00Z','to_utc':'2026-09-11T12:33:00Z','captured_utc':'2026-09-11T16:00:00Z',
                'bars':[{'utc_time':instant('2026-09-11T12:30:00Z')+i*60,'open':1,'high':1,'low':1,'close':1} for i in range(3)]}
            path=write_evidence(data,directory)
            saved=cached_window(path.parent,'EURUSD','EURUSD','M1','2026-09-11T12:31:00Z','2026-09-11T12:33:00Z','Elev8-Demo2')
            self.assertEqual(len(saved[1]['bars']),2)
            self.assertEqual(saved[0],path)
            self.assertIsNone(cached_window(path.parent,'EURUSD','EURUSD','M1','2026-09-11T12:31:00Z','2026-09-11T12:33:00Z','OtherBroker'))
            self.assertIsNone(cached_window(path.parent,'EURUSD','EURUSD','M1','2026-09-11T12:30:00Z','2026-09-11T12:34:00Z','Elev8-Demo2'))
            (path.parent/'broken.ohlc.json').write_text('{partial',encoding='utf-8')
            self.assertEqual(cached_window(path.parent,'EURUSD','EURUSD','M1','2026-09-11T12:31:00Z','2026-09-11T12:33:00Z','Elev8-Demo2')[0],path)
            with capture_lock('fixture-lock-'+directory):
                with self.assertRaisesRegex(ValueError,'busy'):
                    with capture_lock('fixture-lock-'+directory,timeout=0):
                        self.fail('Concurrent capture must wait')
            with capture_lock('fixture-lock-'+directory,timeout=0):
                pass

    def test_saved_candles_reject_invalid_prices_before_measuring_reactions(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory)/'invalid.json'
            data = {'pair':'EURUSD','timeframe':'M1','bars':[{'utc_time':self.event,'open':1,'high':1.1,'low':.9,'close':1}]}
            for key, value in [('close',float('nan')), ('open',None), ('utc_time',float('inf')), ('high',.8)]:
                invalid = {**data,'bars':[{**data['bars'][0],key:value}]}
                path.write_text(json.dumps(invalid),encoding='utf-8')
                with self.assertRaisesRegex(ValueError,'Saved candles contain'):
                    read_saved(path)

    def test_superseded_page_retries_once_inside_request_bound(self):
        from urllib.error import HTTPError
        failed=False
        def get(route):
            nonlocal failed
            if route!='health' and not failed:
                failed=True
                raise HTTPError('fixture',409,'superseded',{},None)
            return self.get(route)
        data=fetch_window(get,'EURUSD','EURUSD','M1','2026-09-11T11:30:00Z','2026-09-11T15:00:00Z')
        self.assertEqual(data['bridge_ohlc_requests'],len(self.calls)+1)

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

    def test_commodity_reaction_retains_exact_symbol_and_uses_price_units(self):
        def get(route):
            result = self.get(route)
            if route != 'health': result['symbol'] = 'SpotBrent'
            return result
        data = fetch_window(get, 'BRENT', 'SpotBrent', 'M1', '2026-09-11T11:30:00Z', '2026-09-11T15:00:00Z')
        output = summarize(data, '2026-09-11T12:30:00Z')
        self.assertEqual((output['pair'], output['symbol']), ('BRENT', 'SpotBrent'))
        self.assertIn('net_price', output['reactions'][-1])
        self.assertIn('net_percent', output['reactions'][-1])
        self.assertNotIn('net_pips', output['reactions'][-1])

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

    def test_captures_get_folders_or_attach_to_an_explicit_report(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory).resolve()
            report_root = root / 'report'
            data = {'pair': 'EURUSD', 'timeframe': 'M1', 'from_utc': '2026-09-11T12:30:00Z',
                'captured_utc': '2026-09-11T16:00:00Z', 'bars': [{'utc_time': self.event,
                    'open': 1, 'high': 1, 'low': 1, 'close': 1}]}
            standalone = write_evidence(data, report_root)
            self.assertEqual(standalone.parent.parent, report_root)
            folder = report_root / 'CPI'
            folder.mkdir()
            brief = folder / 'brief.md'
            brief.write_text('# CPI')
            evidence = folder / 'evidence.tsv'
            evidence.write_text('preserve')
            args = analyst.parser().parse_args(['ohlc', '--from', '2026-09-11T12:30:00Z',
                '--to', '2026-09-11T12:31:00Z', '--report', 'CPI'])
            with patch.object(analyst, 'ROOT', root), patch.object(analyst, 'REPORT_DIRECTORY', report_root), \
                 patch.object(analyst, 'fetch_window', return_value=data):
                result = analyst.run(args)
                self.assertEqual(Path(result['evidence_path']).parent, folder)
                args.report = str(root / 'outside.md')
                (root / 'outside.md').write_text('# Outside')
                with self.assertRaisesRegex(ValueError, 'own report folder'):
                    analyst.run(args)
            self.assertEqual(brief.read_text(), '# CPI')
            self.assertEqual(evidence.read_text(), 'preserve')
            self.assertTrue(all(item.is_dir() for item in report_root.iterdir()))

    def test_capture_write_failure_removes_new_folder_and_preserves_report(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            data = {'pair': 'EURUSD', 'timeframe': 'M1', 'from_utc': '2026-09-11T12:30:00Z'}
            with patch('ohlc.json.dump', side_effect=OSError('disk full')), self.assertRaises(OSError):
                write_evidence(data, root)
            self.assertEqual(list(root.iterdir()), [])
            folder = root / 'CPI'
            folder.mkdir()
            brief = folder / 'brief.md'
            brief.write_text('notes')
            with patch('ohlc.json.dump', side_effect=OSError('disk full')), self.assertRaises(OSError):
                write_evidence(data, root, folder)
            self.assertEqual(list(folder.iterdir()), [brief])
            self.assertEqual(brief.read_text(), 'notes')


if __name__=='__main__':
    unittest.main()
