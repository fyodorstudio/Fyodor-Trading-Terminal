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
| currency-ledger / storage/currency_ledger.py | All-pair calendar tape, retained vintages, provisional scorecard; [Ledger contract](docs/CURRENCY-LEDGER.md) |
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
All 28 major FX pairs open a category scorecard linked to **Ledger** in the bottom dock.
Ledger has a draggable date tape with separate currency lanes, one calendar year
at a time. At the year edge, a small prompt opens the adjacent year. Dragging
and year browsing only browse; selecting a date changes the shared historical
cutoff. Latest readings carry forward even when their releases are offscreen.
The fixed header compares the latest three available releases (oldest to newest)
for each chosen rate, inflation, labor/wage and activity measure. Currency labels
open Fundamental Detail in the existing right panel. Release clicks open the exact
package in Inspector and highlight its measure, preserving Ledger's cutoff and
browsing position. Return to Ledger resumes the tape. Header choices only change
what is displayed. Today restores the current date; the ⌖ button to its left lets
you click a candle while retaining the native crosshair/date label. Escape cancels.
Rates, labor, growth and demand use a transparent provisional momentum formula;
inflation stays context only. Scores show coverage and are not probabilities or
an economy-health verdict. Backfilled evidence stays labelled and later captured
corrections never move backwards into earlier scores. See the
[Ledger contract](docs/CURRENCY-LEDGER.md) for the rules and historical limitations.
All captured broker series are available, including PPI and nonnumeric events;
only defined canonical measures contribute to scores. Actual numbers follow MT5's
stored positive/negative impact color; F/P and boxes remain neutral. Released tape
values stay visible after the evaluation cutoff; the header and scorecard remain
historical. Busy cells virtualize their cards and server snapshots share currency
caches across pairs. Missing stored coverage stays explicit.
The **Filters** button beside ⌖ defaults the timeline to S/A/B events. It reuses
Inspector's family controls with independent Ledger choices, S/A-only and All events
presets, preview/Save/Cancel and currency-shared persistence. Hidden events remain
available; filtering does not change the header, scoring evidence or chart icons.

The **Rate decisions** tab shows the evaluated calendar year's decisions for both
currencies, newest first, using the same cutoff. Indices retain the tier comparison.
Four shared tier groups (S/A/B/C) compare the pair's currencies; EURX/JPYX/USDX
show one. Full-width tier subheaders leave the currency columns equal-width.
Equal-height event blocks compare Previous reading, Latest actual and Next
upcoming forecast, followed by Released at, Next Release and an original-publisher
link. Forecast means the next scheduled release, not the latest release’s old
consensus. Missing readings stay blank dashes; revised previous values take priority.
A newer official observation never borrows an older broker vintage’s previous
value. Conflicts use a ⚠ tooltip. Dates prefer captured
broker occurrences; no hour is invented. Latest values have no Events-window
cutoff. Tier List Info replaces the table with the static definitions and the
active currencies' reference rows; Close returns to the comparison.
Alert's Tier column uses the same exact-series classification. Saved assessments
and reminder choices remain intact. The skill refreshes News and Detail together,
starting with `pnpm analyst details prepare --scope EURUSD`; see the
[Detail workflow](docs/CURRENCY-DETAILS.md).

## Preserved terminal behavior

Market Watch keeps favourites, sections/order and sorting. Dropping a favourite
automatically switches percentage sorting to Saved order, preserving the visible
ranked order as its starting point. Starting/cancelling a drag changes no order.
Daily % is the largest
signed excursion from the selected broker D1 open to its high/low; it is not the
current close change. Date navigation never borrows another day's candle.
The chart header retains high/low distances and indicative regional sessions.
Refocus, immediately right of D1, returns to the latest candles while keeping
horizontal zoom and restoring automatic price scaling and live following. Manual
panning/zooming pauses following until Refocus. Opening/closing panels preserves
both date edges and the manual price range. A fresh browser load
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
Timeframes sit immediately right of the pair/Market Watch button, followed by
Refocus. Volume/RSI and the remaining action buttons align beside the session
timeline; the flexible gap follows Refocus. A separator precedes the event-icon
button. RSI opens a resizable lower pane with a shared time axis, Wilder RSI 14 on Close,
optional smoothing (SMA 14 by default), 70/50/30 bands and a background fill.
Visibility and settings persist on this device across all symbols/timeframes.
Manual price-chart bounds are remembered per broker, pair and timeframe during
the session. Returning to a pair restores its vertical zoom/position, including
through empty loading states. A new pair inherits relative zoom in its own price
units. Horizontal dates and zoom remain shared; Refocus remains an explicit reset.

**MFDI** (Macro Factor Data Inspector) is available on every chart symbol, including
all 28 FX pairs, EURX, JPYX, USDX, XAUUSD and broker-specific instruments. Its gear
opens **Inputs / Style** with draft OK/Cancel. One shared configuration applies
to every symbol: enabled currencies, visibility, styles, selected axis and layout
stay intact when changing pairs. The current symbol’s saved setup seeds the
shared configuration on migration; old symbol profiles are retained. A fresh
setup starts with no currencies ticked.

