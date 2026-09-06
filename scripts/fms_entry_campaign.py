"""Freeze and acquire candle inputs for the FMS earlier-entry comparison.

Uses existing local history endpoints only. Never edits a registration or places
orders. Run prepare once, then fetch; responses outside requested bounds cannot
silently satisfy a request. Saved requests can be resumed after interruption.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path
import sqlite3
import urllib.request

from fms_research_inventory import ROOT


def digest(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, separators=(",", ":")).encode()).hexdigest()


def save(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + ".tmp")
    temporary.write_text(json.dumps(value, indent=2) + "\n", encoding="utf-8")
    temporary.replace(path)


def prepare(database, directory):
    if (directory / "manifest.json").exists():
        raise ValueError("Manifest already exists; resume fetch instead of replacing a frozen campaign.")
    profiles = json.loads((ROOT / "Main/mt5-bridge/registered_reaction_profiles.json").read_text(encoding="utf-8-sig"))["profiles"]
    c = sqlite3.connect(database.resolve().as_uri() + "?mode=ro", uri=True)
    c.execute("BEGIN")
    recipes = []
    try:
        for key, profile in sorted(profiles.items()):
            experiment = profile["experimentId"]
            stored = c.execute("SELECT configuration_json,result_json FROM fms_experiments WHERE id=?", (experiment,)).fetchone()
            config, result = map(json.loads, stored)
            raw_text = c.execute("SELECT value FROM metadata WHERE key=?", (f"fms_raw_audit:{experiment}",)).fetchone()[0]
            raw = json.loads(raw_text)
            contract = next(x for x in raw["contracts"] if x["key"] == raw["selectedContractKey"])
            outcomes = {x["caseId"]: x for x in raw["contractResults"][contract["key"]]}
            cases = []
            for case in raw["cases"]:
                if not case.get("included"):
                    continue
                outcome = outcomes.get(case["caseId"])
                if outcome is None or outcome.get("direction") not in {"long", "short"}:
                    raise ValueError(f"Missing execution direction: {key}/{case['caseId']}")
                cases.append({"caseId": case["caseId"], "eventTime": case["eventTime"],
                    "direction": outcome["direction"], "evidenceDirection": case["direction"],
                    "savedEntryTime": case.get("entryTime"), "savedEntry": case.get("entry"),
                    "savedAtr": case.get("atr"), "savedResultR": outcome.get("grossResultR")})
            recipes.append({"recipe": key, "experimentId": experiment,
                "auditSha256": hashlib.sha256(raw_text.encode()).hexdigest(),
                "configuration": config, "splitTime": result["splitTime"],
                "contract": {k: contract[k] for k in ("stopAtr", "targetR", "holdingCandles")}, "cases": cases})
    finally:
        c.rollback()
        c.close()
    requests = []
    for market in sorted({r["recipe"].split("|")[0] for r in recipes}):
        releases = [case["eventTime"] for r in recipes if r["recipe"].startswith(market + "|") for case in r["cases"]]
        first = (min(releases) // 86400 - 30) * 86400
        last = (max(releases) // 86400 + 45) * 86400
        for start in range(first, last, 30 * 86400):
            requests.append({"symbol": market, "tf": "H1", "from_": start, "to": min(start + 30 * 86400, last)})
    manifest = {"schema": "fms-entry-campaign-v1", "recipesSha256": digest(recipes),
        "entryAlternatives": ["first_H1_open_strictly_after_scheduled_release", "first_H4_open_strictly_after_scheduled_release"],
        "directionBasis": "frozen_selected_contract_outcome",
        "atr": "Wilder ATR14 on completed H4 bars only, recomputed independently at each candidate entry",
        "execution": "Fixed selected experiment stop ATR and target R; fixed elapsed duration holdingCandles * 4 hours from entry; H1 path; gaps/ambiguous order explicitly excluded",
        "selection": "Choose H1 only if development mean paired uplift > 0; later original split evaluates without reselection",
        "scope": "Historical scheduled-release proxies on reused research history; not prospective fills or active overlay replay",
        "limitations": ["Original recipe discovery inspected this archive; the later period is not globally untouched.",
            "M1 postponed until broker supplies within-range history; no fabricated release-time entry.",
            "Fixed experimental contracts are baselines, not a substitute for comparing active management overlays before registration.",
            "Costs excluded, not estimated; no automatic registration."], "requests": requests}
    manifest["manifestHash"] = digest(manifest)
    save(directory / "recipes.json", recipes)
    save(directory / "manifest.json", manifest)
    print(json.dumps({"recipes": len(recipes), "requests": len(requests), "manifestHash": manifest["manifestHash"]}), flush=True)


def fetch(directory, base_url):
    manifest = json.loads((directory / "manifest.json").read_text())
    expected = manifest.pop("manifestHash")
    if digest(manifest) != expected:
        raise ValueError("Frozen manifest changed")
    if digest(json.loads((directory / "recipes.json").read_text())) != manifest["recipesSha256"]:
        raise ValueError("Frozen recipe inputs changed")
    checkpoint_path = directory / "fetch-checkpoint.json"
    checkpoint = json.loads(checkpoint_path.read_text()) if checkpoint_path.exists() else {}
    for index, request in enumerate(manifest["requests"]):
        key = digest(request)
        if key in checkpoint:
            continue
        url = base_url.rstrip("/") + "/history_range?" + "&".join(f"{k}={v}" for k, v in request.items())
        try:
            with urllib.request.urlopen(url, timeout=45) as response:
                rows = json.load(response)
            if not isinstance(rows, list):
                raise ValueError("Expected candle list")
            accepted = [r for r in rows if request["from_"] <= r["time"] <= request["to"]]
            accepted.sort(key=lambda r: r["time"])
            save(directory / "candles" / f"{key}.json", accepted)
            checkpoint[key] = {"request": request, "status": "received" if accepted else "no_within_range_candles",
                "count": len(accepted), "outsideRange": len(rows) - len(accepted), "sha256": digest(accepted),
                "first": accepted[0]["time"] if accepted else None, "last": accepted[-1]["time"] if accepted else None}
        except Exception as error:
            checkpoint[key] = {"request": request, "status": "request_failed", "error": str(error)}
        save(checkpoint_path, checkpoint)
        if index % 20 == 0:
            print(json.dumps({"completed": len(checkpoint), "total": len(manifest["requests"]), "latest": checkpoint[key]["status"]}), flush=True)
    print(json.dumps({"completed": len(checkpoint), "total": len(manifest["requests"])}), flush=True)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("action", choices=["prepare", "fetch"])
    parser.add_argument("--directory", type=Path, required=True)
    parser.add_argument("--database", type=Path, default=Path(os.environ.get("FYODOR_RESEARCH_DB") or str(Path(os.environ["LOCALAPPDATA"]) / "Fyodor Trading Terminal/fyodor-research.sqlite3")))
    parser.add_argument("--base-url", default="http://127.0.0.1:8001")
    args = parser.parse_args()
    if args.action == "prepare":
        prepare(args.database, args.directory)
    else:
        fetch(args.directory, args.base_url)
