import json
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest import TestCase
from unittest.mock import patch

from storage.alert_calendar import day_snapshot
from storage.alert_subscriptions import calendar_subscription
from storage.calendar_audit import audit, import_evidence
from storage.calendar_evidence import CalendarEvidence, as_millis, read_evidence
from storage.calendar_store import CalendarStore
from storage.recent_calendar import recent_snapshot


BROKER = 'Pepperstone-Demo'
SCHEDULE = {'name': 'S&P Global', 'url': 'https://www.pmi.spglobal.com/Public/Home/PDF/UK_Rel_Dates'}
FORECAST = {'name': 'Forex Factory', 'url': 'https://nfs.faireconomy.media/ff_calendar_thisweek.json', 'as_of': '2026-10-23T13:00:00Z', 'value': 51.2}


def release(**changes):
    return {'series': {'event_id': '840500001', 'country': 'US', 'currency': 'USD', 'unit': 0, 'multiplier': 0, 'digits': 1},
            'period': '2026-10-01', 'released_at': '2026-10-23T13:45:00Z', 'schedule': SCHEDULE, 'stage': 'Flash', **changes}


class CalendarEvidenceTests(TestCase):
    def test_verified_release_uses_calendar_and_alarm_routes_and_merges_with_mt5(self):
        flash = release(forecast=FORECAST)
        final = release(released_at='2026-11-02T14:45:00Z', stage='Final', actual={**SCHEDULE, 'value': 52.3})
        evidence = CalendarEvidence([flash, final])
        temp = self.enterContext(TemporaryDirectory())
        with patch.object(CalendarEvidence, 'load', return_value=evidence):
            store = CalendarStore(Path(temp) / 'calendar.sqlite3')
            self.addCleanup(store.close)
            at = as_millis(flash['released_at'])
            native = at // 1000 + 10800
            missing = store.query(BROKER, native, native + 3600, 'USD', time_basis='chart', event_ids=['840500001'])['events']
            self.assertEqual(len(missing), 1)
            row = missing[0]
            self.assertEqual((row['forecast'], row['actual'], row['chart_time_seconds'], row['release_stage']), (51.2, None, native, 'Flash'))
            self.assertEqual(row['calendar_sources']['forecast']['name'], 'Forex Factory')
            self.assertEqual(day_snapshot(store, BROKER, '2026-10-23')['events'][0]['value_id'], row['value_id'])
            _, subscription = calendar_subscription(store, BROKER, [row['value_id']], 'Flash PMI', True)
            self.assertEqual(subscription['value_ids'], [row['value_id']])

            raw = {**row, 'value_id': '123', 'release_at': None, 'actual': 51.7, 'forecast': 49.9,
                   'forecast_raw_scaled_1e6': '49900000'}
            with store.db:
                store.db.execute('INSERT INTO events VALUES (?,?,?,?,?,?,?,?)', (BROKER, '123', native, 'USD', json.dumps(raw), 0, 1, 'live'))
                store.db.execute('INSERT INTO event_timing VALUES (?,?,?,?,?,?,?)', (BROKER, '123', 10800, at, native, 'test', 'pepperstone-ny-close-v1'))
            deduplicated = day_snapshot(store, BROKER, '2026-10-23')['events']
            self.assertEqual([(item['value_id'], item['actual'], item['forecast']) for item in deduplicated], [('123', 51.7, 51.2)])
            self.assertNotIn('forecast_raw_scaled_1e6', deduplicated[0])
            self.assertEqual(store.current_values(BROKER, [row['value_id']])[0]['value_id'], '123')
            self.assertEqual(store.db.execute("SELECT json_extract(payload,'$.forecast') FROM events").fetchone()[0], 49.9)
            upcoming = recent_snapshot(store, BROKER, at, as_millis(final['released_at']), ['USD'])['events']
            self.assertEqual([(item['release_stage'], item['actual']) for item in upcoming], [('Final', 52.3), ('Flash', 51.7)])
            result = audit(store, BROKER, '2026-10-23', '2026-11-02', {('840500001', 'US', 'USD')}, [flash, final])
            self.assertEqual([item['status'] for item in result['comparisons']], ['discrepancy', 'missing'])

    def test_reimport_preserves_newer_pre_release_forecast_and_rejects_late_evidence(self):
        original = release(forecast=FORECAST)
        older = release(forecast={**FORECAST, 'as_of': '2026-10-22', 'value': 40.0})
        future = release(forecast={**FORECAST, 'as_of': '2026-10-23T13:45:00Z'})
        with TemporaryDirectory() as folder:
            path = Path(folder)
            self.assertTrue(import_evidence([original], path))
            self.assertFalse(import_evidence([older], path))
            self.assertEqual(read_evidence(path / 'verified-releases.json'), [original])
            with self.assertRaisesRegex(ValueError, 'predate'):
                import_evidence([future], path)
            self.assertEqual(read_evidence(path / 'verified-releases.json'), [original])
