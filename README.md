# Fyodor Trading Terminal Lite

MT5 chart/drawings, Market Watch, raw economic calendar Inspector, calendar Alert
and reminders, Entry Trade, price alerts, Currency News, Activity and Settings.
The copied bridge remains unchanged. The original terminal was extracted at
`639d382`; its repository remains intact.

## Run and check

Windows x64, Python 3.12 and pnpm 9.12.3. On a new checkout run `pnpm setup`,
then `pnpm dev:all`. UI: http://localhost:5173; bridge: 8001; storage: 8002;
alarm worker: 8003. `dev:all` clears listeners on 5173/8001/8002, checks worker
ownership before restarting 8003, and waits for bridge/storage readiness.
Stored data and alarm choices are retained. MT5 may remain disconnected.
`pnpm dev:ui` uses existing services. Optional `FYODOR_BRIDGE_API_URL` and
`FYODOR_STORAGE_API_URL` override Vite proxies. Reuse the existing MT5 publisher.

```powershell
pnpm test
pnpm lint
pnpm build
pnpm check:repo
```

Frontend suites run sequentially. Focus one with
`pnpm --dir frontend test -- currency_news`; multiple filename fragments are
accepted and unknown filters fail. Repository checks cover source reachability,
unused exports/classes and maintained document links. Visual/live MT5 acceptance
stays with the user; no automated UI audit is implied.

## Ownership

| Owner | Responsibility / contract |
| --- | --- |
| terminal-shell / workspace-docking | Composition, dock navigation/geometry, chart controls |
| market-data | MT5 candles/paging, Market Watch, sessions, viewport, chart/drawings/future axis |
| economic-calendar / inspector | Eight-currency catalogs, clocks, shared family filters, raw tables/icons; [data contract](docs/DATA-CONTRACT.md) |
| alert / events-alarms / storage/alarms | Dated calendar, occurrence bells, independent Windows delivery; [alarm contract](docs/EVENTS-ALARMS.md) |
| external-sources | Outside-feed evidence, chart markers, limitations and versions; [source contract](docs/EXTERNAL-SOURCES.md) |
| currency-news / storage/currency_news.py | On-demand saved news and implications; [news contract](docs/CURRENCY-NEWS.md) |
| currency-details / storage/currency_details.py | Pair/index fundamentals, official evidence and MT5 conflicts; [Detail contract](docs/CURRENCY-DETAILS.md) |
| entry-trade | Manual plans, pins, independent chart arrows and tracked journal |
| price-alerts | Broker/symbol lines, local persistence, Bid monitoring and browser sound |
| research / storage/research_reports.py | Named date-range evidence exports for optional historical studies |
| appearance / system-connectivity / system-observability | Theme/time, bridge status and Activity |
| Market Analyst Workflow/tools | Focused calendar/report/OHLC helpers and news CLI |

## Currency News

Open Currency News in the bottom dock. All shows a shared story feed; currency
buttons filter the same records. Copy refresh prompt prioritizes the newest
material news and relevant earlier context, without a fixed lookback. Run it in
the agent chat. Reload saved news only reads local output; there is no automatic
AI schedule or ingestion. Each agent invocation also checks global ongoing risks
and seven days ahead, prioritizes 48 hours, and maintains verified global custom
stars/notices and new high-impact reminders. A plain `$assess-trade-now` is enough.
See [global risk discovery](docs/GLOBAL-RISK-WORKFLOW.md). Technicals stay manual.

The date revolver opens on Today and filters by publication date in Jakarta.
Date-only stories keep their date and use last assessment time for ordering/age;
completely undated stories fall back to assessment date. Shared stories appear
once with independent currency implications. News Fundamentals contains source
facts; Implication contains bullish/bearish reasoning or explicit conditional
scenarios and coverage caveats. Material follow-ups get their own dated row.
A single Last updated age replaces repeated per-row save/check lines. Earlier
assessments remain selectable in Implication. Only Today offers a live refresh
prompt and polls saved data. Export Markdown follows the selected date, scope
and assessments. History stays local and is included in storage backups.

```powershell
pnpm analyst news read --scope ALL
pnpm analyst news lessons --scope CAD
pnpm analyst news save --scope CAD --input tmp/cad-news.json
pnpm analyst news verify --scope CAD
```

News uses local ignored storage, without mandatory pair forecasts, price scans,
checkpoints or performance evaluation. [Research rules](docs/RESEARCH-RULES.md)
and compact reviewed lessons preserve prior failure context. The old Thesis and
learning implementation/data are preserved per [the archive note](docs/RESEARCH-ARCHIVE.md).
For optional release waits/historical studies see [the user guide](user%20manual.md).

## Currency Detail

**Detail**, immediately right of Show events, opens its own right-panel view.
Six fixed categories compare the pair's currencies; EURX/JPYX/USDX show one.
Latest observations have no Events-window cutoff. Expand metrics for sources,
MT5 comparisons and independent verification clocks. Official readings lead
verified conflicts; raw MT5 remains intact. Last/next publication stages, next
major releases and optional dated policy focus reuse saved evidence. Browsing
does no AI work. The skill refreshes News and Detail together, starting with
`pnpm analyst details prepare --scope EURUSD`; see the
[Detail workflow](docs/CURRENCY-DETAILS.md).

## Preserved terminal behavior