In Inputs, tick any of the eight event currencies to restore its saved event list.
**+ Add events** opens an Inspector-style searchable catalogue, grouped by category
and currency. Select individual measures, including CPI/Core CPI, PCE, payrolls,
unemployment, earnings, GDP, PMIs and retail sales. **− Remove** removes a measure
from that currency's saved list. Currency event presets, styles and the active
configuration are shared locally across every symbol. Unticking a currency retains its saved events for later use.
MFDI settings are independent of Inspector's filters. Reset defaults resets styles
and the selected axis without deleting event lists or changing currency ticks.

Each selected event has its own scale, colour, eye, **F** forecast toggle and **N**
number toggle. Click a label to select its draggable right axis. Labels and numbers
use the event's actual units; arrows compare each actual with the previous available
release. **Fit axis** fits the selected scale; **Fit axis all** fits every visible
scale. The lock links numerical axes in numerical view; in Lane view, drag the
plot to move all lanes together. Wheel input scrolls the lane viewport vertically,
with the lock on or off; it never changes spacing. Use Lane spacing in Series to
adjust the distance between lanes.
The adjacent three-line **Lane view** button draws perfectly straight rows, with
actual values, arrows, dates and forecasts retained. Click again to restore the
numerical plot. **Series** opens a right-side overlay drawer: event names occupy
one column, followed by a dedicated ✥ drag handle, vertically aligned eye/F/N
controls and a colour circle.
Click the circle to choose a colour. While dragging, previews update at most once
every 80 ms without saving preferences or rebuilding chart data. Confirmation
applies the final colour immediately and saves once; blur also finishes an edit.
Line, dot and forecast previews stay in sync without rebuilding the open picker. Event/category names and controls exist only
in the drawer; number labels remain above the dots when N is enabled.
The top All series eye/F/N row toggles all selected events together, including
collapsed categories. Mixed states switch everything off; the next click switches
everything on. Unticked currencies keep their saved settings. Close or Escape dismisses
the drawer without resizing the chart. Wheel anywhere over the popover to scroll
its event list; hold the Series title to move the window within the chart. Drag
the bottom-right grip to resize it (or focus the grip and use arrow keys). Its
position and size survive redraws and close/reopen while the pane stays open.
Opening Inspector or another bottom dock shortens the scrollable body as needed,
keeps the title reachable, and restores the chosen size when space returns.
The category arrow and name form one button: click to fold/expand its drawer list
and select every child, then drag the plot to move that category together in
either view. Folding never hides or shifts plotted lines. Category headers do
not drag; use the up/down category buttons in MFDI settings to reorder them.
With Lane view on and the lock off, select an event name, then drag the plot to
place that straight line freely without moving its peers or numerical scale.
Selecting a series/category unlinks the group. A blank chart click or a click
outside the chart returns to linked movement and clears category selection;
Series controls, MFDI settings and release-dot clicks preserve the selection.
Lane view suppresses native numerical crosshair dots; only its actual lane dots
and their release cards remain interactive.
**Fit all lanes** restores the category arrangement and fits it into the pane.
Lane offset, spacing and individual line placements are saved universally.

Named MFDI presets save currency/event selections, colours, eye/F/N and dot choices,
categories/order/collapse, straight-lane positions, spacing, vertical scroll,
linked movement and numerical axis placements. The working layout saves locally
and restores after refresh across every symbol. Currency ticks hide/show without
packing other lines upward; retained lane anchors restore when re-enabled.
In **Series**, choose a preset to load it, enter a name and **Save as…**, or use
**Update preset** to overwrite that saved snapshot. Working edits never silently
overwrite named presets. In **MFDI settings → Inputs → Named presets**, load,
create, update, rename, duplicate or delete presets, and export/import a JSON
backup. Settings and library edits stay drafts until **OK**; **Cancel** discards
them. Import adds copies rather than replacing existing presets. Loading a preset
keeps the price chart's date window and does not fit the MFDI lines.
Saved numerical mappings preserve pixels per unit and top placement when pane
height changes. A smaller viewport may clamp scrolling while retaining the saved
scroll for when space permits. Fit/reorder actions deliberately rearrange lines.
Storage is local to this browser/app profile; export a backup to transfer it or
protect it before clearing site data. A storage failure is shown in MFDI's status.

**Hide Legend** is ticked by default in Inputs and hides only the value/release
readout; explicit saved choices remain unchanged. Category names, assignments and event lists are shared;
category order, row order, collapsed state, lane mode and Hide Legend are shared
across symbols too. Linked lanes still move everything together, with no persistent
selection highlight in Series; individual/category selection highlights return
when the lock is off.
Create/rename/reorder/delete categories in Inputs; deletion moves events to
Uncategorized. In the Series drawer, hold the ✥ handle before the eye and drag
it to a category (or reorder within one). The target category highlights; the
plot stays still during the drag, then snaps to its category placement on drop.
Dropping outside the drawer cancels. This works in both views; clicking the name
only selects its chart series. Category collapse controls live in
the drawer; the lane scrollbar reveals rows when they exceed the available pane height. Pane resizing adds canvas space below
without stretching plots. Each scale holds its placement across scrolling, backfill,
updates, eyes and axis changes. The linked-axis choice also survives refresh.

