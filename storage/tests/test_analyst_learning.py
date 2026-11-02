import copy
from contextlib import nullcontext
from datetime import datetime, timedelta, timezone
import json
import math
import sys
from pathlib import Path
from tempfile import TemporaryDirectory
from types import SimpleNamespace
from unittest import TestCase
from unittest.mock import patch

from storage.analyst_learning.episodes import sync, windows, select
from storage.analyst_learning.outcomes import PriceTape, LEGS
from storage.analyst_learning.store import PROTOCOL_ID, digest, directory, instant, read, stamp, write
from storage.analyst_learning.reports import summary
from storage.analyst_learning.reviews import append_review, append_lesson, retrieve
from storage.analyst_learning.contracts import AssessmentEvaluation

NOW = datetime(2026, 10, 30, 12, tzinfo=timezone.utc)


def learning_commands():
    tools = Path(__file__).resolve().parents[2] / 'Market Analyst Workflow/tools'
    sys.path.insert(0, str(tools))
    try:
        import learning
        return learning
    finally:
        sys.path.remove(str(tools))


def episode(identity='a', currency='EUR', delivered='2026-10-30T09:00:30Z', cutoff='2026-10-30T09:00:00Z', **changes):
    row = dict(id=identity, source_id=identity, source_kind='research', logical_id=identity,
        delivered_utc=delivered, saved_utc=delivered, cutoff_utc=cutoff, currency=currency, provenance='assessment',
        direction={'verdict': 'POTENTIAL STRENGTHENING', 'basis': 'standalone', 'intensity': 'moderate',
            'verified_utc': cutoff, 'reassessment': {'event_at': '2026-10-30T10:00:00Z'}},
        evaluation=None, evidence=[], protocol_id=PROTOCOL_ID)
    row.update(changes)
    row['input_hash'] = digest(row)
    return row


def documents(start=None, count=8, changes=None):
    start = start or datetime(2026, 10, 30, 9, tzinfo=timezone.utc)
    changes = changes or {}
    result = []
    for symbol, _ in LEGS.values():
        bars = []
        for n in range(count):
            price = changes.get(symbol, lambda n: 1.)(n)
            bars.append(dict(utc_time=(start + timedelta(minutes=n)).timestamp(),
                open=price, high=price * 1.01, low=price * .99, close=price))
        result.append((Path(symbol + '.json'), dict(pair=symbol, symbol=symbol, timeframe='M1', broker='Pepperstone-Demo',
            clock_basis='verified fixture', captured_utc=stamp(NOW), from_utc=stamp(start), to_utc=stamp(start + timedelta(minutes=count)), bars=bars)))
    return result


class LearningEpisodeTests(TestCase):
    def test_frozen_versions_idempotence_and_in_place_mutation_rejection(self):
        with TemporaryDirectory() as temp:
            journal = Path(temp) / 'thesis/journal.json'
            row = episode()
            with patch('storage.analyst_learning.episodes.source_episodes', return_value=[row]):
                self.assertEqual(sync(journal)['added'], 1)
                self.assertEqual(sync(journal)['added'], 0)
            changed = episode(direction={**row['direction'], 'intensity': 'slight'})
            before = (directory(journal) / 'episodes.json').read_bytes()
            with patch('storage.analyst_learning.episodes.source_episodes', return_value=[changed]):
                with self.assertRaisesRegex(ValueError, 'changed in place'):
                    sync(journal)
            self.assertEqual((directory(journal) / 'episodes.json').read_bytes(), before)

    def test_actual_delivery_supersession_late_correction_and_checkpoint_gap(self):
        a = episode()
        b = episode('b', delivered='2026-10-30T11:00:00Z', cutoff='2026-10-30T10:59:00Z')
        b['direction']['reassessment']['event_at'] = '2026-10-30T13:00:00Z'
        late = episode('correction', delivered='2026-10-30T11:30:00Z')
        rows = windows([late, b, a], stamp(NOW))
        self.assertEqual(rows[0]['end_utc'], '2026-10-30T10:00:00Z')
        self.assertEqual(rows[0]['checkpoint_overdue_seconds'], 3600)
        self.assertEqual(rows[0]['assessment_latency_seconds'], 30)
        self.assertEqual(rows[1]['window_status'], 'pending')
        self.assertEqual(rows[2]['window_status'], 'obsolete_correction')
        self.assertEqual(rows[0]['window_basis'], 'diagnostic_proxy')

    def test_gap_ends_original_window_and_reconstruction_never_replaces_it(self):
        a = episode()
        gap = episode('gap', delivered='2026-10-30T09:30:00Z', direction=None)
        reconstructed = episode('history', delivered='2026-10-30T09:10:00Z', provenance='reconstruction')
        rows = windows([a, gap, reconstructed], stamp(NOW))
        self.assertEqual(len(rows), 2)
        self.assertEqual(rows[0]['end_reason'], 'superseded')
        self.assertEqual(rows[0]['checkpoint_overdue_seconds'], 0)
        self.assertEqual(rows[1]['window_status'], 'no_direction')

    def test_declared_horizon_and_scope_preserve_other_information(self):
        row = episode(evaluation={'until_utc': '2026-10-30T09:45:00Z'})
        rows = windows([row, episode('usd', currency='USD')], stamp(NOW))
        self.assertEqual(rows[0]['end_reason'], 'declared_horizon')
        self.assertEqual(len(select(rows, 'EURUSD')), 2)
        self.assertEqual(len(select(rows, 'EUR')), 1)
        with self.assertRaises(ValueError):
            select(rows, 'EURXXX')


