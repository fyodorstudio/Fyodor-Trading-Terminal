"""Freeze recent minute-entry research using the existing campaign acquisition.

This is a recent-history diagnostic, not a new untouched development/holdout.
"""
import argparse
import json
from pathlib import Path

from fms_entry_campaign import digest, fetch, save


def prepare(source, directory):
    if (directory / "manifest.json").exists():
        raise ValueError("Frozen campaign already exists")
    recipes = json.loads((source / "recipes.json").read_text())
    # Predeclared available-history probe window: May through 5 September 2026.
    first, last = 1777593600, 1788652800
    requests = []
    for market in sorted({r["recipe"].split("|")[0] for r in recipes}):
        for start in range(first, last, 20 * 86400):
            requests.append({"symbol": market, "tf": "M1", "from_": start, "to": min(last, start + 20 * 86400)})
    manifest = {"schema": "fms-minute-entry-campaign-v1", "recipesSha256": digest(recipes),
        "sourceCampaign": json.loads((source / "manifest.json").read_text())["manifestHash"],
        "period": {"from": first, "to": last},
        "entries": ["first_M1_open_strictly_after_release", "first_H1_open_strictly_after_release", "first_H4_open_strictly_after_release"],
        "atr": "Completed H4 Wilder ATR14 at each entry; no unfinished H4 data",
        "execution": "Fixed experimental SL/TP; all entries share the original baseline H4 holding-bar expiry; minute OHLC ordering, ambiguous bars excluded",
        "coverage": "Require each minute up to actual exit; weekend gaps up to 72 hours explicitly allowed as a market-closure assumption; other gaps exclude the path",
        "selection": "None. Report every recipe; this short reused period cannot choose or register a faster contract.",
        "costs": "Gross only; spread, commission, slippage and swap unknown and excluded",
        "limitations": ["Scheduled-release proxy cannot prove complete-package observation or executable fill.",
            "Short recent window was already available during original research.",
            "No active break-even/context overlays are simulated in this fixed-contract diagnostic.",
            "Market-closure assumptions and missing-minute rates remain visible."], "requests": requests}
    manifest["manifestHash"] = digest(manifest)
    save(directory / "recipes.json", recipes)
    save(directory / "manifest.json", manifest)
    print(json.dumps({"manifestHash": manifest["manifestHash"], "requests": len(requests)}), flush=True)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("action", choices=["prepare", "fetch"])
    parser.add_argument("--source", type=Path)
    parser.add_argument("--directory", required=True, type=Path)
    args = parser.parse_args()
    if args.action == "prepare":
        prepare(args.source, args.directory)
    else:
        fetch(args.directory, "http://127.0.0.1:8001")
