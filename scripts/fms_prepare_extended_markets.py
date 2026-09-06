"""Prepare the 21 Major Forex Extended crosses for frozen FMS research.

This runner is resumable. It caches each market's H4 archive, starts only the
missing source-family baselines, and records every terminal result. It does not
create experiments, select recipes, register setups, or change live behavior.
"""

from __future__ import annotations

import argparse
import json
import os
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any


MARKETS = (
  "EURGBP", "EURJPY", "EURCHF", "EURAUD", "EURCAD", "EURNZD",
  "GBPJPY", "GBPCHF", "GBPAUD", "GBPCAD", "GBPNZD", "CHFJPY",
  "AUDCHF", "CADCHF", "NZDCHF", "AUDJPY", "AUDCAD", "AUDNZD",
  "CADJPY", "NZDCAD", "NZDJPY",
)
TERMINAL = {"completed", "failed"}


def request(base_url: str, method: str, path: str, payload: dict[str, Any] | None = None) -> Any:
  body = None if payload is None else json.dumps(payload).encode("utf-8")
  req = urllib.request.Request(
    f"{base_url.rstrip('/')}{path}", data=body, method=method,
    headers={"Content-Type": "application/json"},
  )
  try:
    with urllib.request.urlopen(req, timeout=600) as response:
      return json.loads(response.read().decode("utf-8"))
  except urllib.error.HTTPError as error:
    detail = error.read().decode("utf-8", errors="replace")
    raise RuntimeError(f"{method} {path} failed ({error.code}): {detail}") from error


def atomic_write(path: Path, value: dict[str, Any]) -> None:
  temporary = path.with_suffix(path.suffix + ".tmp")
  temporary.write_text(json.dumps(value, indent=2, sort_keys=True) + "\n", encoding="utf-8")
  os.replace(temporary, path)


def save(path: Path, state: dict[str, Any]) -> None:
  state["updatedAt"] = int(time.time())
  atomic_write(path, state)


def main() -> int:
  parser = argparse.ArgumentParser()
  parser.add_argument("--bridge-url", default="http://127.0.0.1:8001")
  parser.add_argument(
    "--checkpoint",
    default="docs/Development Logs/artifacts/fms-extended-markets-2026-09-06/preparation.json",
  )
  parser.add_argument("--poll-seconds", type=float, default=2.0)
  parser.add_argument("--cache-only", action="store_true", help="Finish market H4 caches without starting source baselines")
  args = parser.parse_args()
  checkpoint = Path(args.checkpoint).resolve()
  checkpoint.parent.mkdir(parents=True, exist_ok=True)
  if checkpoint.exists():
    state = json.loads(checkpoint.read_text(encoding="utf-8"))
  else:
    state = {
      "schema": "fms-extended-market-preparation-v1",
      "createdAt": int(time.time()), "updatedAt": int(time.time()),
      "markets": {market: {"cache": {"status": "pending"}, "sources": {}} for market in MARKETS},
    }
  # Keep resumable state aligned with the canonical market universe. This also
  # drops obsolete symbols after a market-list correction.
  state["markets"] = {
    market: state.get("markets", {}).get(market, {"cache": {"status": "pending"}, "sources": {}})
    for market in MARKETS
  }

  for market in MARKETS:
    market_state = state["markets"].setdefault(market, {"cache": {"status": "pending"}, "sources": {}})
    workbench = request(args.bridge_url, "GET", f"/research/workbench?market={market}")
    availability = workbench.get("availability") or {}
    if availability.get("missingH4Prices") and market_state["cache"].get("status") != "completed":
      market_state["cache"] = {"status": "running", "startedAt": int(time.time())}
      save(checkpoint, state)
      try:
        cached = request(args.bridge_url, "POST", "/research/cache-market", {"market": market})
        market_state["cache"] = {"status": "completed", **cached}
      except Exception as error:  # preserve failure and continue with other markets
        market_state["cache"] = {"status": "failed", "error": str(error)}
        save(checkpoint, state)
        continue
      save(checkpoint, state)
    elif not availability.get("missingH4Prices"):
      market_state["cache"] = {"status": "completed", "cachedBeforeRun": True}

    if args.cache_only:
      save(checkpoint, state)
      continue
    workbench = request(args.bridge_url, "GET", f"/research/workbench?market={market}")
    missing = list((workbench.get("availability") or {}).get("missingSourceVersions") or [])
    for version_id in missing:
      source = market_state["sources"].setdefault(version_id, {"status": "pending"})
      if source.get("status") == "completed":
        continue
      try:
        run = request(args.bridge_url, "POST", "/research/backtests", {"versionId": version_id})
        source.update({"status": str(run["status"]), "runId": str(run["id"]), "cached": bool(run.get("cached"))})
      except Exception as error:
        source.update({"status": "failed", "error": str(error)})
      save(checkpoint, state)

  if args.cache_only:
    counts: dict[str, int] = {}
    for market_state in state["markets"].values():
      status = str(market_state["cache"].get("status"))
      counts[status] = counts.get(status, 0) + 1
    print(json.dumps({"checkpoint": str(checkpoint), "cacheStates": counts}, sort_keys=True))
    return 0 if counts.get("failed", 0) == 0 and counts.get("pending", 0) == 0 else 1

  while True:
    active = []
    for market_state in state["markets"].values():
      for source in market_state["sources"].values():
        if source.get("runId") and source.get("status") not in TERMINAL:
          active.append(source)
    if not active:
      break
    for source in active:
      try:
        run = request(args.bridge_url, "GET", f"/research/backtests/{urllib.parse.quote(source['runId'])}")
        source["status"] = str(run["status"])
        source["error"] = run.get("error")
        if source["status"] == "completed":
          source["datasetFingerprint"] = (run.get("result") or {}).get("datasetFingerprint")
      except Exception as error:
        source["lastPollError"] = str(error)
    save(checkpoint, state)
    if any(source.get("status") not in TERMINAL for source in active):
      time.sleep(args.poll_seconds)

  state["completedAt"] = int(time.time())
  save(checkpoint, state)
  counts: dict[str, int] = {}
  for market_state in state["markets"].values():
    for source in market_state["sources"].values():
      status = str(source.get("status"))
      counts[status] = counts.get(status, 0) + 1
  print(json.dumps({"checkpoint": str(checkpoint), "sourceStates": counts}, sort_keys=True))
  return 0 if counts.get("failed", 0) == 0 else 1


if __name__ == "__main__":
  raise SystemExit(main())
