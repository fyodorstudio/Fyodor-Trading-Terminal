import tempfile
import unittest
import json
from pathlib import Path
from storage.calendar_store import CalendarStore
from storage.tests.test_calendar_storage import event, context, NOW


class R1ScheduleTests(unittest.TestCase):
    def test_actual_snapshots_preserve_corrections_and_invalidate_r1_history(self):
        with tempfile.TemporaryDirectory() as directory:
            store = CalendarStore(Path(directory) / 'test.sqlite3', lambda: NOW)
            try:
                store.register(context(instance_id='test'))
                original = event(currency='USD', country_code='US', actual=.2,
                                 actual_raw_scaled_1e6='200000', server_time_seconds=NOW+10800)
                store.collect('Broker-Demo', [original], 'test', observed_at=NOW+1, capture_offset_seconds=10800)
                corrected = {**original, 'actual': .4, 'actual_raw_scaled_1e6': '400000', 'revision': 1}
                store.collect('Broker-Demo', [corrected], 'test', observed_at=NOW+3600, capture_offset_seconds=10800)
                args=('Broker-Demo', NOW-86400, NOW+86400)
                self.assertNotIn('r1_vintages', store.query(*args, time_basis='chart')['events'][0])
                page=store.query(*args, time_basis='chart', r1_history=True)
                versions=json.loads(page['events'][0]['r1_vintages'])
                self.assertEqual([v['event']['actual'] for v in versions], [.2,.4])
                self.assertEqual([v['knownAt'] for v in versions], [(NOW+1)*1000,(NOW+3600)*1000])
                self.assertEqual(versions[0]['event']['release_at'], NOW*1000)
                self.assertEqual(store.query(*args, time_basis='chart', r1_as_of=NOW*1000)['events'][0]['r1_vintages'], page['events'][0]['r1_vintages'])
                revision=store.status()['revision']
                earlier={**original,'previous':.15}
                store._observe('Broker-Demo',earlier,'archive',NOW,{'capture_offset_seconds':10800},priority=0)
                self.assertGreater(store.status()['revision'],revision,'recovered earlier observation invalidates history even when latest payload is retained')
                self.assertEqual(len(json.loads(store.query(*args,time_basis='chart',r1_history=True)['events'][0]['r1_vintages'])),3)
            finally:
                store.close()

    def test_observed_planned_dates_are_as_of_and_reschedule_safe(self):
        with tempfile.TemporaryDirectory() as directory:
            store = CalendarStore(Path(directory) / 'test.sqlite3', lambda: NOW)
            try:
                store.register(context(instance_id='test'))
                planned = event(currency='USD', country_code='US', actual=None, actual_raw_scaled_1e6=None,
                                server_time_seconds=NOW + 10800 + 86400)
                store.collect('Broker-Demo', [planned], 'test', observed_at=NOW, capture_offset_seconds=10800)
                self.assertEqual(store.planned_schedules('Broker-Demo', NOW * 1000 - 1), [])
                first = store.planned_schedules('Broker-Demo', NOW * 1000)
                self.assertEqual(first[0]['dueAt'], (NOW + 86400) * 1000)
                postponed = {**planned, 'server_time_seconds': planned['server_time_seconds'] + 86400}
                store.collect('Broker-Demo', [postponed], 'test', observed_at=NOW + 10, capture_offset_seconds=10800)
                self.assertEqual(store.planned_schedules('Broker-Demo', NOW * 1000), first)
                updated = store.planned_schedules('Broker-Demo', (NOW + 10) * 1000)
                self.assertEqual(updated[1]['supersedesDueAt'], first[0]['dueAt'])
                actual = {**postponed, 'actual': .3}
                store.collect('Broker-Demo', [actual], 'test', observed_at=NOW + 2*86400, capture_offset_seconds=10800)
                self.assertEqual(store.planned_schedules('Broker-Demo', (NOW + 3*86400) * 1000), updated,
                                 'actual publication never invents a schedule announcement')
                store._observe('Unknown-Broker', planned, 'archive', NOW, {})
                self.assertEqual(store.planned_schedules('Unknown-Broker', NOW * 1000), [])
                query = store.query('Broker-Demo', NOW, NOW + 4*86400, time_basis='chart', r1_as_of=NOW*1000)
                self.assertEqual(query['r1_schedules'], first)
                revision = store.status()['revision']
                older = {**planned, 'server_time_seconds': planned['server_time_seconds'] + 10}
                store._observe('Broker-Demo', older, 'archive', NOW - 1, {'capture_offset_seconds': 10800}, priority=0)
                self.assertGreater(store.status()['revision'], revision,
                                   'new schedule evidence invalidates caches even when current payload wins')
            finally:
                store.close()


if __name__ == '__main__':
    unittest.main()