class LearningPriceTests(TestCase):
    def test_post_delivery_close_baseline_basket_breadth_and_sampled_excursions(self):
        docs = documents(changes={'EURUSD': lambda n: [1., 1.02, .99, 1.01, 1.03, 1.03, 1.03, 1.03][n]})
        # An enormous wick cannot become post-verdict executable profit.
        docs[0][1]['bars'][0]['high'] = 10.
        tape = PriceTape(docs, stamp(NOW))
        row = episode()
        result = tape.measure(row, '2026-10-30T09:04:00Z')
        self.assertEqual(result['status'], 'complete')
        self.assertEqual(result['baseline_utc'], '2026-10-30T09:01:00Z')
        self.assertAlmostEqual(result['return_pct'], 1.)
        self.assertAlmostEqual(result['favourable_close_excursion_pct'], 2.)
        self.assertAlmostEqual(result['adverse_close_excursion_pct'], -1.)
        self.assertEqual(result['directional_breadth'], 7)
        logs = []
        for c in ('USD', *LEGS):
            logs.append(math.log1p(tape.measure(episode(currency=c), '2026-10-30T09:04:00Z')['return_pct'] / 100))
        self.assertAlmostEqual(sum(logs), 0., places=12)

    def test_missing_endpoint_no_substitution_and_incomplete_path_not_complete(self):
        docs = documents()
        docs[-1][1]['bars'].pop(1)
        result = PriceTape(docs, stamp(NOW)).measure(episode(), '2026-10-30T09:04:00Z')
        self.assertEqual(result['status'], 'partial')
        self.assertEqual(result['missing_samples'], 1)
        docs[-1][1]['bars'] = [bar for bar in docs[-1][1]['bars'] if bar['utc_time'] != datetime(2026, 10, 30, 9, 3, tzinfo=timezone.utc).timestamp()]
        self.assertEqual(PriceTape(docs, stamp(NOW)).measure(episode(), '2026-10-30T09:04:00Z')['status'], 'unavailable')

    def test_capture_and_observation_clocks_exclude_forming_and_future_bars(self):
        docs = documents()
        for _, doc in docs:
            doc['captured_utc'] = '2026-10-30T09:03:20Z'
        tape = PriceTape(docs, stamp(NOW))
        self.assertEqual(tape.measure(episode(), '2026-10-30T09:04:00Z')['status'], 'unavailable')
        tape = PriceTape(documents(), '2026-10-30T09:02:00Z')
        self.assertEqual(tape.measure(episode(), '2026-10-30T09:04:00Z')['status'], 'pending')

    def test_invalid_source_prices_conflicts_and_closed_market_baseline(self):
        for change in ({'broker': 'Other'}, {'timeframe': 'D1'}, {'clock_basis': ''}):
            docs = documents(); docs[0][1].update(change)
            with self.assertRaises(ValueError):
                PriceTape(docs, stamp(NOW))
        docs = documents(); docs[0][1]['bars'][0]['close'] = float('nan')
        with self.assertRaises(ValueError):
            PriceTape(docs, stamp(NOW))
        docs = documents(); conflicting = copy.deepcopy(docs[0]); conflicting[1]['bars'][0]['close'] = 1.001
        with self.assertRaisesRegex(ValueError, 'Conflicting'):
            PriceTape([*docs, conflicting], stamp(NOW))
        self.assertEqual(PriceTape(documents(), stamp(NOW)).measure(episode(delivered='2026-10-29T09:00:00Z'), '2026-10-30T09:04:00Z')['status'], 'unavailable')

    def test_pair_preference_uses_both_synchronous_legs(self):
        tape = PriceTape(documents(changes={'EURUSD': lambda n: 1 + n / 100, 'GBPUSD': lambda n: 1 + n / 50}), stamp(NOW))
        result = tape.preference(episode(), {'pair': 'EURGBP', 'verdict': 'BUY'}, '2026-10-30T09:04:00Z')
        self.assertLess(result['signed_return_pct'], 0)
        self.assertEqual(result['direction_result'], 'opposed')

    def test_legacy_proxy_and_partial_observations_do_not_become_primary_scores(self):
        rows = windows([episode('a'), episode('b', currency='USD')], stamp(NOW))
        outcomes = [{'id': 'x', 'episode_id': 'a', 'observation': {'status': 'partial'}},
            {'id': 'y', 'episode_id': 'b', 'observation': {'status': 'complete', 'signed_return_pct': -.1, 'direction_result': 'opposed'}}]
        report = summary(rows, outcomes)
        self.assertEqual(report['currency_day_observations'], 1)
        self.assertEqual(report['direction_by_window_and_intensity'][0]['window'], 'diagnostic_proxy')


