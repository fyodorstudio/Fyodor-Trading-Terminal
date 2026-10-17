# Fyodor Trading Terminal Lite

MT5 Market Watch, chart/drawings, raw calendar Inspector, upcoming Alert and Activity,
with saved agent-authored research journals under Highlight. Extracted from the
original terminal at `639d382`; that repository remains intact. Market research
happens in an analyst session; the terminal displays its journal.

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
| external-sources | Separate outside-feed events/headlines/watch items, sourced facts, history, limitations reference and agent prompts |
| events-alarms / storage/alarms | Shared dock, per-pin invocation alarms and independent Windows alarm delivery |
| entry-trade | Manual execution plans, all-pair pins, draggable chart levels and independent saved journals |
| thesis / storage/thesis.py | Monthly pair theses, pending Highlight stages, copied prompts and append-only assessment versions |
| research | Chart date selection and named Markdown handoff shared with Alert |
| Market Analyst Workflow/tools (repo root) | Read-only calendar, upcoming/Highlight/report queries, journal/lifecycle writes and bounded OHLC capture |
| appearance, system-connectivity, system-observability, workspace-docking | Theme/time, bridge status, Activity and dock geometry |

```powershell
pnpm test
pnpm lint
pnpm build
pnpm check:repo
```

**Alert** has **Highlight / MT5 Calendar / External Source** views. Highlight
combines both pinned sources, with date sorting, source labels and filled/outline
alarm bells. Currency buttons stay on the right of view controls. Data and research
remain in their existing stores. Pinned events and confirmed timed external events
automatically receive one Invoke reminder two minutes before each release stage. Use Test
alarm once to check the Windows window and built-in sound. `pnpm dev:all` starts
the independent alarm worker; use `pnpm alarms:start` to start it without restarting
the stack. The browser may close, but Windows must remain awake and the worker
running. See [alarm workflow and persistence](docs/EVENTS-ALARMS.md).

Frontend suites run sequentially and mount production components with fixture
transport/canvas. Native chart API tests verify coordinates, future times and
drawings. Visual/live MT5 acceptance remains with the user.

## Preserved workflow

Market Watch stars save favourites locally across refreshes; NZDCHF, EURUSD and
EURAUD form the initial shortlist. The Favourites tab retains live Bid/Ask and
supports search. Starring preserves the selected chart and existing row order.

Choose Inspector families by currency → click chart icons → raw tables.
Save shares those family selections across every pair containing the currency;
grouping, symbol visibility, icons and colors remain per pair. Existing pair
choices are read until a currency is saved once with the shared selection.
By day keeps one icon per currency/day and sections matching filter categories.
French CPI/HICP variants sharing a verified publication time and reference period
appear as one release with individual series. France, Germany, other dates and
uncertain hours retain their publication identities; existing CPI/HICP family
selections remain effective.
In By release mode, simultaneous timed EUR data publications share one chart
item and flat table, with countries and reference periods retained on each row.
Policy/PMI stages and date-only schedules retain their existing grouping.
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
Drawings are shared across all timeframes for the same pair, including existing
saved drawings. Editing or deleting one updates that same drawing on every timeframe.
The drawing toolbar's delete button clears only the current pair, across all timeframes.
Hold Shift while drawing a Trend line or Price note to keep it horizontal; release
Shift for free movement. Price notes label their endpoint price. Date and price range
shows elapsed days/hours/minutes and pip distance; Research date range is separate.

Use the same UI origin (normally localhost:5173) to reuse browser preferences from
the original app. A different port has separate browser storage. Old scoring view
choices fall back to raw tables; filters/icons/colors stay intact. No Workspace
backup UI, scoring engines, full Notebook workflow, Scatter Plot or experimental
context tools are included.

**Thesis** is a separate bottom dock for readable pair assessments and pending
Highlight stages. V1 offers only **JUL 2026**, with the reconstructed July 1–15
NZDCHF table. Pair choice is independent of the chart. Copy a pending row's release
prompt to assess and save its thesis; elapsed time alone leaves it blank. Sources,
as-of/saved times and prior versions are expandable. See [Thesis workflow](docs/THESIS.md)
for the agent interface and tracked compact records.

**Entry Trade** is a manual trade journal. Save an entry at any stage, choose
Waiting/Long/Short freely, use the broker quote for Entry, and enter SL/TP in any
order. Prices, pips and optional target R:R remain editable after saving; incomplete
levels do not block journaling. Use Market uses Ask for Long, Bid for Short and
midpoint for Waiting. New Entry starts with blank technicals and Waiting.
The sortable all-pair table uses the event anchor date, independently of the
arrow date; entries without an anchor show Date unset. Edit the event name/time
and arrow time separately in the journal, or explicitly copy the event time to
the arrow. All journal date controls use Jakarta AM/PM. Arrows can be placed or
dragged into future empty chart space without adding candles; dragging retains
the native crosshair and axis-time label. Click table headers to reverse or
change sorting. Archive sits beside Delete in the selected journal entry,
preserves the entire entry, and hides its chart arrow; restore from Archived.
Journal text saves with Save/Ctrl+Enter, and archiving includes unsaved text.

Saved arrows and notes keep their original browser keys as an offline cache.
The local Vite dev/preview server atomically persists entries and append-only
edit history in the Git-tracked `Market Analyst Workflow/entry-trade/journal.json`.
Existing browser entries migrate without replacing edited repository entries;
queued local changes retry after outages, stale revisions cannot overwrite the
journal, and deletions cannot be resurrected by another browser. The dock reports
whether edits are saved to the repo or waiting to sync. Saving changes the file;
it does not automatically commit or push Git. Static hosting alone cannot write
this local journal API.

