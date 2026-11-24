import unittest
from datetime import datetime, timezone
from types import SimpleNamespace

import numpy as np

from fyodor_bridge.candle_activity import CandleTickReader, basket_moves, count_moves, read_currency_activity
from fyodor_bridge.currency_indices import CURRENCIES


START = 1_795_543_200
TICKS = [("time_msc", "i8"), ("bid", "f8"), ("ask", "f8")]
RATES = [("time", "i8"), ("tick_volume", "i8")]


class FakeMt5:
    TIMEFRAME_M1 = 1
    COPY_TICKS_INFO = 1

    def account_info(self):
        return SimpleNamespace(server="Pepperstone-Demo", login=1)

    def symbol_info(self, symbol):
        return SimpleNamespace(digits=5)

    def symbol_select(self, symbol, selected):
        return True

    def last_error(self):
        return 1, "Success"

    def copy_rates_from(self, symbol, frame, timestamp, count):
        at = int(timestamp.timestamp())
        if at == START - 1:
            return np.array([(START - 60, 1)], dtype=RATES)
        if symbol == "EURUSD":
            return np.array([(START - 60, 99)], dtype=RATES)
        return np.array([(START, 10)], dtype=RATES)

    def copy_ticks_range(self, symbol, start, end, kind):
        if start == datetime.fromtimestamp(START - 60, timezone.utc):
            return np.array([(START * 1000 - 100, 1.10000, 1.10020)], dtype=TICKS)
        return np.array([
            (START * 1000, 1.10001, 1.10021),
            (START * 1000 + 1, 1.10002, 1.10020),
            (START * 1000 + 1, 1.10001, 1.10020),
            ((START + 60) * 1000, 1.20000, 1.20020),
        ], dtype=TICKS)

    def symbol_info_tick(self, symbol):
        return SimpleNamespace(time_msc=(START + 60) * 1000)


class CandleActivityTest(unittest.TestCase):
    def test_counts_use_previous_quote_and_exclude_next_candle_boundary(self):
        result = CandleTickReader().read(FakeMt5(), "EURUSD", "M1", START, "first", True)
        self.assertEqual(result, dict(up=1, down=1, flat=1, unknown=0, synthetic=False))

    def test_history_counts_boundary_tick_in_its_own_candle_and_omits_missing_quotes(self):
        result = CandleTickReader().read(FakeMt5(), "EURUSD", "M1", START, "history", True,
                                         history=[START, START + 60, START + 120])
        self.assertEqual(result, {"rows": [
            dict(time=START, up=1, down=1, flat=1, unknown=0),
            dict(time=START + 60, up=1, down=0, flat=0, unknown=0),
        ]})

    def test_basket_reads_one_pair_at_a_time(self):
        reader, mt5 = CandleTickReader(), FakeMt5()
        for step in range(6):
            self.assertIsNone(reader.read(mt5, "GBPX", "M1", START, "basket", step == 0))
        result = reader.read(mt5, "GBPX", "M1", START, "basket", False)
        self.assertTrue(result["synthetic"])
        self.assertEqual(sum(result[key] for key in ("up", "down", "flat")), 2)
        self.assertEqual(reader.pending, {})

    def test_simultaneous_opposite_moves_cancel_before_counting(self):
        times = np.array([100, 200])
        legs = [
            (times, np.array([200, 400]), 100, 1),
            (np.array([100]), np.array([200]), 100, -1),
        ]
        timestamps, moves = basket_moves(legs)
        self.assertEqual(timestamps.tolist(), [100, 200])
        self.assertEqual(count_moves(moves, 1e-12), dict(up=1, down=0, flat=1, unknown=0))

    def test_currency_without_all_seven_pair_counts_is_unranked(self):
        rows = read_currency_activity(FakeMt5(), "M1", START)
        self.assertEqual({row["currency"] for row in rows}, set(CURRENCIES))
        self.assertEqual([row["updates"] for row in rows], [70] * 6 + [None, None])
        self.assertEqual([(row["currency"], row["missing"]) for row in rows[-2:]],
                         [("EUR", ["EURUSD"]), ("USD", ["EURUSD"])])


if __name__ == "__main__":
    unittest.main()
