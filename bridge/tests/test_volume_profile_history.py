import json
from pathlib import Path
from tempfile import TemporaryDirectory
from time import time
from unittest import IsolatedAsyncioTestCase
from unittest.mock import patch

from fyodor_bridge import app as bridge
from fyodor_bridge.hourly_profile_cache import HourlyProfiles
from fyodor_bridge.hourly_volume_profile import HOURLY_PROFILE_PAGE_SECONDS
from fyodor_bridge.volume_profile_history import DAY, VolumeProfileCache, profile_windows

START = 20_000 * DAY


class FakeWorker:
    def __init__(self):
        self.generation = 3
        self.calls = []

    def snapshot(self):
        return dict(account_server="Test-Demo", account_login=12, generation=self.generation, connected=True)

    def submit(self, category, operation, arguments, **options):
        self.calls.append((operation, arguments))
        if operation == "volume-profile-days":
            return {"days": [START + day * DAY for day in (0, 1, 2, 5, 6, 7, 8)], "digits": 5}
        if operation == "volume-profile-hourly-bars":
            bars = [(at, 1.5, 10) for at in range(arguments["start"], arguments["end"], DAY)]
            return dict(digits=5, bars=bars, gaps=[])
        level = 150000 if arguments["symbol"] == "CADJPY" else 150100
        return dict(digits=5, missing_minutes=0, levels=[(level, 10)])


class Request:
    def __init__(self, stop_after=None):
        self.checks = 0
        self.stop_after = stop_after

    async def is_disconnected(self):
        self.checks += 1
        return self.stop_after is not None and self.checks > self.stop_after


class VolumeProfileHistoryTest(IsolatedAsyncioTestCase):
    async def frames(self, cache, worker, symbol, start, end, request=None, method="ticks"):
        with patch.object(bridge, "volume_profile_cache", cache), patch.object(bridge, "mt5_worker", worker):
            response = await bridge.get_volume_profile_range(request or Request(), symbol, start, end, 0, method=method)
            return [json.loads(frame) async for frame in response.body_iterator]

    async def test_range_uses_trading_days_and_survives_pair_switch_and_restart(self):
        with TemporaryDirectory() as temp:
            path = Path(temp) / "profile.sqlite3"
            worker = FakeWorker()
            cache = VolumeProfileCache(path)
            frames = await self.frames(cache, worker, "CADJPY", START, START + 9 * DAY)
            self.assertEqual(frames[0]["checked"], 0)
            self.assertEqual(frames[-1]["checked"], 9)
            self.assertTrue(frames[-1]["done"])
            self.assertEqual(frames[-1]["levels"], [[150000, 70]])
            self.assertEqual(sum(op == "volume-profile" for op, _ in worker.calls), 7)
            other = await self.frames(cache, worker, "USDJPY", START, START + 9 * DAY)
            self.assertEqual(other[-1]["levels"], [[150100, 70]])
            worker.calls.clear()
            worker.generation += 1
            warm = await self.frames(VolumeProfileCache(path), worker, "CADJPY", START, START + 9 * DAY)
            self.assertEqual(worker.calls, [])
            self.assertEqual(warm, [{**frames[-1], "source_generation": worker.generation}])

    async def test_range_resumes_after_disconnect_and_refreshes_partial_edges(self):
        with TemporaryDirectory() as temp:
            cache = VolumeProfileCache(Path(temp) / "profile.sqlite3")
            worker = FakeWorker()
            cold = await self.frames(cache, worker, "CADJPY", START, START + 3 * DAY, Request(1))
            self.assertFalse(cold[-1]["done"])
            self.assertEqual(cold[-1]["checked"], 1)
            worker.calls.clear()
            warm = await self.frames(cache, worker, "CADJPY", START, START + 3 * DAY)
            self.assertEqual(warm[0]["checked"], 1)
            self.assertEqual(warm[-1]["levels"], [[150000, 30]])
            self.assertEqual([args["start"] for _, args in worker.calls], [START + DAY, START])
            worker.calls.clear()
            await self.frames(cache, worker, "CADJPY", START + 60, START + 3 * DAY - 60)
            self.assertEqual([(args["start"], args["end"]) for _, args in worker.calls],
                             [(START + 2 * DAY, START + 3 * DAY - 60), (START + 60, START + DAY)])
            self.assertEqual(list(profile_windows(START + 60, START + DAY + 60)),
                             [(START + DAY, START + DAY + 60), (START + 60, START + DAY)])

    async def test_hourly_range_uses_bounded_bulk_reads_without_writing_exact_cache(self):
        with TemporaryDirectory() as temp:
            path = Path(temp) / "profile.sqlite3"
            worker = FakeWorker()
            end = START + 9 * DAY
            start = end - 2_589 * DAY
            hourly_path = Path(temp) / "hourly.sqlite3"
            with patch.object(bridge, "hourly_profiles", HourlyProfiles(hourly_path)):
                frames = await self.frames(VolumeProfileCache(path), worker, "CADJPY", start, end, method="hourly")
            self.assertEqual(frames[-1]["checked"], 2_589)
            self.assertEqual(frames[-1]["total"], 2_589)
            self.assertTrue(frames[-1]["done"])
            self.assertTrue(14 <= len(worker.calls) <= 16)
            self.assertTrue(all(op == "volume-profile-hourly-bars" and args["end"] - args["start"] <= HOURLY_PROFILE_PAGE_SECONDS
                                for op, args in worker.calls))
            self.assertFalse(path.exists())
            worker.calls.clear()
            with patch.object(bridge, "hourly_profiles", HourlyProfiles(hourly_path)):
                warm = await self.frames(VolumeProfileCache(path), worker, "CADJPY", start + DAY, end - DAY, method="hourly")
            self.assertEqual(worker.calls, [])
            self.assertEqual(warm[-1]["levels"], [[150000, 25_870]])

    async def test_exact_cache_reuses_legacy_gaps_and_allows_explicit_retry(self):
        with TemporaryDirectory() as temp:
            path = Path(temp) / "profile.sqlite3"
            cache = VolumeProfileCache(path)
            scope = ("Test-Demo", 12, "USDX")
            gap = {"digits": 3, "levels": [], "missing_minutes": 480}
            cache.write_day(scope, START, START + DAY, gap)
            cache.write_day(scope, START + DAY, START + 2 * DAY, {**gap, "levels": [(100000, 10)]})
            expired = int(time()) - DAY
            with cache.database() as db, db:
                db.execute("UPDATE profile_days_v1 SET expires = ?", (expired,))
                db.execute("PRAGMA user_version = 0")

            reopened = VolumeProfileCache(path)
            self.assertEqual(list(reopened.read(scope, START, START + 2 * DAY)), [((START, START + DAY), gap)])
            self.assertEqual(list(reopened.read(scope, START, START + 2 * DAY, retry=True)), [])
            with reopened.database() as db:
                migrated = db.execute("SELECT expires FROM profile_days_v1 WHERE start = ?", (START,)).fetchone()[0]
            with VolumeProfileCache(path).database() as db:
                self.assertEqual(db.execute("SELECT expires FROM profile_days_v1 WHERE start = ?", (START,)).fetchone()[0], migrated)
