import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

from storage.calendar_store import CalendarStore
from storage.data_lock import data_lock
from storage.recovery import backup_directory, restore_directory, validate_backup, digest
from storage.tests.test_calendar_storage import context, event, NOW


class RecoveryTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.source = self.root / "original data"
        store = CalendarStore(self.source / "calendar.sqlite3", lambda: NOW - 10800)
        store.register(context())
        store.collect("Broker-Demo", [event()], "publisher-1", NOW - 10800)
        self.expected = store.query("Broker-Demo", 0, NOW + 86400)
        store.close()
        inventory = self.source / "inventory" / "seed"
        inventory.mkdir(parents=True)
        (inventory / "calendar_events.csv").write_bytes(b"original export bytes\r\n")
        self.backup = self.root / "backup folder"

    def tearDown(self):
        self.temp.cleanup()

    def test_actual_backup_restore_preserves_rows_provenance_and_inventory(self):
        result = backup_directory(self.source, self.backup)
        self.assertEqual(result["events"], 1)
        restored = self.root / "restored data"
        restore_directory(self.backup, restored)
        store = CalendarStore(restored / "calendar.sqlite3", lambda: NOW - 10800)
        try:
            self.assertEqual(store.query("Broker-Demo", 0, NOW + 86400), self.expected)
        finally:
            store.close()
        self.assertEqual((restored / "inventory/seed/calendar_events.csv").read_bytes(), b"original export bytes\r\n")
        self.assertFalse((self.backup / "calendar.sqlite3-wal").exists())
        self.assertEqual(validate_backup(self.backup)["database"]["events"], 1)
        with self.assertRaisesRegex(ValueError, "empty destination"):
            restore_directory(self.backup, restored)
        with self.assertRaisesRegex(ValueError, "new backup directory"):
            backup_directory(self.source, self.backup)

    def test_corruption_and_unsafe_paths_never_restore(self):
        backup_directory(self.source, self.backup)
        manifest_path = self.backup / "backup.json"
        original = manifest_path.read_text()
        for path in ["../outside", "inventory/../outside", "inventory\\outside", "C:/outside", "/outside", "inventory/./outside"]:
            manifest = json.loads(original)
            manifest["files"][0]["path"] = path
            manifest_path.write_text(json.dumps(manifest))
            with self.assertRaises(ValueError):
                restore_directory(self.backup, self.root / "rejected")
            self.assertFalse((self.root / "rejected").exists())
        manifest_path.write_text(original)
        (self.backup / "inventory/seed/calendar_events.csv").write_bytes(b"changed")
        with self.assertRaisesRegex(ValueError, "mismatch"):
            restore_directory(self.backup, self.root / "rejected")
        self.assertFalse((self.root / "rejected").exists())

    def test_active_service_lock_blocks_second_process_and_recovery(self):
        with data_lock(self.source):
            with self.assertRaisesRegex(ValueError, "in use"):
                backup_directory(self.source, self.backup)
            result = subprocess.run([sys.executable, "-c", "from pathlib import Path; from storage.data_lock import data_lock; import sys;\nwith data_lock(Path(sys.argv[1])): pass", str(self.source)], capture_output=True, text=True)
            self.assertNotEqual(result.returncode, 0)
            self.assertIn("in use", result.stderr)
        backup_directory(self.source, self.backup)
        with data_lock(self.root / "destination"):
            with self.assertRaisesRegex(ValueError, "in use"):
                restore_directory(self.backup, self.root / "destination")
        restore_directory(self.backup, self.root / "destination")

    def test_cli_roundtrip_uses_explicit_destination(self):
        import os
        env = {**os.environ, "FYODOR_STORAGE_DATA_DIR": str(self.source)}
        script = str(Path(__file__).resolve().parents[1] / "run.py")
        for args in [["backup", str(self.backup)], ["restore", str(self.backup), "--destination", str(self.root / "cli restored")]]:
            result = subprocess.run([sys.executable, script, *args], env=env, capture_output=True, text=True)
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertEqual(json.loads(result.stdout)["events"], 1)

    def test_cli_status_reads_configured_directory_without_migration_or_write_lock(self):
        import os
        before = digest(self.source / "calendar.sqlite3")
        with data_lock(self.source):
            result = subprocess.run([sys.executable, str(Path(__file__).resolve().parents[1] / "run.py"), "status"],
                env={**os.environ, "FYODOR_STORAGE_DATA_DIR": str(self.source)}, capture_output=True, text=True)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(json.loads(result.stdout)["sources"][0]["events"], 1)
        self.assertEqual(digest(self.source / "calendar.sqlite3"), before)


if __name__ == "__main__":
    unittest.main()
