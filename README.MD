# Fyodor Trading Terminal

A live MT5 chart workspace focused on the **EURUSD Inspector**, with Market Watch, chart drawings, a manual trade Notebook and Activity telemetry.

The Terminal displays broker data and personal annotations. The Python bridge and MQL5 exporter/publishers are frozen; preserve their existing protocols when changing the UI or storage service.

## Repository map

| Path | Responsibility |
| --- | --- |
| `package.json` | Root command shortcuts; no Node dependencies |
| `frontend/package.json`, `frontend/pnpm-lock.yaml` | All Node dependencies and the single lockfile |
| `frontend/scripts/clean-ports.mjs` | Clear stale processes before launching services |
| `frontend/src/terminal-shell/` | Compose the live chart, feature hooks, panels and navigation |
| `frontend/src/inspector/index.ts` | Inspector's integration entry: hook, panel, markers and event contract |
| `frontend/src/inspector/` | Catalog/symbol definitions, dates, preferences, selection, storage requests, grading and magnitude history |
| `frontend/src/market-data/` | Broker feed, candles, chart history, drawings and Market Watch |
| `frontend/src/trader-notebook/` | Manual trade plans, registered arrows and chart levels |
| `frontend/src/system-connectivity/` | Bridge connection and publisher health telemetry |
| `frontend/src/system-observability/` | Activity log |
| `frontend/src/workspace-docking/` | Dock composition and independently saved sizing for all three docks |
| `frontend/src/appearance/` | Theme and time-display preferences |
| `storage/` | Durable local calendar service on port 8002 |
| `bridge/` | Frozen broker bridge on port 8001 and frozen MQL5 programs |
| `frontend/tests/` | Mounted Inspector/navigation/Notebook checks and dependency boundary checks |
| `storage/data/` | Gitignored local database and imported calendar inventory |

Keep the shell focused on composition. Feature modules own their state, transformations, requests and caches.

Inspector is a self-contained feature inside this Terminal. To reuse it in another experiment, compose `useInspector`, `InspectorPanel` and `InspectorChartMarkers` from its entry point. Supply broker identity/offset, chart bars, timeframe, time preference and clock offset. Its only local dependencies outside the feature are shared chart/time/bridge-health contracts and time formatting; it needs React, lightweight-charts, browser storage and the `/storage-api` service/proxy. Supplying `brokerId` (including `null` while connecting) selects persistent storage; optional injected events support isolated fixtures/experiments.

## Inspector behavior

Inspector currently supports EURUSD, with 21 event families in four categories: monetary policy, inflation, labor/wages, and growth/activity. Date ranges, tables and chart markers use the native broker candle clock. Historical markers need a verified containing candle; uncertain or unloaded times remain inspectable in the release list. Preferences and each bottom dock's height remain saved in the browser. Inspector, Notebook and Activity support dragging their top separator or using Up/Down and Home/End while it is focused. Viewport limits retain chart space.

Readings retain Actual, Forecast, Previous and revised Previous; A−P uses supplied Previous. Jobs/NFP grades and its experimental majority direction follow the existing [NFP terminology](frontend/src/inspector/Event%20Grading%20Terminology/USD/Labor/NFP.md). The [magnitude implementation note](frontend/src/inspector/magnitude/README.md) explains earlier-reading distributions from 2015. Missing readings remain missing; grades and magnitude history are presentation rules.

The launcher uses `frontend/scripts/clean-ports.mjs` to terminate stale processes holding ports 5173, 8001 and 8002 before starting the services.

Production builds split React and lightweight-charts into separate vendor chunks; application imports remain static. This reduces the largest individual chunk and allows vendor assets to be cached separately, without introducing lazy panel-loading states.

## Verification

```powershell
pnpm test
pnpm lint
pnpm build
```

Frontend tests mount production Inspector hooks/components, date/filter interactions, storage paging and cancellation, all-dock resizing and saved heights, navigation, and Notebook chart levels. Storage tests verify data contracts, import/recovery and timing. Run them separately with `pnpm run test:frontend` or `pnpm run test:storage`. Production output goes to `frontend/dist`.

Visual UI audits are manual. With MT5 connected, verify live candles/history and drawings; Inspector date/filter selection and marker clicks; broker timing around DST; Notebook arrow selection and Activity publisher telemetry. Check scrolling, dock resizing and light/dark contrast in the native browser. Automated DOM checks do not establish visual or live-broker acceptance.

## Quickstart

### 1. Install a cloned repository

Use Windows with MT5, Python 3.11–3.13, Node.js 22.12+ and pnpm 9.12.3. From the repository root:

```powershell
python -m venv bridge/.venv
bridge/.venv/Scripts/python.exe -m pip install -e ./bridge
pnpm run install:frontend
```

The calendar storage service uses Python's SQLite library and the already installed FastAPI/Uvicorn runtime. It is a separate application under `storage/`; it does not modify or import the frozen bridge implementation.

The root package forwards commands and needs no separate Node install. All Node dependencies, including `concurrently`, use `frontend/pnpm-lock.yaml` and install into `frontend/node_modules`. `pnpm run install:frontend` runs `pnpm --dir frontend install --frozen-lockfile`. The frontend launcher starts Python services through the root commands, preserving their working directory.

