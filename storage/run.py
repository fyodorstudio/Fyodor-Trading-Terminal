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
from storage.data_lock import data_lock
from storage.recovery import backup_directory, restore_directory
from storage.fed_forecasts import FedRefresh, read_forecasts, save_forecasts


def main():
    parser = argparse.ArgumentParser(description="Fyodor persistent calendar storage")
    commands = parser.add_subparsers(dest="command", required=True)
    serve = commands.add_parser("serve")
    serve.add_argument("--port", type=int, default=int(os.environ.get("FYODOR_STORAGE_PORT", "8002")))
    importer = commands.add_parser("import")
    importer.add_argument("folder", type=Path)
    importer.add_argument("--dry-run", action="store_true")
    commands.add_parser("status")
    forecasts = commands.add_parser('fed-forecasts')
    forecasts.add_argument('action', choices=('read', 'save'))
    forecasts.add_argument('--input', type=Path)
    backup = commands.add_parser("backup")
    backup.add_argument("destination", type=Path)
    restore = commands.add_parser("restore")
    restore.add_argument("folder", type=Path)
    restore.add_argument("--destination", required=True, type=Path)
    args = parser.parse_args()
    if args.command == 'fed-forecasts':
        folder = data_directory() / 'fed-forecasts'
        if args.action == 'save':
            if not args.input:
                parser.error('fed-forecasts save requires --input')
            result = save_forecasts(FedRefresh.model_validate_json(args.input.read_text(encoding='utf-8-sig')), folder)
        else:
            result = read_forecasts(folder)
        print(json.dumps(result, indent=2))
        return
    if args.command == "serve":
        import uvicorn
        uvicorn.run("storage.app:app", host="127.0.0.1", port=args.port, access_log=False)
        return
    if args.command in ("backup", "restore"):
        result = backup_directory(data_directory(), args.destination) if args.command == "backup" else restore_directory(args.folder, args.destination)
        print(json.dumps(result, indent=2))
        return
    if args.command == "status":
        # Inspect the configured directory, even while its service owns the lock.
        # Never accidentally report a different service running on the same port.
        store = CalendarStore(data_directory() / "calendar.sqlite3", readonly=True)
        try:
            print(json.dumps(store.status(), indent=2))
        finally:
            store.close()
        return
    with data_lock(data_directory()):
        store = CalendarStore(data_directory() / "calendar.sqlite3")
        try:
            result = import_export(store, args.folder, data_directory() / "inventory", args.dry_run)
            print(json.dumps(result, indent=2))
        finally:
            store.close()


if __name__ == "__main__":
    main()
