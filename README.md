# Fyodor Trading Terminal Lite

MT5 Market Watch, chart/drawings, raw calendar Inspector, upcoming Alert, Activity
and Settings, with saved agent-authored research journals under Highlight.
Extracted from the original terminal at `639d382`; that repository remains intact.
Market research happens in an analyst session; the terminal displays its journal.

## Run

Windows x64 Python 3.12 and pnpm 9.12.3. Prepare dependencies on a new checkout:

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

| Owner | Responsibility |
| --- | --- |
| terminal-shell | Composition, chart controls, Inspector/Alert/Activity navigation and Settings |
| market-data | Market Watch, MT5 candles/paging, shared date viewport, chart/drawings and future axis |
| economic-calendar | Eight-currency catalog, source contracts, clocks and storage polling |
| inspector | Filters, date ranges, release/day grouping, icons and raw tables |
| alert | Upcoming filters/countdowns, Highlight journals, Copy Prompt and archive |
| external-sources | Separate outside-feed events/headlines/watch items, sourced facts, history and agent prompts |
| research | Chart date selection and named Markdown handoff shared with Alert |
| Market Analyst Workflow/tools (repo root) | Read-only calendar, upcoming/Highlight/report queries, journal/lifecycle writes and bounded OHLC capture |
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

Start agents with [AGENTS.md](AGENTS.md#market-analysis); it owns the analysis
workflow and dataset commands. The [user manual](<user manual.md>) owns the practical
release shortlist for all eight currencies. [Data, clocks and recovery](docs/DATA-CONTRACT.md)
owns storage contracts; the [icon catalogue](docs/tools/icon-catalogue.html) is a
visual reference. Frontend owners above are under `frontend/src/` unless marked.
The bridge's inherited README is historical; Lite's operating instructions are here.

## Research handoff

**External Sources**, immediately left of Inspector in the bottom dock, keeps
outside-feed news separate from the broker calendar and Alert. Its independent
currency filters, search, source links, timing uncertainty and expandable history
use the same records as `pnpm analyst external --scope EURUSD --visibility all`.
Agents can append verified additions without inventing calendar IDs. This is a
saved research collection; it does not ingest or monitor breaking news. See the
[External Sources workflow](docs/EXTERNAL-SOURCES.md) for commands and timing rules.
Dated records have a saved **Show icon on chart** checkbox for gold stars in a
separate row above broker icons; click one to open its record. Stars appear only
on pairs containing an affected currency. Untimed watch items have no chart timestamp.

The repository has four market-analysis skills:
[Assess Trade Now](.agents/skills/assess-trade-now/SKILL.md) for a quick current
fundamental decision card without candles, with eight-currency coverage only
when requested;
[One Minute Before Release](.agents/skills/one-minute-before-release/SKILL.md)
for a bounded active-chat countdown using that prepared context and fresh actuals;
[Review Historical Research](.agents/skills/review-historical-research/SKILL.md)
for past moves and named date-range reports with mandatory H1/H4 evidence; and
[Review Upcoming Alerts](.agents/skills/review-upcoming-alerts/SKILL.md) for deciding
which future releases to watch or pin.

For example, ask `Use $assess-trade-now for 8 currencies ahead of US CPI` to
prepare, then in the same chat `Use $one-minute-before-release for the October 14
US CPI Highlight; compare its currency with all seven counterparts using that
preparation`. The countdown verifies the schedule and waits for actuals, stopping
by default five minutes after publication if decisive data is missing. Neither
skill promises exact response timing or starts background monitoring.

Choose **Research date range** in the drawing toolbar and drag across chart dates.
The research panel sits beside the chart, leaving panning and the bottom dock
available. Notes stay open when switching chart symbols or timeframes.
Name the report, adjust the inclusive dates, optionally add a question or notes, and choose
earlier context (90 days by default). **Prepare research** writes a unique `.md`
brief and complete `.tsv` evidence in a named folder under `Market Analyst Workflow/report/`, and offers
**Copy path** for the analyst session. Share the brief; it links to its evidence.
Alert's **Research** button prepares the same handoff for an upcoming release;
choose its currency alone or a pair containing it.

Alert separates **Upcoming / Highlight** from its shared **All / currency** filter.
The currency filter applies to the current collection, including Highlight's
**Active / Archive / Discovered Limitations**, and remembers your choice and view.
**All** means all currencies in that view; events are filtered by their own currency,
independently of the card's research Scope. **Highlight** keeps occurrences pinned from
Inspector's right header or Alert's **Pin** button. Expand a card for all series
and publication times. Pins remain after release, update with stored actuals and
revisions, and move to **Archive** on your instruction. **Restore** returns them to
the active list. They ignore upcoming family filters and
horizon, remain scoped to their broker, and survive refresh. Highlight checks for
updated values every two seconds while open; feed capture may still be delayed.
The agent can read the same list with `pnpm analyst highlights` and focused values
with `pnpm analyst highlights --summary --match CPI`, without browser access.

Cards display read-only Before/After release research with source links, preserved
reading snapshots and version history. **Copy Prompt** uses an explicit scope and
the latest tailored request. Agents append research through the local CLI; pinning
alone does not generate analysis. [Journal workflow](docs/HIGHLIGHT-JOURNAL.md)
documents research input, archive/restore and upcoming candidate commands.
Choose a pair in an active Highlight's Scope, then **Assess trade now → Copy Prompt**
for a concise fundamental decision card. Live/pre-release assessment uses calendar,
saved fundamental research and web evidence; candles are reserved for explicitly
requested historical price investigations. The action copies instructions only.
Copy Prompt offers preparation and after-release stages. Prompt-only records can
be saved while research is deferred. **Discovered Limitations**, after Active and
Archive, retains verified feed gaps and schedule/data disagreements with sources.

Exports include every stored series for the chosen currencies, independent of
Inspector/Alert filters and chart history. Files retain forecasts, revised priors,
periods, IDs, capture times, uncertainty and coverage gaps. They contain evidence,
not currency scores or speech transcripts; the analyst supplies web research.
Reports are local and ignored by Git. Existing reports are never overwritten.
Restart calendar storage after backend changes to load the updated report/Highlight APIs.

`pnpm analyst reports` finds brief and OHLC paths; `pnpm analyst report latest`
reads the newest evidence brief, ignoring adjacent analyst notes. Each report
folder keeps its brief, calendar evidence, and any attached OHLC together.
