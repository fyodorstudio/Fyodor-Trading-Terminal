# Backup and restore

A recoverable workspace has **two backups**: calendar storage and browser
workspace JSON. Git contains neither of these personal datasets. Keep backups
outside the repository and retain the Git commit used to create them.

## Create a backup

1. In the app, open Settings → Workspace backup → **Export workspace**.
   Keep the downloaded JSON with the calendar backup. It includes saved filters,
   magnitude tuples (frozen when reopened), palette/styles, timezone/theme, dock
   sizes, drawings, notebook notes/plans/arrows and activity source preferences.
   Unsaved drafts, live prices, active selections, Activity session logs and
   machine-specific source-clock verification are not exported.
2. Stop `dev:all` with Ctrl+C, or stop the storage service if running separately.
3. From the repository root, choose a new folder outside your storage directory:

```powershell
pnpm storage:backup 'D:\Fyodor Backups\2026-10-05'
```

The backup reads the configured `FYODOR_STORAGE_DATA_DIR` (default `storage/data`).
An exclusive directory lock rejects concurrent service/import/recovery processes.
It snapshots committed SQLite state using the backup API, copies imported
inventory, checks database integrity/schema and records file sizes/SHA-256 hashes
in versioned `backup.json`. WAL/SHM files and transient locks are not copied.
Existing backup folders are never overwritten. Do not manually edit the manifest.

Back up MT5 Publisher input values and broker/terminal selection separately;
broker credentials and MT5 installations are not part of these backups.

## Restore on a new machine or drill into a separate folder

1. Clone the saved commit and follow [SETUP.md](SETUP.md) to install dependencies.
2. Keep services stopped. Restore into an explicitly named **empty** directory:

```powershell
pnpm storage:restore 'D:\Fyodor Backups\2026-10-05' --destination 'C:\Fyodor Data\restored'
$env:FYODOR_STORAGE_DATA_DIR = 'C:\Fyodor Data\restored'
pnpm storage:status
```

Restore validates format/version, safe file paths, all sizes/hashes, database
integrity and recorded source/event/observation counts. It checks copied files
again before publishing them. It refuses existing data, conflicting locks,
symlinks, invalid paths, unsupported schemas and modified backup files.
Restore does not delete or replace the original database.

3. Launch `pnpm run dev:all`, using the same environment variable. Configure MT5
   and the intended publisher/broker. Restoring history doesn't change broker
   identity: choose the matching broker to see that inventory.
4. Settings → Workspace backup → **Import workspace**, choose the JSON and
   review its entry count/date. **Restore and reload** replaces saved workspace
   keys and reloads the page. Missing keys reset to defaults. Unrelated browser
   storage and local clock verification are excluded. Save drafts first.
5. Verify your filters, per-series cutoffs, colors, notes and drawings, then
   check calendar source/coverage and a known release/time. Reverify the clock.

Workspace import accepts version 1 JSON up to 10 MB, uses an explicit supported
key catalog and validates values. Unsupported versions/settings fail before
mutation. Failed writes attempt rollback; failures are reported instead of
claiming success. The JSON contains personal notes; store it like your other
trading records. Preference persistence is specific to browser/profile/origin.

## Restore drill and acceptance

Periodically restore into a separate empty directory, check `storage:status`,
then open a separate browser profile and import the workspace JSON. Verify a
known release and saved settings. Keep the original directory unchanged until
you have accepted the restored copy. To use the original again, stop services,
restore the original `FYODOR_STORAGE_DATA_DIR` value and relaunch.

`pnpm run test:storage` includes an actual generated-database backup/restore
round trip, byte-identical inventory/provenance checks, CLI round trip, cross-process
lock rejection, corruption/path rejection and no-overwrite checks.
`pnpm run test:frontend` includes workspace round trips, invalid version/key/value
rejection, failed-write rollback and mounted file preview/reload. These use
temporary fixtures; they never restore over your personal inventory.
