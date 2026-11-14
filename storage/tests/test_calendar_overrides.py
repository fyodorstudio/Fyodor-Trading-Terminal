import json
from datetime import datetime
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest import TestCase

from storage.alert_calendar import day_snapshot
from storage.calendar_overrides import CalendarOverrides, DIRECTORY
from storage.calendar_store import CalendarStore
from storage.currency_ledger import ledger_snapshot
from storage.recent_calendar import recent_snapshot
from storage.tests.test_calendar_storage import event


def ms(instant):
    return int(datetime.fromisoformat(instant).timestamp() * 1000)


class CalendarOverrideTests(TestCase):
    def setUp(self):
        self.temp = TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.path = Path(self.temp.name) / 'calendar.sqlite3'
        self.store = CalendarStore(self.path)
        self.addCleanup(self.store.close)
        self.release = ms('2026-11-03T10:30:00+07:00')
        self.broker = 'Pepperstone-Demo'
        self.row = event(value_id='258539', event_id='36030008', currency='AUD', country_code='AU',
                         name='RBA Interest Rate Decision', time_mode=1, actual=None, forecast=None, previous=4.6,
                         actual_raw_scaled_1e6=None, unit=1, multiplier=0, digits=2,
                         server_time_seconds=self.release // 1000 + 3600, period_seconds=0)
        with self.store.db:
            self.store._source(self.broker, self.release // 1000 + 86400)
            self.store._observe(self.broker, self.row, 'fixture', self.release / 1000 + 60,
                                {'capture_offset_seconds': 3600})

    def test_rba_correction_reaches_calendar_values_alert_recent_and_ledger_without_rewriting_raw(self):
        changes = self.store.db.total_changes
        stored = self.store.values(self.broker, ['258539'])[0]
        self.assertEqual((stored['actual'], stored['forecast'], stored['previous']), (4.85, 4.85, 4.6))
        self.assertEqual(stored['actual_raw_scaled_1e6'], '4850000')
        self.assertEqual((stored['time_mode'], stored['release_at']), (0, self.release))
        chart = self.release // 1000 + 7200
        self.assertEqual(stored['chart_time_seconds'], chart)
        self.assertEqual(stored['timing_basis'], 'manual-override')
        # The corrected clock, rather than MT5's supplied time, controls filtering.
        queried = self.store.query(self.broker, chart, chart + 1, time_basis='chart')['events']
        self.assertEqual([r['value_id'] for r in queried], ['258539'])
        self.assertEqual(self.store.query(self.broker, chart - 3600, chart - 3599, time_basis='chart')['events'], [])
        alert = day_snapshot(self.store, self.broker, '2026-11-03')['events'][0]
        recent = recent_snapshot(self.store, self.broker, self.release, self.release + 1, ['AUD'])['events'][0]
        for row in (alert, recent):
            self.assertEqual((row['actual'], row['release_at']), (4.85, self.release))
        ledger = ledger_snapshot(self.store, self.broker, now_ms=self.release + 86400000, currencies=['AUD'])
        reading = next(m for m in ledger['metrics'] if m['id'] == 'aud.rate')['entries'][0]
        self.assertEqual((reading['value'], reading['forecast'], reading['at']), (4.85, 4.85, self.release))
        self.assertEqual(self.store.db.total_changes, changes)
        raw = json.loads(self.store.db.execute('SELECT payload FROM events WHERE value_id=?', ('258539',)).fetchone()[0])
        self.assertEqual((raw['actual'], raw['time_mode']), (None, 1))
        self.assertEqual(json.loads(self.store.db.execute('SELECT payload FROM observations').fetchone()[0]), raw)
        next_year = ledger_snapshot(self.store, self.broker, now_ms=ms('2027-01-02T00:00:00+00:00'),
                                    year=2027, currencies=['AUD'])
        predecessor = next(m for m in next_year['metrics'] if m['id'] == 'aud.rate')['entries'][0]
        self.assertEqual((predecessor['value_id'], predecessor['value']), ('258539', 4.85))

    def test_corrected_clock_controls_paging_and_readonly_alarm_reads(self):
        other = event(value_id='other', server_time_seconds=self.release // 1000 + 5400,
                      currency='AUD', actual=0)
        with self.store.db:
            self.store._observe(self.broker, other, 'fixture', self.release / 1000 + 60,
                                {'capture_offset_seconds': 7200})
        chart = self.release // 1000 + 7200
        first = self.store.query(self.broker, chart - 86400, chart + 86400, limit=1, time_basis='chart')
        self.assertEqual(first['events'][0]['value_id'], 'other')
        second = self.store.query(self.broker, chart - 86400, chart + 86400, limit=1, time_basis='chart', **first['next_cursor'])
        self.assertEqual(second['events'][0]['value_id'], '258539')
        self.assertIsNone(second['next_cursor'])
        reader = CalendarStore(self.path, readonly=True)
        try:
            self.assertEqual(reader.values(self.broker, ['258539'])[0]['actual'], 4.85)
        finally:
            reader.close()

    def test_matching_is_exact_and_refreshes_do_not_erase_corrections(self):
        unrelated = {**self.row, 'event_id': '36030009'}
        self.assertIs(self.store.overrides.apply(self.broker, unrelated), unrelated)
        unrelated = {**self.row, 'country_code': 'NZ'}
        self.assertIs(self.store.overrides.apply(self.broker, unrelated), unrelated)
        with self.store.db:
            self.store._observe(self.broker, {**self.row, 'actual': 99, 'revision': 1}, 'fixture',
                                self.release / 1000 + 120, {'capture_offset_seconds': 3600})
        self.assertEqual(self.store.values(self.broker, ['258539'])[0]['actual'], 4.85)
        before_release = ledger_snapshot(self.store, self.broker, now_ms=self.release - 1, currencies=['AUD'])
        self.assertFalse(any(entry['value'] is not None for m in before_release['metrics'] for entry in m['entries']))

    def test_partial_numeric_correction_preserves_other_fields_and_explicit_null(self):
        folder = Path(self.temp.name) / 'overrides'
        folder.mkdir()
        document = {'schema': 1, 'event_id': '36030008', 'currency': 'AUD', 'country': 'AU',
                    'releases': [{'value_id': '258539', 'set': {'actual': 0, 'forecast': None}}]}
        file = folder / 'test.json'
        file.write_text(json.dumps(document), encoding='utf-8')
        overrides = CalendarOverrides(folder)
        corrected = overrides.apply(self.broker, {**self.row, 'forecast': 5, 'forecast_raw_scaled_1e6': '5000000'})
        self.assertEqual((corrected['actual'], corrected['previous'], corrected['time_mode']), (0, 4.6, 1))
        self.assertEqual(corrected['actual_raw_scaled_1e6'], '0')
        self.assertIsNone(corrected['forecast_raw_scaled_1e6'])
        self.assertEqual(self.row['actual'], None)
        document['releases'][0]['set'] = {'released_at': '2026-11-03T10:30:00'}
        file.write_text(json.dumps(document), encoding='utf-8')
        with self.assertRaisesRegex(ValueError, 'timezone'):
            CalendarOverrides(folder)

    def test_committed_history_covers_all_pasted_releases_and_blank_emergency_forecast(self):
        rows = json.loads((DIRECTORY / 'AUD-RBA-rate.json').read_text(encoding='utf-8'))['releases']
        self.assertEqual(len(rows), 123)
        self.assertEqual(len({r['value_id'] for r in rows}), 123)
        self.assertEqual(rows[-1]['set']['released_at'], '2015-02-03T10:30:00+07:00')
        emergency = next(r for r in rows if r['set']['released_at'].startswith('2020-03-19'))
        self.assertIsNone(emergency['set']['forecast'])
