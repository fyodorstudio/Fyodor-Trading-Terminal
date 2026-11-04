from copy import deepcopy
from datetime import datetime, timedelta, timezone
from hashlib import sha256
import json
from pathlib import Path
from tempfile import TemporaryDirectory
import unittest
from unittest.mock import patch

from pydantic import ValidationError

from storage.currency_news import NewsRefresh, encoded, news_run, read_run, save_refresh
from storage.currency_news_feed import news_feed


CHECK = datetime(2026, 1, 4, 4, tzinfo=timezone.utc)


def story(key='policy', **changes):
    item = dict(story_id=key, summary='The bank raised its policy rate.', published_at='2026-01-04T02:00:00Z',
        sources=[dict(label='Bank', url='https://example.com/policy')], bias='bullish', reason='Higher expected yields support the currency.')
    item.update(changes)
    return item


def row(currency='CAD', items=None, at=CHECK):
    return dict(currency=currency, checked_at=at.isoformat(), coverage='checked', items=[story()] if items is None else items)


class CurrencyNewsFeedTests(unittest.TestCase):
    def setUp(self):
        self.temp = TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.directory = Path(self.temp.name)

    def save(self, *rows):
        return save_refresh(NewsRefresh(rows=list(rows)), self.directory)

    def test_publication_dates_override_save_dates_and_have_no_lookback(self):
        self.save(row(items=[story('dated', published_at=None, published_date='2026-01-02'),
                             story('precise', published_at='2026-01-02T16:59:00Z')]))
        self.assertEqual(len(news_feed(self.directory, '2026-01-02')['stories']), 2)
        self.assertEqual(news_feed(self.directory, '2026-01-04')['stories'], [])
        precise = next(s for s in news_feed(self.directory, '2026-01-02')['stories'] if s['id'] == 'precise')
        self.assertEqual(precise['order_at'], precise['published_at'])
        dated = next(s for s in news_feed(self.directory, '2026-01-02')['stories'] if s['id'] == 'dated')
        self.assertIsNone(dated['published_at'])
        self.assertEqual(dated['order_at'], dated['assessed_at'])

    def test_unknown_hour_uses_assessment_for_ordering_and_reassessment_returns_to_top(self):
        self.save(row(items=[story('unknown', published_at=None, published_date='2026-01-04'), story()]))
        self.assertEqual(news_feed(self.directory, '2026-01-04')['stories'][0]['id'], 'unknown')
        self.save(row(items=[story('later', published_at='2026-01-04T05:00:00Z')], at=CHECK+timedelta(hours=2)))
        self.assertEqual(news_feed(self.directory, '2026-01-04')['stories'][0]['id'], 'later')
        self.save(row(items=[story('unknown', published_at=None, published_date='2026-01-04')], at=CHECK+timedelta(hours=3)))
        feed = news_feed(self.directory, '2026-01-04')
        self.assertEqual(feed['stories'][0]['id'], 'unknown')
        self.assertIsNone(feed['stories'][0]['published_at'])
        self.assertEqual(len(feed['stories'][0]['implications'][0]['versions']), 2)
        self.assertEqual({s['id'] for s in feed['stories']}, {'policy', 'unknown', 'later'}, 'Omitted stories are retained')

    def test_unknown_date_uses_assessment_day_and_known_time_uses_jakarta(self):
        self.save(row(items=[story('undated', published_at=None), story('midnight', published_at='2026-01-03T17:00:00Z')]))
        self.assertEqual({s['id'] for s in news_feed(self.directory, '2026-01-04')['stories']}, {'undated', 'midnight'})
        self.assertEqual(news_feed(self.directory, '2026-01-03')['stories'], [])

    def test_shared_story_retains_independent_currency_directions_and_followups(self):
        first = self.save(row(), row('JPY', [story(bias='bearish', reason='The widening foreign rate gap weighs on JPY.')]))
        original = (self.directory/'runs'/f"{first['run_id']}.json").read_bytes()
        self.save(row(items=[story(reason='Updated CAD mechanism.'), story('material-followup')], at=CHECK+timedelta(minutes=1)))
        feed = news_feed(self.directory, '2026-01-04')
        shared = next(s for s in feed['stories'] if s['id'] == 'policy')
        self.assertEqual(len(feed['stories']), 2)
        self.assertEqual(len(shared['sources']), 1)
        views = {i['currency']: i for i in shared['implications']}
        self.assertEqual(views['CAD']['reason'], 'Updated CAD mechanism.')
        self.assertEqual(views['JPY']['bias'], 'bearish')
        self.assertEqual(len(views['CAD']['versions']), 2)
        self.assertEqual(len(views['JPY']['versions']), 1)
        self.assertEqual((self.directory/'runs'/f"{first['run_id']}.json").read_bytes(), original)

    def test_conditional_bias_requires_both_scenarios_and_shared_facts(self):
        good = story(bias='conditional', bullish_if='inflation persists', bearish_if='demand collapses')
        self.save(row(items=[good]))
        for changes in [dict(bullish_if=''), dict(bearish_if=''), dict(reason=''), dict(bias='mixed')]:
            with self.subTest(changes=changes), self.assertRaises(ValidationError):
                NewsRefresh(rows=[row(items=[{**good, **changes}])])
        with self.assertRaises(ValidationError):
            NewsRefresh(rows=[row(), row('JPY', [story(summary='Different facts under the same ID.')])])
        with self.assertRaises(ValidationError):
            NewsRefresh(rows=[row(items=[story(), story()])])
        with self.assertRaises(ValidationError):
            NewsRefresh(rows=[row(items=[story(published_date='2026-01-03')])])
        with self.assertRaises(ValidationError):
            NewsRefresh(rows=[row(items=[story(published_at=None, published_date='2026-01-05')])])

    def test_unchanged_poll_reads_no_run_bodies_and_latest_only_history_is_lazy(self):
        first = self.save(row())
        self.save(row(items=[story(reason='New interpretation.')], at=CHECK+timedelta(minutes=1)))
        with patch('storage.currency_news_feed.read_run', wraps=read_run) as read:
            feed = news_feed(self.directory, '2026-01-04')
            self.assertEqual(read.call_count, 1, 'Only the newest story body is read')
            news_feed(self.directory, '2026-01-04', feed['revision'])
            self.assertEqual(read.call_count, 1, 'Unchanged polling reads metadata only')
        self.assertTrue(news_run(self.directory, first['run_id'])['rows'][5]['snapshot'])

    def test_original_legacy_hash_and_date_in_prose_remain_readable_without_mutation(self):
        # An original payload predates all new model defaults.
        request = dict(window_hours=3, rows=[dict(currency='CAD', checked_at=CHECK.isoformat().replace('+00:00', 'Z'), coverage='checked', coverage_note='',
            items=[], background=[dict(summary='Old policy statement. This is an attributed brief headline, not a deal.',
            published_at=None, timing_note='January 2, 2026; original hour unknown.',
            sources=[dict(label='Bank', url='https://example.com/policy')])],
            implication='no_clear_signal', reason='Original assessment.')])
        run_id = sha256(encoded(request)).hexdigest()
        saved_at = (CHECK+timedelta(minutes=1)).isoformat()
        (self.directory/'runs').mkdir()
        path = self.directory/'runs'/f'{run_id}.json'
        path.write_bytes(encoded(dict(schema=1, saved_at=saved_at, request=request)))
        (self.directory/'latest.json').write_bytes(encoded(dict(schema=2, latest={'CAD':run_id}, history={run_id:dict(saved_at=saved_at,currencies=['CAD'])})))
        before = {p.name:p.read_bytes() for p in self.directory.rglob('*.json')}
        feed = news_feed(self.directory, '2026-01-02')
        self.assertEqual(feed['stories'][0]['summary'], 'Old policy statement.')
        self.assertIn('not a deal', feed['stories'][0]['implications'][0]['reason'])
        self.assertEqual(before, {p.name:p.read_bytes() for p in self.directory.rglob('*.json')})
        retry = save_refresh(NewsRefresh.model_validate(request), self.directory)
        self.assertEqual(retry['run_id'], run_id, 'A legacy retry keeps its original content identity across upgrades')
        self.save(row(at=CHECK+timedelta(hours=1)))
        self.assertEqual(path.read_bytes(), before[path.name], 'Index migration does not rewrite original runs')
        self.assertEqual(len(news_feed(self.directory, '2026-01-02')['stories']), 1)

    def test_corrupt_story_index_does_not_fabricate_empty_feed(self):
        self.save(row())
        path = self.directory/'latest.json'
        original = json.loads(path.read_bytes())
        for mutation in [lambda s:s.update(stories=[]), lambda s:s['stories']['policy']['CAD'][0].update(run_id='a'*64),
                         lambda s:s['stories']['policy']['CAD'][0].update(position=99)]:
            state = deepcopy(original)
            mutation(state)
            path.write_bytes(encoded(state))
            with self.assertRaises((ValueError, IndexError)):
                news_feed(self.directory, '2026-01-04')
