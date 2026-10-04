from __future__ import annotations

import csv
import hashlib
import json
import re
import shutil
from collections import Counter
from decimal import Decimal
from pathlib import Path

from .calendar_store import CalendarStore, CURRENCIES, canonical
from .contracts import CalendarEvent

REQUIRED_FILES = ("manifest.csv", "calendar_events.csv", "calendar_releases.csv", "calendar_currencies.csv")


def csv_rows(path):
    with path.open(encoding="utf-8-sig", newline="") as stream:
        yield from csv.DictReader(stream)


def file_hash(path):
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def release_event(row, definitions):
    definition = definitions[row["event_id"]]
    if row["value_event_id"] != row["event_id"] or row["country_lookup_ok"] != "true":
        raise ValueError("Export has mismatched event identity or failed country lookup")
    result = {
        "value_id": row["value_id"], "event_id": row["event_id"],
        "server_time_seconds": int(row["timestamp"]), "period_seconds": int(row["period"] or 0),
        "revision": int(row["revision"]), "currency": row["currency"],
        "country_code": row["country_code"], "country_name": definition["country_name"],
        "name": row["event_name"], "event_code": row["event_code"], "importance": row["importance"],
        "unit": int(definition["unit_code"]), "multiplier": int(definition["multiplier_code"]),
        "digits": int(row["digits"]), "time_mode": int(definition["time_mode_code"]),
        "impact": {"0": "none", "1": "positive", "2": "negative"}[row["impact_type_code"]],
    }
    for field in ("actual", "forecast", "previous", "revised_previous"):
        raw = row[field + "_raw_scaled_1e6"]
        result[field + "_raw_scaled_1e6"] = raw or None
        # Preserve exact raw integers; a human-facing decimal can be rounded.
        result[field] = float(Decimal(raw) / 1000000) if raw else (float(row[field]) if row[field] else None)
    return CalendarEvent.model_validate(result).model_dump()


def inspect_export(folder: Path):
    folder = folder.resolve(strict=True)
    for name in REQUIRED_FILES:
        if not (folder / name).is_file():
            raise ValueError(f"Missing required export file: {name}")
    manifest_rows = list(csv_rows(folder / "manifest.csv"))
    manifest = {row["key"]: row["value"] for row in manifest_rows}
    if len(manifest) != len(manifest_rows):
        raise ValueError("Duplicate manifest key")
    if manifest["schema_version"] != "fyodor-mt5-research-export/4.0.0":
        raise ValueError("Expected research export schema 4.0.0")
    if manifest["timestamp_convention"] != "trade_server_time" or manifest["calendar_completed"] != "true":
        raise ValueError("Calendar export is incomplete or uses an unsupported timestamp convention")
    for key in ("calendar_country_lookup_failures", "calendar_event_query_failures", "calendar_currencies_without_events",
                "calendar_value_query_failures", "calendar_event_id_mismatches"):
        if int(manifest[key]) != 0:
            raise ValueError(f"Calendar manifest reports failures: {key}")
    source_id = manifest["account_server"]
    if not source_id or len(source_id) > 160 or not re.fullmatch(r"[A-Za-z0-9_-]{1,160}", manifest["export_id"]):
        raise ValueError("Invalid broker/export identity")
    start, end = int(manifest["calendar_from_timestamp"]), int(manifest["calendar_to_timestamp"])
    if start >= end or end > int(manifest["snapshot_trade_server_timestamp"]):
        raise ValueError("Invalid historical export bounds")
    definitions = {}
    for row in csv_rows(folder / "calendar_events.csv"):
        if row["event_id"] in definitions:
            raise ValueError("Duplicate event definition")
        definitions[row["event_id"]] = row
    if len(definitions) != int(manifest["calendar_events_exported"]):
        raise ValueError("Event definition count does not match manifest")
    counts, seen = Counter(), set()
    for row in csv_rows(folder / "calendar_releases.csv"):
        if row["value_id"] in seen:
            raise ValueError("Duplicate calendar value identity")
        seen.add(row["value_id"])
        if not start <= int(row["timestamp"]) <= end or row["timestamp_convention"] != "trade_server_time":
            raise ValueError("Row timestamp contradicts manifest")
        if row["event_id"] not in definitions:
            raise ValueError("Release has no event definition")
        if row["currency"] in CURRENCIES:
            release_event(row, definitions)
        counts[row["currency"]] += 1
    if sum(counts.values()) != int(manifest["calendar_releases_exported"]):
        raise ValueError("Release count does not match manifest")
    currencies = {}
    for row in csv_rows(folder / "calendar_currencies.csv"):
        if row["currency"] in currencies or row["status"] != "ok" or int(row["query_error"]) != 0:
            raise ValueError("Currency coverage is incomplete or duplicated")
        if int(row["releases"]) != counts[row["currency"]]:
            raise ValueError("Currency count mismatch")
        currencies[row["currency"]] = row
    if set(currencies) != set(manifest["calendar_currencies"].split(",")):
        raise ValueError("Currency coverage does not match manifest")
    names = (*REQUIRED_FILES, *(("run_started.csv",) if (folder / "run_started.csv").is_file() else ()))
    hashes = {name: file_hash(folder / name) for name in names}
    return {"folder": folder, "manifest": manifest, "definitions": definitions, "hashes": hashes,
            "file_count": len(names), "bytes": sum((folder / name).stat().st_size for name in names),
            "total_rows": sum(counts.values()), "selected_rows": sum(counts[c] for c in CURRENCIES),
            "source_id": source_id, "import_id": source_id + ":" + manifest["export_id"]}


def import_export(store: CalendarStore, folder: Path, inventory: Path, dry_run=False):
    plan = inspect_export(folder)
    report = {key: plan[key] for key in ("file_count", "bytes", "total_rows", "selected_rows", "source_id", "import_id")}
    report["cutoff_server_text"] = plan["manifest"]["calendar_to_server_text"]
    print("Inventory import plan (before copying): " + json.dumps(report), flush=True)
    if dry_run:
        return report
    # Runtime files are copied, never linked to mutable research input. Recheck
    # copied hashes before committing, preventing source changes during import.
    folder_name = hashlib.sha256(plan["import_id"].encode()).hexdigest()[:12] + "_" + plan["manifest"]["export_id"]
    target = inventory.resolve() / folder_name
    target.mkdir(parents=True, exist_ok=True)
    for name, digest in plan["hashes"].items():
        destination = target / name
        if destination.exists():
            if file_hash(destination) != digest:
                raise ValueError("Existing inventory copy differs; refusing to overwrite it")
        else:
            shutil.copy2(plan["folder"] / name, destination)
        if file_hash(destination) != digest:
            raise ValueError("Copied export hash verification failed")
    definitions = {row["event_id"]: row for row in csv_rows(target / "calendar_events.csv")}
    rows = (release_event(row, definitions) for row in csv_rows(target / "calendar_releases.csv") if row["currency"] in CURRENCIES)
    result = store.import_rows(plan["import_id"], plan["source_id"], plan["manifest"], plan["hashes"], rows)
    (target / "import_hashes.json").write_text(canonical(plan["hashes"]) + "\n", encoding="utf-8")
    return {**report, **result}
