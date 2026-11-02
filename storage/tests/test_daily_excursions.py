import copy
from datetime import datetime, timezone
from pathlib import Path
from tempfile import TemporaryDirectory
from types import SimpleNamespace
from unittest import TestCase
from unittest.mock import patch

from storage.analyst_learning.daily import DailyBasket, SOURCE, bounds, broker_date, episode_day
from storage.analyst_learning.daily_market import DailyExcursionMarket
from storage.analyst_learning.daily_worker import read_day
from storage.analyst_learning.feedback import feedback_summary
from storage.analyst_learning.outcomes import LEGS
from storage.analyst_learning.store import digest, directory, read, stamp, write
from storage.calendar_clock import PROFILES


def document(day='2026-11-02', count=1440, price=None, final=True):
    start, end = bounds(day)
    return dict(day=day, source_id=SOURCE, clock_profile=PROFILES[SOURCE],
        captured_utc=datetime.fromtimestamp(end if final else start+count*60, timezone.utc).isoformat(),
        opens={symbol:1. for symbol,_ in LEGS.values()}, samples={symbol:[
            [start+n*60, price(symbol,n) if price else 1.] for n in range(count)] for symbol,_ in LEGS.values()})


def episode(day='2026-11-02', currency='EUR', at=30):
    start,end=bounds(day)
    def clock(value): return stamp(datetime.fromtimestamp(value,timezone.utc))
    row=dict(id='research:call:'+currency, source_kind='research', source_id='call',currency=currency,
        cutoff_utc=clock(start),saved_utc=clock(start+at),delivered_utc=clock(start+at),
        provenance='assessment',basis_eligible=True,window_status='matured',end_utc=clock(start+3600),end_reason='checkpoint',
        direction=dict(verdict='POTENTIAL STRENGTHENING',intensity='moderate',basis='standalone'))
    row['input_hash']=digest(row)
    return row


