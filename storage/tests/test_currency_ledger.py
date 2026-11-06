import asyncio
from datetime import datetime, timezone
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest import TestCase
import json

from storage.app import create_app
from storage.calendar_store import CalendarStore
from storage.currency_ledger import ledger_snapshot
from storage.detail_registry import registry
from storage.currencies import CURRENCIES
from itertools import combinations
from storage.tests.test_calendar_storage import event


def ms(day):
    return int(datetime.fromisoformat(day).replace(tzinfo=timezone.utc).timestamp() * 1000)


NOW = ms('2026-11-06T10:00:00')


def seed_ledger(store):
    def add(metric_id, identity, released, value, previous, captured=None, **extra):
        metric = next(m for m in registry()['metrics'] if m['id'] == metric_id)
        row = event(value_id=identity, event_id=metric['broker_event_id'], currency=metric['currency'],
                    country_code=metric['broker_country'], unit=metric['broker_unit'], multiplier=metric['broker_multiplier'],
                    server_time_seconds=ms(released)//1000+7200, actual=value, previous=previous,
                    period_seconds=ms(released[:7]+'-01')//1000, **extra)
        store._observe('Pepperstone-Demo', row, 'fixture', ms(captured or released)/1000,
                       {'capture_offset_seconds': 7200})
    with store.lock, store.db:
        store._source('Pepperstone-Demo', NOW//1000+7200)
        add('usd.cpi-yoy', 'prior-year', '2025-12-12T13:30:00', 3.2, 3.3)
        add('usd.cpi-yoy', 'seed', '2026-04-10T12:30:00', 3.1, 3.2)
        add('usd.cpi-yoy', 'aug', '2026-08-12T12:30:00', 3, 3.1, '2026-08-13T12:00:00')
        add('usd.cpi-yoy', 'sep', '2026-09-11T12:30:00', 2.8, 3, '2026-09-11T12:31:00')
        add('usd.cpi-yoy', 'sep', '2026-09-11T12:30:00', 2.9, 3, '2026-09-15T12:00:00', revision=1, revised_previous=3.05)
        add('usd.rate', 'us-rate', '2026-08-01T18:00:00', 4, 4)
        add('cad.rate', 'ca-rate', '2026-09-02T13:45:00', 4, 3.75)
        add('usd.unemployment', 'us-jobs', '2026-09-04T12:30:00', 4.4, 4.2)
        add('cad.unemployment', 'ca-jobs', '2026-09-04T12:30:00', 6.5, 6.7)
        add('usd.payrolls', 'us-nfp', '2026-09-04T12:30:00', 100, 150)
        add('cad.employment', 'ca-employment', '2026-09-04T12:30:00', 40, 20)
        add('cad.cpi-yoy', 'date-only', '2026-08-20T00:00:00', 2.5, 2.6, time_mode=1)
        add('cad.retail', 'zero', '2026-09-01T12:30:00', 0, .2)
        add('usd.rate', 'future', '2026-11-18T19:00:00', 9, 4, '2026-11-01T10:00:00')
        add('cad.rate', 'schedule', '2026-11-18T14:45:00', None, 4, '2026-11-01T10:00:00')


class LedgerTests(TestCase):
    def setUp(self):
        self.temp = TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.store = CalendarStore(self.root/'calendar.sqlite3')
        self.addCleanup(self.store.close)
        seed_ledger(self.store)

    def test_bounded_series_seeds_vintages_clocks_and_no_writes(self):
        changes = self.store.db.total_changes
        queries = []
        self.store.db.set_trace_callback(queries.append)
        data = ledger_snapshot(self.store, 'Pepperstone-Demo', now_ms=NOW)
        self.store.db.set_trace_callback(None)
        self.assertEqual((data['from_date'], data['through_date']), ('2026-01-01', '2026-12-31'))
        self.assertEqual((data['year'], data['min_year'], data['max_year']), (2026, 2015, 2026))
        metrics = {m['id']: m for m in data['metrics']}
        self.assertEqual({m['currency'] for m in data['metrics']}, {'USD', 'CAD'})
        entries = sorted(metrics['usd.cpi-yoy']['entries'], key=lambda e: e['known_at'])
        self.assertEqual([e['value_id'] for e in entries], ['prior-year', 'seed', 'aug', 'sep', 'sep'])
        self.assertEqual([e['value'] for e in entries], [3.2, 3.1, 3, 2.8, 2.9])
        self.assertEqual(entries[-1]['known_at'], ms('2026-09-15T12:00:00'))
        self.assertIsNone(metrics['cad.cpi-yoy']['entries'][0]['at'])
        self.assertEqual(metrics['cad.retail']['entries'][0]['value'], 0)
        self.assertIsNone(next(e for e in metrics['usd.rate']['entries'] if e['value_id']=='future')['value'])
        self.assertIsNone(next(e for e in metrics['cad.rate']['entries'] if e['value_id'] == 'schedule')['value'])
        self.assertEqual(changes, self.store.db.total_changes)
        seeks = [q for q in queries if q.startswith('SELECT value_id FROM events')]
        self.assertEqual(len(seeks), sum(m['event_id'] is not None for m in metrics.values()))
        ranges = [q for q in queries if q.startswith('SELECT value_id,payload FROM events')]
        self.assertEqual(len(ranges), 2)
        for q in ranges:
            self.assertIn('events_ledger_range', ' '.join(r[3] for r in self.store.db.execute('EXPLAIN QUERY PLAN '+q)))
        for q in seeks:
            self.assertIn('events_detail_series', ' '.join(r[3] for r in self.store.db.execute('EXPLAIN QUERY PLAN '+q)))
        queries.clear(); self.store.db.set_trace_callback(queries.append)
        self.assertTrue(ledger_snapshot(self.store, 'Pepperstone-Demo', data['revision'], NOW)['unchanged'])
        self.store.db.set_trace_callback(None)
        self.assertFalse(any('FROM observations' in q or 'FROM events' in q for q in queries), 'Unchanged polls reuse currency snapshots')
        queries.clear(); self.store.db.set_trace_callback(queries.append)
        self.assertTrue(ledger_snapshot(self.store,'Pepperstone-Demo',data['revision'],NOW+31000)['unchanged'])
        self.store.db.set_trace_callback(None)
        self.assertFalse(any('FROM observations' in q or 'FROM events' in q for q in queries), 'Polling clock buckets do not replay stable histories')
        future=ledger_snapshot(self.store,'Pepperstone-Demo',now_ms=ms('2026-11-18T19:00:01'))
        self.assertEqual(next(e for m in future['metrics'] for e in m['entries'] if e['value_id']=='future')['value'],9)
        self.assertTrue(all(not m['entries'] for m in ledger_snapshot(self.store, 'Other', now_ms=NOW)['metrics']))

    def test_calendar_years_and_immutable_capture_history(self):
        snap = ledger_snapshot(self.store, 'Pepperstone-Demo', now_ms=ms('2026-08-31T12:00:00'))
        self.assertEqual(snap['from_date'], '2026-01-01')
        self.assertNotIn('sep', [e['value_id'] for m in snap['metrics'] for e in m['entries']])
        self.assertEqual(self.store.db.execute('SELECT count(*) FROM observations WHERE value_id=?', ('sep',)).fetchone()[0], 2)
        older = ledger_snapshot(self.store, 'Pepperstone-Demo', now_ms=NOW, year=2025)
        self.assertEqual((older['from_date'], older['through_date']), ('2025-01-01', '2025-12-31'))
        self.assertEqual([e['value_id'] for m in older['metrics'] for e in m['entries']], ['prior-year'])
        for year in [2014, 2027]:
            with self.assertRaises(ValueError): ledger_snapshot(self.store, 'Pepperstone-Demo', now_ms=NOW, year=year)

    def test_coverage_expiration_invalidates_without_a_payload_change(self):
        server_now=NOW//1000+7200
        with self.store.db:
            self.store.db.execute('INSERT INTO coverage VALUES (?,?,?,?,?,?)',('Pepperstone-Demo','USD',ms('2026-01-01')//1000,ms('2027-01-01')//1000,server_now+10,'fixture'))
        first=ledger_snapshot(self.store,'Pepperstone-Demo',now_ms=NOW)
        self.assertEqual(first['coverage']['USD']['missing'],[])
        revision=self.store.db.execute('SELECT value FROM data_revision WHERE id=1').fetchone()[0]
        with self.store.db:
            self.store._source('Pepperstone-Demo',server_now+20)
        self.assertEqual(self.store.db.execute('SELECT value FROM data_revision WHERE id=1').fetchone()[0],revision)
        second=ledger_snapshot(self.store,'Pepperstone-Demo',now_ms=NOW+20000)
        self.assertNotEqual(first['revision'],second['revision'])
        self.assertTrue(second['coverage']['USD']['missing'])

    def test_rejected_late_archive_cannot_undo_a_live_revision(self):
        row = json.loads(self.store.db.execute('SELECT payload FROM events WHERE value_id=?', ('sep',)).fetchone()[0])
        row.update(actual=9, revision=0)
        with self.store.db:
            self.store._observe('Pepperstone-Demo', row, 'archive', ms('2026-09-20T10:00:00')/1000,
                                {'capture_offset_seconds': 7200}, priority=0)
        entries = next(m for m in ledger_snapshot(self.store, 'Pepperstone-Demo', now_ms=NOW)['metrics'] if m['id']=='usd.cpi-yoy')['entries']
        self.assertNotIn(9, [e['value'] for e in entries])
        self.assertEqual(self.store.db.execute('SELECT count(*) FROM observations WHERE value_id=?', ('sep',)).fetchone()[0], 3)

    def test_retains_three_pre_year_releases_for_the_header(self):
        original = json.loads(self.store.db.execute('SELECT payload FROM events WHERE value_id=?', ('prior-year',)).fetchone()[0])
        with self.store.db:
            for month in [8, 9, 10, 11]:
                at = ms(f'2025-{month:02d}-12T13:30:00')
                row = {**original, 'value_id': f'prior-{month}', 'server_time_seconds': at//1000+7200,
                       'period_seconds': ms(f'2025-{month:02d}-01')//1000}
                self.store._observe('Pepperstone-Demo', row, 'fixture', at/1000, {'capture_offset_seconds': 7200})
        metric = next(m for m in ledger_snapshot(self.store,'Pepperstone-Demo',now_ms=NOW)['metrics'] if m['id']=='usd.cpi-yoy')
        self.assertEqual({e['value_id'] for e in metric['entries'] if e['day']<'2026-01-01'}, {'prior-10','prior-11','prior-year'})

    def test_all_currencies_pairs_and_complete_series_admission(self):
        with self.store.db:
            for currency in CURRENCIES:
                metric=next(m for m in registry()['metrics'] if m['id']==currency.lower()+'.rate')
                row=event(value_id=currency+'-rate',event_id=metric['broker_event_id'],currency=currency,
                          country_code=metric['broker_country'],unit=metric['broker_unit'],multiplier=metric['broker_multiplier'],
                          actual=2,previous=1.75,impact='positive',server_time_seconds=ms('2026-05-01T12:00:00')//1000+7200)
                self.store._observe('Pepperstone-Demo',row,'fixture',ms('2026-05-01T12:01:00')/1000,{'capture_offset_seconds':7200})
            for identity,event_id,actual in [('ppi','840030001',1.4),('unknown','8877665544',0),('speech','8877665545',None)]:
                row=event(value_id=identity,event_id=event_id,currency='USD',country_code='US',name=identity,
                          actual=actual,previous=.5,impact='negative',server_time_seconds=ms('2026-05-13T12:30:00')//1000+7200)
                self.store._observe('Pepperstone-Demo',row,'fixture',ms('2026-05-13T12:31:00')/1000,{'capture_offset_seconds':7200})
        all_data=ledger_snapshot(self.store,'Pepperstone-Demo',now_ms=NOW,currencies=CURRENCIES)
        self.assertEqual(all_data['currencies'],list(CURRENCIES))
        self.assertEqual({m['id'] for m in all_data['metrics'] if m['canonical']},{m['id'] for m in registry()['metrics']},'Every canonical measure survives, including distinct unmapped national series')
        for currency in CURRENCIES:
            metric=next(m for m in all_data['metrics'] if m['id']==currency.lower()+'.rate')
            self.assertIn(currency+'-rate',[e['value_id'] for e in metric['entries']])
        for value_id in ['ppi','unknown','speech']:
            metric=next(m for m in all_data['metrics'] if any(e['value_id']==value_id for e in m['entries']))
            self.assertFalse(metric['canonical'])
            self.assertEqual(metric['entries'][0]['impact'],'negative')
        self.assertEqual(next(m for m in all_data['metrics'] if m['label']=='ppi')['category'],'inflation')
        queries=[];self.store.db.set_trace_callback(queries.append)
        for pair in combinations(CURRENCIES,2):
            snap=ledger_snapshot(self.store,'Pepperstone-Demo',now_ms=NOW,currencies=pair)
            self.assertEqual(snap['currencies'],list(pair))
            self.assertEqual({m['currency'] for m in snap['metrics']},set(pair))
        self.store.db.set_trace_callback(None)
        self.assertFalse(any('FROM observations' in q or 'FROM events' in q for q in queries),'All 28 crosses share eight cached currency reads')
        self.assertLessEqual(len(self.store._ledger_cache),16)
        # A retained non-USD observation must invalidate caches even if rejected
        # as the current event; the immutable history is independently meaningful.
        before=self.store.db.execute('SELECT value FROM data_revision WHERE id=1').fetchone()[0]
        row=json.loads(self.store.db.execute("SELECT payload FROM events WHERE value_id='JPY-rate'").fetchone()[0])
        row['forecast']=1.9
        with self.store.db:
            self.store._observe('Pepperstone-Demo',row,'archive',ms('2026-06-01T12:00:00')/1000,{'capture_offset_seconds':7200},priority=0)
        self.assertGreater(self.store.db.execute('SELECT value FROM data_revision WHERE id=1').fetchone()[0],before)

    def test_api_is_read_only_and_revision_aware(self):
        async def run():
            app = create_app(self.root, run_collector=False)
            async with app.router.lifespan_context(app):
                async def get(query):
                    sent = []
                    async def receive(): return {'type': 'http.request', 'body': b''}
                    async def send(value): sent.append(value)
                    await app({'type': 'http', 'method': 'GET', 'path': '/api/v1/currency-ledger', 'query_string': query.encode(), 'headers': []}, receive, send)
                    self.assertEqual(sent[0]['status'], 200)
                    return json.loads(b''.join(s.get('body', b'') for s in sent))
                first = await get('source_id=Pepperstone-Demo')
                self.assertEqual(first['currencies'], ['USD', 'CAD'])
                self.assertTrue((await get('source_id=Pepperstone-Demo&after_revision='+first['revision']))['unchanged'])
                self.assertEqual((await get('source_id=Pepperstone-Demo&year=2025'))['year'], 2025)
                self.assertEqual((await get('source_id=Pepperstone-Demo&scope=GBPJPY'))['currencies'],['GBP','JPY'])
        asyncio.run(run())
