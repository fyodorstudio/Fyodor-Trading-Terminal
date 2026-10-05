# Setup and configuration

This is the canonical setup guide for a fresh clone. A clone includes code and
MQL5 programs; calendar inventory and browser settings are separate. To recreate
an existing workspace, also follow [BACKUP-RESTORE.md](BACKUP-RESTORE.md).

## Install dependencies

The pinned baseline is Windows x64, Python **3.12.10**, Node **22.12.0** and pnpm
**9.12.3**. Install MT5 and sign in to the intended broker. Other Python versions
allowed by bridge packaging are not the tested locked baseline.

From the repository root:

```powershell
pnpm run setup
```

This creates `bridge/.venv`, installs `bridge/requirements.lock.txt` without
resolving newer dependencies, installs this checkout's bridge with pinned build
tools, checks Python dependencies and installs the frontend's frozen lockfile.
It stops on errors. An existing virtual environment with another Python version
must be renamed before rerunning. No root Node install is needed.

If execution policy blocks direct scripts, the root command invokes PowerShell
with a process-local bypass. It does not change your permanent execution policy.

## Choose the MT5 installation and broker

For multiple running MT5 installations, set this before launching:

```powershell
$env:FYODOR_MT5_TERMINAL_PATH = 'C:\path\to\terminal64.exe'
```

Inventory is separated by MT5 `ACCOUNT_SERVER`. The only currently verified
historical candle-clock profile is **Elev8-Demo2**, EET/EEST under EU DST rules,
covering 2015–2031 (with a 2014 boundary margin). An unfamiliar broker is not
silently assigned this clock. Readings can remain inspectable while historical
chart alignment and consumers requiring chart timing are unavailable.

Adding a broker requires verifying native candle timestamps and historical DST,
then adding an explicit profile and regression tests in `storage/calendar_clock.py`.
PC timezone does not establish broker history. Review the current profile before
2032 and whenever the broker changes its clock policy. See
[MAINTENANCE.md](MAINTENANCE.md).

## Seed calendar history

1. Copy `bridge/mql5/Active/FyodorResearchExporterV4.mq5` or the supplied `.ex5`
   into MT5's `MQL5/Scripts`. Compile source in MetaEditor if needed.
2. Run it on a chart and load `FyodorCalendarSeedEURUSD.set` in Inputs.
3. Keep `ExportCalendar=true`, `ExportRequestedBars=false`,
   `CalendarCurrencies=USD,EUR`, `RequireExact28PairSet=false`,
   `CalendarFromDate=2015.01.01 00:00:00`, `CalendarToDate=0`, and
   `SaveToCommonFolder=true`.
4. Wait for successful completion. The completion dialog identifies the export
   folder under MT5's shared `Terminal/Common/Files`.
5. With storage stopped, validate and import the entire folder:

```powershell
pnpm storage:import 'C:\path\to\FyodorCalendarSeed_v4_..._server' --dry-run
pnpm storage:import 'C:\path\to\FyodorCalendarSeed_v4_..._server'
```

Keep `manifest.csv`, `calendar_events.csv`, `calendar_releases.csv` and
`calendar_currencies.csv` unchanged. Import validates completed v4 exports,
counts/identities and query failures, copies inventory with SHA-256 verification,
and commits EUR/USD rows transactionally. Reimporting the same export is safe.
Use restore instead if transferring an existing database.

## Enable ongoing collection

1. Copy `FyodorCalendarPublisherV2.mq5` and `FyodorCalendarStorageV2.mqh` from
   `bridge/mql5/Active` into the same `MQL5/Experts` folder, then compile in
   MetaEditor; alternatively use its supplied `.ex5`.
2. In MT5 Tools → Options → Expert Advisors → Allow WebRequest for listed URL,
   permit `http://127.0.0.1:8001` and `http://127.0.0.1:8002`.
3. Attach **one** publisher instance to a chart.
4. Initially keep `SnapshotDaysBack=30`, `SnapshotDaysAhead=60`,
   `StorageUrl=http://127.0.0.1:8002/api/v1`, `EnableAutomaticBackfill=true`.

Publisher V2.0.2 prioritizes recent/future inventory and fills missing available
history from 2015. Its status is visible in storage health and MT5 Experts.
Only MT5-available records can be recovered; missing Actual values stay missing.
The programs do not send orders. Bridge/MQL protocols remain unchanged.

## Launch and configure

```powershell
pnpm run dev:all
```

Open **http://localhost:5173**. The launcher clears stale processes on ports
5173/8001/8002, then runs UI, bridge and storage. This remains a development
launcher, not a packaged desktop installer. Keep the same browser origin for
saved settings; `localhost` and `127.0.0.1` have separate browser storage.

- Inspector: apply family filters; Alert uses those same applied filters and broker.
- Scatter Plot: choose NFP/CPI and a series. Magnitude starts **Undefined**.
  Select **Manual boundaries**, enter three increasing positive native-unit
  cutoffs and press **Freeze**. Valid edits preview the bands/size immediately in
  Scatter Plot; **Boundary zoom** is the default when boundaries exist. Unfreeze
  opens editing; Inspector retains saved values until Freeze or Set Undefined.
  Invalid edits retain the last valid preview. New readings grow N without moving limits.
- Settings: choose display timezone and use Workspace backup to export/import
  saved preferences. Small/Medium/Large colors are global across series/families.
- Verify the source clock locally; machine-specific clock verification is not
  transferred with workspace settings.

Calendar storage persists independently of whether a dock/browser is open.
Collection requires MT5/publisher and services running. Inspector checks storage
every ten seconds; Alert countdowns tick locally. Magnitude uses all usable
released readings since January 2015 through now, including selected/newer
readings. Scheduled rows without usable Actual/Previous remain outside N.

## Validate and troubleshoot

```powershell
pnpm storage:status
pnpm test
pnpm lint
pnpm build
```

Health: `http://127.0.0.1:8002/api/v1/health`; schemas: port 8002 `/docs`.
Check publisher freshness, source identity and incomplete coverage. An empty
histogram with Undefined magnitude is intentional. Imported Custom tuples remain
supported; retired P95 selections become Undefined and need manual configuration.

After moving a checkout, rerun `pnpm run setup` so the editable bridge points to
this path. If the frontend install also needs repair:

```powershell
pnpm --dir frontend install --frozen-lockfile --force
```

`FYODOR_STORAGE_DATA_DIR` selects a different persistent data directory.
`FYODOR_STORAGE_PORT` selects a different port; also update Publisher URL,
WebRequest permissions and `frontend/vite.config.ts` proxy. Never run two storage
services against one directory. Import/backup/restore require its service stopped.

Manual checks belong to the user: live candles, broker timing/DST alignment,
publisher collection, dock layout, colors, zoom and pointer behavior. Terminal
tests do not establish visual or live-broker acceptance.
