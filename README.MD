# Fyodor Trading Terminal

A local Windows/MT5 trading workspace with live charts, Market Watch, Inspector,
Scatter Plot, Alert, a manual trade Notebook and Activity telemetry.

## Getting started

Follow [docs/SETUP.md](docs/SETUP.md) for the complete fresh-clone procedure:
pinned dependencies, broker-clock support, calendar seed, Publisher V2, launch
and manual configuration. `pnpm run setup` installs dependencies; `pnpm run dev:all`
starts UI (5173), bridge (8001) and storage (8002).

A clone does not contain personal calendar inventory or browser preferences.
Use [docs/BACKUP-RESTORE.md](docs/BACKUP-RESTORE.md) to preserve both. Settings
includes versioned workspace export/import; `pnpm storage:backup` and
`pnpm storage:restore` handle calendar data separately.

See [docs/MAINTENANCE.md](docs/MAINTENANCE.md) for dependency/CI procedures,
compatibility and expansion. Broker profiles are explicit: Elev8-Demo2 is
currently verified through 2031; other brokers require verified timing rules.

## Repository map

| Path | Responsibility |
| --- | --- |
| `package.json` | Root shortcuts; no separate Node dependencies |
| `scripts/setup.ps1`, `bridge/requirements.lock.txt` | Pinned Python setup and local bridge installation |
| `frontend/package.json`, `frontend/pnpm-lock.yaml` | Frontend commands and the single Node lockfile |
| `frontend/src/terminal-shell/` | Compose feature modules and navigation |
| `frontend/src/inspector/` | Catalog, filters, episodes, grading, stored data and shared magnitude logic |
| `frontend/src/scatter-plot/` | Shared plot/settings with scoped pair/family adapters |
| `frontend/src/alert/` | Upcoming filtered episodes and local countdowns |
| `frontend/src/workspace-portability/` | Versioned browser workspace validation/export/import |
| `frontend/src/market-data/` | Broker feed, candles, drawings and chart settings |
| `frontend/src/trader-notebook/` | Personal plans, notes and registered trade arrows |
| `frontend/src/system-connectivity/`, `system-observability/` | Connection health and Activity |
| `frontend/src/workspace-docking/`, `appearance/` | Dock layout and display preferences |
| `storage/` | SQLite inventory, reconciliation, timing and validated backup/restore |
| `bridge/` | Frozen read-only Python bridge and MQL5 programs/protocols |
| `docs/` | Canonical setup, recovery, maintenance and storage contracts |
| `.github/workflows/checks.yml` | Clean Windows installation, tests, lint and build |

Keep the shell focused on composition. Feature modules own requests,
transformations, state and caches. Inspector's integration entry is
`frontend/src/inspector/index.ts`; it consumes broker identity/clock, chart data,
time preferences and the storage API. Renderers do not own collection.

## Interpretation and data

Inspector supports EURUSD and 21 families in four categories. NFP/CPI magnitude
uses all usable released Actual/Previous deltas since January 2015 through now,
including the selected and newer readings. Scheduled unusable values stay outside
N. `Earlier / All` separates chronology from dataset size. Stored corrections are
not historical data vintages.

Magnitude is **Undefined** or **frozen manual boundaries**. Enter independent
positive Small/Medium/Large native-unit limits and Freeze; above Large is Extreme.
Unfreeze opens a live Scatter Plot preview while Inspector retains saved limits.
Boundary zoom is the default when limits exist. The connected-dot view defaults
to the inspected release plus 12 predecessors; Latest release restores that date
window, and Inspector can open the exact release in Scatter Plot. P95 is retired; legacy
manual tuples persist and legacy P95 selections become Undefined. Numeric limits
are scoped per series; magnitude colors apply globally. Classification rules are
user-chosen interpretations, documented in the family terminology files.

NFP direction uses signed magnitude points from Payrolls, Unemployment and
Earnings m/m; seven supporting readings stay separate. CPI retains its four-rate
score and separate price-index matrix. Hover series labels for NFP role explanations.

See [shared magnitude behavior](frontend/src/inspector/magnitude/README.md),
[Scatter Plot](frontend/src/scatter-plot/README.md),
[Alert](frontend/src/alert/README.md) and
[storage contract](docs/STORAGE-CONTRACT.md).

## Verification

```powershell
pnpm test
pnpm lint
pnpm build
```

Tests include mounted frontend behavior and temporary storage/recovery fixtures.
Run separately with `pnpm run test:frontend` or `pnpm run test:storage`.
Build output goes to `frontend/dist`. Visual UI audits and live MT5/DST/publisher
acceptance belong to the user; see the setup guide for manual checks.