class DailyExcursionTests(TestCase):
    def test_broker_day_dst_and_jakarta_midnight_is_not_rollover(self):
        self.assertEqual(broker_date('2026-11-02T17:30:00Z'),'2026-11-02')
        self.assertEqual(broker_date('2026-11-02T22:00:00Z'),'2026-11-03')
        self.assertEqual(datetime.fromtimestamp(bounds('2026-10-30')[0],timezone.utc).hour,21)
        self.assertEqual(datetime.fromtimestamp(bounds('2026-11-02')[0],timezone.utc).hour,22)
        self.assertEqual(episode_day(episode()),'2026-11-02')

    def test_daily_signed_max_is_distinct_from_late_call_and_terminal_return(self):
        def price(symbol,n): return (1.20 if n<4 else 1.01 if n==10 else 1.) if symbol=='EURUSD' else 1.
        doc=document(price=price); basket=DailyBasket(doc,doc['captured_utc'])
        row=episode(at=5*60+30)
        value=basket.assessment(row)
        self.assertAlmostEqual(value['day']['max_pct'],20)
        self.assertAlmostEqual(value['after_verdict']['favourable_pct'],1)
        self.assertAlmostEqual(value['after_verdict']['terminal_return_pct'],0)
        self.assertEqual(value['feedback'],'supporting_case','Excursion can align even after terminal giveback')
        self.assertLess(value['after_verdict']['favourable_pct'],value['day']['max_pct'],'Earlier prices cannot reward a later call')
        self.assertEqual(value['active_window']['end_reason'],'checkpoint')

    def test_peak_timing_adverse_before_peak_and_active_window(self):
        def price(symbol,n): return ({2:.99,3:1.02,120:1.10}.get(n,1.)) if symbol=='EURUSD' else 1.
        doc=document(price=price); result=DailyBasket(doc,doc['captured_utc']).assessment(episode())
        self.assertAlmostEqual(result['after_verdict']['favourable_pct'],10)
        self.assertAlmostEqual(result['active_window']['favourable_pct'],2)
        self.assertAlmostEqual(result['after_verdict']['adverse_before_peak_pct'],-1)
        self.assertEqual(result['after_verdict']['time_to_peak_seconds'],120*60)
        wrong=episode();wrong['direction']['verdict']='POTENTIAL WEAKENING'
        self.assertEqual(DailyBasket(doc,doc['captured_utc']).assessment(wrong)['feedback'],'refinement_candidate')

    def test_aligned_excursion_can_close_opposed_and_learning_confronts_both(self):
        def price(symbol,n):
            return (1.02 if n==10 else .99 if n>=59 else 1.) if symbol=='EURUSD' else 1.
        doc=document(price=price);row=episode()
        result=DailyBasket(doc,doc['captured_utc']).assessment(row)
        self.assertEqual(result['feedback'],'supporting_case')
        self.assertEqual(result['after_verdict']['close_result'],'opposed')
        self.assertAlmostEqual(result['day']['close_pct'],-1)
        self.assertAlmostEqual(result['after_verdict']['terminal_return_pct'],-1)
        record=dict(id='outcome',episode_id=row['id'],currency='EUR',verdict=row['direction']['verdict'],intensity='moderate',**result)
        feedback=feedback_summary([row],[record],[],doc['captured_utc'])
        self.assertEqual(feedback['case_queue'][0]['closing_result'],'opposed')
        self.assertEqual(feedback['closing_counts'],{'opposed':1})
        row['direction']['verdict']='POTENTIAL WEAKENING'
        weak=DailyBasket(doc,doc['captured_utc']).assessment(row)
        self.assertEqual(weak['after_verdict']['close_result'],'aligned')
        self.assertAlmostEqual(weak['after_verdict']['terminal_return_pct'],1)
        self.assertAlmostEqual(weak['after_verdict']['currency_return_pct'],-1)

    def test_missing_exact_close_is_unavailable_but_internal_gap_keeps_exact_close(self):
        doc=document();doc['samples']['EURUSD'].pop()
        result=DailyBasket(doc,doc['captured_utc']).assessment(episode())
        self.assertEqual(result['phase'],'final')
        self.assertNotIn('close_pct',result['day'])
        self.assertNotIn('terminal_return_pct',result['after_verdict'])
        self.assertEqual(result['after_verdict']['terminal_status'],'unavailable')
        doc=document();doc['samples']['EURUSD'].pop(5)
        result=DailyBasket(doc,doc['captured_utc']).assessment(episode())
        self.assertEqual(result['after_verdict']['status'],'partial')
        self.assertEqual(result['after_verdict']['terminal_status'],'complete')
        self.assertEqual(result['after_verdict']['close_result'],'flat')

    def test_complete_relative_basket_not_a_single_usd_pair(self):
        doc=document(price=lambda s,n:1+n/100000 if s=='EURUSD' else 1.)
        basket=DailyBasket(doc,doc['captured_utc'])
        self.assertLess(basket.daily('GBP')['max_pct'],0)
        values=[basket.path(c)[100][1] for c in ('USD',*LEGS)]
        self.assertAlmostEqual(sum(values),0)

    def test_developing_forming_missing_and_invalid_samples(self):
        doc=document(count=10,final=False,price=lambda s,n:1.1 if s=='EURUSD' and n==9 else 1.)
        start,_=bounds(doc['day']); cutoff=stamp(datetime.fromtimestamp(start+9*60+20,timezone.utc))
        result=DailyBasket(doc,cutoff).assessment(episode())
        self.assertEqual(result['phase'],'developing')
        self.assertEqual(result['day']['max_pct'],0,'Forming minute excluded')
        doc=document();doc['samples']['EURUSD'].pop(4)
        result=DailyBasket(doc,doc['captured_utc']).assessment(episode())
        self.assertEqual(result['day']['missing_samples'],1)
        self.assertEqual(result['feedback'],'unresolved')
        doc['opens']['GBPUSD']=None
        self.assertEqual(DailyBasket(doc,doc['captured_utc']).daily('EUR')['status'],'unavailable')
        doc=document();doc['samples']['EURUSD'][1][1]=float('nan')
        with self.assertRaises(ValueError):DailyBasket(doc,doc['captured_utc'])

    def test_reconstruction_obsolete_and_unknown_legacy_basis_not_rewarded(self):
        doc=document();basket=DailyBasket(doc,doc['captured_utc'])
        for changes in ({'provenance':'reconstruction'},{'window_status':'obsolete_correction'},{'basis_eligible':False}):
            row=episode();row.update(changes)
            self.assertEqual(basket.assessment(row)['feedback'],'unresolved')


