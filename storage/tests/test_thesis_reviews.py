import json
from unittest import TestCase
from unittest.mock import patch

import test_thesis as fixtures
from storage.thesis_reviews import CATEGORIES, ReviewRequest, append_review, read_reviews, review_context


class ReviewTests(TestCase):
    setUp = fixtures.ThesisTests.setUp
    tearDown = fixtures.ThesisTests.tearDown
    add = fixtures.ThesisTests.add
    paths = fixtures.ThesisTests.paths
    request = fixtures.ThesisTests.request
    save = fixtures.ThesisTests.save
    snapshot = fixtures.ThesisTests.snapshot

    def review(self, **changes):
        scope = changes.get('scope', 'NZDCHF')
        currencies = ['USD', 'EUR', 'GBP', 'JPY', 'CHF', 'CAD', 'AUD', 'NZD'] if scope == 'ALL' else [scope[:3], scope[3:]]
        return ReviewRequest(**(dict(scope=scope, as_of_utc='2026-07-15T06:00:00Z',
            takeaway='Leading opportunity; the earlier sell case weakened.', horizon='This week',
            backdrop=[dict(currency=currency, category=category, evidence=[dict(
                published_on='2026-07-01', verified_utc='2026-07-15T05:00:00Z',
                summary='Dated evidence and implication.', sources=[dict(kind='web', label='Official', locator='https://www.snb.ch/')])])
                for currency in currencies for category in CATEGORIES]) | changes))

    def test_exact_versions_frozen_after_later_pair_update_and_review_only_revision(self):
        self.paths()
        row = self.save()
        before = self.snapshot()
        saved = append_review(self.review(opportunity_ids=[row['id']]), self.path)
        first = self.snapshot()
        self.assertNotEqual(first['revision'], before['revision'])
        self.assertEqual(first['reviews'][0]['opportunities'][0]['verdict'], 'BUY')
        self.assertTrue(self.snapshot(after_revision=first['revision'])['unchanged'])
        self.save(row_id=row['row_id'], expected_version=row['id'], as_of_utc='2026-07-16T06:00:00Z', verdict='SELL')
        current = self.snapshot()
        self.assertEqual(current['past'][0]['verdict'], 'SELL')
        frozen = current['reviews'][0]['opportunities'][0]
        self.assertEqual(frozen['id'], row['id'])
        self.assertEqual(frozen['verdict'], 'BUY')
        self.assertEqual(len(frozen['versions']), 1)
        self.assertEqual(current['reviews'][0]['id'], saved['id'])

    def test_review_corrections_preserve_cutoff_history_and_atomic_failure(self):
        self.paths(); self.save()
        first = append_review(self.review(), self.path)
        path = self.path.with_name('reviews.json')
        original = path.read_bytes(); journal = self.path.read_bytes()
        for changes in [dict(review_id=first['review_id']), dict(review_id='f'*32),
                        dict(review_id=first['review_id'], expected_version=first['id'], as_of_utc='2026-07-16T06:00:00Z')]:
            with self.assertRaises(ValueError):
                append_review(self.review(**changes), self.path)
        with patch('storage.thesis_reviews.os.replace', side_effect=OSError('disk full')), self.assertRaises(OSError):
            append_review(self.review(review_id=first['review_id'], expected_version=first['id']), self.path)
        self.assertEqual(path.read_bytes(), original)
        second = append_review(self.review(review_id=first['review_id'], expected_version=first['id'], takeaway='Corrected interpretation.'), self.path)
        view = self.snapshot()['reviews'][0]
        self.assertEqual(view['id'], second['id'])
        self.assertEqual(len(view['versions']), 2)
        self.assertEqual(view['versions'][0]['takeaway'], 'Leading opportunity; the earlier sell case weakened.')
        self.assertEqual(self.path.read_bytes(), journal)
        broken = json.loads(path.read_text())
        broken['reviews'][1]['expected_version'] = None
        path.write_text(json.dumps(broken), encoding='utf-8')
        with self.assertRaises(ValueError): read_reviews(self.path)

    def test_complete_backdrop_gaps_original_dates_and_exact_opportunity_links(self):
        self.paths(); row = self.save()
        good = self.review().model_dump(mode='json')
        bad_values = []
        for mutate in [lambda data: data['backdrop'].pop(),
                       lambda data: data['backdrop'].append(data['backdrop'][0]),
                       lambda data: data['backdrop'][0]['evidence'][0].update(published_on='2026-07-16'),
                       lambda data: data['backdrop'][0]['evidence'][0].update(verified_utc='2026-07-15T07:00:00Z'),
                       lambda data: data['backdrop'][0]['evidence'][0].update(published_on=None),
                       lambda data: data['backdrop'][0].update(evidence=[])]:
            data = json.loads(json.dumps(good)); mutate(data); bad_values.append(data)
        for data in bad_values:
            with self.assertRaises(ValueError): ReviewRequest(**data)
        good['backdrop'][0].update(evidence=[], gap='No verified recent policy source.')
        self.assertEqual(ReviewRequest(**good).backdrop[0].evidence, [])
        for changes in [dict(opportunity_ids=['f'*32]), dict(opportunity_ids=[row['id']], scope='ALL'),
                        dict(opportunity_ids=[row['id']], as_of_utc='2026-07-16T06:00:00Z')]:
            with self.assertRaises(ValueError): append_review(self.review(**changes), self.path)
        append_review(self.review(opportunity_ids=[row['id']]), self.path)
        carried = self.snapshot()['reviews'][0]['backdrop'][0]['evidence'][0]
        self.assertEqual(carried['published_on'], '2026-07-01')
        self.assertEqual(carried['verified_utc'], '2026-07-15T05:00:00Z')

    def test_context_is_bounded_pair_focused_across_months_and_respects_cutoff(self):
        self.paths()
        first = self.save(collection='across', verdict='SELL')
        append_review(self.review(scope='ALL', opportunity_ids=[first['id']]), self.path)
        other = self.save(collection='across', scope='EURCHF', verdict='SELL')
        later = self.save(collection='across', as_of_utc='2026-07-31T18:00:00Z', verdict='MIXED',
            change='Weakened', change_reason='Contrary evidence.', compared_with=first['id'])
        append_review(self.review(scope='ALL', as_of_utc='2026-07-31T18:00:00Z', opportunity_ids=[later['id']]), self.path)
        view = review_context(self.path, 'NZDCHF', '2026-08-01T00:00:00Z')
        self.assertEqual(view['latest_review']['as_of_utc'], '2026-07-31T18:00:00Z')
        self.assertEqual(len(view['latest_review']['backdrop']), 10)
        self.assertNotIn('versions', view['latest_review'])
        self.assertEqual(view['last_directional_assessment']['id'], first['id'])
        self.assertTrue(all(row['scope']=='NZDCHF' for row in view['latest_assessments']))
        self.assertEqual(len(view['prior_review_takeaways']), 1)
        old = review_context(self.path, 'ALL', '2026-07-16T00:00:00Z')
        self.assertEqual(len(old['latest_review']['backdrop']), 40)
        self.assertEqual(old['latest_review']['opportunities'][0]['id'], first['id'])
        self.assertNotIn(later['id'], [row['id'] for row in old['latest_assessments']])
        self.assertEqual(review_context(self.path, 'EURGBP')['latest_review']['opportunities'], [])
        self.assertEqual(self.snapshot()['reviews'], [], 'Across context does not replace the pair journal')
        self.assertEqual(self.snapshot(scope='ALL', month='2026-08')['reviews'][0]['opportunity_ids'], [later['id']])
