# Fyodor Trading Terminal Lite

MT5 Market Watch, chart/drawings, raw calendar Inspector, upcoming Alert, Activity
and Settings. Extracted from the original terminal at `639d382`; that repository
remains intact. Market interpretation happens in a separate analyst session.

## Run

Windows x64 Python 3.12 and pnpm 9.12.3. Dependencies and the existing calendar
inventory are already prepared in this checkout. On another machine:

```powershell
pnpm setup
```

Start or restart the stack:

```powershell
pnpm dev:all
```

This clears existing listeners on ports 5173, 8001 and 8002 before starting,
including the original terminal if it is running on those ports.

UI: http://localhost:5173, bridge: 8001, calendar storage: 8002. Reuse the existing
MT5 publisher/exporter configuration; bridge source and binaries are unchanged.
`pnpm dev:ui` runs only the UI against services already running on those ports.
Optional `FYODOR_BRIDGE_API_URL` / `FYODOR_STORAGE_API_URL` override Vite's proxies.

## Ownership and checks

| Path under frontend/src | Responsibility |
| --- | --- |
| terminal-shell | Composition, chart controls, Inspector/Alert/Activity navigation and Settings |
| market-data | Market Watch, MT5 candles/paging, shared date viewport, chart/drawings and future axis |
| economic-calendar | Eight-currency catalog, source contracts, clocks and storage polling |
| inspector | Filters, date ranges, release/day grouping, icons and raw tables |
| alert | Independent upcoming currency/family filters and countdowns |
| appearance, system-connectivity, system-observability, workspace-docking | Theme/time, bridge status, Activity and dock geometry |

```powershell
pnpm test
pnpm lint
pnpm build
pnpm check:repo
```

Frontend suites run sequentially and mount production components with fixture
transport/canvas. Native chart API tests verify coordinates, future times and
drawings. Visual/live MT5 acceptance remains with the user.

## Preserved workflow

Choose per-pair Inspector filters/icons/colors → click chart icons → raw tables.
By day keeps one icon per currency/day and sections matching filter categories.
All 1,051 exported types remain available; new numeric IDs enter Other / new events
when enabled. A−P describes a numerical change, not a currency verdict. Forecasts,
revised priors, periods and missing values remain source data.

Startup range: one calendar year before today through 90 days ahead. The native
axis includes the whole 90th day after the latest candle's date, with no future
price candles. Pair/timeframe switching preserves the horizontal date window;
each symbol fits its own prices. Blank chart clicks dismiss nearby-release lists
and deselect/collapse Inspector, unless placing a drawing. Saved drawings, filter
Save/Cancel, dock sizing and clock/theme/chart preferences keep their original keys.

Use the same UI origin (normally localhost:5173) to reuse browser preferences from
the original app. A different port has separate browser storage. Old scoring view
choices fall back to raw tables; filters/icons/colors stay intact. No Workspace
backup UI, scoring engines, Notebook, Scatter Plot or experimental context tools
are included.

See [data, clocks and recovery](docs/DATA-CONTRACT.md) and the retained
[icon catalogue](docs/tools/icon-catalogue.html). The bridge's inherited README is
historical; Lite's operating instructions are here.
