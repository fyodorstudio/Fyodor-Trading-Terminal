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
It also restarts the alarm worker on port 8003 after verifying it belongs to this
checkout, loading updated backend code while retaining saved reminder choices.
An unrelated or unverifiable port 8003 listener stops startup with a diagnostic.
The UI waits for bridge and storage HTTP readiness (up to two minutes), so initial
page requests do not race storage startup. MT5 may still be disconnected.

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
| alert | Date-based events, filters/countdowns, agent impact and saved research |
| external-sources | Separate outside-feed events/headlines/watch items, sourced facts, history, limitations reference and agent prompts |
| events-alarms / storage/alarms | Shared dock, per-pin invocation alarms and independent Windows alarm delivery |
| entry-trade | Manual execution plans, all-pair pins, draggable chart levels and independent saved journals |
| thesis / storage/thesis.py / storage/thesis_reviews.py | Dated opportunities, shared backdrop reviews, agent context and append-only versions |
| research | Chart date selection and named Markdown handoff shared with Alert |
| Market Analyst Workflow/tools (repo root) | Read-only calendar, upcoming/Highlight/report queries, journal/lifecycle writes and bounded OHLC capture |
| appearance, system-connectivity, system-observability, workspace-docking | Theme/time, bridge status, Activity and dock geometry |

```powershell
pnpm test
pnpm lint
pnpm build
pnpm check:repo
```

**Alert** is one date-based table for Pepperstone and named external publishers.
Scroll the five-day selector, choose month/year or Today, and use All/eight-currency
buttons plus the existing Alert filters. Every available event on that Jakarta date
stays visible after release; no shortlist or manual archiving is needed. Actual,
Forecast and Previous retain their source values. Click an event for Overview,
Sources & history, and saved research. Feed notes retains discovered limitations.
Agent impact shows a separately sourced High/Medium/Low assessment or **Unreviewed**.
MT5 importance never supplies this label; old broker assessments stay with their
original broker. Text, including secondary labels, uses full readable contrast.

One bell controls each timed release package. New events start off; changing dates
or filters never changes a reminder. Existing verified Elev8 choices migrate to
matching Pepperstone occurrences; unmatched stages appear in Alarm Settings for
review. Source records and research history remain intact. Alarm Settings contains
global enable/pause, reminder offset, test and delivery history. `pnpm dev:all`
starts the independent worker; Windows must remain awake. See the
[alarm workflow](docs/EVENTS-ALARMS.md) for persistence and delivery limits.

Frontend suites run sequentially and mount production components with fixture
transport/canvas. Native chart API tests verify coordinates, future times and
drawings. Visual/live MT5 acceptance remains with the user.

Display time defaults to Jakarta (UTC+07:00), including chart labels and Inspector
release hours. Chart settings → Display timezone retains alternate clocks and
AM/PM. Broker-specific historical conversion is shared with storage; unfamiliar
brokers require a verified clock profile rather than today's offset.