class LearningReviewTests(TestCase):
    def setUp(self):
        self.temp = TemporaryDirectory()
        self.journal = Path(self.temp.name) / 'thesis/journal.json'
        self.target = directory(self.journal)
        self.row = episode()
        write(self.target / 'episodes.json', {'episodes': [self.row]})
        write(self.target / 'outcomes.json', {'outcomes': [{'id': 'out', 'episode_id': 'a', 'observation': {'status': 'complete'}}]})

    def tearDown(self):
        self.temp.cleanup()

    def case(self):
        return dict(episode_id='a', outcome_id='out', classification='misweighting', analysis='The contemporaneous policy guidance was not weighed against the earlier assumption.',
            known_before_cutoff='The policy guidance existed before this information cutoff.', subsequent_information='Subsequent prices alone do not establish the cause of demand.',
            source_evidence=[dict(url='https://example.org/policy', claim='The bank retained conditional tightening.', availability_note='Original dated publication checked.',
                published_at='2026-10-30T08:00:00Z', used_as_pre_cutoff=True)])

    def lesson(self, review_id):
        return dict(key='weigh-opposition', kind='process', status='active', currencies=['EUR'], mechanism_tags=['policy'],
            situation='A later policy stage challenges an earlier inference.', rule='Weigh the completed guidance against the earlier interpretation before retaining its sign.',
            exceptions='Do not change direction merely because a later price chart disagrees with the interpretation.',
            supporting_reviews=[review_id], contrary_reviews=[], validation_note='Verified process omission; no statistical or trading-edge claim.')

    def test_causal_review_requires_existing_outcome_and_pre_cutoff_source(self):
        request = self.case(); request['source_evidence'][0]['published_at'] = '2026-10-30T11:00:00Z'
        with self.assertRaisesRegex(ValueError, 'Later evidence'):
            append_review(self.journal, request)
        request = self.case(); request['outcome_id'] = 'missing'
        with self.assertRaisesRegex(ValueError, 'existing episode'):
            append_review(self.journal, request)
        request = self.case(); request['source_evidence'] = []
        with self.assertRaisesRegex(ValueError, 'dated source'):
            append_review(self.journal, request)

    def test_versioned_review_lessons_retrieval_and_retirement(self):
        review = append_review(self.journal, self.case())
        lesson = append_lesson(self.journal, self.lesson(review['id']))
        self.assertEqual(retrieve(self.journal, ['EUR'], ['policy'])[0]['id'], lesson['id'])
        self.assertFalse(retrieve(self.journal, ['USD']))
        self.assertFalse(retrieve(self.journal, ['EUR'], ['energy']))
        request = self.lesson(review['id']); request['status'] = 'retired'
        with self.assertRaisesRegex(ValueError, 'changed'):
            append_lesson(self.journal, request)
        request.update(expected_version=lesson['id'], revision_note='The rule is replaced by a better scoped tested lesson.')
        append_lesson(self.journal, request)
        self.assertFalse(retrieve(self.journal, ['EUR']))
        self.assertEqual(len(read(self.target / 'lessons.json', {})['lessons']), 2)

    def test_retrospective_wins_cannot_activate_directional_hypothesis(self):
        review = append_review(self.journal, self.case())
        request = self.lesson(review['id']); request['kind'] = 'hypothesis'
        with self.assertRaisesRegex(ValueError, 'start in trial'):
            append_lesson(self.journal, request)
        request['status'] = 'trial'; lesson = append_lesson(self.journal, request)
        request.update(status='active', expected_version=lesson['id'], revision_note='Attempted promotion without prospective evidence.')
        with self.assertRaisesRegex(ValueError, 'prospective'):
            append_lesson(self.journal, request)

    def test_evaluation_metadata_has_real_pairs_tags_and_no_forced_grade(self):
        value = dict(until_utc='2026-10-30T10:00:00Z', mechanism_tags=['policy'], intensity_reason='The active mechanism clearly dominates the routine opposition.',
            strongest_opposition='Financing constraints remain important opposing evidence.', invalidation='A materially more patient policy path would defeat the mechanism.')
        self.assertEqual(AssessmentEvaluation(**value).mechanism_tags, ['policy'])
        with self.assertRaises(ValueError):
            AssessmentEvaluation(**{**value, 'relative_preferences': [dict(pair='EUREUR', verdict='BUY', reason='A fabricated pair cannot support a comparison.')]})