class DailyMarketTests(TestCase):
    def setUp(self):
        self.temp=TemporaryDirectory();self.root=Path(self.temp.name);self.journal=self.root/'thesis/journal.json'
        self.doc=document(price=lambda s,n:1.001 if s=='EURUSD' and n>5 else 1.)
        self.now=datetime.fromisoformat(self.doc['captured_utc']).timestamp()+60
        self.health=dict(connected=True,process_running=True,account_server=SOURCE,account_login=1,terminal_path='fixture',generation=1)
        self.calls=[]
        def reader(identity,day):self.calls.append(day);return copy.deepcopy(self.doc)
        self.market=DailyExcursionMarket(self.journal,self.root/'prices',lambda:self.health.copy(),reader,lambda:self.now)

    def tearDown(self):
        if self.market.future:self.market.future.result(timeout=3)
        self.market.close();self.temp.cleanup()

    def test_async_loading_final_persistence_no_duplicate_and_stable_projection(self):
        rows=[episode(),episode(currency='GBP')]
        first=self.market.project(rows)
        self.assertEqual(first['call:EUR']['day']['status'],'unavailable')
        self.market.future.result(timeout=3)
        second=self.market.project(rows)
        third=self.market.project(rows)
        self.assertIs(second['call:EUR'],third['call:EUR'])
        self.assertEqual(self.calls,['2026-11-02'],'All currencies share one seven-leg day read')
        recorded=read(directory(self.journal)/'daily-outcomes.json',{})['outcomes']
        self.assertEqual(len(recorded),2)
        self.assertEqual(recorded[0]['feedback'],'supporting_case')
        report=feedback_summary(rows,recorded,[],stamp(datetime.fromtimestamp(self.now,timezone.utc)))
        self.assertEqual(report['counts']['supporting_case'],1)
        self.assertEqual(report['counts']['refinement_candidate'],1)
        self.assertEqual(len(report['case_queue']),2)
        earlier=feedback_summary(rows,recorded,[],'2026-11-01T22:30:00Z')
        self.assertEqual(earlier['counts'],{},'Future completed days cannot leak into an earlier information set')
        active_only=feedback_summary(rows,recorded,[],'2026-11-02T21:00:00Z')
        self.assertTrue(all(c['feedback_window']=='active_interval' and c['day_max_pct'] is None
            and c['remaining_day_favourable_pct'] is None for c in active_only['cases']))

    def test_completed_active_window_is_frozen_before_rollover_without_repeated_live_versions(self):
        start,end=bounds('2026-11-02');self.now=start+7200
        self.doc=document(count=60,final=False)
        self.doc['captured_utc']=stamp(datetime.fromtimestamp(self.now,timezone.utc))
        self.market.capture('2026-11-02');self.market.project([episode()],schedule=False)
        path=directory(self.journal)/'daily-outcomes.json'
        records=read(path,{})['outcomes']
        self.assertEqual(len(records),1)
        self.assertEqual(records[0]['phase'],'developing')
        self.now+=60;self.doc['captured_utc']=stamp(datetime.fromtimestamp(self.now,timezone.utc))
        self.market.capture('2026-11-02');self.market.project([episode()],schedule=False)
        self.assertEqual(len(read(path,{})['outcomes']),1,'Later live-day prices cannot create duplicates of the completed active interval')
        self.now=end+60;self.doc['captured_utc']=stamp(datetime.fromtimestamp(self.now,timezone.utc))
        self.market.capture('2026-11-02');self.market.project([episode()],schedule=False)
        self.assertEqual(len(read(path,{})['outcomes']),2,'Rollover appends the final day without overwriting its active-stage snapshot')
        records=read(path,{})['outcomes']
        self.assertEqual(records[0]['price_revision'],records[1]['price_revision'],'Prices can be unchanged across finalization')
        self.assertNotEqual(records[0]['price_evidence'],records[1]['price_evidence'],'Capture provenance must still preserve distinct pre/post-close sources')
        replay=DailyBasket(read(records[1]['price_evidence'],None),records[1]['observed_until_utc']).assessment(episode())
        self.assertEqual(replay['day'],records[1]['day'])
        self.assertEqual(replay['phase'],'final')

    def test_source_change_keeps_existing_cache_and_failure_is_bounded(self):
        def changed(identity,day):self.health['generation']=2;return self.doc
        self.market.reader=changed
        result=self.market.capture('2026-11-02')
        self.assertEqual(result['status'],'unavailable')
        self.assertFalse((self.root/'prices/2026-11-02.json').exists())
        self.assertFalse(self.market.due('2026-11-02'))

    def test_many_assessments_share_one_basket_and_one_persistence_write(self):
        self.market.capture('2026-11-02')
        rows=[]
        for n in range(40):
            row=episode(at=n*30+30);row['id']=f'research:call{n}:EUR';row['input_hash']=digest(row);rows.append(row)
        with patch('storage.analyst_learning.daily_market.write',wraps=write) as writer:
            self.market.project(rows,schedule=False)
            self.assertEqual(writer.call_count,2,'One archived price document and one atomic outcomes batch, not forty read/rewrite cycles')
            self.market.project(rows,schedule=False)
            self.assertEqual(writer.call_count,2,'Unchanged polling performs no persistence writes')
        records=read(directory(self.journal)/'daily-outcomes.json',{})['outcomes']
        record=records[0]
        frozen=read(record['price_evidence'],None)
        replay=DailyBasket(frozen,record['observed_until_utc']).assessment(rows[0])
        self.assertEqual(replay['active_window'],record['active_window'],'Recorded measurements replay against immutable source evidence')
        self.assertEqual(len(self.market.baskets),1)

    def test_enriched_api_revision_changes_for_prices_without_freshening_research(self):
        self.market.capture('2026-11-02');rows=[episode()]
        snapshot=dict(schema=1,revision='financial-research-version',currency='EUR',
            **{'from':'2026-11-02','to':'2026-11-02'},developments=[],
            assessments=[dict(id='call:EUR',as_of_utc=rows[0]['cutoff_utc'],direction=rows[0]['direction'])])
        before=copy.deepcopy(snapshot)
        with patch.object(self.market,'rows',return_value=rows):
            response=self.market.enrich(snapshot)
            self.assertEqual(self.market.enrich(snapshot,response['revision'])['unchanged'],True)
            self.assertEqual(snapshot,before,'Projection cannot mutate the financial snapshot')
            self.assertEqual(response['assessments'][0]['direction'],before['assessments'][0]['direction'])
            self.doc['samples']['EURUSD'][10][1]=1.2
            self.market.capture('2026-11-02')
            newer=self.market.enrich(snapshot,response['revision'])
            self.assertNotEqual(newer['revision'],response['revision'])
            self.assertNotIn('unchanged',newer)

    def test_live_day_is_recaptured_after_rollover(self):
        start,end=bounds('2026-11-02');self.now=end-60
        self.doc['captured_utc']=stamp(datetime.fromtimestamp(self.now,timezone.utc))
        self.market.capture('2026-11-02')
        self.assertFalse(self.market.due('2026-11-02'))
        self.now=end+60
        self.assertTrue(self.market.due('2026-11-02'))

    def test_native_reader_only_reads_visible_legs_and_never_mutates_account(self):
        start,end=bounds('2026-11-02');raw=int(datetime(2026,11,2,tzinfo=timezone.utc).timestamp())
        class Native:
            TIMEFRAME_D1='D1';TIMEFRAME_M1='M1'
            def initialize(self,**kwargs):return True
            def shutdown(self):pass
            def account_info(self):return SimpleNamespace(server=SOURCE,login=1)
            def terminal_info(self):return SimpleNamespace(connected=True)
            def symbols_get(self):return [SimpleNamespace(name='EURUSD',visible=True)]
            def copy_rates_range(self,symbol,timeframe,a,b):
                self.outer.append((symbol,timeframe))
                return [dict(time=raw,open=1.,high=1.,low=1.,close=1.)]
        native=Native();native.outer=[]
        result=read_day(native,{'identity':self.health,'day':'2026-11-02'})
        self.assertEqual(native.outer,[('EURUSD','D1'),('EURUSD','M1')])
        self.assertEqual(result['samples']['EURUSD'][0][0],start)
        self.assertIsNone(result['opens']['GBPUSD'])