Only selected event IDs/currencies are loaded, sharing one paged snapshot and polling
clock. No selections means no macro calendar polling. Numeric released actuals with
verified chart timing align to their containing candle; the latest release in a
candle wins. Missing values and unknown times stay blank. Click a dot to inspect its
exact release package in the bottom dock, using its own currency. Hover readouts show
Actual / Forecast / Previous for the exact release, with its date/time in the
selected clock and a connector to the dot. Missing values show a dash; supplied
previous values are never substituted with a prior plotted dot. Successful charts have no static
source/status caption; loading, errors and empty states remain visible when needed.

Monthly lines connect release dots; the Fed rate holds between decisions. Historical
forecasts use a same-colour line at 60% opacity and hollow rings. Upcoming releases
replace vertical schedule lines with faint dots containing their forecast values,
and connections at 25% opacity. When the observed actual arrives, a displayed
pending dot becomes solid and shows the actual value inside. Release previews
remain visible with F off and follow the eye/dot choices. A missing forecast
breaks the connection: lane view can show a dash, while numerical view omits an
unknown-height dot. These overlays never refit scales or introduce native timeline
timestamps. Existing USDX payroll
forecasts default on; newly added events default off. Fed-specific official upper
bounds and saved consensus overrides apply only to the exact Fed rate series. Its
dot card uses the exact saved primary consensus in its Forecast column when available. See the [Fed consensus reference](docs/MFDI-FORECASTS.md).
Hiding an indicator unregisters its series from the shared native timeline, so
old lower-timeframe timestamps cannot spread out later H4/D1 candles.
The settings dialog has Inputs/Style, OK/Cancel and Reset defaults. RSI follows
the chart timeframe and includes the current candle; earlier history reseeds it.
Volume and its settings gear sit beside RSI. Volume opens a resizable native
histogram pane above RSI, sharing dates, crosshair and the future axis. Raw mode
shows broker tick counts; Relative mode automatically matches candles from the
same regional session or overlap at the same point in that session period. The
readout follows the hovered candle; without hover it shows the current session,
including overlaps. All four session names stay visible: active names are red,
inactive names grey out. Volume and RSI legends have transparent
backgrounds, with backgrounds retained on buttons only. Sessions reuse the
header's indicative regional hours and
historical DST; no comparison-clock selection is needed. D1 uses prior daily
bars. Defaults are up to 20 prior matches and a minimum of five;
missing/zero-mean baselines stay blank. Scroll left to build history.
Volume settings use Inputs/Style tabs, matching RSI: data options in Inputs,
visibility and colours in Style.
Show Relative activity line overlays each candle's exact ratio with straight
segments and no averaging or smoothing. It is enabled by default. Raw mode has
an **Axis: Volume / Relative** toggle: the selected series owns the
draggable right axis and the other uses an independent hidden automatic scale.
The selector stays clickable in Raw mode; choosing a hidden axis reveals its
Relative line or volume bars. Raw/Relative bar mode is selected in Inputs.
No left gutter is added. Relative bars and the line share the right × scale;
a 1× reference remains visible. The fixed-field readout sits at the upper-right,
with pipe separators between Ticks, Relative and Matches. The line stays above the
bars when hovering. Missing baselines stay blank.
**Bars**, **Relative** and **Average** buttons immediately right of the axis
selector independently show/hide the histogram, Relative line and raw-tick SMA.
The average applies in Raw mode. Visibility persists and matches the Style tab;
controls remain available with every layer hidden. The axis follows the remaining
visible series when only one kind is shown. Scroll left for earlier history.
See [Volume usage](user%20manual.md#volume).
A scope change records one bounded post-paint **Timeframe trace** in Activity
under Chart: sampled raw/native OHLC, timeline indices, price coordinates,
viewport and pane types. It adds no chart controls and does no live-tick tracing.
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
Chart markers keep their original offset when indicators are hidden; with an
indicator pane open, both local icons and custom stars sit 22px lower within
the main price pane, preserving stacked-row clearance.
All series, date-only/unknown times, unknown-ID admission, blank-chart dismissal,
future axis and saved drawings remain supported. Jakarta AM/PM is the display
default; publication UTC and historical broker/chart clocks remain independent.
Family filters control chart/list admission; opening an admitted release exposes
its complete same-time source group. By-day selections keep their daily filters.

The outline calendar-list button immediately right of the drawing-toolbar toggle opens Events
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
rows, with source-specific Actual/Forecast/Previous. The Tier column uses the
shared currency classification; MT5 importance never supplies it. One bell controls each timed
release package. Every row repeats its time and currency, with opaque black
horizontal dividers in the light theme (white in dark). The current-time line
occupies an existing row boundary without a spacer. Each event has its own flat row and independently expandable
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
