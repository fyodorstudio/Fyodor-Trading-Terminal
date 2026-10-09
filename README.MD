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
| `frontend/src/scoring-system/` | Shared family calculations, model policies, context and relationships |
| `frontend/src/fundamental-tools/` | Fundamental Settings dock, calibration controls and tool navigation |
| `frontend/src/usd-context/`, `pair-context/`, `raycaster/` | Quarantined context storage, workers and presentation |
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

The [main objective](fyodor%20trading%20terminal%20main%20objective.md) defines the
product contract and outstanding work. The [repository map](docs/REPOSITORY-MAP.md)
defines terminology and code ownership; the [shared scoring system](frontend/src/scoring-system/README.md)
describes current models and settings. Standalone USD scoring is the active scope;
Roofs, Raycaster and Candy retain their existing experimental calculations.

- **Inspector** shows stored releases, readings and standalone scoring. Each
  family has one current scoring view, with result drivers visible and method,
  calibration and supporting context available on demand.
- **Raycaster** reads economic context through the selected candle's end.
  **Context-detailed → At publication** shows context for the selected Inspector
  release. Input settings are shared across these views; marker filters are separate.
- **Roofs** describes USD release relationships. In Concise mode, **+N Combo**
  opens every enabled relationship at that candle in the bottom dock.
  **View details** opens an individual combination; **All N combinations** returns
  to the overview. Focused and All roofs retain labels and overflow menus.
- **Scatter Plot** separates original Actual−Previous magnitudes from derived
  scoring signals. Frozen manual boundaries classify original readings;
  **Scorer comparison → Apply to scorer** saves component overrides.
- **Fed and ECB** numerical actions remain separate from macro votes. A rate
  hold alone does not establish currency strength or weakness. Policy episodes
  retain each publication's own time; speeches remain nonnumeric.

Missing readings remain unavailable. Stored corrections are not historical
provider vintages. Forecasts and prices do not enter economic scores. Each view
preserves release times in the selected display clock; scheduled chart symbols
add no synthetic price data.

Feature contracts and workflows:
[scoring](frontend/src/inspector/scoring/README.md),
[Raycaster](frontend/src/raycaster/README.md),
[USD context](frontend/src/usd-context/README.md),
[Roofs](frontend/src/usd-context/sequences/README.md),
[relative context](frontend/src/pair-context/README.md),
[magnitude](frontend/src/inspector/magnitude/README.md),
[Scatter Plot](frontend/src/scatter-plot/README.md),
[policy episodes](frontend/src/inspector/episodes/README.md),
[Alert](frontend/src/alert/README.md),
[Fundamental Settings](frontend/src/fundamental-tools/README.md),
[outside events](frontend/src/external-events/README.md).

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
