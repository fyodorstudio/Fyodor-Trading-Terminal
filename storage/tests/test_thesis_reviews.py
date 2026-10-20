import json
from unittest import TestCase
from unittest.mock import patch

import test_thesis as fixtures
from storage.thesis_reviews import CATEGORIES, ReviewEntry, ReviewRequest, append_review, read_reviews, review_context


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

    def currency_views(self):
        return [dict(currency=currency, bias='Mixed policy and demand.', summary='Supported dated interpretation.',
            counterweight='Main opposing evidence.', sources=[dict(kind='web', label='Official', locator='https://www.snb.ch/')],
            checkpoints=[dict(title='Next release', event_at='2026-07-16T06:00:00Z', verified_utc='2026-07-15T07:00:00Z',
                sources=[dict(kind='web', label='Schedule', locator='https://www.snb.ch/')], note='Persistence supports; cooling challenges.')])
            for currency in ('NZD', 'CHF')]

    def test_currency_overview_keeps_later_planning_separate_from_original_research(self):
        self.paths(); self.save()
        first = append_review(self.review(), self.path)
        append_review(self.review(review_id=first['review_id'], expected_version=first['id'],
            currency_views=self.currency_views(), planning_as_of_utc='2026-07-15T08:00:00Z'), self.path)
        result = self.snapshot()['reviews'][0]
        self.assertEqual(result['as_of_utc'], '2026-07-15T06:00:00Z')
        self.assertEqual(result['planning_as_of_utc'], '2026-07-15T08:00:00Z')
        self.assertEqual(len(result['currency_views']), 2)
        self.assertEqual(result['versions'][0]['currency_views'], [])
        before_preparation = review_context(self.path, 'NZDCHF', '2026-07-15T06:30:00Z')['latest_review']
        self.assertIsNone(before_preparation['planning_as_of_utc'])
        self.assertTrue(all(not view['checkpoints'] for view in before_preparation['currency_views']))
        self.assertEqual(len(review_context(self.path, 'NZDCHF', '2026-07-15T09:00:00Z')['latest_review']['currency_views'][0]['checkpoints']), 1)

    def test_currency_view_coverage_safe_sources_and_checkpoint_clocks(self):
        good = self.review(currency_views=self.currency_views(), planning_as_of_utc='2026-07-15T08:00:00Z').model_dump(mode='json')
        for mutate in [lambda data: data['currency_views'].pop(),
                       lambda data: data['currency_views'][1].update(currency='NZD'),
                       lambda data: data['currency_views'][0].update(counterweight=' '),
                       lambda data: data['currency_views'][0]['sources'][0].update(locator='javascript:alert(1)'),
                       lambda data: data.update(planning_as_of_utc=None),
                       lambda data: data['currency_views'][0]['checkpoints'][0].update(verified_utc='2026-07-15T09:00:00Z'),
                       lambda data: data['currency_views'][0]['checkpoints'][0].update(event_at='2026-07-15T07:00:00Z'),
                       lambda data: data['currency_views'][0]['checkpoints'][0].update(event_date='2026-07-16'),
                       lambda data: data['currency_views'][0]['checkpoints'][0].update(event_at=None, event_date='2026-07-14'),
                       lambda data: data['currency_views'][0]['checkpoints'][0].update(event_at=None, note='')]:
            data = json.loads(json.dumps(good)); mutate(data)
            with self.assertRaises(ValueError): ReviewRequest(**data)
        good['currency_views'][0]['checkpoints'][0].update(event_at=None, event_date='2026-07-16')
        result = ReviewRequest(**good)
        self.assertIsNone(result.currency_views[0].checkpoints[0].event_at)
        good['currency_views'][0]['checkpoints'][0].update(event_date=None, note='Unscheduled fiscal developments.')
        self.assertIsNone(ReviewRequest(**good).currency_views[0].checkpoints[0].event_date)

    def test_pair_context_filters_eight_currency_overview_without_changing_saved_versions(self):
        self.paths(); self.save()
        views = self.currency_views()
        views += [{**views[0], 'currency': currency} for currency in ('USD','EUR','GBP','JPY','CAD','AUD')]
        append_review(self.review(scope='ALL', currency_views=views, planning_as_of_utc='2026-07-15T08:00:00Z'), self.path)
        selected = review_context(self.path, 'EURJPY')['latest_review']
        self.assertEqual({view['currency'] for view in selected['currency_views']}, {'EUR','JPY'})
        self.assertEqual(len(read_reviews(self.path)[0]['currency_views']), 8)

    def daily_news(self):
        sources = [dict(kind='web', label='Published release', locator='https://example.com/release')]
        return dict(scope='ALL', format='daily_news', as_of_utc='2026-07-15T06:00:00Z',
            provenance='reconstruction', note='Historical news collected later; original availability checked.',
            planning_as_of_utc='2026-08-01T06:00:00Z',
            entry_opportunities=[dict(currency='USD', summary='Dominant policy support.', starts_at='2026-07-15T06:00:00Z',
                ends_at='2026-07-15T16:59:59Z', timing_note='Remaining selected day.', invalidation='Contrary policy news.')],
            currency_views=[dict(currency=currency, direction=dict(verdict='POTENTIAL STRENGTHENING', reason='Dominant active support.',
                verified_utc='2026-08-01T05:00:00Z', sources=sources), news=[dict(published_on='2026-07-15',
                published_at='2026-07-14T18:00:00Z', summary=f'{currency} published news.',
                verified_utc='2026-08-01T05:00:00Z', sources=sources)], checkpoints=[dict(
                    title='Scheduled release', event_at='2026-07-15T07:00:00Z',
                    verified_utc='2026-08-01T05:00:00Z', sources=sources)])
                for currency in ('USD','EUR','GBP','JPY','CHF','CAD','AUD','NZD')])

    def test_daily_news_saves_numbered_items_without_bias_or_backdrop_and_preserves_history(self):
        self.paths(); self.save()
        legacy = append_review(self.review(), self.path)
        before = json.loads(self.path.with_name('reviews.json').read_text())['reviews']
        journal = self.path.read_bytes()
        data = self.daily_news()
        first_news = data['currency_views'][0]['news'][0]
        data['currency_views'][0]['news'] = [{**first_news, 'summary': f'USD news item {index + 1}.'} for index in range(4)]
        data['currency_views'][7].update(news=[], news_gap='No verified relevant same-date news found.')
        first = append_review(ReviewRequest(**data), self.path)
        readback = self.snapshot(scope='ALL')['reviews'][0]
        self.assertEqual(readback['id'], first['id'])
        self.assertEqual(len(readback['currency_views']), 8)
        self.assertEqual(len(readback['currency_views'][0]['news']), 4)
        self.assertEqual(readback['backdrop'], [])
        self.assertEqual(readback['currency_views'][0]['bias'], '')
        self.assertEqual(readback['currency_views'][0]['news'][0]['verified_utc'], '2026-08-01T05:00:00Z')
        append_review(ReviewRequest(**{**data, 'review_id': first['review_id'], 'expected_version': first['id']}), self.path)
        self.assertEqual(len(self.snapshot(scope='ALL')['reviews'][0]['versions']), 2)
        self.assertEqual(self.snapshot()['reviews'][0]['id'], legacy['id'])
        self.assertEqual(json.loads(self.path.with_name('reviews.json').read_text())['reviews'][:len(before)], before)
        self.assertEqual(self.path.read_bytes(), journal)

    def test_daily_news_rejects_wrong_dates_unsafe_sources_elapsed_events_and_missing_rows(self):
        good = self.daily_news()
        for mutate in [lambda d: d['currency_views'].pop(),
                lambda d: d['currency_views'][0].update(news=[]),
                lambda d: d['currency_views'][0].update(bias='BUY'),
                lambda d: d.update(provenance='assessment'),
                lambda d: d['currency_views'][0]['news'][0].update(published_on='2026-07-14'),
                lambda d: d['currency_views'][0]['news'][0].update(published_at='2026-07-15T07:00:00Z'),
                lambda d: d['currency_views'][0]['news'][0].update(verified_utc='2026-07-14T05:00:00Z'),
                lambda d: d['currency_views'][0]['news'][0]['sources'][0].update(locator='javascript:alert(1)'),
                lambda d: d['currency_views'][0]['checkpoints'][0].update(event_at='2026-07-15T05:00:00Z'),
                lambda d: d['currency_views'][0]['checkpoints'][0].update(event_at=None, event_date='2026-07-14'),
                lambda d: d['currency_views'][0]['checkpoints'][0].update(event_at=None, note='Unscheduled')]:
            data = json.loads(json.dumps(good)); mutate(data)
            with self.assertRaises(ValueError): ReviewRequest(**data)
        good['currency_views'][0]['news'][0].update(published_at=None)
        good['currency_views'][0]['checkpoints'][0].update(event_at=None, event_date='2026-07-15')
        self.assertIsNone(ReviewRequest(**good).currency_views[0].news[0].published_at)

    def test_contemporaneous_daily_table_remains_readable_after_its_saved_day(self):
        data = self.daily_news()
        data.update(provenance='assessment', note='', planning_as_of_utc='2026-07-15T06:00:00Z')
        for view in data['currency_views']:
            view['direction']['verified_utc'] = '2026-07-15T05:00:00Z'
            view['news'][0]['verified_utc'] = '2026-07-15T05:00:00Z'
            view['checkpoints'][0]['verified_utc'] = '2026-07-15T05:00:00Z'
        record = ReviewEntry(**data, id='a'*32, review_id='b'*32, saved_utc='2026-07-15T06:01:00Z')
        self.assertEqual(record.provenance, 'assessment')
        data['entry_opportunities'][0]['starts_at'] = '2026-07-15T05:59:59Z'
        with self.assertRaises(ValueError):
            ReviewEntry(**data, id='a'*32, review_id='b'*32, saved_utc='2026-07-15T06:01:00Z')


    def test_daily_directions_are_required_binary_and_confined_to_selected_day(self):
        good = self.daily_news()
        for mutate in [lambda d: d['currency_views'][0].update(direction=None),
                lambda d: d['currency_views'][0]['direction'].update(verdict='MIXED'),
                lambda d: d['currency_views'][0]['direction'].update(reason=' '),
                lambda d: d['currency_views'][0]['direction'].update(sources=[]),
                lambda d: d['currency_views'][0]['direction'].update(verified_utc='2099-01-01T00:00:00Z'),
                lambda d: d.update(entry_opportunities=[]),
                lambda d: d['entry_opportunities'].append(d['entry_opportunities'][0]),
                lambda d: d['entry_opportunities'][0].update(currency='EURUSD'),
                lambda d: d['entry_opportunities'][0].update(starts_at='2026-07-14T16:59:59Z'),
                lambda d: d['entry_opportunities'][0].update(ends_at='2026-07-15T17:00:00Z'),
                lambda d: d['entry_opportunities'][0].update(ends_at='2026-07-15T06:00:00Z'),
                lambda d: d['entry_opportunities'][0].update(starts_at='2026-07-15T06:00:00'),
                lambda d: d['entry_opportunities'][0].update(invalidation=' ')]:
            data = json.loads(json.dumps(good)); mutate(data)
            with self.subTest(data=data), self.assertRaises(ValueError): ReviewRequest(**data)
        good['currency_views'][0]['direction']['verdict'] = 'POTENTIAL WEAKENING'
        self.assertEqual(ReviewRequest(**good).currency_views[0].direction.verdict, 'POTENTIAL WEAKENING')

    def test_legacy_news_only_history_reads_but_new_saves_require_directions(self):
        data = self.daily_news()
        data.pop('entry_opportunities')
        for view in data['currency_views']: view.pop('direction')
        with self.assertRaises(ValueError): ReviewRequest(**data)
        record = ReviewEntry(**data, id='a'*32, review_id='b'*32, saved_utc='2026-08-01T06:01:00Z')
        self.assertEqual(record.entry_opportunities, [])
        self.assertTrue(all(view.direction is None for view in record.currency_views))
