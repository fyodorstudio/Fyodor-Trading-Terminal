"""Observable coverage/persistence failures, including the missed Treasury window."""
from copy import deepcopy
from datetime import datetime, timezone
import json
from pathlib import Path
import sys
from tempfile import TemporaryDirectory
from unittest import TestCase
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'Market Analyst Workflow/tools'))
from discovery_audit import capture, collect_pages, required_sources, validate_receipt
from storage.external_sources import ExternalRequest, append_external, external_history, archive_external

FIXTURES = ROOT / '.agents/skills/assess-trade-now/tests/fixtures/treasury-cutoff'
NOW = datetime(2026, 10, 21, 19, 30, tzinfo=timezone.utc)


class DiscoveryAuditTests(TestCase):
    def setUp(self):
        self.temp = TemporaryDirectory()
        self.directory = Path(self.temp.name)
        self.sources = []
        for family, currency in required_sources('EURUSD'):
            identity = f'{currency.lower()}-{family}'
            local = currency == 'ALL'
            path = self.directory / (identity + ('.json' if local else '.txt'))
            path.write_text(json.dumps({'pages': [{'items': [], 'next_offset': None}], 'matches': 0, 'next_offset': None})
                            if local else 'Opened publisher body preserved for coverage validation.', encoding='utf-8')
            self.sources.append(dict(id=identity, family=family, currency=currency, status='checked',
                checked_utc='2026-10-21T17:18:00Z', evidence_path=path.name,
                url='https://www.treasurydirect.gov/auctions/buy-backs/', retrieval_method='offline fixture'))
        preliminary = ET.parse(FIXTURES / 'BBPA_20261021174000.xml').getroot()
        self.event = dict(key='treasury-tips', title='Scheduled TIPS operation', currencies=['USD'], stage='operation',
            event_at=preliminary.findtext('operationStartDTM'), event_date=None,
            available_utc=preliminary.findtext('announcementDTM'), used_for_prompt_verdict=False,
            source_ids=['usd-treasury-buybacks'], material=True, surface=True, decision_note='Material intraday debt operation',
            pin={'source': 'external', 'reference': 'treasury-tips', 'status': 'saved', 'saved_utc': '2026-10-21T17:19:00Z'})
        self.receipt = dict(scope='EURUSD', broker='fixture-broker', as_of_utc='2026-10-21T17:16:40Z',
            started_utc='2026-10-21T17:16:40Z', discovery_completed_utc='2026-10-21T17:20:00Z',
            backdrop_started_utc='2026-10-21T17:21:00Z', horizon_days=7, read_only=False,
            coverage='complete', gaps=[], sources=self.sources, events=[self.event])
        self.stored = dict(key='treasury-tips', archived=False, currencies=['USD'],
            event_at='2026-10-21T17:40:00Z', event_date=None, chart_icon_request_id='a' * 32)

    def tearDown(self):
        self.temp.cleanup()

    def validate(self, receipt=None, stored=None):
        return validate_receipt(receipt or self.receipt, self.directory,
            lambda key: self.stored if stored is None else stored, lambda key: None, NOW)

    def assert_invalid(self, fragment, receipt=None, stored=None):
        result = self.validate(receipt, stored)
        self.assertFalse(result['valid'], result)
        self.assertTrue(any(fragment in e for e in result['errors']), result)

    def test_cutoff_fixture_requires_the_known_imminent_operation_without_future_actuals(self):
        before = ET.parse(FIXTURES / 'BBPA_20261021174000.xml').getroot()
        after = ET.parse(FIXTURES / 'BBR_20261021174000.xml').getroot()
        self.assertFalse(before.findtext('totalParAmountAccepted'))
        self.assertEqual(after.findtext('totalParAmountOffered'), '4751000000')
        self.assertEqual(after.findtext('totalParAmountAccepted'), '750000000')
        self.assertEqual(after.findtext('numberIssuesAccepted'), '8')
        self.assertEqual(self.event['event_at'], '2026-10-21T13:40:00-04:00')
        self.assertTrue(self.validate()['valid'])
        self.event['surface'] = False
        self.assert_invalid('imminent/just-elapsed stage was omitted')

    def test_macro_backdrop_does_not_replace_treasury_coverage_or_opened_evidence(self):
        self.sources[:] = [s for s in self.sources if s['id'] != 'usd-treasury-buybacks']
        self.assert_invalid('Missing required source: USD treasury-buybacks')
        receipt = deepcopy(self.receipt)
        receipt['sources'][0]['status'] = 'pending'
        self.assert_invalid('still pending', receipt)
        receipt = deepcopy(self.receipt)
        receipt['sources'][0]['evidence_path'] = 'missing.json'
        self.assert_invalid('opened-source evidence is missing', receipt)

    def test_before_after_information_sets_and_discovery_order(self):
        self.event.update(available_utc='2026-10-21T18:04:00Z', used_for_prompt_verdict=True)
        self.assert_invalid('leaked into prompt-time verdict')
        self.event.update(available_utc=None, availability_note='Exact results-publication clock unresolved')
        self.assert_invalid('leaked into prompt-time verdict')
        self.event['used_for_prompt_verdict'] = False
        self.receipt['backdrop_started_utc'] = '2026-10-21T17:17:00Z'
        self.assert_invalid('Backdrop started before immediate discovery')
        self.receipt['backdrop_started_utc'] = '2026-10-21T17:21:00Z'
        self.event['pin']['saved_utc'] = '2026-10-21T17:22:00Z'
        self.assert_invalid('pin was deferred')
        self.event['discovered_utc'] = '2026-10-21T17:21:30Z'
        self.assertTrue(self.validate()['valid'], 'Later discoveries can be pinned as separate post-prompt updates')
        self.event['discovered_utc'] = '2026-10-22T00:00:00Z'
        self.assert_invalid('invalid actual discovery clock')

    def test_sources_fail_loudly_or_pass_only_with_disclosed_partial_coverage(self):
        source = next(s for s in self.sources if s['id'] == 'eur-policy')
        source.update(status='unavailable', attempts=['official page'], note='Publisher access failed')
        self.assert_invalid('route attempts')
        source['attempts'].append('official text alternate')
        self.assert_invalid('partial coverage')
        self.receipt.update(coverage='partial', gaps=['eur-policy: both routes failed'])
        self.assertTrue(self.validate()['valid'])

    def test_claimed_icons_and_pins_need_actual_active_scoped_store_evidence(self):
        self.assert_invalid('Show icon on chart request', stored={**self.stored, 'chart_icon_request_id': None})
        self.assert_invalid('active scoped external pin', stored={**self.stored, 'archived': True})
        self.assert_invalid('active scoped external pin', stored={**self.stored, 'currencies': ['JPY']})
        self.assert_invalid('stage/time differs', stored={**self.stored, 'event_at': '2026-10-21T18:00:00Z'})
        self.event['pin']['status'] = 'recommended'
        self.assert_invalid('has not been pinned')

    def test_separate_usd_operations_and_non_usd_policy_stage_readback(self):
        required = set(required_sources('EURUSD'))
        self.assertTrue({('treasury-auctions', 'USD'), ('treasury-buybacks', 'USD'), ('market-operations', 'USD')} <= required)
        self.event.update(key='ecb-qa', currencies=['EUR'], stage='press-conference',
                          source_ids=['eur-policy'], decision_note='Policy guidance can change the expected rate path')
        self.event['pin'].update(source='highlight', reference='ecb-pin', value_ids=['101'])
        stored = dict(id='ecb-pin', source_id='fixture-broker', currency='EUR', archived_utc=None,
                      value_ids=['101'], release_at=int(datetime(2026, 10, 21, 17, 40, tzinfo=timezone.utc).timestamp() * 1000))
        run = lambda: validate_receipt(self.receipt, self.directory, lambda key: None, lambda key: stored, NOW)
        self.assertTrue(run()['valid'])
        stored['release_at'] += 1800000
        self.assertTrue(any('broker stage/time differs' in e for e in run()['errors']))
        stored['release_at'] = None
        self.event.update(event_at=None, event_date='2026-10-21')
        stored['event_date'] = '2026-10-21'
        self.assertTrue(run()['valid'])
        stored['event_date'] = '2026-10-22'
        self.assertTrue(any('broker date-only stage differs' in e for e in run()['errors']))

    def test_read_only_and_failed_writes_are_explicit_not_false_success(self):
        self.receipt['read_only'] = True
        self.assert_invalid('read-only override')
        self.event['pin']['status'] = 'read_only'
        self.assertTrue(self.validate()['valid'])
        self.receipt['read_only'] = False
        self.event['pin'].update(status='failed', note='Storage write unavailable')
        self.assert_invalid('partial coverage')
        self.receipt.update(coverage='partial', gaps=['treasury-tips: storage write unavailable'])
        self.assertTrue(self.validate()['valid'])

    def test_independent_readback_against_real_isolated_external_store(self):
        store = self.directory / 'external'
        request = ExternalRequest(key='treasury-tips', title='Verified operation', currencies=['USD'],
            kind='scheduled', status='confirmed', event_at=self.event['event_at'], facts='Known operation, no result yet.',
            time_note='Operation start; results later.', show_on_chart=True,
            sources=[dict(kind='web', label='Original announcement', locator=self.sources[-1]['url'])])
        saved = append_external(request, store)
        lookup = lambda key: external_history(key, store)[-1]
        self.assertTrue(validate_receipt(self.receipt, self.directory, lookup, lambda key: None, NOW)['valid'])
        archive_external('treasury-tips', saved['id'], store)
        self.assertFalse(validate_receipt(self.receipt, self.directory, lookup, lambda key: None, NOW)['valid'])

    def test_complete_pagination_and_mutation_free_start_with_rolling_boundary_day(self):
        calls = []
        def runner(args):
            calls.append(args)
            return dict(items=[], matches=0, offset=0, next_offset=None)
        output = self.directory / 'capture'
        result = capture(self.directory, output, 'EURUSD', 'fixture-broker', self.receipt['as_of_utc'], runner=runner)
        receipt = json.loads(Path(result['path']).read_text())
        self.assertEqual(result['pending_web_checks'], 9)
        self.assertTrue(all(s['status'] == 'checked' for s in receipt['sources'][:4]))
        self.assertEqual([c[0] for c in calls], ['highlights', 'limitations', 'external', 'upcoming'])
        self.assertIn('8', calls[-1], 'Include the overnight rolling-horizon boundary')
        self.assertEqual(len(list(output.glob('*.json'))), 5)
        with self.assertRaisesRegex(ValueError, 'already exists'):
            capture(self.directory, output, 'EURUSD', 'fixture-broker', runner=runner)
        longer = capture(self.directory, self.directory / 'longer', 'EURUSD', 'fixture-broker', days=120, runner=runner)
        self.assertEqual(json.loads(Path(longer['path']).read_text())['horizon_days'], 120)
        self.assertIn('90', calls[-1], 'Longer web horizons retain the bounded broker query')
        pages = iter([dict(items=[{'id': 1}], matches=2, next_offset=1, revision='a'),
                      dict(items=[{'id': 2}], matches=2, next_offset=None, revision='a')])
        full = collect_pages(lambda args: next(pages), ['external'], 1)
        self.assertEqual(full['matches'], 2)
        self.assertIsNone(full['next_offset'])
        with self.assertRaisesRegex(ValueError, 'changed during pagination'):
            pages = iter([dict(items=[1], matches=2, next_offset=1, revision='a'), dict(items=[2], matches=2, next_offset=None, revision='b')])
            collect_pages(lambda args: next(pages), ['external'], 1)
