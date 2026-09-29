"""Publish a compact, pinned EURUSD CPI/NFP audit snapshot for the terminal.

This is a display-data extraction, not a new backtest. The research viewer has
already reconciled its episode-level trials to the frozen V2 source packages.
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
from pathlib import Path
import re


TERMINAL_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_RESEARCH_ROOT = Path(r"C:\dev\Fyodor Math Lab\Expanded Macro Research")
OUTPUT = TERMINAL_ROOT / "frontend" / "public" / "criterion" / "eurusd_cpi_nfp_v2.json"
EXPECTED_VIEWER_SHA256 = "d9da359c2bfac9aba193648a712bf985751dc9aed5467a5c5cfc4d50871a3c5a"
EXPECTED_CANDLES_SHA256 = "96a51aa29bbc3f3e9cb07633328f154ac6967d8bf40b7a5211934acb0deff45e"
VIEWER_DATA = re.compile(r'<script type="application/json" id="viewer-data">(.*?)</script>', re.S)


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1 << 20), b""):
            digest.update(chunk)
    return digest.hexdigest()


def load_csv(path: Path):
    with path.open(encoding="utf-8-sig", newline="") as stream:
        yield from csv.DictReader(stream)


def load_viewer(path: Path):
    if sha256(path) != EXPECTED_VIEWER_SHA256:
        raise ValueError("Research viewer is not the pinned, reconciled snapshot")
    match = VIEWER_DATA.search(path.read_text(encoding="utf-8"))
    if not match:
        raise ValueError("Research viewer has no embedded audit data")
    payload = json.loads(match.group(1))
    if payload.get("schema") != 1 or set(payload.get("families", {})) != {"CPI", "NFP"}:
        raise ValueError("Unexpected research viewer schema/families")
    return payload


def load_bars(path: Path):
    if sha256(path) != EXPECTED_CANDLES_SHA256:
        raise ValueError("EURUSD H1 candles differ from pinned MT5 export")
    bars = []
    by_time = {}
    for row in load_csv(path):
        bar = [int(row["time"]), float(row["open"]), float(row["high"]), float(row["low"]), float(row["close"])]
        if bars and bar[0] <= bars[-1][0]:
            raise ValueError("EURUSD H1 candles are not strictly chronological")
        if row["complete_at_export"].lower() != "true":
            continue
        bars.append(bar)
        by_time[bar[0]] = bar
    return bars, by_time


def extract_family(research_root: Path, name: str, source: dict, bars_by_time: dict, bars: list):
    pre_path = research_root / "Research Candidate" / name / f"pre_outcome_ledger_{name.lower()}_v2.csv"
    if sha256(pre_path) != source["sourceHashes"]["preOutcome"]:
        raise ValueError(f"{name} pre-outcome ledger differs from pinned source")
    pre = {row["bundle_id"]: row for row in load_csv(pre_path) if row["pair"] == "EURUSD"}
    bar_positions = {bar[0]: index for index, bar in enumerate(bars)}
    originals = source["episodes"]
    old_to_new = {}
    episodes = []
    for old_index, item in enumerate(originals):
        if item[1] != "EURUSD":
            continue
        row = pre[item[11]]
        entry_time = int(row["entry_timestamp"])
        entry_bar = bars_by_time.get(entry_time)
        if entry_bar is None or row["timestamp_server_text"] != item[0] or row["entry_server_text"] != item[12]:
            raise ValueError(f"{name} entry or timestamp mismatch: {item[11]}")
        if row["actual"] != item[2] or row["forecast"] != item[3] or row["previous"] != item[4]:
            raise ValueError(f"{name} A/F/P mismatch: {item[11]}")
        start = bar_positions[entry_time]
        for offset, source_pips in enumerate(item[10]):
            if start + offset >= len(bars) or abs((bars[start + offset][4] - entry_bar[1]) * 10000 - source_pips) > 0.001:
                raise ValueError(f"{name} H{offset + 1} price path differs from pinned candles: {item[11]}")
        old_to_new[old_index] = len(episodes)
        episodes.append({
            "id": item[11], "releaseTime": int(row["timestamp"]), "releaseText": item[0],
            "entryTime": entry_time, "entryText": item[12], "year": int(row["year"]),
            "actual": item[2], "forecast": item[3], "previous": item[4],
            "entryPrice": entry_bar[1], "atr": float(row["pre_release_atr"]),
            "joblessCollision": item[5], "cadJobsCollision": item[6], "commonH240": item[7],
            "af": {"direction": int(item[13]) if item[13] else 0, "eligible": item[8]},
            "ap": {"direction": int(item[14]) if item[14] else 0, "eligible": item[9]},
        })
    if set(pre) != {episode["id"] for episode in episodes}:
        raise ValueError(f"{name} EURUSD episode set incomplete")

    trials = {}
    for key, group in source["trades"].items():
        pair, signal, horizon, cell = key.split("|")
        if pair != "EURUSD":
            continue
        trimmed = []
        for trade in group:
            if trade[0] in old_to_new:
                trimmed.append([old_to_new[trade[0]], *trade[1:]])
        trials[f"{signal}|{horizon}|{cell}"] = trimmed

    fields = ("panel", "pair", "signal", "cohort", "horizon", "stop", "target", "bundles", "trades",
              "tp", "sl", "expiry", "dual", "meanR", "grossR", "tpMedianH", "slMedianH",
              "allMedianH", "allP90H", "loyoPositive", "loyoTotal", "adjacentMeanR")
    summaries = []
    for source_row in source["summaries"]:
        if source_row[1] != "EURUSD":
            continue
        summary = dict(zip(fields, source_row))
        for field in ("horizon", "bundles", "trades", "tp", "sl", "expiry", "dual"):
            summary[field] = int(summary[field])
        summary["stop"] = float(summary["stop"])
        summary["target"] = float(summary["target"])
        key = f'{summary["signal"]}|{summary["horizon"]}|{summary["stop"]:g}:{summary["target"]:g}'
        selected = [trade for trade in trials.get(key, [])
                    if (summary["cohort"] != "COMMON_H240" or trade[5])
                    and (name != "CPI" or summary["panel"] != "JOBLESS_CLAIMS_CLEAN"
                         or not episodes[trade[0]]["joblessCollision"])
                    and (name != "NFP" or summary["panel"] == "FULL_PANEL" or summary["pair"] != "USDCAD"
                         or not episodes[trade[0]]["cadJobsCollision"])]
        counts = (len(selected), sum(t[1] == 0 for t in selected), sum(t[1] == 1 for t in selected),
                  sum(t[1] == 2 for t in selected), sum(t[4] for t in selected))
        expected = tuple(summary[field] for field in ("trades", "tp", "sl", "expiry", "dual"))
        if counts != expected or len({t[0] for t in selected}) != summary["bundles"]:
            raise ValueError(f"{name} summary count mismatch: {key} {summary['panel']} {summary['cohort']}")
        if selected and abs(sum(float(t[3]) for t in selected) - float(summary["grossR"])) > 0.0002:
            raise ValueError(f"{name} summary R mismatch: {key}")
        summaries.append(summary)
    return {"run": source["run"], "codeCommit": source["codeCommit"], "sourceHashes": source["sourceHashes"],
            "episodes": episodes, "trials": trials, "summaries": summaries}


def build(research_root: Path, output: Path = OUTPUT):
    viewer = research_root / "HTML Viewer" / "table_viewer.html"
    candle = research_root / "raw_data" / "FyodorResearchExport_v4_20260928_021936_79538281_server" / "candles" / "candles_EURUSD_H1.csv"
    source = load_viewer(viewer)
    bars, by_time = load_bars(candle)
    families = {name: extract_family(research_root, name, source["families"][name], by_time, bars)
                for name in ("CPI", "NFP")}
    payload = {"schema": 1, "status": "HISTORICAL_EXPLORATION_ONLY", "selectionPolicy": "NONE",
               "pair": "EURUSD", "viewerSha256": EXPECTED_VIEWER_SHA256,
               "candlesSha256": EXPECTED_CANDLES_SHA256, "bars": bars, "families": families}
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(payload, separators=(",", ":"), ensure_ascii=False), encoding="utf-8")
    print(f"Published {output}: {len(bars)} H1 bars, " + ", ".join(
        f"{name} {len(value['episodes'])} episodes/{len(value['summaries'])} cells" for name, value in families.items()))


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--research-root", type=Path, default=DEFAULT_RESEARCH_ROOT)
    args = parser.parse_args()
    build(args.research_root)
