from copy import deepcopy
from datetime import datetime, timezone
import json
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest import TestCase
from unittest.mock import patch

from storage.thesis_research import ResearchRequest, append_research, read_research, research_snapshot
from storage.thesis_summary import currency_summary


class ResearchTests(TestCase):
    def setUp(self):
        class ResearchClock(datetime):
            @classmethod
            def now(cls, tz=None): return datetime(2026,7,22,12,tzinfo=timezone.utc)
        self.clock_patch=patch('storage.thesis_research.datetime',ResearchClock)
        self.clock_patch.start();self.addCleanup(self.clock_patch.stop)
        self.temp=TemporaryDirectory(); self.path=Path(self.temp.name)/'journal.json'
        self.source=dict(kind='web',label='Official evidence',locator='https://example.com/release',note='Original source')
        self.clock='2026-07-22T10:00:00Z'

    def tearDown(self): self.temp.cleanup()

    def development(self, key='chf-policy', published='2026-07-22'):
        return dict(key=key,title='Policy communication',facts='Verified policy facts.',published_on=published,
            published_at=None,timing_note='Publication hour unknown.',verified_utc=self.clock,sources=[self.source],
            impacts=[dict(currency='CHF',implication='Supports funding pressure.',thesis_effect='Reinforces the weakening mechanism.')])

    def direction(self):
        return dict(basis='standalone',verdict='POTENTIAL WEAKENING',intensity='slight',horizon='Current session through the selected review.',
            reason='Funding pressure outweighs verified haven offsets.',verified_utc=self.clock,sources=[self.source],
            reassessment=dict(title='Policy guidance',event_at='2026-07-23T10:00:00Z',verified_utc=self.clock,sources=[self.source],note='Reassess the funding mechanism against new guidance.'))

    def request(self):
        return dict(as_of_utc=self.clock,period_start='2026-07-22',period_end='2026-07-22',currencies=['CHF'],
            developments=[self.development()],assessments=[dict(currency='CHF',direction=self.direction(),evidence_keys=['chf-policy'])])

    def test_event_stored_once_and_focused_summary_does_not_manufacture_other_rows(self):
        r=self.request(); first=append_research(ResearchRequest(**r),self.path)
        second=append_research(ResearchRequest(**r),self.path)
        book=read_research(self.path)
        self.assertEqual(len(book['developments']),1);self.assertEqual(len(book['runs']),2)
        self.assertEqual(second['reused_development_ids'],first['created_development_ids'])
        self.assertNotIn('developments',book['runs'][0])
        summary=currency_summary(self.path);chf=next(r for r in summary['rows'] if r['currency']=='CHF')
        self.assertEqual(chf['intensity'],'slight');self.assertEqual(chf['evidence_anchor']['event_date'],'2026-07-22')
        self.assertTrue(all(r['verdict'] is None for r in summary['rows'] if r['currency']!='CHF'))

    def test_correction_preserves_vintage_and_stale_write_is_atomic(self):
        r=self.request();first=append_research(ResearchRequest(**r),self.path)
        changed=deepcopy(r);changed['developments'][0]['facts']='Corrected policy facts.'
        before=self.path.with_name('research.json').read_bytes()
        with self.assertRaisesRegex(ValueError,'latest version'):append_research(ResearchRequest(**changed),self.path)
        self.assertEqual(before,self.path.with_name('research.json').read_bytes())
        changed['developments'][0].update(expected_version=first['created_development_ids'][0],revision_note='Corrected source reading.')
        append_research(ResearchRequest(**changed),self.path);book=read_research(self.path)
        self.assertEqual(len(book['developments']),2)
        self.assertEqual(book['runs'][0]['evidence_versions']['CHF'],first['created_development_ids'])
        self.assertEqual(book['developments'][0]['facts'],'Verified policy facts.')

    def test_range_keeps_unknown_hours_background_and_multiple_intraday_events(self):
        r=self.request();r['developments'] += [self.development('chf-old','2026-07-20'),self.development('chf-haven')]
        r['developments'][2].update(published_at='2026-07-22T08:00:00Z',facts='New haven information.')
        r['assessments'][0].update(background_keys=['chf-old'],evidence_keys=['chf-policy','chf-haven'])
        append_research(ResearchRequest(**r),self.path);s=research_snapshot(self.path,'2026-07-22','2026-07-22')
        self.assertEqual(len(s['developments']),3)
        self.assertEqual(s['developments'][0]['key'],'chf-haven')
        self.assertIsNone(next(d for d in s['developments'] if d['key']=='chf-policy')['published_at'])
        self.assertEqual(len(s['assessments'][0]['background_ids']),1)
        self.assertTrue(research_snapshot(self.path,'2026-07-22','2026-07-22',s['revision'])['unchanged'])

    def test_unresolved_review_retains_previous_clock_without_fresh_direction(self):
        r=self.request();append_research(ResearchRequest(**r),self.path)
        r.update(as_of_utc='2026-07-22T11:00:00Z',developments=[],assessments=[dict(currency='CHF',gap='Material new guidance cannot be verified.')])
        append_research(ResearchRequest(**r),self.path)
        row=next(r for r in currency_summary(self.path)['rows'] if r['currency']=='CHF')
        self.assertEqual(row['verified_utc'],'2026-07-22T10:00:00Z')
        self.assertIn('cannot be verified',row['reassessment_gap']);self.assertIsNone(row['reassessment'])

    def test_reconstruction_cannot_replace_live_summary(self):
        r=self.request();first=append_research(ResearchRequest(**r),self.path)
        r.update(as_of_utc='2026-07-22T11:00:00Z',provenance='reconstruction',note='Historical information set, assessed retrospectively.')
        r['assessments'][0]['direction']['verdict']='POTENTIAL STRENGTHENING'
        append_research(ResearchRequest(**r),self.path)
        self.assertEqual(currency_summary(self.path)['review_id'],first['id'])

    def test_findings_only_do_not_require_an_entry_or_an_eight_currency_verdict(self):
        r=self.request();r['assessments']=[]
        append_research(ResearchRequest(**r),self.path)
        self.assertEqual(len(read_research(self.path)['developments']),1)
        self.assertTrue(all(r['verdict'] is None for r in currency_summary(self.path)['rows']))

    def test_invalid_clocks_scope_background_and_checkpoints(self):
        r=self.request()
        cases=[]
        x=deepcopy(r);x['developments'][0]['published_at']='2026-07-23T09:00:00Z';cases.append(x)
        x=deepcopy(r);x['assessments'][0]['direction']['verified_utc']='2026-07-22T11:00:00Z';cases.append(x)
        x=deepcopy(r);x['assessments'][0]['direction']['reassessment']['event_at']=self.clock;cases.append(x)
        x=deepcopy(r);x['assessments'][0]['currency']='JPY';cases.append(x)
        for case in cases:
            with self.assertRaises(ValueError):ResearchRequest(**case)
        x=deepcopy(r);x['assessments'][0]['background_keys']=['chf-policy'];x['assessments'][0]['evidence_keys']=[]
        with self.assertRaisesRegex(ValueError,'background keys'):append_research(ResearchRequest(**x),self.path)
        self.assertFalse(self.path.with_name('research.json').exists())

    def test_multi_currency_fact_remains_one_development(self):
        r=self.request();r['currencies'].append('JPY');r['developments'][0]['impacts'].append(dict(currency='JPY',implication='Haven demand.',thesis_effect='Offsets funding pressure.'))
        append_research(ResearchRequest(**r),self.path)
        self.assertEqual(len(read_research(self.path)['developments']),1)
        self.assertEqual(len(research_snapshot(self.path,'2026-07-20','2026-07-23')['developments'][0]['impacts']),2)

    def test_api_route_and_invalid_range(self):
        from storage.app import create_app
        app=create_app(thesis_path=self.path)
        route=next(r for r in app.routes if getattr(r,'path','')=='/api/v1/theses/research')
        self.assertEqual(len(route.endpoint('2026-07-22','2026-07-22',None)['assessments']),0)
        with self.assertRaises(ValueError):research_snapshot(self.path,'2026-07-23','2026-07-22')

    def test_corrupt_references_fail_without_discarding_history(self):
        r=self.request();append_research(ResearchRequest(**r),self.path)
        path=self.path.with_name('research.json');book=json.loads(path.read_text());book['runs'][0]['evidence_versions']['CHF']=['f'*32];path.write_text(json.dumps(book))
        with self.assertRaisesRegex(ValueError,'missing evidence'):read_research(self.path)

    def test_reconstruction_keeps_real_later_verification_clocks(self):
        r=self.request();r.update(as_of_utc='2026-07-21T16:59:59Z',period_start='2026-07-21',period_end='2026-07-21',
            provenance='reconstruction',note='July 21 end-of-day information, verified July 22.')
        r['developments'][0]['published_on']='2026-07-21'
        append_research(ResearchRequest(**r),self.path)
        s=research_snapshot(self.path,'2026-07-21','2026-07-21')
        self.assertEqual(s['developments'][0]['verified_utc'],self.clock)
        self.assertEqual(s['assessments'][0]['direction']['verified_utc'],self.clock)
        self.assertTrue(all(x['verdict'] is None for x in currency_summary(self.path)['rows']))
        r['provenance']='assessment'
        with self.assertRaisesRegex(ValueError,'reconstruction'):ResearchRequest(**r)

    def test_narrow_range_keeps_prior_evidence_and_retained_view_after_a_gap(self):
        r=self.request();append_research(ResearchRequest(**r),self.path)
        r.update(as_of_utc='2026-07-22T11:00:00Z',developments=[],assessments=[dict(currency='CHF',gap='Unverified material guidance.')])
        append_research(ResearchRequest(**r),self.path)
        s=research_snapshot(self.path,'2026-07-23','2026-07-23')
        self.assertEqual(len(s['assessments']),2)
        self.assertEqual(len(s['developments']),1,'The narrower view still exposes the prior supported foundation')

    def test_findings_only_trigger_review_without_refreshing_the_old_assessment(self):
        r=self.request();append_research(ResearchRequest(**r),self.path)
        r.update(as_of_utc='2026-07-22T11:00:00Z',assessments=[],developments=[self.development('new-haven')])
        r['developments'][0]['verified_utc']='2026-07-22T11:00:00Z'
        append_research(ResearchRequest(**r),self.path)
        row=next(x for x in currency_summary(self.path)['rows'] if x['currency']=='CHF')
        self.assertEqual(row['verified_utc'],self.clock)
        self.assertIn('not yet been incorporated',row['reassessment_gap'])

    def test_commodity_research_does_not_require_a_synthetic_currency_impact(self):
        r=self.request();r['assessments']=[];d=r['developments'][0]
        d.update(key='brent-supply',impacts=[],instruments=['BRENT','WTI'],instrument_note='Benchmark supply story; broker CFD contract not yet resolved.',
            commodity_implication='Supports tighter physical balances.',commodity_thesis_effect='Offsets the earlier demand headwind.')
        append_research(ResearchRequest(**r),self.path)
        s=research_snapshot(self.path,'2026-07-22','2026-07-22')
        self.assertEqual(s['developments'][0]['impacts'],[])
        self.assertEqual(s['developments'][0]['instruments'],['BRENT','WTI'])

    def test_repeated_unresolved_reviews_without_a_prior_verdict_remain_visible(self):
        r=self.request();r.update(developments=[],assessments=[dict(currency='CHF',gap='Awaiting decisive facts.')])
        append_research(ResearchRequest(**r),self.path)
        r['as_of_utc']='2026-07-22T11:00:00Z';append_research(ResearchRequest(**r),self.path)
        row=next(x for x in currency_summary(self.path)['rows'] if x['currency']=='CHF')
        self.assertIsNone(row['verdict']);self.assertEqual(row['reassessment_gap'],'Awaiting decisive facts.')
