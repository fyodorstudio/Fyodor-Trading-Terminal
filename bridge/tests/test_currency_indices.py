import unittest
from types import SimpleNamespace

from fyodor_bridge.currency_indices import ANCHOR, SERVER, STEPS, CurrencyIndexHistory


class FakeIndexMt5:
    TIMEFRAME_M1 = 1
    TIMEFRAME_H4 = 4
    TIMEFRAME_D1 = 24

    def account_info(self):
        return SimpleNamespace(server=SERVER, login=99)

    def copy_rates_from_pos(self, pair, frame, start, count):
        return self.rates(pair, frame)[-count:]

    def copy_rates_from(self, pair, frame, before, count):
        return [row for row in self.rates(pair, frame) if row["time"] <= before.timestamp()][-count:]

    def rates(self, pair, frame):
        day = STEPS["D1"]
        if frame == self.TIMEFRAME_D1:
            samples = [(ANCHOR, 1, 1.04), (ANCHOR + day, 1.04, 1.06), (ANCHOR + 2 * day, 1.06, 1.07)]
        elif frame == self.TIMEFRAME_H4:
            samples = [(ANCHOR + day, 1.04, 1.2), (ANCHOR + day + STEPS["H4"], 1.2, 0.9)]
        else:
            samples = [(ANCHOR + 2 * day, 1.06, 1.09), (ANCHOR + 2 * day + 60, 1.09, 1.08)]
        return [dict(time=at, open=opening if pair == "GBPUSD" else 1,
                     close=close if pair == "GBPUSD" else 1) for at, opening, close in samples]


class CurrencyIndexTest(unittest.TestCase):
    def test_daily_keeps_recent_minutes_and_builds_older_candles(self):
        history = CurrencyIndexHistory()
        page = history.read(FakeIndexMt5(), "GBPX", "D1", 2, None)
        middle, latest = page["bars"]
        self.assertTrue(page["has_older"])
        self.assertAlmostEqual(middle["open"], 100 * 1.04 ** (1 / 7))
        self.assertAlmostEqual(middle["close"], 100 * 1.06 ** (1 / 7))
        self.assertAlmostEqual(middle["high"], 100 * 1.20 ** (1 / 7))
        self.assertAlmostEqual(middle["low"], 100 * 0.90 ** (1 / 7))
        self.assertAlmostEqual(latest["close"], 100 * 1.08 ** (1 / 7))
        self.assertNotIn("close_only", middle)

        older = history.read(FakeIndexMt5(), "GBPX", "D1", 2, page["next_before"])["bars"]
        self.assertEqual(len(older), 1)
        oldest = older[0]
        self.assertEqual(oldest["time"], ANCHOR)
        self.assertEqual(oldest["open"], oldest["low"])
        self.assertEqual(oldest["close"], oldest["high"])
        self.assertGreater(oldest["close"], oldest["open"])
        self.assertNotIn("close_only", oldest)
