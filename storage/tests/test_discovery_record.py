from copy import deepcopy
from datetime import datetime, timedelta, timezone
import json
from pathlib import Path
from unittest import TestCase
from unittest.mock import patch

import test_discovery_audit as audit
from discovery_audit import validate_receipt
from discovery_record import record_source, finish


class DiscoveryRecordTests(TestCase):
    setUp = audit.DiscoveryAuditTests.setUp
    tearDown = audit.DiscoveryAuditTests.tearDown

    def prepare(self, release=True):
        receipt = deepcopy(self.receipt)
        receipt['sources'][4]['status'] = 'pending'
        if release:
            receipt.update(mode='release', release_at_utc='2026-10-21T17:20:00Z', deadline_utc='2026-10-21T17:25:00Z')
        path = self.directory / 'discovery.json'
        path.write_text(json.dumps(receipt))
        body = self.directory / 'publisher.txt'
        body.write_text('Opened original publisher body, not a search snippet.')
        return path, body, receipt['sources'][4]['id']

    def record(self, path, identity, body=None, **kwargs):
        return record_source(path, identity, kwargs.pop('status', 'partial'), kwargs.pop('url', 'https://publisher.test/release'),
            evidence=body, tool_reference='source-open-1', note='Opened release; full family schedule scan is unfinished.', root=self.directory, **kwargs)

    def validate(self, path):
        return validate_receipt(json.loads(path.read_text()), self.directory, lambda key: self.stored, lambda key: None)

    def test_incremental_evidence_is_retained_and_deadline_deferral_is_honest_partial(self):
        path, body, identity = self.prepare()
        first = self.record(path, identity, body)
        original = (path.parent / first['evidence_path']).read_bytes()
        body.write_text('Newer source evidence.')
        self.record(path, identity, body, url='https://publisher.test/schedule')
        self.assertEqual((path.parent / first['evidence_path']).read_bytes(), original)
        receipt = json.loads(path.read_text())
        receipt['sources'][5]['status'] = 'pending'
        path.write_text(json.dumps(receipt))
        result = finish(path, 'release_deadline', 'Reached the declared release deadline; preserve verified facts and unfinished checks.')
        receipt = json.loads(path.read_text())
        self.assertEqual(receipt['sources'][4]['status'], 'partial')
        self.assertEqual(len(receipt['sources'][4]['checks']), 2)
        self.assertEqual(receipt['sources'][5]['status'], 'deferred')
        self.assertNotIn('attempts', receipt['sources'][5], 'Unattempted checks must not become invented source failures')
        self.assertEqual(result['coverage'], 'partial')
        check = self.validate(path)
        self.assertTrue(check['valid'], check)
        self.assertFalse(check['coverage_complete'])
        with self.assertRaisesRegex(ValueError, 'finished'):
            self.record(path, identity, body)

    def test_actual_retrieval_failures_remain_separate_from_deadline_deferrals(self):
        path, body, identity = self.prepare(release=False)
        self.record(path, identity, outcome='failed')
        self.record(path, identity, status='unavailable', outcome='failed', url='https://publisher.test/alternate')
        finish(path, 'source_gaps', 'Two actual retrieval routes failed.')
        receipt = json.loads(path.read_text())
        source = receipt['sources'][4]
        self.assertEqual(source['status'], 'unavailable')
        self.assertEqual([c['outcome'] for c in source['checks']], ['failed', 'failed'])
        self.assertEqual(len(source['attempts']), 2)
        self.assertTrue(self.validate(path)['valid'])

    def test_normal_assessment_and_unelapsed_deadline_cannot_skip_required_checks(self):
        path, body, identity = self.prepare(release=False)
        self.record(path, identity, body)
        self.assertFalse(self.validate(path)['valid'])
        before = path.read_bytes()
        with self.assertRaises(ValueError):
            finish(path, 'release_deadline', 'Attempt to skip normal assessment checks')
        with self.assertRaises(ValueError):
            finish(path, 'complete')
        self.assertEqual(path.read_bytes(), before)
        receipt = json.loads(before)
        receipt.update(mode='release', release_at_utc=datetime.now(timezone.utc).isoformat(),
                       deadline_utc=(datetime.now(timezone.utc) + timedelta(minutes=5)).isoformat())
        path.write_text(json.dumps(receipt))
        with self.assertRaises(ValueError):
            finish(path, 'release_deadline', 'Deadline is not elapsed')

    def test_failed_atomic_record_preserves_receipt_and_prior_source_bytes(self):
        path, body, identity = self.prepare()
        before = path.read_bytes()
        with patch('discovery_record.os.replace', side_effect=OSError('write failed')):
            with self.assertRaises(OSError):
                self.record(path, identity, body)
        self.assertEqual(path.read_bytes(), before)
        self.assertEqual(list((path.parent / 'evidence').glob('*')), [])
        self.assertEqual(list(path.parent.glob('*.tmp')), [])
        self.assertEqual(body.read_text(), 'Opened original publisher body, not a search snippet.')

    def test_partial_family_can_support_a_verified_candidate_without_claiming_complete_scan(self):
        path, body, identity = self.prepare()
        self.record(path, identity, body)
        receipt = json.loads(path.read_text())
        receipt['events'][0]['source_ids'] = [identity]
        path.write_text(json.dumps(receipt))
        finish(path, 'release_deadline', 'Full scan unfinished; this event has opened evidence.')
        self.assertTrue(self.validate(path)['valid'])
        receipt = json.loads(path.read_text())
        receipt['sources'][4]['checks'][0]['outcome'] = 'failed'
        path.write_text(json.dumps(receipt))
        self.assertTrue(any('candidate needs checked source evidence' in e for e in self.validate(path)['errors']))
