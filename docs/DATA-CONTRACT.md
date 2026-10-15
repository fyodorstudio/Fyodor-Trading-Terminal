# Data, clocks and recovery

The bridge remains unchanged from the original terminal. Storage serves the same
publisher/ingestion, paged calendar and recovery protocols. The frontend never
calculates currency scores or modifies source observations.

## Local inventory

Outside-feed events are stored separately as immutable versions under
`Market Analyst Workflow/external-sources/`; they never enter calendar observations,
MT5 Highlight IDs or Inspector filters. Highlight displays both pinned sources,
retaining their separate identities. The External Source view in Alert and CLI
share this broker-independent collection. [External Sources](EXTERNAL-SOURCES.md)
owns its clocks, validation, optimistic writes, revision paging and recovery.
The separate alarm worker reads both collections and stores reminder state under
`storage/data/alarms/`; see [Alert](EVENTS-ALARMS.md). Alarms never write
calendar observations or research. Exact instants alone are eligible for delivery.

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
Each named export creates an exclusive folder under `Market Analyst Workflow/report/`
with `brief.md` and complete `evidence.tsv`, outside the inventory. Brief indexes summarize
counts; every selected/context reading remains in the companion. CSV quoting
preserves tabs, pipes and newlines in names. The new folder and files are cleaned up if generation
fails; existing files are never overwritten. Old full-table reports remain readable
by the analyst helper. Report generation never changes calendar observations.
Broker forecasts and web survey estimates retain separate provider/as-of attribution;
differences alone do not establish a source error.

Highlight pin metadata lives in Git-ignored `Market Analyst Workflow/highlights.json`.
Storage exposes GET/POST/DELETE `/api/v1/highlights`; writes replace the complete
file atomically. Pins bind broker and source value IDs, retain elapsed occurrences,
and query current stored rows without calendar display filters or horizons. Related
series at the same publication time (within one hour for explicit policy packages)
join the pin; live reads bind their IDs so later rescheduling stays visible. Separate
publication windows never span intervening months; existing series retain their
reference periods when discovering related values. Agent
calendar reads are read-only and can work offline. Missing/withdrawn observations retain the
pin and their availability labels. Browser caches retain the last snapshot during
an outage. Polling reuses unchanged revisions and row identities; countdown ticks
never query storage, regroup releases, or rebuild expanded series tables.

Version-1 pin files remain readable; lifecycle writes save version 2 with optional
archive metadata and preserved readings. POST `/{id}/archive` and `/{id}/restore`
under the Highlight API preserve identities; legacy DELETE archives too. GET
visibility selects active/archived/all. Writes share an interprocess metadata lock.
Agent journal appends create immutable JSON files under
`Market Analyst Workflow/journal/<highlight-id>/`, separate from the calendar and
pin file. Snapshots preserve raw readings/provenance at save time, not a reconstructed
release-day vintage. Journal contents participate in the Highlight revision.
The UI has no journal writer; use the CLI and [journal contract](HIGHLIGHT-JOURNAL.md).
Prompt-only templates live in prompts/ and never create research entries. Their
contents participate in Highlight revisions. Broker-scoped limitations live in
limitations/ as immutable versions, with a revision-aware GET-only endpoint and
a separate read-only UI tab. These metadata writes never change calendar readings.

`pnpm analyst` reads the existing calendar schema in a read-only transaction, with
complete pagination before returning compact focused results. OHLC uses the unchanged
bridge, bounded positional seeking and overlapped paging, validates source generation,
and converts historical candle server time via the explicit broker profile. Unknown
clocks require a verified historical offset; ambiguous clocks are rejected. Saved OHLC
retains capture provenance. Missing M1 minutes invalidate the corresponding event
measurement; session/history gaps and incomplete edges remain visible. See
[analyst instructions and commands](../AGENTS.md#dataset-commands). New OHLC gets
its own folder unless explicitly attached to an existing report with `--report`.

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
date filters before grouping. Saved family selections are shared by currency;
grouping, symbol visibility, icons and colors remain per canonical pair. A single
browser-storage write saves both currencies and the pair's appearance settings.
Preview/Cancel never changes the saved shared selections. Legacy pair settings
remain readable until Save establishes a currency's shared selection.
New numeric IDs with valid metadata use each
currency's selectable Other / new events control; known IDs with wrong metadata
are rejected. Chart grouping retains every visible series and source value ID.
Alert's upcoming tabs keep independent filters and exclude completed events;
Highlight retains them until explicit archive. Paging rejects
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
Highlight metadata and journal files are separate from calendar backups; keep
highlights.json, journal/, prompts/, limitations/ and report folders under
`Market Analyst Workflow/` together.