For a fresh Pepperstone batch, run the unchanged
`bridge/mql5/Active/FyodorResearchExporterV4.mq5` while connected to Pepperstone.
Use `CalendarFromDate=2015.01.01`, `CalendarToDate=0` (snapshot time), all eight
currencies, and keep the complete output folder. For H1 candles retain the default
2014.11.01 warmup and exact 28-pair settings; use Pepperstone's exact symbol names
if they have suffixes. Imports validate the manifest, recorded clocks, identities,
counts and file hashes, then keep the archive alongside live/backfill observations.
See [import and clock rules](docs/DATA-CONTRACT.md#runtime-and-clocks).

## Preserved workflow

Market Watch stars save favourites locally across refreshes; NZDCHF, EURUSD and
EURAUD form the initial shortlist. The Favourites tab retains live Bid/Ask and
supports search. Use Edit sections to add/rename sections or move symbols between
them; drag the handles (or press Up/Down on a handle) to reorder. Sections/order
persist locally; deleting a section moves its symbols back to the first section.
Starring preserves the selected chart and existing feed order outside Favourites.

Market Watch categories use a captured Pepperstone-Demo symbol-folder catalog,
including currency indices, forex minors/exotics/NDFs, stocks, ETFs, forwards and
Perp CFDs. Quotes and availability still come from the live bridge. Other brokers
and new symbols use conservative name matching. Refresh the folder snapshot with
`bridge\.venv\Scripts\python.exe scripts/export-symbol-groups.py --terminal "C:\Program Files\MetaTrader 5\terminal64.exe" --server Pepperstone-Demo`.
This reads metadata only and leaves the inherited bridge unchanged.

The calendar button beside the chart timeframes shows/hides all event icons,
including Inspector icons and External Source stars. This setting persists across
symbols, timeframes and reloads without changing filters or individual source choices.
Choose Inspector families by currency → click chart icons → raw tables.
Inspector also supports JPYX/JPN225 (JPY), EURX (EUR), USDX/XAUUSD (USD), and the
available JPN225-F, USDX-F and XAUUSD-F forwards. Each shows its mapped currency's
calendar events and eligible External Source stars. These mappings describe event
relevance, not the expected price direction or complete index-basket coverage.
Save shares those family selections across every pair containing the currency;
grouping, icon choices and colors remain per chart. Existing pair
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
Drag the bottom dock's top edge up to fill the workspace above the bottom navigation;
drag down to shrink it. With the resize handle focused, End maximizes and Home shrinks it.
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

**Thesis** documents agent assessments explicitly requested by the user, newest
first, independently of the chart. The month selector offers **JUL / OCT 2026**.
**Across All Currency** shows one eight-currency table for the selected month/day:
daily strengthening/weakening verdict, sourced news and upcoming checkpoints. A top
Trade Entry Opportunity selects supported standalone currency and optional
Brent/WTI/gold entries with investor incentives, active/conditional status and
same-day windows. It can explain an empty selection while keeping all eight
directional rows; real capital may be at stake. No pair scanning in this view.
It has its own dated copied prompt and Markdown handoff; existing pair journals remain separate.
Agents use `thesis context`
for bounded prior context, then refresh evidence and save a new dated review;
earlier reviews retain their exact opportunity versions and original source dates.
July retains its original NZDCHF
reconstruction; October 1–17 adds event-driven NZDCHF assessments with separate
pair bias and thesis-change evidence. Sources, as-of/saved times and prior versions are
expandable. NZDCHF October 18–31 has requested blank planning rows with sourced
schedule notes. Export Markdown includes the selected currency date or pair/month, sources,
versions and context for continuing with another AI. Alert retains scheduling
and notifications. See [Thesis workflow](docs/THESIS.md)
for the copied assessment prompt and agent save interface.

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

Named external publishers appear alongside calendar rows in Alert and keep
outside-feed research separate from MT5 observations. Source links, timing
uncertainty and expandable history use the same records as
`pnpm analyst external --scope EURUSD --visibility all`. Agents can append verified
additions without inventing calendar IDs. This is a saved research collection;
it does not ingest or monitor breaking news. See the [External Sources workflow](docs/EXTERNAL-SOURCES.md)
for commands and timing rules. Dated records have a saved **Show icon on chart**
checkbox for gold stars in a separate row above broker icons; click one to open
its record. Stars appear only on pairs containing an affected currency. Untimed
watch items have no chart timestamp.

The repository has three market-analysis skills:
[Assess Trade Now](.agents/skills/assess-trade-now/SKILL.md) combines current
fundamentals, near-term discovery and upcoming-alert/holding reviews. It researches
web sources before the dated backdrop, reads known feed limitations, immediately
pins verified material discoveries and requests chart icons (unless explicitly
read-only), then validates its coverage/persistence receipt. It sends a supported
pair BUY/SELL decision promptly, explicitly retains/reverses prior directions,
and surfaces emerging beneficiaries in LOOK HERE NEXT after a brief eight-currency
catalyst sweep. Deep research stays with the request and material candidates;
an unspecified broad event shortlist alone uses all eight/90 days. Fundamental-only
is the default; an explicit price-aware request permits bounded market feedback.
Daily Thesis currency rows keep their existing saved labels and schema.
[One Minute Before Release](.agents/skills/one-minute-before-release/SKILL.md)
provides a bounded active-chat countdown using prepared context and fresh actuals.
[Review Historical Research](.agents/skills/review-historical-research/SKILL.md)
handles past price moves and date-range reports with mandatory H1/H4 evidence.
Upcoming review no longer needs a separate skill invocation. No live news monitor
or guaranteed exhaustive coverage is implied; explicit source gaps remain visible.

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

The Alert date table browses calendar rows independently of saved Highlight pins.
The publisher supplies Pepperstone readings; outside-feed records retain their
actual publisher links and separate identities. Exact, explicitly linked external
coverage can share a publication group and bell with calendar rows; matching times
or similar names alone never merge releases. Date-only events keep their source
date and unknown hour. Undated watch items have a separate section.

Legacy Highlight pins/journals, archived investigations and CLI research remain
readable. Saving or pinning research does not automatically select a new alarm.
Alert no longer offers Prepare research or archive controls; chart Research date
range still creates named reports. Dates do not invoke research or create reminders.

Exports include every stored series for the chosen currencies, independent of
Inspector/Alert filters and chart history. Files retain forecasts, revised priors,
periods, IDs, capture times, uncertainty and coverage gaps. They contain evidence,
not currency scores or speech transcripts; the analyst supplies web research.
Reports are local and ignored by Git. Existing reports are never overwritten.
Restart calendar storage after backend changes to load the updated report/Highlight APIs.

`pnpm analyst reports` finds brief and OHLC paths; `pnpm analyst report latest`
reads the newest evidence brief, ignoring adjacent analyst notes. Each report
folder keeps its brief, calendar evidence, and any attached OHLC together.
