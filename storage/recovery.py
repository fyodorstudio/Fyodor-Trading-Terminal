"""Versioned offline backups, validated before restoring into an empty directory."""
from datetime import datetime, timezone
from contextlib import closing
import hashlib
import json
from pathlib import Path, PurePosixPath
import shutil
import sqlite3
import tempfile

from .data_lock import data_lock

FORMAT = "fyodor-calendar-backup"


def digest(path):
    with path.open("rb") as handle:
        return hashlib.file_digest(handle, "sha256").hexdigest()


def database_report(path):
    with closing(sqlite3.connect(path.resolve().as_uri() + "?mode=ro", uri=True)) as database:
        if database.execute("PRAGMA quick_check").fetchall() != [("ok",)]:
            raise ValueError("Calendar database integrity check failed")
        schema = database.execute("PRAGMA user_version").fetchone()[0]
        if schema != 2:
            raise ValueError(f"Unsupported backup database schema: {schema}")
        return {"schema": schema, "events": database.execute("SELECT count(*) FROM events").fetchone()[0],
                "observations": database.execute("SELECT count(*) FROM observations").fetchone()[0],
                "sources": [row[0] for row in database.execute("SELECT id FROM sources ORDER BY id")]}


def backup_directory(source: Path, destination: Path):
    source, destination = source.resolve(), destination.resolve()
    if not (source / "calendar.sqlite3").is_file():
        raise ValueError("No calendar database to back up")
    if destination.exists() or destination.is_relative_to(source) or source.is_relative_to(destination):
        raise ValueError("Choose a new backup directory outside the storage data directory")
    destination.parent.mkdir(parents=True, exist_ok=True)
    with data_lock(source), tempfile.TemporaryDirectory(prefix="fyodor-backup-", dir=destination.parent) as temporary:
        stage = Path(temporary) / "snapshot"
        stage.mkdir()
        # SQLite's backup API includes committed WAL contents without copying journals.
        with closing(sqlite3.connect((source / "calendar.sqlite3").as_uri() + "?mode=ro", uri=True)) as original:
            with closing(sqlite3.connect(stage / "calendar.sqlite3")) as copied:
                original.backup(copied)
                copied.execute("PRAGMA journal_mode=DELETE")
        inventory = source / "inventory"
        if inventory.exists():
            if inventory.is_symlink() or any(path.is_symlink() for path in inventory.rglob("*")):
                raise ValueError("Inventory symlinks are not supported in backups")
            shutil.copytree(inventory, stage / "inventory")
        files = [{"path": path.relative_to(stage).as_posix(), "size": path.stat().st_size, "sha256": digest(path)}
                 for path in sorted(stage.rglob("*")) if path.is_file()]
        manifest = {"format": FORMAT, "version": 1, "created_at": datetime.now(timezone.utc).isoformat(),
                    "database": database_report(stage / "calendar.sqlite3"), "files": files}
        (stage / "backup.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
        stage.rename(destination)
    return {"backup": str(destination), **manifest["database"], "files": len(files)}


def validate_backup(folder: Path):
    folder = folder.resolve()
    if (folder / "backup.json").is_symlink():
        raise ValueError("Backup symlinks are not supported")
    if (folder / "backup.json").stat().st_size > 10 * 1024 * 1024:
        raise ValueError("Backup manifest exceeds 10 MB")
    manifest = json.loads((folder / "backup.json").read_text(encoding="utf-8"))
    if not isinstance(manifest, dict) or manifest.get("format") != FORMAT or manifest.get("version") != 1 or not isinstance(manifest.get("files"), list):
        raise ValueError("Unsupported backup format or version")
    paths = set()
    for entry in manifest["files"]:
        if not isinstance(entry, dict) or not isinstance(entry.get("path"), str):
            raise ValueError("Invalid backup file entry")
        raw = entry["path"]
        relative = PurePosixPath(raw)
        if raw != relative.as_posix() or relative.is_absolute() or ".." in relative.parts or "\\" in raw or ":" in raw or raw in paths or not (raw == "calendar.sqlite3" or raw.startswith("inventory/")):
            raise ValueError("Invalid or duplicate backup path")
        paths.add(raw)
        target = folder / raw
        if any((folder / PurePosixPath(*relative.parts[:i])).is_symlink() for i in range(1, len(relative.parts) + 1)) or not target.is_file():
            raise ValueError("Missing backup file or unsupported symlink")
        if target.stat().st_size != entry.get("size") or digest(target) != entry.get("sha256"):
            raise ValueError(f"Backup hash/size mismatch: {raw}")
    if "calendar.sqlite3" not in paths or database_report(folder / "calendar.sqlite3") != manifest.get("database"):
        raise ValueError("Backup database does not match its manifest")
    return manifest


def restore_directory(folder: Path, destination: Path):
    folder, destination = folder.resolve(), destination.resolve()
    if destination == folder or destination.is_relative_to(folder) or folder.is_relative_to(destination):
        raise ValueError("Restore destination must be outside the backup directory")
    manifest = validate_backup(folder)
    with data_lock(destination):
        if any(path.name != ".fyodor-storage.lock" for path in destination.iterdir()):
            raise ValueError("Restore requires an empty destination; existing data will not be overwritten")
        with tempfile.TemporaryDirectory(prefix="fyodor-restore-", dir=destination.parent) as temporary:
            stage = Path(temporary)
            for entry in manifest["files"]:
                target = stage / entry["path"]
                target.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(folder / entry["path"], target)
                if digest(target) != entry["sha256"]:
                    raise ValueError("Backup changed during restore")
            if database_report(stage / "calendar.sqlite3") != manifest["database"]:
                raise ValueError("Restored database validation failed")
            # Only validated files reach the empty destination. No existing data is replaced.
            moved = []
            try:
                for path in list(stage.iterdir()):
                    target = destination / path.name
                    path.rename(target)
                    moved.append(target)
            except OSError:
                # Roll back only the new paths this operation published.
                for target in reversed(moved):
                    target.rename(stage / target.name)
                raise
    return {"restored": str(destination), **manifest["database"]}
