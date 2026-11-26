import asyncio
from pathlib import Path
from tempfile import TemporaryDirectory
from threading import Event
from unittest import IsolatedAsyncioTestCase

from fyodor_bridge.currency_indices import MEMBERS, SERVER
from fyodor_bridge.hourly_profile_cache import CHUNK, HOUR, HourlyProfiles
from fyodor_bridge.volume_profile_preload import PRELOAD_PRIORITY, PRELOAD_SYMBOLS, VolumeProfilePreload

START = 110 * CHUNK


class Worker:
    def __init__(self):
        self.calls = []
        self.entrance = None
        self.release = None

    def snapshot(self):
        return dict(account_server=SERVER, account_login=1, generation=2, connected=True)

    def submit(self, category, operation, arguments, *, priority, supersede):
        self.calls.append((operation, arguments, priority))
        if self.entrance and not self.entrance.is_set():
            self.entrance.set()
            if not self.release.wait(5):
                raise RuntimeError("The test did not release its batch")
        if operation == "volume-profile-hourly-reference":
            return [(direction / 7, 0) for _, direction in MEMBERS[arguments["symbol"]]]
        bars = [(at, 1, 10) for at in range(arguments["start"], arguments["end"], HOUR)]
        return dict(digits=5, bars=bars, gaps=[])


class VolumeProfilePreloadTest(IsolatedAsyncioTestCase):
    async def test_all_36_reuse_constituents_and_warm_ranges_survive_restart(self):
        with TemporaryDirectory() as temp:
            path = Path(temp) / "hourly.sqlite3"
            worker = Worker()
            source = worker.snapshot()
            preload = VolumeProfilePreload(HourlyProfiles(path))
            end = START + 48 * HOUR
            self.assertEqual(len(set(PRELOAD_SYMBOLS)), 36)
            preload.start(worker, source, PRELOAD_SYMBOLS, START, end)
            await preload.task
            result = preload.status(source)
            self.assertEqual((result["state"], result["completed_symbols"]), ("complete", 36))
            self.assertEqual(result["incomplete_symbols"], [])
            bars = [args["symbol"] for op, args, _ in worker.calls if op == "volume-profile-hourly-bars"]
            self.assertEqual(bars, list(PRELOAD_SYMBOLS[:31]))
            self.assertTrue(all(priority == PRELOAD_PRIORITY for _, _, priority in worker.calls))
            worker.calls.clear()
            restarted = HourlyProfiles(path)
            # Box edges are inside the cached hours, with the end clipped to half an hour.
            profile = restarted.profile(worker, source, "GBPX", START + 1_800, START + 5_400, end + HOUR)
            self.assertEqual(profile["levels"], [(100000, 70)])
            self.assertEqual(worker.calls, [])
            # A live profile only reads the active hour, even when earlier hours are included.
            live = restarted.profile(worker, source, "CADJPY", end - HOUR, end + HOUR, end + 1_800)
            self.assertEqual(live["levels"], [(100000, 20)])
            self.assertEqual(worker.calls, [
                ("volume-profile-hourly-bars", {"symbol": "CADJPY", "start": end, "end": end + 1_800}, 10)
            ])

    async def test_pause_finishes_and_keeps_inflight_chunk_then_resumes(self):
        with TemporaryDirectory() as temp:
            worker = Worker()
            worker.entrance, worker.release = Event(), Event()
            source = worker.snapshot()
            preload = VolumeProfilePreload(HourlyProfiles(Path(temp) / "hourly.sqlite3"))
            preload.start(worker, source, ("EURUSD",), START, START + CHUNK + HOUR)
            try:
                self.assertTrue(await asyncio.to_thread(worker.entrance.wait, 5))
                self.assertEqual(preload.control(worker, source, "pause")["state"], "paused")
            finally:
                worker.release.set()
            await preload.task
            self.assertEqual(len(worker.calls), 1)
            self.assertEqual(preload.status(source)["completed_chunks"], 1)
            preload.control(worker, source, "resume")
            await preload.task
            self.assertEqual(preload.status(source)["state"], "complete")
            self.assertEqual(len(worker.calls), 2)
