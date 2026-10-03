import json
from pathlib import Path
import unittest


ROOT = Path(__file__).resolve().parents[2]
SNAPSHOT = ROOT / "frontend" / "public" / "criterion" / "eurusd_cpi_nfp_v2.json"


class AuditSnapshotTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.data = json.loads(SNAPSHOT.read_text(encoding="utf-8"))

    def test_approved_scope_and_exact_entry_candles(self):
        self.assertEqual((self.data["schema"], self.data["status"], self.data["selectionPolicy"], self.data["pair"]),
                         (1, "HISTORICAL_EXPLORATION_ONLY", "NONE", "EURUSD"))
        bars = {bar[0]: bar for bar in self.data["bars"]}
        self.assertEqual(len(bars), len(self.data["bars"]))
        for name in ("CPI", "NFP"):
            family = self.data["families"][name]
            self.assertEqual(len(family["episodes"]), 140)
            self.assertEqual(len(family["summaries"]), 1248)
            for episode in family["episodes"]:
                self.assertIn(episode["entryTime"], bars)
                self.assertAlmostEqual(episode["entryPrice"], bars[episode["entryTime"]][1], places=6)
                self.assertGreater(episode["atr"], 0)
                for signal, comparator in (("af", "forecast"), ("ap", "previous")):
                    if not episode[signal]["eligible"]:
                        continue
                    difference = float(episode["actual"]) - float(episode[comparator])
                    self.assertNotEqual(difference, 0)
                    # USD is EURUSD's quote: stronger USD points to a short.
                    self.assertEqual(episode[signal]["direction"], -1 if difference > 0 else 1)

    def test_every_displayed_cell_reconciles(self):
        for name in ("CPI", "NFP"):
            family = self.data["families"][name]
            for row in family["summaries"]:
                key = f'{row["signal"]}|{row["horizon"]}|{row["stop"]:g}:{row["target"]:g}'
                trades = [trade for trade in family["trials"].get(key, [])
                          if (row["cohort"] != "COMMON_H240" or trade[5])
                          and (name != "CPI" or row["panel"] != "JOBLESS_CLAIMS_CLEAN"
                               or not family["episodes"][trade[0]]["joblessCollision"])]
                self.assertEqual(len(trades), row["trades"])
                self.assertEqual(sum(trade[1] == 0 for trade in trades), row["tp"])
                self.assertEqual(sum(trade[1] == 1 for trade in trades), row["sl"])
                self.assertEqual(sum(trade[1] == 2 for trade in trades), row["expiry"])
                self.assertEqual(len({trade[0] for trade in trades}), row["bundles"])
                for trade in trades:
                    self.assertTrue(family["episodes"][trade[0]][row["signal"]]["eligible"])
                self.assertAlmostEqual(sum(float(trade[3]) for trade in trades), float(row["grossR"]), delta=0.0002)

    def test_source_representative_cpi_case(self):
        family = self.data["families"]["CPI"]
        episode_index = next(index for index, episode in enumerate(family["episodes"])
                             if episode["id"] == "USD_CPI_1494603000")
        trade = next(row for row in family["trials"]["af|60|1:2"] if row[0] == episode_index)
        self.assertEqual(trade[1], 1)  # SL-first in independently audited report
        self.assertEqual(float(trade[3]), -1.0)
        self.assertEqual(family["episodes"][episode_index]["af"]["direction"], -1)


if __name__ == "__main__":
    unittest.main()