class LearningCommandTests(TestCase):
    def test_read_only_prepare_writes_nothing_and_capture_failure_obeys_budget(self):
        learning = learning_commands()
        with TemporaryDirectory() as temp:
            root = Path(temp); journal = root / 'workflow/thesis/journal.json'
            args = SimpleNamespace(read_only=True, as_of=stamp(NOW), scope='ALL', from_date=None,
                to_date=None, input=[], capture=True, max_symbols=2, max_requests=8,
                bridge='fixture', action='prepare', tag=[], limit=5)
            with patch('storage.analyst_learning.episodes.source_episodes', return_value=[episode()]):
                receipt = learning.command(root, journal, args, None)
            self.assertEqual(receipt['snapshot']['status'], 'read_only')
            self.assertFalse(directory(journal).exists())
            args.read_only = False; args.action = 'refresh'
            with patch('storage.analyst_learning.episodes.source_episodes', return_value=[episode()]), \
                    patch.object(learning, 'prices', return_value=[]), \
                    patch.object(learning, 'capture_lock', return_value=nullcontext()), \
                    patch.object(learning, 'fetch_window', side_effect=RuntimeError('fixture disconnected')) as capture:
                first = learning.refresh(root, journal, args, None)
                second = learning.refresh(root, journal, args, None)
            self.assertEqual(len(first['capture_attempts']), 2)
            self.assertEqual(len(second['capture_attempts']), 2)
            self.assertTrue(all(not attempt['ok'] for attempt in first['capture_attempts']))
            self.assertTrue(set(a['symbol'] for a in first['capture_attempts']).isdisjoint(a['symbol'] for a in second['capture_attempts']))
            self.assertEqual(capture.call_count, 4)

    def test_cached_refresh_is_idempotent_but_new_overdue_exposure_is_measured(self):
        learning = learning_commands()
        with TemporaryDirectory() as temp:
            root = Path(temp)
            journal = root / 'workflow/thesis/journal.json'
            row = episode()
            row['direction']['reassessment']['event_at'] = '2026-10-30T09:04:00Z'
            docs = documents(count=12)
            args = SimpleNamespace(read_only=False, as_of='2026-10-30T09:06:00Z', scope='ALL',
                from_date=None, to_date=None, input=[], capture=False, max_symbols=2,
                max_requests=32, bridge='fixture', action='refresh', tag=[], limit=5)
            with patch('storage.analyst_learning.episodes.source_episodes', return_value=[row]), patch.object(learning, 'prices', return_value=docs):
                first = learning.refresh(root, journal, args, None)
                self.assertEqual(first['new_outcomes'], 1)
                self.assertEqual(learning.refresh(root, journal, args, None)['new_outcomes'], 0)
                args.as_of = '2026-10-30T09:08:00Z'
                self.assertEqual(learning.refresh(root, journal, args, None)['new_outcomes'], 1)
            records = read(directory(journal) / 'outcomes.json', {})['outcomes']
            self.assertEqual(records[-1]['post_checkpoint_observation']['terminal_utc'], '2026-10-30T09:08:00Z')
            args.action = 'case'; args.episode = 'a'; args.blind = True; args.read_only = True
            with patch('storage.analyst_learning.episodes.source_episodes', return_value=[row]):
                packet = learning.command(root, journal, args, None)
            self.assertNotIn('direction', packet['evidence_context'])
            self.assertNotIn('outcome', packet)
            self.assertEqual(len(read(directory(journal) / 'outcomes.json', {})['outcomes']), 2)

    def test_secondary_capture_ends_are_matured_and_checkpoint_context_changes(self):
        learning = learning_commands()
        row = windows([episode()], stamp(NOW))[0]
        ends = learning.measurement_ends(row, stamp(NOW))
        self.assertIn(instant('2026-10-30T11:00:30Z'), ends)
        self.assertNotIn(instant('2026-10-31T09:00:30Z'), ends)
        initial = learning.window_revision(row, stamp(NOW))
        row['next_delivery_utc'] = '2026-10-30T11:30:00Z'
        self.assertNotEqual(initial, learning.window_revision(row, stamp(NOW)))
