import asyncio
from copy import deepcopy
from datetime import datetime, timedelta, timezone
import json
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest import TestCase
from unittest.mock import patch
from urllib.parse import urlencode

from storage.app import create_app
from storage.calendar_store import CalendarStore
from storage.currency_details import DetailRefresh, read_records, read_state, save_details
from storage.detail_projection import detail_snapshot, prepare_details
from storage.detail_registry import registry, resolve_scope
from storage.recovery import backup_directory, restore_directory
from storage.tests.test_calendar_storage import event

NOW = int(datetime(2026, 11, 5, 1, tzinfo=timezone.utc).timestamp()*1000)
RELEASE = int(datetime(2026, 11, 4, 10, tzinfo=timezone.utc).timestamp()*1000)
SOURCE = {'label': 'Eurostat release', 'url': 'https://ec.europa.eu/eurostat/web/products-euro-indicators/w/2-04112026-ap'}


def payload():
    return {'checks': [{'metric_id': 'eur.hicp-yoy', 'checked_at': '2026-11-05T00:00:00Z',
        'coverage': 'checked', 'sources': [deepcopy(SOURCE)], 'observation': {
            'period': '2026-10-01', 'stage': 'flash', 'value': 4.0,
            'released_at': '2026-11-04T10:00:00Z', 'released_date': '2026-11-04',
            'verified_at': '2026-11-05T00:00:00Z', 'sources': [SOURCE],
            'broker_reference': {'source_id': 'Pepperstone-Demo', 'value_id': 'eur-cpi', 'basis_note': 'Same October flash HICP annual rate and publication stage.'}},
        'next_releases': [dict(stage='final', period='2026-10-01', date='2026-11-18', sources=[SOURCE]),
                          dict(stage='flash', period='2026-11-01', date='2026-12-01', sources=[SOURCE])]}]}


