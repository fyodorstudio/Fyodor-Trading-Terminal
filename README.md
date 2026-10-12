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
| research | Chart date selection and named Markdown handoff shared with Alert |
| Market Analyst Workflow | Data helper and local report folders |
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

Choose Inspector families by currency → click chart icons → raw tables.
Save shares those family selections across every pair containing the currency;
grouping, symbol visibility, icons and colors remain per pair. Existing pair
choices are read until a currency is saved once with the shared selection.
By day keeps one icon per currency/day and sections matching filter categories.
All 1,051 exported types remain available; new numeric IDs enter Other / new events
when enabled. A−P describes a numerical change, not a currency verdict. Forecasts,
revised priors, periods and missing values remain source data.

Startup range: one calendar year before today through 90 days ahead. The native
axis includes the whole 90th day after the latest candle's date, with no future
price candles. Pair/timeframe switching preserves the horizontal date window;
each symbol fits its own prices. Blank chart clicks dismiss nearby-release lists
and deselect/collapse Inspector, unless placing a drawing. Saved drawings, dock
sizing and clock/theme/chart preferences keep their original keys. Inspector keeps
Save/Cancel and reads older pair settings; new saves use shared currency selections.

Use the same UI origin (normally localhost:5173) to reuse browser preferences from
the original app. A different port has separate browser storage. Old scoring view
choices fall back to raw tables; filters/icons/colors stay intact. No Workspace
backup UI, scoring engines, Notebook, Scatter Plot or experimental context tools
are included.

See [data, clocks and recovery](docs/DATA-CONTRACT.md) and the retained
[icon catalogue](docs/tools/icon-catalogue.html). The bridge's inherited README is
historical; Lite's operating instructions are here.

## Research handoff

Choose **Research date range** in the drawing toolbar and drag across chart dates.
The research panel sits beside the chart, leaving panning and the bottom dock
available. Notes stay open when switching chart symbols or timeframes.
Name the report, adjust the inclusive dates, optionally add a question or notes, and choose
earlier context (90 days by default). **Prepare research** writes a unique `.md`
brief and complete `.tsv` evidence in a named folder under `Market Analyst Workflow/report/`, and offers
**Copy path** for the analyst session. Share the brief; it links to its evidence.
Alert's **Research** button prepares the same handoff for an upcoming release;
choose its currency alone or a pair containing it.

**Highlight**, left of **All** in Alert, keeps release occurrences pinned from
Inspector's right header or Alert's **Pin** button. Expand a card for all series
and publication times. Pins remain after release, update with stored actuals and
revisions, and disappear only with **Remove pin**. They ignore Alert filters and
horizon, remain scoped to their broker, and survive refresh. Highlight checks for
updated values every two seconds while open; feed capture may still be delayed.
The agent can read the same list with `pnpm analyst highlights` and focused values
with `pnpm analyst highlights --summary --match CPI`, without browser access.

Exports include every stored series for the chosen currencies, independent of
Inspector/Alert filters and chart history. Files retain forecasts, revised priors,
periods, IDs, capture times, uncertainty and coverage gaps. They contain evidence,
not currency scores or speech transcripts; the analyst supplies web research.
Reports are local and ignored by Git. Existing reports are never overwritten.
Restart calendar storage after updating to use the new export path and format.

For analysis use [AGENTS.md](AGENTS.md#market-analysis); the root
[user manual](<user manual.md>) covers all eight currencies. `pnpm analyst reports`
finds report paths; `pnpm analyst report latest` reads the newest brief. Each report
folder keeps its brief, calendar evidence, and any attached OHLC together.
