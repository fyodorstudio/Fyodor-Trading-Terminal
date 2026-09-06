"""Publish compact immutable timing-campaign evidence for the existing Knowledge view."""
import json
from pathlib import Path

from fms_entry_campaign import ROOT, digest


def campaign_summary(directory, kind):
    manifest = json.loads((directory / "manifest.json").read_text())
    result = json.loads((directory / "comparison.json").read_text())
    fingerprint = manifest.pop("manifestHash")
    if digest(manifest) != fingerprint or result["manifestHash"] != fingerprint:
        raise ValueError("Campaign manifest/result mismatch")
    findings = [{key: value for key, value in row.items() if key != "cases"} for row in result["findings"]]
    selected = [row for row in findings if row.get("developmentSelectedEntry") == "H1"]
    supported = [row for row in selected if row["later"]["n"] and row["later"]["pairedUpliftR"] > 0 and row["later"]["h1AverageR"] > 0]
    return {"kind": kind, "manifestHash": fingerprint,
        "resultSha256": digest(result), "h4SnapshotSha256": result["h4SnapshotSha256"],
        "sourceDirectory": directory.relative_to(ROOT).as_posix(),
        "recipeCount": len(findings), "attempted": sum(row["attempted"] for row in findings),
        "matched": sum(row["matched"] for row in findings),
        "developmentSelectedH1": len(selected), "laterPositiveImprovements": len(supported),
        "limitations": result["limitations"], "manifest": manifest, "findings": findings}


def session_summary(directory):
    manifest = json.loads((directory / "session-comparison-manifest.json").read_text())
    result = json.loads((directory / "session-comparison.json").read_text())
    fingerprint = manifest.pop("manifestHash")
    if digest(manifest) != fingerprint or result["manifestHash"] != fingerprint:
        raise ValueError("Session comparison manifest/result mismatch")
    selected = [row for row in result["findings"] if row["developmentSelectedEntry"] == "H1"]
    supported = [row for row in selected if row["later"]["n"] and row["later"]["pairedUpliftR"] > 0 and row["later"]["h1AverageR"] > 0]
    return {"kind": "H1 versus H4 with trading-session gaps", "manifestHash": fingerprint,
        "resultSha256": digest(result), "sourceDirectory": directory.relative_to(ROOT).as_posix(),
        "recipeCount": len(result["findings"]), "attempted": sum(row["attempted"] for row in result["findings"]),
        "matched": sum(row["matched"] for row in result["findings"]), "developmentSelectedH1": len(selected),
        "laterPositiveImprovements": len(supported), "limitations": result["limitations"],
        "manifest": manifest, "findings": result["findings"]}


def active_entry_review(directory):
    manifest = json.loads((directory / "active-entry-review-manifest.json").read_text())
    result = json.loads((directory / "active-entry-review.json").read_text())
    fingerprint = manifest.pop("manifestHash")
    if digest(manifest) != fingerprint or result["manifestHash"] != fingerprint:
        raise ValueError("Active entry review manifest/result mismatch")
    return {"manifestHash": fingerprint, "resultSha256": digest(result),
        "reviewed": len(result["findings"]),
        "supported": sum(row["supportedForEntryCandidate"] for row in result["findings"]),
        "limitations": result["limitations"], "findings": result["findings"]}


def pre_h4_reaction(directory):
    manifest = json.loads((directory / "pre-h4-reaction-manifest.json").read_text())
    result = json.loads((directory / "pre-h4-reaction.json").read_text())
    fingerprint = manifest.pop("manifestHash")
    if digest(manifest) != fingerprint or result["manifestHash"] != fingerprint:
        raise ValueError("Pre-H4 reaction manifest/result mismatch")
    return {"manifestHash": fingerprint, "resultSha256": digest(result),
        "evaluated": sum(row["development"]["cases"] + row["later"]["cases"] for row in result["findings"]),
        "limitations": result["limitations"], "findings": result["findings"]}


if __name__ == "__main__":
    artifacts = ROOT / "docs/Development Logs/artifacts"
    payload = {"schema": "fms-entry-research-summary-v1", "recordedOn": "06 Sep 2026",
        "status": "Research only; no entry contract changed",
        "hourly": campaign_summary(artifacts / "fms-entry-campaign-2026-09-06", "H1 versus H4"),
        "sessionHourly": session_summary(artifacts / "fms-entry-campaign-2026-09-06"),
        "activeEntryReview": active_entry_review(artifacts / "fms-entry-campaign-2026-09-06"),
        "preH4Reaction": pre_h4_reaction(artifacts / "fms-entry-campaign-2026-09-06"),
        "minute": campaign_summary(artifacts / "fms-minute-campaign-2026-09-06", "M1 versus H1 versus H4")}
    destination = ROOT / "Main/src/app/lib/fmsEntryResearchSummary.json"
    destination.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"published": str(destination), "hourlyMatched": payload["hourly"]["matched"], "minuteMatched": payload["minute"]["matched"]}))
