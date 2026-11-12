from datetime import datetime, timedelta, timezone
import importlib.util
import json
from pathlib import Path
import sys
import socket
import threading
from tempfile import TemporaryDirectory
import unittest
from unittest.mock import patch

from urllib.error import HTTPError
from urllib.request import urlopen
import uvicorn
from pydantic import ValidationError

from storage.app import create_app
from storage.currency_news import NewsRefresh, news_snapshot, save_refresh, news_day, news_history, news_run, read_run
from storage.currency_news_feed import news_feed


def payload(currency='CAD', **changes):
    checked = datetime.now(timezone.utc) - timedelta(minutes=1)
    row = dict(currency=currency, checked_at=checked.isoformat(), coverage='checked', coverage_note='',
        items=[dict(summary='New export guidance was reported.', published_at=(checked-timedelta(hours=1)).isoformat(),
            sources=[dict(label='Original source', url='https://example.com/release')])],
        background=[], implication='supportive', reason='Export demand supports CAD; funding opposition limits the implication.')
    row.update(changes)
    return dict(window_hours=3, rows=[row])


class CurrencyNewsTests(unittest.TestCase):
    def setUp(self):
        self.temp = TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.directory = Path(self.temp.name)
        self.news = self.directory / 'currency-news'

    def save(self, body):
        return save_refresh(NewsRefresh.model_validate(body), self.news)

    def test_focused_save_preserves_other_currencies_and_immutable_history(self):
        cad = self.save(payload())
        self.assertTrue(cad['readback_verified'])
        before = (self.news / 'runs' / (cad['run_id']+'.json')).read_bytes()
        self.save(payload('JPY'))
        rows = {r['currency']: r['snapshot'] for r in news_snapshot(self.news)['rows']}
        self.assertEqual(len(rows), 8)
        self.assertEqual(rows['CAD']['run_id'], cad['run_id'])
        self.assertIsNotNone(rows['JPY'])
        self.assertIsNone(rows['EUR'])
        self.assertEqual((self.news / 'runs' / (cad['run_id']+'.json')).read_bytes(), before)

    def test_idempotent_retry_and_revision_conditional_read(self):
        body = payload()
        first = self.save(body)
        second = self.save(body)
        self.assertEqual(first, second)
        self.assertEqual(len(list((self.news / 'runs').glob('*.json'))), 1)
        self.assertEqual(news_snapshot(self.news, first['revision']), dict(schema=1, revision=first['revision'], unchanged=True))

    def test_equal_or_older_check_cannot_overwrite_newer_result(self):
        body = payload()
        first = self.save(body)
        body['rows'][0]['reason'] = 'Conflicting delayed result.'
        with self.assertRaisesRegex(ValueError, 'equal or newer'):
            self.save(body)
        body['rows'][0]['checked_at'] = (datetime.fromisoformat(body['rows'][0]['checked_at'])-timedelta(seconds=1)).isoformat()
        with self.assertRaises(ValueError):
            self.save(body)
        self.assertEqual(news_snapshot(self.news)['revision'], first['revision'])

    def test_atomic_batch_failure_leaves_previous_results_and_no_orphan(self):
        self.save(payload('JPY'))
        before = news_snapshot(self.news)
        from storage.currency_news import atomic_write
        def fail_index(path, body):
            if path.name == 'latest.json':
                raise OSError('Disk full')
            return atomic_write(path, body)
        with patch('storage.currency_news.atomic_write', side_effect=fail_index), self.assertRaises(OSError):
            self.save(payload())
        self.assertEqual(news_snapshot(self.news), before)
        self.assertEqual(len(list((self.news / 'runs').glob('*.json'))), 1)

    def dated_save(self, currency, at):
        body = payload(currency)
        checked = at - timedelta(minutes=2)
        body['rows'][0]['checked_at'] = checked.isoformat()
        body['rows'][0]['items'][0]['published_at'] = (checked-timedelta(hours=1)).isoformat()
        class Clock(datetime):
            @classmethod
            def now(cls, tz=None): return at
        with patch('storage.currency_news.datetime', Clock):
            return self.save(body)

    def test_history_uses_jakarta_save_date_and_retains_exact_focused_versions(self):
        first = self.dated_save('CAD', datetime(2026, 1, 1, 16, 59, 59, tzinfo=timezone.utc))
        second = self.dated_save('CAD', datetime(2026, 1, 1, 17, tzinfo=timezone.utc))
        third = self.dated_save('JPY', datetime(2026, 1, 1, 18, tzinfo=timezone.utc))
        self.assertEqual([r['run_id'] for r in news_history(self.news, '2026-01-01')['runs']], [first['run_id']])
        day = news_history(self.news, '2026-01-02')
        self.assertEqual([r['run_id'] for r in day['runs']], [third['run_id'], second['run_id']])
        old = news_run(self.news, first['run_id'])
        self.assertEqual(old['rows'][5]['snapshot']['checked_at'], '2026-01-01T16:57:59Z')
        self.assertIsNone(old['rows'][7]['snapshot'], 'A focused historical refresh does not borrow later or other-currency results')
        self.assertEqual(old['revision'], first['run_id'])
        self.assertEqual(news_snapshot(self.news)['rows'][5]['snapshot']['run_id'], second['run_id'])
        self.assertEqual(news_history(self.news, '2026-01-03')['runs'], [])

    def test_history_pages_metadata_without_reading_unrelated_bodies(self):
        for hour in [17, 18, 19]:
            self.dated_save('CAD', datetime(2026, 1, 1, hour, tzinfo=timezone.utc))
        with patch('storage.currency_news.read_run', wraps=read_run) as read:
            first = news_history(self.news, '2026-01-02', limit=2)
            second = news_history(self.news, '2026-01-02', before=first['next_before'], limit=2)
            read.assert_not_called()
            self.assertEqual(len(first['runs']), 2); self.assertEqual(len(second['runs']), 1)
            self.assertIsNone(second['next_before'])
            news_run(self.news, second['runs'][0]['run_id'])
            self.assertEqual(read.call_count, 1, 'Only the selected immutable body is loaded')
        with self.assertRaises(ValueError): news_history(self.news, '2026-01-02', before='a'*64)

    def test_daily_table_combines_focused_saves_and_keeps_each_currencies_versions(self):
        yesterday = self.dated_save('EUR', datetime(2026, 1, 1, 16, 59, tzinfo=timezone.utc))
        cad = self.dated_save('CAD', datetime(2026, 1, 1, 17, tzinfo=timezone.utc))
        jpy = self.dated_save('JPY', datetime(2026, 1, 1, 18, tzinfo=timezone.utc))
        later = self.dated_save('CAD', datetime(2026, 1, 1, 19, tzinfo=timezone.utc))
        day = news_day(self.news, '2026-01-02')
        rows = {row['currency']: row for row in day['rows']}
        self.assertEqual(len(rows), 8)
        self.assertEqual(rows['CAD']['snapshot']['run_id'], later['run_id'])
        self.assertEqual(rows['JPY']['snapshot']['run_id'], jpy['run_id'])
        self.assertEqual([r['run_id'] for r in rows['CAD']['refreshes']], [later['run_id'], cad['run_id']])
        self.assertIsNone(rows['EUR']['snapshot'], 'Previous-day research never fills a new day')
        self.assertEqual(rows['EUR']['refreshes'], [])
        self.assertEqual(news_day(self.news, '2026-01-01')['rows'][0]['snapshot']['run_id'], yesterday['run_id'])
        empty = news_day(self.news, '2026-01-03')
        self.assertTrue(all(r['snapshot'] is None and not r['refreshes'] for r in empty['rows']))
        self.assertEqual(news_day(self.news, '2026-01-02', day['revision']), dict(schema=1, date='2026-01-02', revision=day['revision'], unchanged=True))

    def test_daily_projection_ignores_other_dates_and_reads_only_latest_currency_bodies(self):
        self.dated_save('CAD', datetime(2026, 1, 1, 17, tzinfo=timezone.utc))
        self.dated_save('CAD', datetime(2026, 1, 1, 18, tzinfo=timezone.utc))
        self.dated_save('JPY', datetime(2026, 1, 1, 19, tzinfo=timezone.utc))
        with patch('storage.currency_news.read_run', wraps=read_run) as read:
            day = news_day(self.news, '2026-01-02')
            self.assertEqual(read.call_count, 2, 'Latest body per researched currency, without loading older versions')
            news_day(self.news, '2026-01-02', day['revision'])
            self.assertEqual(read.call_count, 2, 'Unchanged polling reads no bodies')
        self.dated_save('EUR', datetime(2026, 1, 2, 18, tzinfo=timezone.utc))
        self.assertEqual(news_day(self.news, '2026-01-02')['revision'], day['revision'])

    def test_legacy_history_reads_do_not_write_and_next_save_migrates_metadata(self):
        first = self.save(payload())
        state = self.news/'latest.json'
        doc = json.loads(state.read_text(encoding='utf-8'))
        state.write_text(json.dumps(doc['latest']), encoding='utf-8')
        before = {p.relative_to(self.news): p.read_bytes() for p in self.news.rglob('*') if p.is_file()}
        saved = news_run(self.news, first['run_id'])
        day = datetime.fromisoformat(saved['saved_at']).astimezone(timezone(timedelta(hours=7))).date().isoformat()
        self.assertEqual(news_history(self.news, day)['runs'][0]['run_id'], first['run_id'])
        self.assertEqual(before, {p.relative_to(self.news): p.read_bytes() for p in self.news.rglob('*') if p.is_file()})
        self.save(payload('JPY'))
        self.assertEqual(json.loads(state.read_text(encoding='utf-8'))['schema'], 3)
        self.assertEqual(news_run(self.news, first['run_id']), saved)

    def test_empty_history_is_read_only_and_uncommitted_orphans_are_not_shown(self):
        self.assertEqual(news_history(self.news, '2026-01-02')['runs'], [])
        self.assertFalse(self.news.exists())
        first = self.save(payload())
        orphan = 'a'*64
        (self.news/'runs'/f'{orphan}.json').write_text('{}', encoding='utf-8')
        with self.assertRaises(LookupError): news_run(self.news, orphan)
        self.assertEqual(news_snapshot(self.news)['revision'], first['revision'])
        with self.assertRaises(LookupError): news_run(self.news, '../outside')

    def test_valid_quiet_result_and_background_do_not_renew_direction(self):
        body = payload(items=[], implication='no_clear_signal', reason='No qualifying fresh item verified.')
        checked = datetime.fromisoformat(body['rows'][0]['checked_at'])
        body['rows'][0]['background'] = [dict(summary='Older policy background.', published_at=(checked-timedelta(days=2)).isoformat(),
            sources=[dict(label='Bank', url='https://example.com/policy')])]
        self.save(body)
        self.assertEqual(news_snapshot(self.news)['rows'][5]['snapshot']['implication'], 'no_clear_signal')
        body['rows'][0]['implication'] = 'supportive'
        with self.assertRaisesRegex(ValidationError, 'background alone'):
            NewsRefresh.model_validate(body)

    def test_time_coverage_source_and_scope_validation(self):
        cases = [
            lambda b: b['rows'].append(b['rows'][0]),
            lambda b: b.update(window_hours=0),
            lambda b: b.update(window_hours=3.5),
            lambda b: b['rows'][0].update(currency='XYZ'),
            lambda b: b['rows'][0].update(checked_at='2026-01-01T00:00:00'),
            lambda b: b['rows'][0].update(checked_at=(datetime.now(timezone.utc)+timedelta(hours=1)).isoformat()),
            lambda b: b['rows'][0].update(coverage='partial', coverage_note=' '),
            lambda b: b['rows'][0].update(coverage='unavailable', coverage_note='No access'),
            lambda b: b['rows'][0].update(reason=' '),
            lambda b: b['rows'][0]['items'][0].update(published_at=None, timing_note='Hour unknown'),
            lambda b: b['rows'][0]['items'][0].update(published_at=(datetime.fromisoformat(b['rows'][0]['checked_at'])-timedelta(hours=4)).isoformat()),
            lambda b: b['rows'][0]['items'][0].update(published_at=(datetime.fromisoformat(b['rows'][0]['checked_at'])+timedelta(seconds=1)).isoformat()),
            lambda b: b['rows'][0]['items'][0].update(sources=[]),
            lambda b: b['rows'][0]['items'][0]['sources'][0].update(url='javascript:alert(1)'),
            lambda b: b['rows'][0]['items'][0]['sources'][0].update(url='https://user:password@example.com/'),
            lambda b: b['rows'][0].update(background=b['rows'][0]['items']),
        ]
        for mutate in cases:
            with self.subTest(mutate=mutate):
                body = payload()
                mutate(body)
                with self.assertRaises(ValidationError):
                    NewsRefresh.model_validate(body)
        checked = datetime.now(timezone.utc) - timedelta(minutes=2)
        for index, coverage in enumerate(['partial', 'unavailable']):
            # Distinct snapshots must not rely on the Windows wall clock advancing.
            self.save(payload(items=[], implication='no_clear_signal', coverage=coverage,
                coverage_note='Publisher inaccessible.', checked_at=(checked + timedelta(seconds=index)).isoformat()))

    def test_unknown_background_clock_retains_note_and_source(self):
        body = payload(background=[dict(summary='Policy background.', published_at=None, timing_note='November 2, hour unknown.',
            sources=[dict(label='Bank', url='https://example.com/old')])])
        self.save(body)
        self.assertEqual(news_snapshot(self.news)['rows'][5]['snapshot']['background'][0]['timing_note'], 'November 2, hour unknown.')

    def test_corrupt_or_traversing_index_and_changed_immutable_body_fail(self):
        first = self.save(payload())
        index = self.news / 'latest.json'
        original = index.read_bytes()
        index.write_text('{"CAD":"../outside"}')
        with self.assertRaises(ValueError): news_snapshot(self.news)
        index.write_bytes(original)
        body = self.news / 'runs' / (first['run_id']+'.json')
        doc = json.loads(body.read_text())
        doc['request']['rows'][0]['reason'] = 'Modified stored content.'
        body.write_text(json.dumps(doc))
        with self.assertRaisesRegex(ValueError, 'hash mismatch'): news_snapshot(self.news)

    def test_api_empty_saved_unchanged_and_corrupt_history(self):
        app = create_app(directory=self.directory, run_collector=False)
        ready = threading.Event()
        class Server(uvicorn.Server):
            async def startup(self, sockets=None):
                await super().startup(sockets)
                ready.set()
        sock = socket.socket()
        sock.bind(('127.0.0.1', 0))
        base = f'http://127.0.0.1:{sock.getsockname()[1]}'
        server = Server(uvicorn.Config(app, log_level='error', access_log=False))
        thread = threading.Thread(target=lambda: server.run(sockets=[sock]), daemon=True)
        thread.start()
        def get(route):
            try:
                with urlopen(base+route, timeout=5) as response:
                    return response.status, json.load(response)
            except HTTPError as error:
                return error.code, json.load(error)
        try:
            self.assertTrue(ready.wait(10), 'Storage server started')
            status, empty = get('/api/v1/currency-news')
            self.assertEqual(status, 200)
            self.assertEqual(len(empty['rows']), 8)
            self.assertTrue(all(r['snapshot'] is None for r in empty['rows']))
            self.assertFalse(self.news.exists(), 'An empty panel read creates no files or research')
            first = self.save(payload())
            served = get('/api/v1/currency-news')[1]
            self.assertEqual(served, news_snapshot(self.news))
            self.assertEqual(get('/api/v1/currency-news?after_revision='+first['revision'])[1],
                             dict(schema=1, revision=first['revision'], unchanged=True))
            self.assertEqual(get('/api/v1/theses/summary')[0], 404)
            saved = news_run(self.news, first['run_id'])
            day = datetime.fromisoformat(saved['saved_at']).astimezone(timezone(timedelta(hours=7))).date().isoformat()
            self.assertEqual(get('/api/v1/currency-news/history?date='+day)[1], news_history(self.news, day))
            self.assertEqual(get('/api/v1/currency-news/day?date='+day)[1], news_day(self.news, day))
            self.assertEqual(get('/api/v1/currency-news/feed?date='+day)[1], news_feed(self.news, day))
            self.assertEqual(get('/api/v1/currency-news/feed?date=2026-02-30')[0], 422)
            self.assertEqual(get('/api/v1/currency-news/day?date=2026-02-30')[0], 422)
            self.assertEqual(get('/api/v1/currency-news/history/'+first['run_id'])[1], saved)
            self.assertEqual(get('/api/v1/currency-news/history?date=2026-02-30')[0], 422)
            self.assertEqual(get('/api/v1/currency-news/history/'+'a'*64)[0], 404)
            (self.news/'latest.json').write_text('broken')
            self.assertEqual(get('/api/v1/currency-news')[0], 503)
        finally:
            server.should_exit = True
            thread.join(10)
            sock.close()

    def test_cli_scope_and_running_panel_verification(self):
        tools = Path(__file__).resolve().parents[2] / 'Market Analyst Workflow/tools'
        sys.path.insert(0, str(tools))
        self.addCleanup(lambda: sys.path.remove(str(tools)))
        spec = importlib.util.spec_from_file_location('news_analyst_test', tools / 'market_data.py')
        analyst = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(analyst)
        fixture = news_snapshot(self.news)
        daily = news_day(self.news, datetime.now(timezone.utc).astimezone(timezone(timedelta(hours=7))).date().isoformat())
        feed = news_feed(self.news, daily['date'])
        args = analyst.parser().parse_args(['news', 'verify', '--scope', 'CAD'])
        with patch('storage.currency_news.news_snapshot', return_value=fixture), patch('storage.currency_news.news_day', return_value=daily), patch('storage.currency_news_feed.news_feed', return_value=feed), patch.object(analyst, 'get_json', side_effect=lambda _, route: feed if '/feed?' in route else daily if '/day?' in route else fixture):
            self.assertTrue(analyst.run(args)['panel_delivery_verified'])
        with patch('storage.currency_news.news_snapshot', return_value=fixture), patch('storage.currency_news.news_day', return_value=daily), patch.object(analyst, 'get_json', return_value=fixture):
            with self.assertRaisesRegex(ValueError, 'daily table'): analyst.run(args)
        with patch('storage.currency_news.news_snapshot', return_value=fixture), patch.object(analyst, 'get_json', return_value={}):
            with self.assertRaisesRegex(ValueError, 'correct stack'): analyst.run(args)
        body = self.directory/'news.json'
        body.write_text(json.dumps(payload()))
        args = analyst.parser().parse_args(['news', 'save', '--scope', 'JPY', '--input', str(body)])
        with patch.object(analyst, 'local_path', return_value=body), patch('storage.currency_news.save_refresh') as save:
            with self.assertRaisesRegex(ValueError, 'requested currency'): analyst.run(args)
            save.assert_not_called()