The original agent-authored theses also live in the tracked
`frontend/public/entry-trade-research.json`. For new agent journal writes, GET
`/entry-trade-api/journal`, then POST JSON with `expectedRevision` and `operations`
containing unique `operationId`, `action` (insert/update/delete), `id`, and `arrow`
or `changes`. Preserve user notes, levels, history and identities; initialise
research-only entries with Waiting and null execution levels. UTC event instants
are storage data; write alarm times and thesis prose in Jakarta AM/PM.

Start agents with [AGENTS.md](AGENTS.md#market-analysis); it owns the analysis
workflow and dataset commands. The [user manual](<user manual.md>) owns the practical
release shortlist for all eight currencies. [Data, clocks and recovery](docs/DATA-CONTRACT.md)
owns storage contracts; the [icon catalogue](docs/tools/icon-catalogue.html) is a
visual reference. Frontend owners above are under `frontend/src/` unless marked.
The bridge's inherited README is historical; Lite's operating instructions are here.

## Research handoff

**External Source**, inside Alert, keeps outside-feed research separate from MT5
observations. Its independent currency filters, search, source links, timing
uncertainty and expandable history use the same records as
`pnpm analyst external --scope EURUSD --visibility all`. Agents can append verified
additions without inventing calendar IDs. This is a saved research collection;
it does not ingest or monitor breaking news. See the [External Sources workflow](docs/EXTERNAL-SOURCES.md)
for commands and timing rules. Dated records have a saved **Show icon on chart**
checkbox for gold stars in a separate row above broker icons; click one to open
its record. Stars appear only on pairs containing an affected currency. Untimed
watch items have no chart timestamp.

The repository has four market-analysis skills:
[Assess Trade Now](.agents/skills/assess-trade-now/SKILL.md) for a concise web-first
fundamental thesis without candles, with eight-currency coverage only
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
by default five minutes after publication if decisive data is missing. Preparation
includes direct release sources, decisive fields and simultaneous-release checks.
The countdown sends a short sourced verdict as soon as sufficient evidence arrives,
then the compact thesis with separate upcoming events and a compact fundamental backdrop table in the same turn,
with available timing checkpoints.
Neither skill promises exact response timing or starts background monitoring.

Choose **Research date range** in the drawing toolbar and drag across chart dates.
The research panel sits beside the chart, leaving panning and the bottom dock
available. Notes stay open when switching chart symbols or timeframes.
Name the report, adjust the inclusive dates, optionally add a question or notes,
and choose earlier context (90 days by default). **Prepare research** writes a
unique `.md` brief and complete `.tsv` evidence in a named folder under
`Market Analyst Workflow/report/`, and offers **Copy path** for the analyst session.
Share the brief; it links to its evidence.
Alert's **Research** button prepares the same handoff for an upcoming release;
choose its currency alone or a pair containing it.

**Highlight / MT5 Calendar / External Source** are separate top-level views.
The currency filter applies to the current collection, including Highlight's
**Show: Active / Archived** and External Source's **Events / Discovered Limitations**,
and remembers your choice and view. **All** means all currencies in that view;
events are filtered by their own currency, independently of the card's research
Scope. **Highlight** keeps occurrences pinned from Inspector's right header or
MT5 Calendar's **Pin** button, plus active external records (Pin/Pinned in External
Source). Archive/Restore preserves external version history and existing alarm
choices. Expand a calendar card for all series and publication times. Pins remain
after release, update with stored actuals and revisions, and move to **Archive**
on your instruction. **Restore** returns them to the active list. They ignore
upcoming family filters and horizon, remain scoped to their broker, and survive
refresh. Highlight checks for updated values every two seconds while open; feed
capture may still be delayed. The agent can read the same list with
`pnpm analyst highlights` and focused values with
`pnpm analyst highlights --summary --match CPI`, without browser access.

Cards display read-only Before/After release research with source links, preserved
reading snapshots and version history. **Copy Prompt** uses an explicit scope and
the latest tailored request. Agents append research through the local CLI; pinning
alone does not generate analysis. [Journal workflow](docs/HIGHLIGHT-JOURNAL.md)
documents research input, archive/restore and upcoming candidate commands.
Choose a pair in an active Highlight's Scope, then **Assess trade now → Copy Prompt**
for a concise fundamental thesis. Live/pre-release assessment uses current web
evidence, with calendar and saved fundamental research optional; candles are reserved
for explicitly requested historical price investigations. The action copies instructions only.
Copy Prompt offers preparation and after-release stages. Prompt-only records can
be saved while research is deferred. **External Source → Discovered Limitations**
retains verified feed gaps and schedule/data disagreements with sources, separately
from saved events. Agents read these through `pnpm analyst limitations --broker <broker>`
before reviewing MT5 and outside-feed schedules.

Exports include every stored series for the chosen currencies, independent of
Inspector/Alert filters and chart history. Files retain forecasts, revised priors,
periods, IDs, capture times, uncertainty and coverage gaps. They contain evidence,
not currency scores or speech transcripts; the analyst supplies web research.
Reports are local and ignored by Git. Existing reports are never overwritten.
Restart calendar storage after backend changes to load the updated report/Highlight APIs.

`pnpm analyst reports` finds brief and OHLC paths; `pnpm analyst report latest`
reads the newest evidence brief, ignoring adjacent analyst notes. Each report
folder keeps its brief, calendar evidence, and any attached OHLC together.
