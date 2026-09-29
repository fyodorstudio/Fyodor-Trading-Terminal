import hashlib
import json
from pathlib import Path
import re
import unittest


ROOT = Path(__file__).resolve().parents[2]
REPORT = ROOT / "frontend" / "public" / "criterion" / "research_report.html"
SNAPSHOT = ROOT / "frontend" / "public" / "criterion" / "eurusd_cpi_nfp_v2.json"
MANIFEST = ROOT / "frontend" / "src" / "criterion" / "report-manifest.json"


class ReportVersionTests(unittest.TestCase):
    def test_published_report_matches_manifest_and_terminal_snapshot(self):
        manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
        snapshot = json.loads(SNAPSHOT.read_text(encoding="utf-8"))
        report_bytes = REPORT.read_bytes()
        self.assertEqual(manifest["version"], "1.0.1")
        self.assertEqual(hashlib.sha256(report_bytes).hexdigest(), manifest["reportSha256"])
        self.assertEqual(snapshot["viewerSha256"], manifest["reportSha256"])
        self.assertEqual(manifest["terminalDockPairs"], [snapshot["pair"]])
        self.assertEqual(manifest["status"], snapshot["status"])

        embedded = re.search(rb'<script type="application/json" id="viewer-data">(.*?)</script>',
                             report_bytes, re.DOTALL)
        self.assertIsNotNone(embedded)
        report = json.loads(embedded.group(1))
        self.assertEqual(sorted(report["families"]), sorted(manifest["families"]))
        for family in manifest["families"]:
            episodes = report["families"][family]["episodes"]
            self.assertEqual(sorted({row[1] for row in episodes}), manifest["fullReportPairs"])
            self.assertEqual(len(episodes), 980)
            self.assertEqual(len({row[11] for row in episodes}), 140)


if __name__ == "__main__":
    unittest.main()
