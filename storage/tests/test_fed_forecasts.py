import asyncio
from copy import deepcopy
import json
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest import TestCase

from storage.app import create_app
from storage.calendar_store import CalendarStore
from storage.fed_forecasts import FedRefresh, read_forecasts, save_forecasts
from storage.recovery import backup_directory, restore_directory


def payload():
    evidence = dict(url='https://www.investing.com/economic-calendar/interest-rate-decision-168',
                    captured_at='2026-10-29T00:00:00Z', as_of=None, timing='historical_backfill',
                    note='Fixture: event-specific consensus column, not previous.')
    return {'meetings': [dict(released_at='2026-10-28T18:00:00Z', actual={**evidence,
        'url': 'https://www.federalreserve.gov/newsevents/pressreleases/monetary20261028a.htm',
        'lower': 3.75, 'upper': 4}, consensus=[{**evidence, 'provider': 'investing', 'value': 4}], fedwatch=None)]}


class FedForecastTests(TestCase):
    def setUp(self):
        self.temporary = TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name) / 'data'
        self.folder = self.root / 'fed-forecasts'

    def test_clock_guards_source_identity_and_consensus_basis(self):
        FedRefresh.model_validate(payload())
        for changes in [dict(value=float('nan')), dict(value=-1), dict(provider='TEForecast'),
                        dict(url='https://investing.com.evil.example/data'), dict(url='https://user@www.investing.com/data'),
                        dict(captured_at='2026-10-29T00:00:00'), dict(captured_at='2099-01-01T00:00:00Z'),
                        dict(timing='pre_release'), dict(as_of='2026-10-28T18:00:00Z')]:
            with self.subTest(changes=changes):
                body = payload(); body['meetings'][0]['consensus'][0].update(changes)
                with self.assertRaises(ValueError): FedRefresh.model_validate(body)
        body = payload(); body['meetings'][0]['consensus'][0].update(timing='pre_release', captured_at='2026-10-28T17:00:00Z', as_of='2026-10-28T16:59:00Z')
        FedRefresh.model_validate(body)
        body['meetings'][0]['consensus'].append(deepcopy(body['meetings'][0]['consensus'][0]))
        with self.assertRaisesRegex(ValueError, 'one consensus'): FedRefresh.model_validate(body)

    def test_fedwatch_requires_complete_original_pre_decision_distribution(self):
        body = payload()
        watch = {**body['meetings'][0]['consensus'][0], 'url': 'https://www.cmegroup.com/markets/interest-rates/cme-fedwatch-tool.html',
                 'as_of': '2026-10-28T17:00:00Z', 'outcomes': [dict(lower=3.75, upper=4, probability=85), dict(lower=4, upper=4.25, probability=15)]}
        watch.pop('value'); watch.pop('provider'); body['meetings'][0]['fedwatch'] = watch
        FedRefresh.model_validate(body)
        for patch in [dict(as_of=None), dict(as_of='2026-10-29T00:00:00Z'),
                      dict(outcomes=[dict(lower=3.75, upper=4, probability=85)]),
                      dict(outcomes=[dict(lower=3.75, upper=4, probability=50)] * 2)]:
            bad = deepcopy(body); bad['meetings'][0]['fedwatch'].update(patch)
            with self.assertRaises(ValueError): FedRefresh.model_validate(bad)

    def test_immutable_history_merge_empty_cache_and_backups(self):
        self.assertEqual(read_forecasts(self.folder), {'schema': 1, 'meetings': []})
        first = save_forecasts(FedRefresh.model_validate(payload()), self.folder)
        original = (self.folder / 'history' / f"{first['revision']}.json").read_bytes()
        save_forecasts(FedRefresh.model_validate(payload()), self.folder)
        self.assertEqual(len(list((self.folder / 'history').glob('*.json'))), 1)
        changed = payload(); changed['meetings'][0]['consensus'][0]['value'] = 3.75
        save_forecasts(FedRefresh.model_validate(changed), self.folder)
        self.assertEqual((self.folder / 'history' / f"{first['revision']}.json").read_bytes(), original)
        earlier = payload(); earlier['meetings'][0]['released_at'] = '2026-09-16T18:00:00Z'
        save_forecasts(FedRefresh.model_validate(earlier), self.folder)
        self.assertEqual(len(read_forecasts(self.folder)['meetings']), 2)
        CalendarStore(self.root / 'calendar.sqlite3').close()
        backup = Path(self.temporary.name) / 'backup'
        backup_directory(self.root, backup)
        destination = Path(self.temporary.name) / 'restored'
        restore_directory(backup, destination)
        self.assertEqual(read_forecasts(destination / 'fed-forecasts'), read_forecasts(self.folder))
        self.assertEqual((destination / 'fed-forecasts/history' / f"{first['revision']}.json").read_bytes(), original)

    def test_api_reports_corruption_and_never_mutates_calendar(self):
        async def run():
            app = create_app(self.root, run_collector=False)
            async def get():
                messages = []
                async def receive(): return {'type': 'http.request', 'body': b''}
                async def send(message): messages.append(message)
                await app({'type': 'http', 'method': 'GET', 'path': '/api/v1/fed-forecasts', 'query_string': b'', 'headers': []}, receive, send)
                return messages[0]['status'], json.loads(b''.join(m.get('body', b'') for m in messages))
            async with app.router.lifespan_context(app):
                self.assertEqual((await get()), (200, {'schema': 1, 'meetings': []}))
                save_forecasts(FedRefresh.model_validate(payload()), self.folder)
                self.assertEqual((await get())[0], 200)
                self.assertEqual(app.state.store.db.execute('SELECT count(*) FROM events').fetchone()[0], 0)
                (self.folder / 'latest.json').write_text('{bad', encoding='utf-8')
                self.assertEqual((await get())[0], 503)
        asyncio.run(run())
