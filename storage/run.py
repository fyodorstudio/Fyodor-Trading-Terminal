from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

# Run with the same installed runtime dependencies as the frozen bridge,
# without importing or modifying any bridge modules.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from storage.app import data_directory
from storage.archive_import import import_export
from storage.calendar_store import CalendarStore


def main():
    parser = argparse.ArgumentParser(description="Fyodor persistent calendar storage")
    commands = parser.add_subparsers(dest="command", required=True)
    serve = commands.add_parser("serve")
    serve.add_argument("--port", type=int, default=int(os.environ.get("FYODOR_STORAGE_PORT", "8002")))
    importer = commands.add_parser("import")
    importer.add_argument("folder", type=Path)
    importer.add_argument("--dry-run", action="store_true")
    commands.add_parser("status")
    args = parser.parse_args()
    if args.command == "serve":
        import uvicorn
        uvicorn.run("storage.app:app", host="127.0.0.1", port=args.port, access_log=False)
        return
    store = CalendarStore(data_directory() / "calendar.sqlite3")
    try:
        result = import_export(store, args.folder, data_directory() / "inventory", args.dry_run) if args.command == "import" else store.status()
        print(json.dumps(result, indent=2))
    finally:
        store.close()


if __name__ == "__main__":
    main()
