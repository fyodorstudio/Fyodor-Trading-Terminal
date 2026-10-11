import json
import re
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from storage.calendar_store import CalendarStore, DAY, HISTORY_START
from storage.currencies import CURRENCIES, publisher_currencies
from storage.tests.test_calendar_storage import context, event, chunk, NOW


class MajorCurrencyTests(unittest.TestCase):
    def setUp(self):
        self.folder = tempfile.TemporaryDirectory()
        self.store = CalendarStore(Path(self.folder.name) / "calendar.sqlite3")

    def tearDown(self):
        self.store.close()
        self.folder.cleanup()

    def test_unnamed_archive_record_preserves_raw_source_name(self):
        from storage.contracts import CalendarEvent
        row = CalendarEvent.model_validate(event(currency='AUD', name=''))
        self.assertEqual(row.name, '')

    def test_frontend_and_storage_currency_contracts_agree(self):
        source = Path('frontend/src/economic-calendar/forex/currencies.ts').read_text(encoding='utf-8')
        literal = re.search(r'majorCurrencies = (\[[^\]]+\])', source).group(1)
        self.assertEqual(tuple(json.loads(literal.replace("'", '"'))), CURRENCIES)
        self.assertEqual(publisher_currencies('2.0.4'), CURRENCIES)
        self.assertEqual(publisher_currencies('2.0.3'), ('EUR', 'USD', 'GBP'))
        self.assertEqual(publisher_currencies('2.0.2'), ('EUR', 'USD'))

    def test_archive_extension_for_eight_currencies_preserves_live_corrections(self):
        manifest = {"calendar_from_timestamp": str(HISTORY_START), "calendar_to_timestamp": str(NOW),
                    "snapshot_trade_server_timestamp": str(NOW), "snapshot_gmt_timestamp": str(NOW - 10800),
                    "calendar_currencies": ','.join(CURRENCIES)}
        rows = [event(value_id=currency, currency=currency, actual_raw_scaled_1e6='300001') for currency in CURRENCIES]
        with patch('storage.persistence.coverage.CURRENCIES', ('EUR', 'USD', 'GBP')):
            self.assertEqual(self.store.import_rows('seed', 'Broker-Demo', manifest, {'file': 'hash'}, rows)['rows'], 3)
        self.store.register(context(publisher_version='2.0.4'))
        self.store.collect('Broker-Demo', [event(value_id='JPY', currency='JPY', revision=1, actual_raw_scaled_1e6='500001')], 'publisher-1')
        self.assertEqual(self.store.import_rows('seed', 'Broker-Demo', manifest, {'file': 'hash'}, rows)['rows'], 8)
        for currency in CURRENCIES:
            page = self.store.query('Broker-Demo', HISTORY_START, NOW, currency)
            self.assertEqual(len(page['events']), 1)
            expected = '500001' if currency == 'JPY' else '300001'
            self.assertEqual(page['events'][0]['actual_raw_scaled_1e6'], expected)
        self.assertTrue(self.store.import_rows('seed', 'Broker-Demo', manifest, {'file': 'hash'}, rows)['already_imported'])

    def test_pair_query_pages_only_selected_currencies_and_preserves_revisions(self):
        self.store.register(context(publisher_version='2.0.4'))
        rows = [event(value_id=str(i), currency=currency) for i, currency in enumerate(CURRENCIES)]
        self.store.collect('Broker-Demo', rows, 'publisher-1')
        scope = ['AUD', 'JPY']
        first = self.store.query('Broker-Demo', HISTORY_START, NOW, limit=1, time_basis='chart', currencies=scope)
        self.assertEqual(set(first['coverage']), set(scope))
        second = self.store.query('Broker-Demo', HISTORY_START, NOW, limit=1, time_basis='chart', currencies=scope, **first['next_cursor'])
        self.assertEqual({e['currency'] for page in (first, second) for e in page['events']}, set(scope))
        self.assertIsNone(second['next_cursor'])
        corrected = {**rows[2], 'actual': .8, 'revision': 2}
        self.store.collect('Broker-Demo', [corrected], 'publisher-1')
        updated = self.store.query('Broker-Demo', HISTORY_START, NOW, time_basis='chart', currencies=scope)
        self.assertGreater(updated['revision'], first['revision'])
        self.assertEqual(next(e for e in updated['events'] if e['currency'] == 'AUD')['actual'], .8)

    def test_old_publishers_never_lease_new_currency_jobs(self):
        target = ((NOW // DAY) + 1 + 60) * DAY
        self.store.register(context(publisher_version='2.0.4'))
        for currency in ('EUR', 'USD', 'GBP'):
            self.store._coverage('Broker-Demo', currency, HISTORY_START, target, NOW, 'seed')
        modern = self.store.next_job(context(publisher_version='2.0.4'))
        self.assertTrue(modern['available'])
        self.assertIn(modern['currency'], ('AUD', 'NZD', 'CAD', 'CHF', 'JPY'))
        self.assertFalse(self.store.next_job(context(publisher_version='2.0.3'))['available'])
        self.assertFalse(self.store.next_job(context(publisher_version='2.0.2'))['available'])
        # Re-lease with the new publisher and commit one exact source row.
        job = self.store.next_job(context(publisher_version='2.0.4'))
        row = event(currency=job['currency'], server_time_seconds=job['from_server_seconds'], actual_raw_scaled_1e6='1234567')
        self.assertTrue(self.store.receive(chunk(job, [row]))['committed'])
        page = self.store.query('Broker-Demo', job['from_server_seconds'], job['to_server_seconds'], job['currency'])
        self.assertEqual(page['events'][0]['actual_raw_scaled_1e6'], '1234567')