### 2. One-time calendar export and import

A clone contains service code and MQL5 programs, but not your local calendar inventory/database. The intended setup is to run the exporter once, import its inventory, then attach Publisher V2 for ongoing updates.

1. Copy `bridge/mql5/Active/FyodorResearchExporterV4.mq5` (or its supplied `.ex5`) into your MT5 data folder's `MQL5/Scripts`. Compile the source with MetaEditor if needed.
2. Run the script on a chart. Load the supplied `FyodorCalendarSeedEURUSD.set` preset from its Inputs dialog, or set the values below. The preset exports calendar records only; live candle history remains supplied by the bridge.
3. Wait for successful completion. This is a one-time script and exits when finished. Its completion dialog identifies the generated folder. With `SaveToCommonFolder=true`, it is under MT5's shared `Terminal/Common/Files` directory.
4. Import that whole export folder, keeping its file names unchanged:

```powershell
pnpm storage:import "C:\path\to\FyodorCalendarSeed_v4_..._server" --dry-run
pnpm storage:import "C:\path\to\FyodorCalendarSeed_v4_..._server"
```

| Exporter input | Calendar-only first-time value |
| --- | --- |
| `ExportCalendar` | `true` |
| `ExportRequestedBars` | `false` |
| `CalendarCurrencies` | `USD,EUR` |
| `RequireExact28PairSet` | `false` |
| `CalendarFromDate` | `2015.01.01 00:00:00` |
| `CalendarToDate` | `0` — the export-time server cutoff |
| `SaveToCommonFolder` | `true` |

Importer validation requires a completed v4 calendar export, consistent counts/identities, no reported calendar query failures and the four files `manifest.csv`, `calendar_events.csv`, `calendar_releases.csv`, `calendar_currencies.csv`. It prints file counts/bytes before copying, verifies copied SHA-256 hashes, and commits the EUR/USD rows transactionally. Reimporting the same export is safe. The supplied exporter is v4.0.0 with schema 4.0.0.

Coverage begins January 1, 2015 and continues through available broker observations. Local inventory is gitignored and does not travel with a clone. Each broker's inventory is stored separately.

Publisher V2 also fills missing available EUR/USD calendar history from 2015, prioritizing recent and future dates. Progress appears in storage health/status and MT5's Experts log. Inspector displays completed stored ranges while remaining history downloads.

### 3. Configure Publisher V2 in MT5

1. Copy `FyodorCalendarPublisherV2.mq5` **and** `FyodorCalendarStorageV2.mqh` from `bridge/mql5/Active/` into the same folder under MT5's `MQL5/Experts`, then compile V2 with MetaEditor. Alternatively use the supplied `FyodorCalendarPublisherV2.ex5`.
2. In MT5 **Tools → Options → Expert Advisors → Allow WebRequest for listed URL**, add both `http://127.0.0.1:8001` and `http://127.0.0.1:8002`.
3. Attach **only one** calendar publisher instance. Concurrent publishers compete for the bridge's single publisher generation.
4. Leave the defaults initially: `SnapshotDaysBack=30`, `SnapshotDaysAhead=60`, `StorageUrl=http://127.0.0.1:8002/api/v1`, `EnableAutomaticBackfill=true`. Set `FYODOR_MT5_TERMINAL_PATH` before launching if several MT5 installations are present.

Publisher V2 is v2.0.2 (`#property version "2.02"`); its live bridge envelope uses protocol v1. It contains no order/position operations. To replace an attached publisher, remove it, replace its compiled `.ex5` (or compile the `.mq5` with its companion `.mqh`), and reattach it. Completed storage batches remain stored.

### 4. Launch Terminal

```powershell
pnpm run dev:all
```

This starts the three services:

| Service | Address |
| --- | --- |
| MT5 Bridge | `http://127.0.0.1:8001` |
| Calendar Storage | `http://127.0.0.1:8002` |
| Terminal UI | `http://localhost:5173` |

Open `http://localhost:5173` in your browser. Use `pnpm run dev:ui`, `pnpm run dev:bridge` or `pnpm run dev:storage` to launch a service independently.

After setup, normal use requires the local processes and Publisher V2. Storage persists while the browser is closed. Startup snapshots remain recent; the storage service requests missing date intervals automatically, including absences longer than DaysBack. Only MT5-available records can be recovered; missing Actual values stay missing.

```powershell
pnpm storage:status
pnpm run test:storage
```

Storage health is also available at `http://127.0.0.1:8002/api/v1/health`, with publisher freshness, counts, completed batches, missing intervals and pending/retrying jobs. `pnpm run dev:storage` starts storage by itself.

### Calendar storage and recovery contract

Tracked service code lives under `storage/`. Runtime data lives under gitignored `storage/data/`: the SQLite database, copied inventory and generated import hashes. Back up that directory with the storage process stopped; a Git clone is not a database backup. `FYODOR_STORAGE_DATA_DIR` selects another data directory. Changing `FYODOR_STORAGE_PORT` also requires matching Publisher V2 URL/WebRequest settings and the frontend proxy in `frontend/vite.config.ts`.

