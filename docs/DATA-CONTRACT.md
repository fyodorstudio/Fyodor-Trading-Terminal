# Data, clocks and recovery

The bridge remains unchanged from the original terminal. Storage serves the same
publisher/ingestion, paged calendar and recovery protocols. The frontend never
calculates currency scores or modifies source observations.

## Local inventory

`storage/data/` is ignored by Git. It contains `calendar.sqlite3` and the original
V4 `inventory/` exports. Extraction used SQLite's online backup API to include
committed WAL data consistently, then copied/hash-checked all six inventory files.
The copied snapshot contains 125,751 events and 127,076 observations. Dataset
counts can increase as the publisher/collector updates the Lite inventory.

Do not copy only the database file while its service is running: committed data
may be in its WAL. Do not delete SQLite journals, inventory, observations or
publisher/job metadata as cleanup. The copied database retains capture/revision
provenance; its optional historical API fields are data, not a scoring engine.

`POST /api/v1/reports` reads one locked calendar snapshot, including all pages and
all series for the requested currencies; display filters and catalog admission do
not constrain exports. Verified instants use the selected display-day boundaries;
date-only/unverified rows retain their source date. Optional preceding context is
separate. Coverage gaps, latest-query absences and capture/revision information
remain explicit. Latest stored values are not a reconstructed release-day vintage.
Named Markdown files are created exclusively in the root `report/` folder, outside
the inventory; report generation never changes calendar observations.

```powershell
pnpm storage:status
pnpm storage:import -- "C:\path\to\MT5-export" --dry-run
pnpm storage:import -- "C:\path\to\MT5-export"
```

Imports are additive. Keep source/value IDs, country/currency, reference periods,
timing mode, revision, native units and raw scaled values. Numerical blanks stay
missing; Actual/Forecast/Previous/revised Previous are distinct fields.

## Runtime and clocks

Bridge listens on 8001; storage on 8002. Collector reads the bridge; Publisher V2
registers/carries out calendar backfills through storage. The current publisher
supports USD, EUR, GBP, JPY, CHF, CAD, AUD and NZD. Use the same publisher storage
URL when replacing the original service. `FYODOR_STORAGE_PORT` can change the
service port; `FYODOR_STORAGE_DATA_DIR` selects a different inventory directory.

Calendar timestamps and chart coordinates use broker trade-server clocks. UTC
release instants and selected display time are separate. Elev8-Demo2's recorded
EET/EEST profile covers 2014–2031; ambiguous/skipped wall clocks never get guessed
UTC instants. Date-only schedules keep their source date, not an invented hour.
Published tentative numerical events can use their recorded verified clock.
Historical symbols need a containing candle; future symbols project timeframe
slots until actual sessions arrive. Unused projected slots are removed on a gap.

Inspector fetches the pair's currencies, including new IDs, and applies family/
date filters before grouping. New numeric IDs with valid metadata use each
currency's selectable Other / new events control; known IDs with wrong metadata
are rejected. Chart grouping retains every visible series and source value ID.
Alert keeps independent filters and excludes elapsed events. Paging rejects
mixed revisions, repeating cursors and stale replies; outages retain the last
valid snapshot. Appearance/display-clock changes never rewrite stored dates.

## Recovery

Stop storage before making an offline backup or restoring. These commands keep
calendar recovery available without a Workspace backup UI:

```powershell
pnpm storage:backup -- "C:\backups\fyodor-lite-calendar"
pnpm storage:restore -- "C:\backups\fyodor-lite-calendar" --destination "C:\restored\fyodor-calendar"
```

Destinations must be new/empty and outside the live inventory. Recovery validates
schema, integrity and file hashes. Browser filters, drawings and preferences live
on the UI origin; keep the same origin to reuse them. Calendar backup does not
contain browser settings. The original repository/data remains the extraction
reference and was not removed.
