from copy import deepcopy
from datetime import datetime, timezone
from unittest import TestCase
from unittest.mock import patch

from storage.tests import test_thesis_research as fixtures
from storage.thesis_research import ResearchRequest, append_research
from storage.recommended_pairs import recommended_pairs


class RecommendedPairsTests(TestCase):
    def setUp(self):
        self.fixture = fixtures.ResearchTests()
        self.fixture.setUp()
        self.addCleanup(self.fixture.tearDown)
        self.addCleanup(self.fixture.doCleanups)
        class Clock(datetime):
            @classmethod
            def now(cls, tz=None): return datetime(2026,7,22,10,0,30,tzinfo=timezone.utc)
        self.patch = patch('storage.thesis_research.datetime', Clock)
        self.patch.start()
        self.addCleanup(self.patch.stop)
        self.path = self.fixture.path

    def request(self, detailed=True):
        r = self.fixture.request()
        r['currencies'] = ['GBP','CHF']
        r['developments'][0]['impacts'].append(dict(currency='GBP',implication='Policy supports sterling.',thesis_effect='Retained support.'))
        gbp = deepcopy(r['assessments'][0]);gbp['currency'] = 'GBP'
        gbp['direction']['verdict'] = 'POTENTIAL STRENGTHENING'
        gbp['direction']['reassessment']['event_at'] = '2026-07-22T11:00:00Z'
        r['assessments'][0]['direction']['reassessment']['event_at'] = '2026-07-22T10:30:00Z'
        pref = dict(pair='GBPCHF',verdict='BUY',reason='Explicitly researched policy divergence favours GBP over CHF.')
        if detailed:
            pref['recommendation'] = dict(intensity='moderate',rank=1,
                strongest_opposition='A renewed defensive shock could restore CHF demand.',
                invalidation='A less restrictive UK policy path defeats this comparison.')
        gbp['evaluation'] = dict(until_utc='2026-07-22T10:50:00Z',mechanism_tags=['policy'],
            intensity_reason='Policy divergence dominates the immediate funding comparison.',
            strongest_opposition='Defensive demand is the strongest opposing mechanism.',
            invalidation='A less restrictive UK path would defeat the comparison.',relative_preferences=[pref])
        r['assessments'].append(gbp)
        return r

    def test_exact_evidence_window_ranking_and_read_only_revision(self):
        receipt = append_research(ResearchRequest(**self.request()),self.path)
        before = self.path.with_name('research.json').read_bytes()
        result = recommended_pairs(self.path)
        item = result['items'][0]
        self.assertEqual(item['pair'],'GBPCHF')
        self.assertEqual(item['intensity'],'moderate')
        self.assertEqual(item['rank'],1)
        self.assertEqual(item['until_utc'],'2026-07-22T10:30:00Z','Earlier counterpart checkpoint caps the recommendation')
        self.assertEqual(item['starts_at'],'2026-07-22T10:00:30Z','No earlier research time is credited as delivery')
        self.assertEqual([s['assessment_id'] for s in item['evidence']],[receipt['id']+':GBP',receipt['id']+':CHF'])
        self.assertTrue(all(s['sources'] and s['evidence_ids'] for s in item['evidence']))
        self.assertEqual(recommended_pairs(self.path,result['revision']),dict(schema=1,revision=result['revision'],unchanged=True))
        self.assertEqual(before,self.path.with_name('research.json').read_bytes())

    def test_legacy_comparison_is_not_given_an_invented_grade_or_rank(self):
        append_research(ResearchRequest(**self.request(False)),self.path)
        item = recommended_pairs(self.path)['items'][0]
        self.assertIsNone(item['intensity']);self.assertIsNone(item['rank'])
        self.assertEqual(item['status'],'current')

    def test_focused_counterpart_assessment_supersedes_old_pair_without_reactivating_it(self):
        r = self.request();append_research(ResearchRequest(**r),self.path)
        next_request = self.fixture.request()
        next_request['developments'] = []
        next_request['as_of_utc'] = '2026-07-22T10:00:10Z'
        next_request['assessments'][0]['direction']['verified_utc'] = '2026-07-22T10:00:10Z'
        append_research(ResearchRequest(**next_request),self.path)
        self.assertEqual(recommended_pairs(self.path)['items'][0]['status'],'superseded')

    def test_unassessed_new_evidence_marks_pair_due(self):
        r = self.request();append_research(ResearchRequest(**r),self.path)
        dev = self.fixture.development('new-evidence')
        dev['verified_utc'] = '2026-07-22T10:00:20Z'
        r.update(as_of_utc='2026-07-22T10:00:20Z',assessments=[],developments=[dev])
        append_research(ResearchRequest(**r),self.path)
        self.assertEqual(recommended_pairs(self.path)['items'][0]['status'],'source_gap')

    def test_no_pair_inferred_from_standalone_labels_and_reconstruction_excluded(self):
        r = self.request();r['assessments'][1].pop('evaluation')
        append_research(ResearchRequest(**r),self.path)
        self.assertEqual(recommended_pairs(self.path)['items'],[])
        r = self.request();r.update(provenance='reconstruction',note='Retrospective information set, not live research.')
        append_research(ResearchRequest(**r),self.path)
        self.assertEqual(recommended_pairs(self.path)['items'],[])

    def test_rejects_incomplete_sides_and_inconsistent_duplicate_comparisons(self):
        for change in ('date-only','provisional','conflicting'):
            r = self.request()
            if change == 'date-only':
                r['assessments'][0]['direction']['reassessment'].update(event_at=None,event_date='2026-07-22')
            elif change == 'provisional':
                r['assessments'][0]['direction']['review_status'] = 'provisional'
            else:
                r['assessments'][0]['evaluation'] = deepcopy(r['assessments'][1]['evaluation'])
                r['assessments'][0]['evaluation']['until_utc'] = '2026-07-22T10:20:00Z'
                r['assessments'][0]['evaluation']['relative_preferences'][0]['verdict'] = 'SELL'
            with self.assertRaises(ValueError):ResearchRequest(**r)
