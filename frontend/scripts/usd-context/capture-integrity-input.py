"""Freeze an audit input using the storage API's query rules in a read-only transaction.

No provider observations, timing records or magnitude preferences are changed.
The older snapshot supplies explicit calibration settings, not old calculated outputs.
"""
import argparse
import datetime
import json
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT))
from storage.calendar_store import CalendarStore

parser = argparse.ArgumentParser()
parser.add_argument("settings_snapshot")
parser.add_argument("output")
parser.add_argument("--source", default="Elev8-Demo2")
args = parser.parse_args()
output = pathlib.Path(args.output)
if output.exists():
    raise SystemExit("Choose a new audit file; existing snapshots are never overwritten.")
with open(args.settings_snapshot, encoding="utf-8") as file:
    old = json.load(file)
as_of = int(datetime.datetime.now(datetime.timezone.utc).timestamp() * 1000)
store = CalendarStore(ROOT / "storage/data/calendar.sqlite3", readonly=True)
try:
    events, cursor, pages = [], None, 0
    while True:
        page = store.query(args.source, 0, as_of // 1000 + 86400, limit=5000,
                           after_time=cursor["after_time"] if cursor else None,
                           after_id=cursor["after_id"] if cursor else None, time_basis="chart")
        events.extend(page["events"])
        pages += 1
        cursor = page["next_cursor"]
        if not cursor:
            break
    result = {"source": args.source, "revision": page["revision"], "asOf": as_of,
              "capture": "read-only storage transaction; chart query rules",
              "settingsProvenance": str(pathlib.Path(args.settings_snapshot)),
              "coverage": page["coverage"],
              "inputUSD": {**{key: old["inputUSD"][key] for key in ("families", "settings")},
                           "asOf": as_of, "events": [e for e in events if e["currency"] == "USD"]},
              "inputEUR": {**{key: old["inputEUR"][key] for key in ("families", "settings")},
                           "asOf": as_of, "events": [e for e in events if e["currency"] == "EUR"]}}
    output.write_text(json.dumps(result, separators=(",", ":")), encoding="utf-8")
    print(json.dumps({"revision": page["revision"], "pages": pages, "rows": len(events),
                      "USD": len(result["inputUSD"]["events"]), "EUR": len(result["inputEUR"]["events"])}))
finally:
    store.close()