class DetailTests(TestCase):
    def setUp(self):
        self.temp = TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name) / 'data'
        self.directory = self.root / 'currency-details'
        self.store = CalendarStore(self.root / 'calendar.sqlite3')
        self.addCleanup(self.store.close)
        manifest = {'calendar_from_timestamp': '1420070400', 'calendar_to_timestamp': '1800000000',
            'calendar_currencies': 'EUR,USD,JPY', 'snapshot_trade_server_timestamp': str(NOW//1000+7200),
            'snapshot_gmt_timestamp': str(NOW//1000)}
        self.manifest = manifest
        def row(identity, event_id, currency, country, at, actual, period, **kwargs):
            return event(value_id=identity, event_id=event_id, currency=currency, country_code=country,
                server_time_seconds=at//1000+7200, actual=actual, period_seconds=int(datetime.fromisoformat(period).replace(tzinfo=timezone.utc).timestamp()), **kwargs)
        self.rows = [row('eur-cpi', '999030013', 'EUR', 'EU', RELEASE, 3.2, '2026-10-01'),
            row('eur-next', '999030013', 'EUR', 'EU', NOW+14*86400000, None, '2026-10-01'),
            row('quarter', '999030016', 'EUR', 'EU', NOW-100*86400000, 0, '2026-04-01'),
            row('us-cpi', '840030007', 'USD', 'US', NOW-22*86400000, 2.7, '2026-09-01'),
            row('us-next', '840030007', 'USD', 'US', NOW+5*86400000, None, '2026-10-01'),
            row('jp-rate', '392060022', 'JPY', 'JP', NOW-40*86400000, 0.5, '2026-09-01'),
            row('unknown-time', '999030012', 'EUR', 'EU', RELEASE, 2.5, '2026-10-01', time_mode=1)]
        self.store.import_rows('fixture', 'Pepperstone-Demo', manifest, {}, self.rows)

    def snapshot(self, scope='EURUSD', **kwargs):
        return detail_snapshot(self.store, 'Pepperstone-Demo', resolve_scope(scope), self.directory, now_ms=NOW, **kwargs)

    def metric(self, identity, snapshot=None):
        return next(m for m in (snapshot or self.snapshot())['metrics'] if m['id'] == identity)

    def test_latest_beyond_window_zero_date_only_scope_indexed_and_read_only(self):
        statements = []
        before = self.store.db.total_changes
        self.store.db.set_trace_callback(statements.append)
        snap = self.snapshot()
        self.store.db.set_trace_callback(None)
        self.assertEqual(self.metric('eur.gdp', snap)['broker']['value'], 0)
        self.assertIsNone(self.metric('eur.core-yoy', snap)['broker']['at'])
        self.assertEqual(self.metric('eur.hicp-yoy', snap)['broker_next']['value_id'], 'eur-next')
        self.assertFalse(any(m['currency'] == 'JPY' for m in snap['metrics']))
        reads = [sql for sql in statements if 'SELECT e.*' in sql]
        self.assertEqual(len(reads), 2*sum(bool(m['broker_event_id']) for m in snap['metrics']))
        for sql in reads:
            plan = ' '.join(r[3] for r in self.store.db.execute('EXPLAIN QUERY PLAN '+sql))
            self.assertIn('events_detail_series', plan)
        self.assertEqual(before, self.store.db.total_changes)
        for scope, currency in [('EURX', 'EUR'), ('JPYX.a', 'JPY'), ('USDX', 'USD'), ('USDX-F', 'USD')]:
            self.assertEqual(self.snapshot(scope)['currencies'], [currency])
        for invalid in ['BTCUSD', 'EURXPERP', 'USDX-PERP', 'USDUSD']:
            with self.assertRaises(ValueError): resolve_scope(invalid)
        self.assertEqual(len(resolve_scope('ALL')), 8)

    def test_conflict_idempotence_independent_clocks_and_raw_preservation(self):
        before = self.store.values('Pepperstone-Demo', ['eur-cpi'])
        request = DetailRefresh.model_validate(payload())
        first = save_details(request, self.directory, self.store)
        self.assertTrue(save_details(request, self.directory, self.store)['unchanged'])
        metric = self.metric('eur.hicp-yoy')
        self.assertEqual(metric['comparison'], 'conflict')
        self.assertTrue(metric['official_latest'])
        self.assertEqual(metric['official']['value'], 4)
        self.assertEqual([s['stage'] for s in metric['next_releases']], ['final', 'flash'])
        snapshot = self.snapshot()
        self.assertTrue(self.snapshot(after_revision=snapshot['revision'])['unchanged'])
        old_run = (self.directory/'runs'/(first['run_id']+'.json')).read_bytes()
        check = payload()['checks'][0]
        check.pop('observation'); check.pop('next_releases')
        check.update(checked_at='2026-11-05T00:30:00Z', coverage='unavailable', coverage_note='Publisher temporarily unavailable.')
        save_details(DetailRefresh(checks=[check]), self.directory, self.store)
        with self.assertRaisesRegex(ValueError, 'superseded'):
            save_details(request, self.directory, self.store)
        metric = self.metric('eur.hicp-yoy')
        self.assertEqual(metric['official']['verified_at'], '2026-11-05T00:00:00Z')
        self.assertEqual(metric['check']['schedule_checked_at'], '2026-11-05T00:00:00Z')
        self.assertEqual(metric['check']['coverage'], 'unavailable')
        self.assertEqual(self.store.values('Pepperstone-Demo', ['eur-cpi']), before)
        self.assertEqual((self.directory/'runs'/(first['run_id']+'.json')).read_bytes(), old_run)
        self.assertIsNone(self.metric('usd.cpi-yoy')['check'])
        hints = next(m for m in prepare_details(self.snapshot(), NOW)['metrics'] if m['metric_id'] == 'eur.hicp-yoy')['needs']
        self.assertIn('unresolved_source_conflict', hints)
        self.assertIn('incomplete_previous_check', hints)

    def test_policy_history_is_six_months_completed_scoped_and_read_only(self):
        def decision(identity, currency, day, value, **changes):
            metric = next(m for m in registry()['metrics'] if m['id'] == currency.lower()+'.rate')
            seconds = int(datetime.fromisoformat(day).replace(tzinfo=timezone.utc).timestamp())
            return event(value_id=identity, event_id=metric['broker_event_id'], currency=currency,
                country_code=metric['broker_country'], server_time_seconds=seconds+7200,
                actual=value, previous=0, forecast=None, period_seconds=0, **changes)
        rows = [decision('usd-latest','USD','2026-10-28T18:00:00',4),
                decision('usd-older','USD','2026-06-17T18:00:00',3.75),
                decision('cad-latest','CAD','2026-10-28T13:45:00',2.5),
                decision('cad-zero','CAD','2026-06-10T13:45:00',0),
                decision('usd-before','USD','2026-05-04T12:00:00',3.75),
                decision('usd-cutoff','USD','2026-05-04T17:00:00',3.75),
                decision('usd-next','USD','2026-12-09T19:00:00',None),
                decision('usd-future-actual','USD','2026-11-05T02:00:00',4),
                decision('cad-date','CAD','2026-07-15T00:00:00',2.25,time_mode=1)]
        self.store.import_rows('policy-fixture','Pepperstone-Demo',{**self.manifest,'calendar_currencies':'USD,CAD'}, {}, rows)
        changes = self.store.db.total_changes
        statements = []
        self.store.db.set_trace_callback(statements.append)
        snapshot = self.snapshot('USDCAD')
        self.store.db.set_trace_callback(None)
        history = snapshot['policy_history']
        self.assertEqual((history['from_date'],history['through_date']),('2026-05-05','2026-11-05'))
        usd, cad = history['decisions']['USD'], history['decisions']['CAD']
        self.assertEqual([r['value_id'] for r in usd],['usd-latest','usd-older','usd-cutoff'])
        self.assertEqual([r['value_id'] for r in cad],['cad-latest','cad-date','cad-zero'])
        self.assertIsNone(cad[1]['at'])
        self.assertEqual(cad[-1]['value'],0)
        self.assertEqual(usd[0]['previous'],0)
        self.assertIsNone(usd[0]['forecast'])
        self.assertEqual(usd[0]['source_url'],'https://www.federalreserve.gov/newsevents/pressreleases/monetary20261028a.htm')
        self.assertIn('2026-10-28',cad[0]['source_url'])
        self.assertEqual(self.store.db.total_changes,changes)
        history_reads = [s for s in statements if 'e.server_time BETWEEN' in s]
        self.assertEqual(len(history_reads),2)
        for sql in history_reads:
            self.assertIn('events_detail_series',' '.join(r[3] for r in self.store.db.execute('EXPLAIN QUERY PLAN '+sql)))
        self.assertIsNone(self.snapshot('EURUSD')['policy_history'])
        self.assertEqual(self.snapshot('CADUSD')['policy_history']['decisions']['USD'],usd)
        self.assertEqual(detail_snapshot(self.store,'Other',['USD','CAD'],self.directory,now_ms=NOW)['policy_history']['decisions'],{'USD':[],'CAD':[]})
        self.assertTrue(self.snapshot('USDCAD',after_revision=snapshot['revision'])['unchanged'])

    def test_policy_history_calendar_month_cutoff_clamps_month_end(self):
        end = int(datetime(2026,8,31,12,tzinfo=timezone.utc).timestamp()*1000)
        history = detail_snapshot(self.store,'Pepperstone-Demo',['USD','CAD'],self.directory,now_ms=end)['policy_history']
        self.assertEqual(history['from_date'],'2026-02-28')

    def test_different_period_stage_and_source_never_silently_compare(self):
        p = payload(); p['checks'][0]['observation'].pop('broker_reference')
        save_details(DetailRefresh.model_validate(p), self.directory, self.store)
        self.assertEqual(self.metric('eur.hicp-yoy')['comparison'], 'different_vintage')
        p2 = deepcopy(self.rows[0]); p2.update(value_id='new-period', period_seconds=int(datetime(2026,11,1,tzinfo=timezone.utc).timestamp()))
        self.store.import_rows('new-period', 'Pepperstone-Demo', self.manifest, {}, [p2])
        metric = self.metric('eur.hicp-yoy')
        self.assertEqual(metric['comparison'], 'different_period')
        self.assertFalse(metric['official_latest'])
        other = detail_snapshot(self.store, 'Other', ['EUR'], self.directory, now_ms=NOW)
        self.assertFalse(other['source_available'])
        self.assertIsNotNone(self.metric('eur.hicp-yoy', other)['official'])

    def test_validation_stale_conflicting_and_atomic_failure(self):
        for mutate in [lambda p: p['checks'][0].update(checked_at='2099-01-01T00:00:00Z'),
                       lambda p: p['checks'][0]['sources'][0].update(url='https://wrong.example/release'),
                       lambda p: p['checks'][0]['observation'].update(released_at='2026-11-04T23:00:00Z'),
                       lambda p: p['checks'][0]['observation'].update(value=float('nan'))]:
            p=payload(); mutate(p)
            with self.assertRaises(ValueError): DetailRefresh.model_validate(p)
        for ref in ['us-cpi', 'quarter', 'missing']:
            p=payload(); p['checks'][0]['observation']['broker_reference']['value_id']=ref
            with self.assertRaisesRegex(ValueError, 'Broker reference'):
                save_details(DetailRefresh.model_validate(p), self.directory, self.store)
        request=DetailRefresh.model_validate(payload())
        save_details(request,self.directory,self.store)
        before=read_state(self.directory)
        p=payload();p['checks'][0]['observation']['value']=4.1
        with self.assertRaisesRegex(ValueError, 'equal/newer'):
            save_details(DetailRefresh.model_validate(p),self.directory,self.store)
        p['checks'][0]['checked_at']='2026-11-05T00:30:00Z';p['checks'][0]['observation']['verified_at']='2026-11-05T00:30:00Z'
        from storage.currency_details import atomic_write
        def fail_index(path, value):
            if path.name=='latest.json': raise OSError('simulated interrupted publication')
            return atomic_write(path,value)
        with patch('storage.currency_details.atomic_write',side_effect=fail_index):
            with self.assertRaises(OSError): save_details(DetailRefresh.model_validate(p),self.directory,self.store)
        self.assertEqual(read_state(self.directory),before)
        self.assertEqual(self.metric('eur.hicp-yoy')['official']['value'],4)

    def test_scoped_reads_skip_other_currency_and_backup_restores_history(self):
        save_details(DetailRefresh.model_validate(payload()),self.directory,self.store)
        # Scoped snapshots never need another currency's saved body.
        state=read_state(self.directory)
        state['metrics']['usd.cpi-yoy']={'check':'f'*64}
        self.assertEqual(read_records(self.directory,state,currencies=['EUR'])[0]['eur.hicp-yoy']['observation']['value'],4)
        before=self.snapshot()
        backup=self.root.parent/(self.root.name+'-backup')
        restored=self.root.parent/(self.root.name+'-restored')
        backup_directory(self.root,backup);restore_directory(backup,restored)
        with __import__('contextlib').closing(CalendarStore(restored/'calendar.sqlite3')) as store:
            self.assertEqual(detail_snapshot(store,'Pepperstone-Demo',['EUR','USD'],restored/'currency-details',now_ms=NOW),before)

    def test_api_read_write_validation_and_complete_delivery(self):
        async def run():
            app=create_app(self.root,run_collector=False)
            async def request(method='GET', body=None, **params):
                params={'source_id':'Pepperstone-Demo','scope':'EURUSD','at_utc_ms':NOW,**params}
                received=[]
                async def receive(): return {'type':'http.request','body':json.dumps(body).encode() if body else b''}
                async def send(message): received.append(message)
                await app({'type':'http','method':method,'path':'/api/v1/currency-details',
                    'query_string':urlencode(params).encode(),'headers':[(b'content-type',b'application/json')]},receive,send)
                return next(m['status'] for m in received if m['type']=='http.response.start'),json.loads(b''.join(m.get('body',b'') for m in received))
            async with app.router.lifespan_context(app):
                self.assertEqual((await request(scope='BTCUSD'))[0],422)
                status,saved=await request('POST',payload());self.assertEqual(status,200)
                self.assertTrue(saved['readback_verified'])
                status,snapshot=await request();self.assertEqual(status,200)
                self.assertEqual(snapshot,self.snapshot())
                self.assertTrue((await request(after_revision=snapshot['revision']))[1]['unchanged'])
        asyncio.run(run())

    def test_registry_covers_all_currencies_and_categories_without_false_monthly_mapping(self):
        r=registry()
        self.assertEqual(len({m['id'] for m in r['metrics']}),len(r['metrics']))
        for currency in resolve_scope('ALL'):
            self.assertEqual({m['category'] for m in r['metrics'] if m['currency']==currency},{c['id'] for c in r['categories']})
        self.assertIsNone(next(m for m in r['metrics'] if m['id']=='aud.cpi-monthly')['broker_event_id'])
        self.assertIsNone(next(m for m in r['metrics'] if m['id']=='aud.spending')['broker_event_id'])

    def test_date_only_observation_and_later_stage_never_regresses(self):
        p=payload();obs=p['checks'][0]['observation'];obs['released_at']=None
        save_details(DetailRefresh.model_validate(p),self.directory,self.store)
        self.assertIsNone(self.metric('eur.hicp-yoy')['official']['released_at'])
        p['checks'][0]['checked_at']='2026-11-05T00:10:00Z'
        obs.update(verified_at='2026-11-05T00:10:00Z',stage='final')
        save_details(DetailRefresh.model_validate(p),self.directory,self.store)
        p['checks'][0]['checked_at']='2026-11-05T00:20:00Z'
        obs.update(verified_at='2026-11-05T00:20:00Z',stage='flash')
        with self.assertRaisesRegex(ValueError,'earlier vintage'):
            save_details(DetailRefresh.model_validate(p),self.directory,self.store)

    def test_quiet_preparation_is_compact_but_publisher_rechecks_and_elapsed_schedules_return(self):
        p=payload();p['checks'][0]['observation']['value']=3.2
        save_details(DetailRefresh.model_validate(p),self.directory,self.store)
        before=self.metric('eur.hicp-yoy')['official']['verified_at']
        quiet=prepare_details(self.snapshot(),NOW)
        self.assertIn('eur.hicp-yoy',[m['metric_id'] for m in quiet['unchanged']])
        self.assertNotIn('eur.hicp-yoy',[m['metric_id'] for m in quiet['metrics']])
        later=prepare_details(self.snapshot(),NOW+86400000)
        due=next(m for m in later['metrics'] if m['metric_id']=='eur.hicp-yoy')
        self.assertIn('publisher_revision_check_due',due['needs'])
        expired=detail_snapshot(self.store,'Pepperstone-Demo',['EUR'],self.directory,now_ms=NOW+28*86400000)
        self.assertTrue(self.metric('eur.hicp-yoy',expired)['schedule_elapsed'])
        self.assertEqual(self.metric('eur.hicp-yoy')['official']['verified_at'],before)

    def test_scoped_cli_rejects_other_currency_without_writing(self):
        import importlib.util
        from types import SimpleNamespace
        path=Path(__file__).resolve().parents[2]/'Market Analyst Workflow/tools/details_cli.py'
        spec=importlib.util.spec_from_file_location('detail_cli_test',path)
        module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
        input_file=self.root/'refresh.json';input_file.write_text(json.dumps(payload()),encoding='utf-8')
        args=SimpleNamespace(scope='USD',action='save',database=str(self.root/'calendar.sqlite3'),input=str(input_file))
        with self.assertRaisesRegex(ValueError,'exceeds the researched scope'):
            module.run_details(args,Path,lambda *_:None)
        self.assertFalse((self.directory/'latest.json').exists())

    def test_original_publisher_alternate_host_is_allowed_but_lookalikes_fail(self):
        check={'metric_id':'eur.services','checked_at':'2026-11-05T00:00:00Z','coverage':'checked',
            'sources':[{'label':'S&P original release','url':'https://www.spglobal.com/marketintelligence/en/mi/research-analysis/'}]}
        self.assertEqual(DetailRefresh(checks=[check]).checks[0].metric_id,'eur.services')
        check['sources'][0]['url']='https://www.spglobal.com.evil.example/release'
        with self.assertRaisesRegex(ValueError,'registered publisher'):DetailRefresh(checks=[check])