The service reads the bridge's existing health/calendar endpoints when a registered V2 publisher's feed changes. It preserves archive and changed observations, deduplicates by broker/value identity, and exposes the latest accepted rows. A completed query that no longer returns a previously stored record marks it `not-returned-by-latest-query`, preserving its history rather than treating it as a confirmed current release or inferring cancellation. Newer live observations are protected from an older query. A later fetch of an older bridge snapshot cannot overwrite a newer backfill/live observation. Archive imports cannot replace accepted network updates. Broker identity comes from the export's `account_server` and V2's `ACCOUNT_SERVER`.

Backfill jobs are currency-scoped, half-open date intervals, initially at most seven days. V2 performs one history query or one chunk transfer per timer tick after live work, caching event/country metadata. Storage acknowledges coverage only after every chunk validates and commits; empty successful queries count as queried dates. Failed queries remain pending with backoff. Other uncovered dates proceed while a job cools down, with its interval reserved to prevent duplicate jobs. Timeout, memory, internal and out-of-range failures reduce requests down to a minimum of one day; unresolved dates remain explicitly incomplete. Publisher diagnostics distinguish out-of-range value/event identities and timestamps from metadata errors; transfers use only the returned array count. Interrupted transfers resume by retrying the uncompleted batch; acknowledged date batches survive process restarts. Recent/future coverage expires daily for reconciliation, so a schedule snapshot does not permanently certify released readings. Older historical coverage remains stored.

Backfill uses storage endpoints directly, never the bridge's live snapshot endpoint. V2.0.2 requests complete broker days around each job and trims the successful result to its exact half-open interval: MT5 may otherwise return an all-day holiday earlier than an intraday query boundary. Only in-range rows count toward the atomic transfer; rows outside even the padded query still cause a diagnostic failure. History queries and WebRequest are synchronous, so a slow query can still delay that EA's own polling; small batches reduce the amount of work per turn. A stopped collector cannot capture every intermediate update between observations, but reconciliation refreshes the latest MT5 readings when collection resumes.

All raw calendar timestamps retain their original **broker-server clock**. The default API query (`time_basis=raw`) retains raw-date ordering and null `release_at` for compatibility. Inspector requests `time_basis=chart`: dates and pagination then use the native candle clock, with derived UTC `release_at` in milliseconds and `chart_time_seconds` in seconds. The separate `event_timing` table records the capture offset, timing basis and chart profile; raw observations are immutable. Migration restores archive offsets from their export manifests and legacy backfill offsets from lease clocks. Legacy live observations use the explicitly configured broker profile at their observation date. New observations record the actual publisher offset, including the offset leased for each backfill batch. A publisher restart or change in its recent window does not erase established history or change a selected release's UTC identity.

`storage/calendar_clock.py` explicitly configures **Elev8-Demo2** as EET/EEST (UTC+2 winter / UTC+3 summer, EU transition rules, supported years 2015–2031). This profile is inferred from the actual 2025/2026 native EURUSD trading sessions and checked against the broker's EET/EEST description; it is not inferred from the user's PC timezone. EU transitions follow [Directive 2000/84/EC](https://eur-lex.europa.eu/eli/dir/2000/84/oj/eng/pdf). Unknown broker identities have no guessed historical chart offset: their readings remain inspectable, with an explicit missing-timing message. Before adding another broker to `PROFILES`, verify its native candle clock and historical DST rules. Audit Elev8 candle alignment after the next DST change; a broker schedule change requires updating this explicit profile. No Python bridge dependency or MQL5 rebuild is required for this display conversion.

Storage supplies a persistent data `revision`; Inspector checks page revisions before displaying a completed range, cancels obsolete requests and polls for updates every ten seconds. Chart-date coverage uses each import or completed batch's retrieval clock, including empty queried dates; intervals without recoverable clock evidence remain conservative around their boundaries. Rows absent from a later successful query remain in storage as evidence but are excluded from the current Inspector release list.

For future consumers, `GET /api/v1/calendar` on port 8002 accepts `source_id`, `from_server_seconds`, `to_server_seconds`, optional `currency`, and a bounded `limit` (maximum 5000). Responses include origin, raw scaled values when available, missing intervals and an `after_time`/`after_id` continuation cursor. API schemas are available at port 8002 `/docs`.

Manual MT5 acceptance: confirm V2's live bridge snapshot/heartbeat still works; observe a completed backfill in Experts and storage health; interrupt/restart during a batch and check recovery; stop storage and confirm the live bridge continues; check a known release's units, Previous/revised Previous and raw server time. Automated storage tests cover restart/lease recovery, interrupted chunks, lost commit acknowledgements, validation, long absences, exact raw values, stale-source ordering, imports and real HTTP endpoints.

If the repository has been moved or `dev:all` reports that `vite` or a Node package cannot be found, repair the frontend install from the repository root before launching again:

```powershell
pnpm --dir frontend install --frozen-lockfile --force
pnpm run dev:all
```
