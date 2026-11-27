import asyncio
from pathlib import Path
from tempfile import TemporaryDirectory
from threading import Event
from unittest import IsolatedAsyncioTestCase
from unittest.mock import patch

from fyodor_bridge.currency_indices import SERVER
from fyodor_bridge.volume_profile_history import DAY, VolumeProfileCache
from fyodor_bridge.volume_profile_preload import PRELOAD_PRIORITY, PRELOAD_SYMBOL_GROUPS, PRELOAD_SYMBOLS, VolumeProfilePreload

START = 20_000 * DAY


class Worker:
    def __init__(self):
        self.calendars = {}
        self.calls = []
        self.timeouts = []
        self.entrance = None
        self.release = None

    def snapshot(self):
        return dict(account_server=SERVER, account_login=1, generation=2, connected=True)

    def submit(self, category, operation, arguments, *, priority, supersede, adapter_timeout=None):
        self.timeouts.append((operation, adapter_timeout))
        self.calls.append((operation, arguments["symbol"], arguments["start"], arguments["end"], priority))
        days = self.calendars.get(arguments["symbol"], [START, START + DAY])
        return dict(digits=5, days=days)

    def ticks(self, symbol, start, end, generation, *, priority, slices, adapter_timeout=None):
        self.timeouts.append(("ticks", adapter_timeout))
        self.calls.append(("ticks", symbol, start, end, priority))
        if self.entrance and not self.entrance.is_set():
            self.entrance.set()
            if not self.release.wait(5):
                raise RuntimeError("The test did not release its batch")
        self.assert_slice_read(generation, slices)
        return dict(digits=5, missing_minutes=0, levels=[(110000, 2), (120000, 9)],
                    slices=[(start, [(110000, 2)]), (start + 60, [(120000, 9)])], missing_slices=[])

    def assert_slice_read(self, generation, slices):
        assert generation == 2 and slices


class VolumeProfilePreloadTest(IsolatedAsyncioTestCase):
    async def test_discovers_history_and_caches_partial_day_windows_for_all_symbols(self):
        with TemporaryDirectory() as temp:
            path = Path(temp) / "exact.sqlite3"
            worker = Worker()
            worker.calendars = {"EURUSD": [START, START + 2 * DAY], "JPYX": []}
            source = worker.snapshot()
            preload = VolumeProfilePreload(VolumeProfileCache(path), worker.ticks)
            end = START + 2 * DAY + 180
            self.assertEqual(set(PRELOAD_SYMBOL_GROUPS["Currency indices"]), set("USDX EURX JPYX GBPX CHFX CADX AUDX NZDX".split()))
            self.assertEqual(set(PRELOAD_SYMBOL_GROUPS["Forex majors"]), set("AUDUSD EURUSD GBPUSD NZDUSD USDCAD USDCHF USDJPY".split()))
            self.assertEqual(set(PRELOAD_SYMBOL_GROUPS["Forex crosses"]), set(
                "AUDCAD AUDCHF AUDJPY AUDNZD CADCHF CADJPY CHFJPY EURAUD EURCAD EURCHF EURGBP EURJPY EURNZD "
                "GBPAUD GBPCAD GBPCHF GBPJPY GBPNZD NZDCAD NZDCHF NZDJPY".split()))
            self.assertEqual(len(set(PRELOAD_SYMBOLS)), 36)
            preload.start(worker, source, PRELOAD_SYMBOLS, None, end)
            await preload.task
            result = preload.status(source)
            self.assertEqual((result["state"], result["completed_symbols"], result["available_symbols"]), ("complete", 36, 35))
            self.assertEqual(result["unavailable_symbols"], ["JPYX"])
            self.assertTrue(all(priority == PRELOAD_PRIORITY for *_, priority in worker.calls))
            eur = [call for call in worker.calls if call[:2] == ("ticks", "EURUSD")]
            self.assertEqual(eur[0][2:4], (START + 2 * DAY, end))
            self.assertFalse(any(START + DAY <= call[2] < START + 2 * DAY for call in eur))
            worker.calls.clear()
            reopened = VolumeProfileCache(path)
            scope = (SERVER, 1, "EURUSD")
            self.assertEqual(reopened.read_window(scope, START + 60, START + 120)["levels"], [(120000, 9)])
            self.assertEqual(reopened.read_window(scope, START + DAY + 60, START + DAY + 120)["levels"], [])
            self.assertEqual(reopened.read_window(scope, end - 180, end - 120)["levels"], [(110000, 2)])
            self.assertEqual(worker.calls, [])
            self.assertEqual(VolumeProfilePreload(reopened, worker.ticks).status(source), result)

    async def test_paused_preload_restores_position_without_rereading_the_completed_day(self):
        with TemporaryDirectory() as temp:
            path = Path(temp) / "exact.sqlite3"
            worker = Worker()
            worker.entrance, worker.release = Event(), Event()
            source = worker.snapshot()
            preload = VolumeProfilePreload(VolumeProfileCache(path), worker.ticks)
            preload.start(worker, source, ("EURUSD",), START, START + DAY + 180)
            try:
                self.assertTrue(await asyncio.to_thread(worker.entrance.wait, 5))
                self.assertEqual(preload.control(worker, source, "pause")["state"], "paused")
            finally:
                worker.release.set()
            await preload.task
            restarted = VolumeProfilePreload(VolumeProfileCache(path), worker.ticks)
            self.assertEqual(restarted.status(source)["completed_chunks"], 1)
            worker.timeouts.clear()
            restarted.control(worker, source, "resume", timeout_seconds=90)
            await restarted.task
            self.assertEqual(restarted.status(source)["state"], "complete")
            self.assertIn(("volume-profile-days", 90), worker.timeouts)
            self.assertIn(("ticks", 90), worker.timeouts)
            self.assertEqual(sum(op == "ticks" and at == START + DAY for op, _, at, *_ in worker.calls), 1)

    async def test_full_preload_catches_up_only_unread_ticks_after_its_original_cutoff(self):
        with TemporaryDirectory() as temp:
            cache = VolumeProfileCache(Path(temp) / "exact.sqlite3")
            worker = Worker()
            source = worker.snapshot()
            preload = VolumeProfilePreload(cache, worker.ticks)
            original_end = START + DAY + 180
            latest = original_end + 180
            with patch("fyodor_bridge.volume_profile_preload.time", return_value=latest):
                preload.start(worker, source, ("EURUSD",), START, original_end, broker_offset=0)
                await preload.task
            self.assertEqual(preload.status(source)["end"], latest)
            self.assertEqual(preload.status(source)["first_candles"], {"EURUSD": START})
            self.assertEqual([call[2:4] for call in worker.calls if call[0] == "ticks" and call[2] >= START + DAY],
                             [(START + DAY, original_end), (original_end, latest)])
