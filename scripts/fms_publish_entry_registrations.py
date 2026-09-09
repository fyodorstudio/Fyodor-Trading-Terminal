"""Publish the existing reviewed-H1 allowlist into one bridge-owned record.

The fixed recipe set below is the approval boundary. New research findings are
never added automatically; changing this set requires a separate review.
"""
from __future__ import annotations

import json

from fms_entry_campaign import ROOT, digest, save


SOURCE = ROOT / "docs/Development Logs/artifacts/fms-entry-campaign-2026-09-06"
DESTINATION = ROOT / "Main/mt5-bridge/registered_entry_review_evidence.json"
ACTIVATED_AT = 1788680400
APPROVED_RECIPES = (
    "AUDUSD|audusd-us-producer-inflation",
    "EURUSD|eurusd-retail-sales-m-m-package",
    "GBPUSD|gbpusd-ism-non-manufacturing-business-activity-package",
    "USDCAD|usdcad-us-consumer-inflation",
    "USDCHF|usdchf-ppi-m-m-package",
    "USDCHF|usdchf-us-employment-release",
    "USDJPY|usdjpy-jpy-labor-wages",
    "USDJPY|usdjpy-us-producer-inflation-rejection",
)


def main() -> None:
    manifest = json.loads((SOURCE / "active-entry-review-manifest.json").read_text())
    result = json.loads((SOURCE / "active-entry-review.json").read_text())
    manifest_hash = manifest.get("manifestHash")
    frozen_manifest = {key: value for key, value in manifest.items() if key != "manifestHash"}
    if digest(frozen_manifest) != manifest_hash or result.get("manifestHash") != manifest_hash:
        raise ValueError("Reviewed-H1 manifest/result provenance mismatch")
    findings = {row["recipe"]: row for row in result["findings"]}
    if set(findings) != set(APPROVED_RECIPES):
        raise ValueError("Research findings changed; approval allowlist was not updated")

    profiles = {}
    for recipe in APPROVED_RECIPES:
        finding = findings[recipe]
        if not finding.get("supportedForEntryCandidate"):
            raise ValueError(f"Approved recipe no longer passes its frozen review: {recipe}")
        if finding.get("contract") != manifest["activeContracts"].get(recipe):
            raise ValueError(f"Reviewed contract no longer matches its frozen manifest: {recipe}")
        market, pattern_id = recipe.split("|", 1)
        later = finding["later"]
        profiles[recipe] = {
            "market": market,
            "patternId": pattern_id,
            "reviewId": f"FMS-{market}-{pattern_id}-ENTRY-H1-v1",
            "contract": finding["contract"],
            "entryRule": "first H1 open strictly after release and complete first-seen package",
            "expiryRule": "same final H4 boundary as the parent contract",
            "developmentSelected": True,
            "later": {
                "laterN": later["n"],
                "h1AverageR": later["h1AverageR"],
                "h4AverageR": later["h4AverageR"],
                "pairedUpliftR": later["pairedUpliftR"],
                "targetHitCount": later["targetHitCount"],
                "stopHitCount": later["stopHitCount"],
                "expiredCount": later["expiredCount"],
                "breakEvenCount": later["breakEvenCount"],
                "ambiguousCount": later["ambiguousCount"],
                "unevaluableCount": later["unevaluableCount"],
            },
        }

    payload = {
        "schema": "fms-reviewed-h1-entry-registration-v1",
        "purpose": "Existing explicitly reviewed H1 registrations; this file cannot promote new recipes.",
        "activatedAt": ACTIVATED_AT,
        "sourceManifestHash": manifest_hash,
        "sourceResultSha256": digest(result),
        "profiles": profiles,
    }
    save(DESTINATION, {**payload, "registryHash": digest(payload)})
    print(json.dumps({"published": str(DESTINATION), "profiles": len(profiles), "registryHash": digest(payload)}))


if __name__ == "__main__":
    main()