Market Watch keeps favourites, sections/order and sorting. Daily % is the largest
signed excursion from the selected broker D1 open to its high/low; it is not the
current close change. Date navigation never borrows another day's candle.
The chart header retains high/low distances and indicative regional sessions.
Refocus, immediately right of D1, returns to the latest candles while keeping
horizontal zoom and restoring automatic price scaling. A fresh browser load
opens recent candles at the configured spacing instead of fitting all history.
Timeframe and symbol changes keep the selected date window as their navigation
target across historical views and future space. Viewport dates include the
outer candle edges. When a window is narrower than the native minimum zoom,
its left date stays anchored; returning to a smaller timeframe restores the
original zoom. Dense views admit the required pixel spacing; restoration checks
both edges. Candle, axis and indicator replacements run before browser paint so
rapid switches cannot paint new data before its viewport has been queued.
Deferred native chart updates cannot replace that window with an intermediate
future-axis range. Empty future space keeps
the last useful price scale and editable drawings visible.
RSI and its settings gear sit immediately left of the timeframe controls. RSI
opens a resizable lower pane with a shared time axis, Wilder RSI 14 on Close,
optional smoothing (SMA 14 by default), 70/50/30 bands and a background fill.
Visibility and settings persist on this device across all symbols/timeframes.
The settings dialog has Inputs/Style, OK/Cancel and Reset defaults. RSI follows
the chart timeframe and includes the current candle; earlier history reseeds it.
Volume and its settings gear sit beside RSI. Volume opens a resizable native
histogram pane above RSI, sharing dates, crosshair and the future axis. Raw mode
shows broker tick counts; Relative mode automatically matches candles from the
same regional session or overlap at the same point in that session period. The
readout follows the hovered candle; without hover it shows the current session,
including overlaps. Sessions reuse the header's indicative regional hours and
historical DST; no comparison-clock selection is needed. D1 uses prior daily
bars. Defaults are up to 20 prior matches and a minimum of five;
missing/zero-mean baselines stay blank. Load older or scroll left to build history.
Show Relative activity line overlays each candle's exact ratio with straight
segments and no averaging or smoothing. It is enabled by default: Raw bars keep
ticks on the right and the line uses a separate left × scale with a 1× reference;
Relative bars and the line share the right × scale. Missing baselines stay blank.
Show pane controls hides the in-pane button strip while the header gear stays
available. Raw mode also retains its separate optional SMA. Visibility/settings
persist across symbols and reloads. Select A/B then click each push's first and last candles in the Volume
pane to compare closed-bar total ticks, duration and mean relative activity.
Selections are temporary and reset on broker/symbol/timeframe changes. No signal
or trade direction is generated. See [Volume usage](user%20manual.md#volume-and-push-comparison).
Daily-candle reads attach only to the bridge's exact terminal/account, with
bounded caches; no login, symbol selection or broker changes.

By release combines exact-time readings for each currency into one Inspector
table across every category, including TIC/money, policy and PMI, preserving raw
series, source IDs and family filters. Distinct publication times stay separate
even on the same chart candle; older policy/PMI episodes do not merge those
clocks in By release. Calendar icons open Inspector first; **View in Alert** opens the selected
Pepperstone release in the dated Alert table. Inspector Save shares selected families across pairs containing each currency;
icon style/grouping/colors remain chart-specific. The chart calendar toggle
controls event icons and External Source stars without changing selections.
All series, date-only/unknown times, unknown-ID admission, blank-chart dismissal,
future axis and saved drawings remain supported. Jakarta AM/PM is the display
default; publication UTC and historical broker/chart clocks remain independent.
Family filters control chart/list admission; opening an admitted release exposes
its complete same-time source group. By-day selections keep their daily filters.

The 📆 button immediately right of the drawing-toolbar toggle opens Events
in the right panel. Its bottom dock switches Upcoming (the default) and Recent.
It follows the active chart's currency scope and broker, showing all timed rows
within the next or last 3, 7, 14 or 31 rolling days. Upcoming sorts nearest first
with In, CUR, Event and Actual/Forecast/Previous; Recent sorts newest first with
Age instead of In. Chart family selections and icon visibility do not filter
this list. Relative time uses publication UTC; hovering shows the timestamp
in the selected display timezone. Date-only or unverifiable
publication times are excluded rather than given an invented age. Browsing is
read-only and preserves research drafts when switching the shared right panel.

Alert shows all captured events for a selected Jakarta date, including released
rows, with source-specific Actual/Forecast/Previous. Agent impact remains sourced
or Unreviewed; MT5 importance never supplies it. One bell controls each timed
release package. Each event has its own flat row and independently expandable
details, including package components and linked publishers. Browsing, news saves and filters do not change choices. Windows
must remain awake for the independent worker; delivery never invokes AI.
Manual price alerts remain independent. Alert’s **Legacy pins & research** button
exposes active/archived pins, Elev8 journals, evidence, versions and saved prompts
for read-only inspection across brokers. Stored legacy data is preserved.

Entry Trade preserves incomplete editable manual entries, sortable dates,
pinned arrows, archive/restore and one journal box. The tracked journal and
history remain in `Market Analyst Workflow/entry-trade/journal.json`. Event UTC
controls table dating; the independently placed chart arrow can be in future space.

## Calendar and recovery

Read [DATA-CONTRACT.md](docs/DATA-CONTRACT.md) for calendar coverage, exporter
imports, broker clocks and recovery. `pnpm storage:backup` / `pnpm storage:restore`
operate on durable local storage, including Currency News. Keep raw captures and
saved choices; generated payloads/downloads/logs go in ignored `tmp/` or report
folders. See [dataset commands](docs/AGENT-RESEARCH.md#dataset-commands) only when
performing analyst dataset work.
