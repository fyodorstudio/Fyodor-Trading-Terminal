"""Publish a compact, reproducible coverage ledger for all 28 FMS markets."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path
import sys
import time


ROOT = Path(__file__).resolve().parents[1]
BRIDGE = ROOT / "Main/mt5-bridge"
sys.path.insert(0, str(BRIDGE))

from macro_signal import MARKET_RESEARCH_SPECS, MARKET_SOURCE_VERSION_IDS  # noqa: E402
from research_store import ResearchStore  # noqa: E402


MARKETS = ("EURUSD", *MARKET_RESEARCH_SPECS.keys())


def digest(value: object) -> str:
  return hashlib.sha256(json.dumps(value, sort_keys=True, separators=(",", ":")).encode()).hexdigest()


def main() -> int:
  store = ResearchStore()
  rows = []
  for market in MARKETS:
    versions = MARKET_SOURCE_VERSION_IDS[market]
    if market == "EURUSD":
      currencies = ["EUR", "USD"]
    else:
      base, quote, _scope = MARKET_RESEARCH_SPECS[market]
      currencies = [base, quote]
    calendar = store.calendar_coverage(currencies)
    h4 = store.candle_coverage(market, "H4")
    sources = []
    for version in versions:
      run = store.latest_backtest_run(version)
      result = (run or {}).get("result") or {}
      outcomes = (((result.get("targets") or {}).get("2.0") or {}).get("outcomes") or [])
      overall = (((result.get("targets") or {}).get("2.0") or {}).get("overall") or {})
      sources.append({
        "versionId": version, "runId": (run or {}).get("id"),
        "status": (run or {}).get("status", "missing"),
        "datasetFingerprint": result.get("datasetFingerprint"),
        "candidateCases": len(outcomes),
        "evaluableCases": overall.get("evaluableCount"),
        "unevaluableCases": overall.get("unevaluableCount"),
      })
    ready = bool(h4.get("count")) and all(source["status"] == "completed" for source in sources)
    rows.append({
      "market": market, "currencies": currencies,
      "status": "ready" if ready else "preparing" if h4.get("count") else "missing_prices",
      "calendar": {key: calendar.get(key) for key in ("count", "earliest", "latest", "currencies")},
      "h4": {key: h4.get(key) for key in ("count", "earliest", "latest")},
      "sources": sources,
    })
  core = {
    "schema": "fms-major-forex-extended-coverage-v1",
    "universe": "28 combinations of USD, EUR, GBP, JPY, AUD, CAD, NZD, CHF",
    "markets": rows,
  }
  payload = {
    **core, "generatedAt": int(time.time()), "coverageHash": digest(core),
    "summary": {
      "markets": len(rows), "ready": sum(row["status"] == "ready" for row in rows),
      "withH4": sum(bool(row["h4"]["count"]) for row in rows),
      "completedSources": sum(source["status"] == "completed" for row in rows for source in row["sources"]),
      "requiredSources": sum(len(row["sources"]) for row in rows),
    },
  }
  artifact = ROOT / "docs/Development Logs/artifacts/fms-extended-markets-2026-09-06/coverage.json"
  client = ROOT / "Main/src/app/lib/fmsCoverageSummary.json"
  artifact.parent.mkdir(parents=True, exist_ok=True)
  encoded = json.dumps(payload, indent=2) + "\n"
  artifact.write_text(encoded, encoding="utf-8")
  client.write_text(encoded, encoding="utf-8")
  print(json.dumps({"coverageHash": payload["coverageHash"], **payload["summary"]}, sort_keys=True))
  return 0


if __name__ == "__main__":
  raise SystemExit(main())
