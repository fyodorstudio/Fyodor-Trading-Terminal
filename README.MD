# Fyodor Terminal — Canvas & Notebook

A clean, high-performance trading terminal and forensic notebook built strictly on verified MetaTrader 5 broker data.

---

## Architecture Topology

```
┌────────────────────────────────────────────────────────────────────────┐
│                        FYODOR TERMINAL (FRONTEND)                      │
│   • Renders 60 FPS candlestick charts, Market Watch, and Notebook       │
│   • Interactive drawing toolbar, long/short risk:reward calculators    │
│   • Real-time MT5 Economic Calendar release markers on the timeline    │
└───────────────────────────────────▲────────────────────────────────────┘
                                    │
                   Raw Broker Data  │ (Quotes, Candles & Calendar)
                                    │
┌───────────────────────────────────┴────────────────────────────────────┐
│                               MT5 BRIDGE                               │
│                         (port 8001 / FastAPI)                          │
│   • Native MetaTrader 5 IPC adapter                                    │
│   • Pure read-only market data streaming and historical bar paging     │
│   • Serialized latest-request-wins worker architecture                 │
│   • Zero strategy logic, zero synthetic data, zero external services   │
└────────────────────────────────────────────────────────────────────────┘
```

---

## Core Features

Calendar durability is owned by the separate local `storage/` service on port 8002. Publisher V2 retains the frozen bridge's live protocol and supplies requested history to storage; the database and copied raw inventory live under gitignored `storage/data/`. Inspector reads this persistent calendar; the Economic Calendar preview retains its existing live feed.

1. **Market Watch**:
   - Dedicated left dock displaying live broker instruments.
   - Real-time bid, ask, spread, daily % change, and fast search filter.
2. **Interactive Candlestick Chart**:
   - Timeframes from `M1` through `MN`.
   - Smooth 2D canvas pan, zoom, dark/light themes, and custom candle colors.
   - Real-time vertical markers for MT5 economic releases pinned above the timeline.
3. **Full Drawing Suite**:
   - Trendlines, horizontal lines, rectangles, parallel channels, position boxes, and text notes.
   - Interactive handles and direct right-click deletion.
4. **Trader's Notebook & Execution Planner**:
   - Located in the bottom dock under the **Notebook** tab.
   - Set planned Entry, Take Profit, and Stop Loss levels with instant pip distance and R:R ratio calculation.
   - Project planned levels directly on the chart (dotted blue Entry, dashed emerald TP, dashed rose SL).
   - Rich forensic journal `<textarea>` automatically saved locally and durable across browser refreshes.
5. **MT5 Economic Calendar**:
   - Historical and upcoming high/medium impact events with countdowns, actual vs. forecast values, and click-to-highlight jump.
6. **CPI & Event Timeline inspection**:
   - The audited Math Lab publication supplies 140 CPI episodes and fixed H240 / SL 1 ATR / TP 1 ATR results.
   - The bottom dock opens on six compact CPI rows and a release-change summary. Title, Before CPI / At CPI / After CPI / On chart tabs, date, search, release count, pagination, Filters, Window and Info share the header; separate browse/pagination strips and repeated release banners are removed. At narrower dock widths search opens in a popup and controls wrap. Full release/entry timestamps and research identity remain in Info. Browse one date at a time, search across all dates in a tab, or page through at most eight release headers. Before/After start with the nearest date to CPI.
   - Inflation summaries remain visible with readings collapsed: US CPI/PPI/PCE and euro-area CPI use explicit headline/core catalog IDs, with separate m/m and y/y changes and sums in percentage points. Both higher/lower, unchanged and mixed states describe A−P versus exported Previous, not Forecast or market surprise. Headline includes core, so their sum is descriptive arithmetic, not an official inflation aggregate or an impact score. German CPI/HICP changes stay separate. Missing constituents, duplicate series/reference months, incompatible periods/units or inconsistent arithmetic produce Incomplete; original values and revised Previous remain inspectable. No sums combine countries, publication times, inflation families or periodicities.
   - Policy decisions show the exported Fed decision-rate change or the ECB deposit-facility rate change in basis points (Hike/Hold/Cut). Other ECB rates remain in the readings and are not added together or substituted for the deposit rate. Calendar commentary, speeches, projections and meeting text receive no invented numerical guidance score. These presentation summaries preserve all reviewed signals, outcomes, price levels and source hashes.
   - EURUSD Filters opens with a Director-approved Most relevant preset: four category controls per currency. USD order is monetary policy, inflation, labor, growth/activity; EUR order is monetary policy, inflation, growth/activity, labor/wages. Categories select related report families together; Customize exposes individual families. German inflation and German/French PMIs sit inside their relevant EUR category, without a separate country-selection step. More context starts collapsed and contains searchable supporting families, including policy minutes/accounts, claims and other national releases. Priority guides review rather than guaranteeing realized price impact; MT5 importance and outcomes do not determine it. The snapshot does not reliably identify flash/first versus final stages, so all recorded updates of selected families remain inspectable. Coverage details also disclose partial fiscal/geopolitical coverage.
   - Previous default filters upgrade to Most relevant; explicit custom/All releases preferences, existing symbol selections and saved national-family defaults are preserved. Most relevant explicitly restores the approved preset; Custom selection and All releases retain the editable shortlist. A saved family remains editable with a zero count when absent from the episode. Other currencies retain their existing separate controls; priority categories are implemented only for EURUSD. Same-time companions share a release while original source rows and distinct policy announcement times remain intact.
   - Apply filters both the list and chart visibility; Apply & mark releases also adds valid timed events in the current window. Hidden marker selections remain saved and reappear when their currency/family is shown again. On chart lists visible marked releases. Tabs, dates and search only navigate the list. Filter drafts are discarded on dismissal; applied selections persist locally. Window controls before/after observed H1 candles without changing reviewed outcomes.
   - Tick a release and choose Star, Sun, Cloud, Umbrella, Snowflake or Moon to mark it on the pinned H1 chart. Symbols Configure is collapsed in Filters. Base symbols are blue, quote symbols purple, with lighter colours in dark mode; red/green direction badges and CPI arrows retain their meaning. Mixed clusters show both currency colours, and popup entries include currency labels. Hover for readings; click to jump to its tab/date/page and open its table. Tentative/date-only events remain visible in the dock without an invented exact-time symbol.
   - Before/after selectors change the displayed candles and surrounding events, independently of the published trade horizon. Symbol choices are stored per research identity and episode in this browser, with remembered family defaults. Personal audit notes use the same research/episode ownership and can be exported as Markdown.
   - This feature annotates reviewed data; it does not calculate new outcomes or change signals. See [Fyodor Workspace](Fyodor%20Workspace.md) for project boundaries.

---

## Inspector

The **Inspector** bottom dock inspects EURUSD monetary policy, inflation, labor/wages and growth/activity releases independently of Criterion's historical episodes. Its header contains the selected pair, a compact date-range button, and Filters. The date button opens a picker centered horizontally over Inspector, above its header where space permits or below when needed. It stays within 16-pixel viewport margins, recenters during dock/window resizing and scrolls in small viewports. Adjacent monthly calendars, month/year navigation and editable From/To dates remain available. Today, Previous week, This week, Next week, This month and Year to date presets update immediately. Choosing the second calendar date applies the completed range immediately, including reverse selections and same-day ranges; no Apply/Cancel buttons are used for dates. Valid From/To edits also apply immediately; incomplete/invalid edits retain the last applied range and show an explanation. End dates are inclusive. Escape, outside interaction and the close button dismiss the picker without reverting completed changes.

The centered Filters modal contains all four categories for EUR/USD, configurable weather/nature symbols, and Show symbols on chart. Search sits beside that toggle and matches family names, categories, currencies and base/quote labels. It changes visible families without changing hidden checkbox selections. Category checkboxes still affect the whole category, including hidden matches. Clear search restores the full list; no results is explicit. Its family list scrolls while the header and Apply/Cancel controls remain accessible. Apply saves the whole filter draft locally; Cancel, Escape and backdrop dismissal discard it. Search text is temporary and does not become a release-data filter.

Inspector includes 21 families:

| Category | EUR | USD |
| --- | --- | --- |
| Monetary policy | ECB policy; ECB President remarks | FOMC; Fed Chair remarks |
| Inflation | Euro-area CPI; German CPI/HICP | CPI/core CPI; PCE; PPI |
| Labor / wages | Employment/unemployment; wage/labor costs | Jobs report/NFP; jobless claims |
| Growth / activity | GDP; euro-area, German and French PMIs | GDP; retail sales; ISM manufacturing/services |

Family selection includes every mapped reading, regardless of MT5 importance. The original all-enabled nine-family default upgrades to all 21; existing custom selections, saved symbols and Show symbols preferences are preserved. New families remain selectable for custom users. Enabled symbols follow the date range and remain active when the dock closes. Clicking a symbol opens Inspector and selects that exact release; nearby symbols use a release chooser. The chooser closes when its anchor leaves the chart viewport and stays closed when panning back; the selected release table stays open. Only a containing observed candle qualifies on the selected timeframe; uncertain/date-only times and releases without a containing candle remain inspectable in the list without a timed symbol. Other pairs keep their existing Calendar preview.

Release tables show **Series, Actual, Previous and A−P** only. Delta sums remain deferred. NFP alone has the experimental majority direction described below. Percentage-reading changes use percentage points, policy rate changes use basis points, and index/count/hour readings retain their own units. A−P uses supplied Previous with revised Previous shown separately. Missing numeric readings remain missing; policy commentary without numerical readings shows Not applicable. Reference periods and revisions remain visible, and separate policy commentary does not merge into a rate decision. Jobs reports place NFP first, then unemployment/participation, earnings, hours and payroll components. Euro-area unemployment remains separate from employment even at a coincident release time. Quarterly PCE readings accompanying GDP remain in the GDP family rather than merging with monthly PCE. Calendar coverage/freshness and unsupported-pair states are explicit. Calendar responses from canceled requests or previous publisher generations cannot replace the current readings.

**US Jobs report / NFP only:** A−P cells additionally show green Good, red Bad or gray Unchanged/Missing labels, with a per-reading rule explanation on hover. A compact tally counts every displayed reading equally versus supplied Previous: Good / Bad / Unchanged, plus Missing/Unrated when present. Higher payrolls, participation, earnings and weekly hours are Good under the agreed simplified convention; lower Unemployment Rate and U6 are Good. Zero is Unchanged; unavailable deltas are Missing. The experimental **NFP majority rule** shows **EURUSD Short** when Good > Bad, **EURUSD Long** when Bad > Good, and **EURUSD Neutral** when equal. Unchanged does not vote. Direction requires exactly one usable reading for each of the ten defined series; absent, missing, unrated or repeated series show **Incomplete** while retaining the available tally. The October 2, 2026 example is **2 Good · 7 Bad · 1 Unchanged · 10 readings → EURUSD Long**. January 10, 2025 (4/3/3) and February 7, 2025 (5/4/1) both map to Short. Direction badges use red Short, green Long and gray Neutral/Incomplete in light/dark themes. This is an experimental rule output with overlapping votes, not an established strategy or confidence probability. Other families keep their numeric deltas without inheriting these rules. Definitions and scope are organized by currency/category/family in [Event Grading Terminology](frontend/src/inspector/Event%20Grading%20Terminology/README.md), starting with [USD Labor / NFP](frontend/src/inspector/Event%20Grading%20Terminology/USD/Labor/NFP.md).

Inspector starts at 380 pixels high, bounded by the viewport. Drag its top separator to resize; the preferred height is saved locally. The focused separator also accepts Up/Down and Home/End. Compact inflation tables place headline/core monthly readings before headline/core annual readings. A shared reference period appears once above the table; differing periods remain on their rows. Hide releases expands the table horizontally, and the information button explains A−P units without a permanent footer. The selected release shows **broker time and Display time side by side**. Display follows the existing chart setting (local workstation, UTC or fixed UTC offset), converted from the established UTC release instant rather than adding an offset to broker time. Unknown clocks show unavailable. For January 10, 2025 NFP, this means 15:30 broker / 20:30 Jakarta / 13:30 UTC. Clock changes retain selection, values and marker placement. This selected-release presentation does not change the chart-axis formatter.

Inspector requests, grouping, preferences, selection and presentation arithmetic live independently in `frontend/src/inspector`; the shell composes its hook, panel and chart overlay. Inspector reads the selected broker's persistent calendar through `/storage-api` (Vite proxies this to port 8002). Date ranges, tables and symbol tooltips use the **native broker candle clock**. Historical and recent symbols come from storage independently of Publisher V2's DaysBack window. Storage derives UTC using each observation's retrieval offset, then applies the historical broker offset for chart placement. Original exported timestamps and values remain unchanged. Releases without established chart timing remain selectable in the list. Pending coverage, offline publishers and collection errors are visible. Published Criterion research signals, sums, outcomes and source artifacts are unchanged.

Manual Inspector audit:

NFP alone also has an **A−P magnitude · History** column: a reusable miniature
histogram per series, using earlier stored readings from January 1, 2015.
Gray bars count absolute changes; the colored bin contains the selected reading's
magnitude. Empty selected bins use an outline rather than an invented count.
Visible percentile/count labels and P50/P75/P90 ticks accompany a structured
hover/focus detail card. Extremes stay in a separate Tail bin. History is independent of the chart
date range and excludes the selected/future releases. The majority direction
is unchanged. See [the component/history contract](frontend/src/inspector/magnitude/README.md).
**Restart storage after updating** to enable the additive series-filtered query;
the bridge and Publisher V2 need no changes.

1. Start `pnpm dev:all` with V2 attached. On EURUSD, open Filters: both currency columns should contain all four categories. At your actual window size and zoom, scroll the family list and confirm Show symbols and Apply/Cancel stay reachable; inspect light/dark themes and a narrow window.
2. Toggle Labor / wages or Growth / activity for one currency, customize one family symbol, then Cancel. Reopen, Apply those changes and reload: only applied changes should persist. A partially selected category should look indeterminate. Existing custom selections should remain custom after the expansion.
3. Set Custom to October 2, 2026, select US Jobs report / NFP, and verify all ten rows are reachable by resizing/scrolling. NFP leads; payroll deltas use k, unemployment/earnings use pp, and hours use h. Compare the displayed Actual, Previous and revised Previous with your MT5 calendar. The local October 3 storage snapshot has NFP A−P −133k, unemployment +0.1 pp and hours 0 h; later corrections may update readings.
4. Inspect claims, euro-area employment/unemployment, wage costs, GDP, retail, ISM and national PMIs. Check long labels, mixed reference periods, revisions and table alignment. Missing numeric PMI readings should show — rather than Not applicable. Country labels should distinguish EU/DE/FR PMI releases.
5. Click live labor/growth symbols, including crowded release choosers; change timeframe and pan the anchor outside the viewport. The chooser should collapse without following you or reopening on re-entry; the selected table should remain. Check that enabling/disabling symbols visually matches the applied filters.
6. Set Custom to January 1–31, 2026 with Show symbols enabled. On D1, January should contain symbols on loaded release days. On H1, inspect January 9 NFP: its 13:30 UTC release belongs to the 15:00 broker candle, with 15:30 broker time in the table and tooltip. The summer-captured raw inventory says 16:30; that raw export clock is preserved separately. Check March 11 CPI at 14:30 broker time and April 3 NFP at 15:30 to audit the US/EU DST mismatch. Changing appearance time settings must not alter Inspector's broker-clock labels or placement. Older dates, including 2015, should show symbols once their containing candles load; date-only events, weekends without candles and future events without candles remain list-only. Switch dates/pairs rapidly and confirm no old-range or wrong-pair table flashes; another pair should show the EURUSD-only message.
7. Resize the dock, reload and confirm height persistence. Check Filters keyboard focus/Escape and backdrop dismissal in your browser. Temporarily stop storage, confirm a visible error and retained already-loaded readings, then restart it and verify recovery. Observe a real publisher update refresh the selected table without changing selection.
8. Search `USD NFP` beside Show symbols. Only Jobs report / NFP should match; toggling it and clearing search should preserve all hidden selections. Check no-results and Cancel/Apply behavior. Search a category/currency and confirm its category checkbox still controls the whole category.
9. For the October 2, 2026 NFP example, confirm **2 Good, 7 Bad, 1 Unchanged, 10 readings**, green Participation/U6, red Unemployment despite its positive delta, gray unchanged hours, and readable hover rules. Check missing values stay Missing and a real update refreshes colors/counts. CPI and other families should retain plain A−P cells. Check light/dark contrast and all labels after resizing.
10. Open the new date picker at the actual dock height. Check it stays within the viewport, presets apply immediately, reverse/two-click and same-day ranges work, From/To edits apply without buttons, invalid edits keep the current results, and month/year selectors reach 2015 directly. Check calendar keyboard arrows/Home/End/PageUp/PageDown, Escape focus return, outside dismissal and narrow-window scrolling. Changing dates must update both list and symbols consistently.
11. Select January 10 and February 7, 2025 NFP: both majority labels should say **EURUSD Short · NFP majority rule · Experimental**. October 2, 2026's supplied 2/7/1 example should say Long. Check the direction and tally remain readable at your dock height, and hover explains the rule. Incomplete releases must say Incomplete; other families must have no majority direction.

12. Select a 2025/2026 NFP release with the visible chart range restricted to that month. Its magnitude plots should still use earlier history since 2015. Hover or keyboard-focus each plot for a structured card with native units, percentile and earlier observation dates; Escape and scrolling should close it. Check the colored bin matches the row grade, the visible Pxx badge and earlier-reading count are readable, and gray bars/subtle percentile ticks remain clear in both themes. Tail identifies overflow; empty selected bins use an outline. Check the wider column at your preferred dock size, table scrolling/resizing, and switching NFP/CPI: only NFP has this column. October 2, 2026 has 140 earlier readings per series, versus 141 releases including itself. An early 2015 release can have few/no usable earlier readings; coverage gaps must say Partial history. Upcoming readings can show gray history without a selected bin or rank.

Automated checks cover production hook/component behavior, family identities, grouping, preference migration, unit formatting, incoming readings, cancellation, polling, chart-position callbacks, historical timing migration, DST, midnight date boundaries, series-filtered pagination and NFP magnitude cutoffs/distributions. The visual layout, native browser focus/scrolling, actual chart gesture alignment and a future real MT5 release require the manual audit above. This timing integration upgrades storage to 1.1.0/schema 2; restart storage after updating. Publisher V2 and the frozen bridge require no changes.

## Quickstart

### 1. Install a cloned repository

Use Windows with MT5, Python 3.11–3.13, Node.js 20.19+ (or 22.12+) and pnpm. From the repository root:

```powershell
python -m venv bridge/.venv
bridge/.venv/Scripts/python.exe -m pip install -e ./bridge
pnpm install --frozen-lockfile
pnpm --dir frontend install --frozen-lockfile
```

The calendar storage service uses Python's SQLite library and the already installed FastAPI/Uvicorn runtime. It is a separate application under `storage/`; it does not modify or import the frozen bridge implementation.

### 2. Optional first-time calendar export and import

A clone contains service code and MQL5 programs, but not your local calendar inventory/database. Choose either an initial export/import or automatic background history download by Publisher V2.

For the quicker export/import path:

1. Copy `bridge/mql5/Active/FyodorResearchExporterV4.mq5` (or its supplied `.ex5`) into your MT5 data folder's `MQL5/Scripts`. Compile the source with MetaEditor if needed.
2. Run the script on a chart. Load the supplied `FyodorCalendarSeedEURUSD.set` preset from its Inputs dialog, or set the values below. The preset exports calendar records only; live candle history remains supplied by the bridge.
3. Wait for successful completion. This is a one-time script and exits when finished. Its completion dialog identifies the generated folder. With `SaveToCommonFolder=true`, it is under MT5's shared `Terminal/Common/Files` directory.
4. Import that whole export folder, keeping its file names unchanged:

```powershell
pnpm storage:import "C:\path\to\FyodorCalendarSeed_v4_..._server" --dry-run
pnpm storage:import "C:\path\to\FyodorCalendarSeed_v4_..._server"
```

| Exporter input | Calendar-only first-time value |
| --- | --- |
| `ExportCalendar` | `true` |
| `ExportRequestedBars` | `false` |
| `CalendarCurrencies` | `USD,EUR` |
| `RequireExact28PairSet` | `false` |
| `CalendarFromDate` | `2015.01.01 00:00:00` |
| `CalendarToDate` | `0` — the export-time server cutoff |
| `SaveToCommonFolder` | `true` |

Importer validation requires a completed v4 calendar export, consistent counts/identities, no reported calendar query failures and the four files `manifest.csv`, `calendar_events.csv`, `calendar_releases.csv`, `calendar_currencies.csv`. It prints file counts/bytes before copying, verifies copied SHA-256 hashes, and commits the EUR/USD rows transactionally. Reimporting the same export is safe. Research candle files are not needed or copied. The supplied research exporter stays at v4.0.0 with schema 4.0.0.

The owner's existing seed was queried from January 1, 2015 through **September 28, 2026 at 02:19:36 broker-server time**, with 76,714 EUR/USD release records. That local inventory is gitignored and does not travel with a clone. Its source broker is `Elev8-Demo2`; another broker is stored separately and can bootstrap its own inventory.

To skip the exporter, proceed directly to Publisher V2. Empty storage downloads available EUR/USD calendar history from 2015 gradually, prioritizing recent and future dates. Progress appears in storage health/status and MT5's Experts log. Inspector displays completed stored ranges while the remaining history downloads.

### 3. Configure Publisher V2 in MT5

1. Copy `FyodorCalendarPublisherV2.mq5` **and** `FyodorCalendarStorageV2.mqh` from `bridge/mql5/Active/` into the same folder under MT5's `MQL5/Experts`, then compile V2 with MetaEditor. Alternatively use the supplied `FyodorCalendarPublisherV2.ex5`.
2. In MT5 **Tools → Options → Expert Advisors → Allow WebRequest for listed URL**, add both `http://127.0.0.1:8001` and `http://127.0.0.1:8002`.
3. Attach **only one** Publisher V2 instance. Remove the original Publisher V1 first; concurrent publishers compete for the bridge's single publisher generation. Retain V1 for rollback.
4. Leave the defaults initially: `SnapshotDaysBack=30`, `SnapshotDaysAhead=60`, `StorageUrl=http://127.0.0.1:8002/api/v1`, `EnableAutomaticBackfill=true`. Set `FYODOR_MT5_TERMINAL_PATH` before launching if several MT5 installations are present.

Publisher V2 is v2.0.2 (`#property version "2.02"`). Its live bridge envelope remains protocol v1. Storage accepts v2.0.0 through v2.0.2 during upgrades. The original publisher and Python bridge stay unchanged. The programs contain no order/position operations. To upgrade an attached V2, remove it, replace its compiled `.ex5` (or copy the updated `.mq5` and companion `.mqh`, then compile), and reattach it. Completed storage batches are retained.

### 4. Launch Terminal
```powershell
pnpm run dev:all
```

This concurrently boots:
* **MT5 Bridge** on `http://127.0.0.1:8001`
* **Calendar Storage** on `http://127.0.0.1:8002`
* **Terminal UI** on `http://localhost:5173`

Open `http://localhost:5173` in your browser. If an older `dev:all` session is running, stop it and relaunch to include storage.

After setup, normal use requires the local processes and Publisher V2. Storage persists while the browser is closed. Startup snapshots remain recent; the storage service requests missing date intervals automatically, including absences longer than DaysBack. Only MT5-available records can be recovered; missing Actual values stay missing.

```powershell
pnpm storage:status
pnpm run test:storage
```

Storage health is also available at `http://127.0.0.1:8002/api/v1/health`, with publisher freshness, counts, completed batches, missing intervals and pending/retrying jobs. `pnpm run dev:storage` starts storage by itself.

### Calendar storage and recovery contract

Tracked service code lives under `storage/`. Runtime data lives under gitignored `storage/data/`: the SQLite database, copied inventory and generated import hashes. Back up that directory with the storage process stopped; a Git clone is not a database backup. `FYODOR_STORAGE_DATA_DIR` can select another data directory; `FYODOR_STORAGE_PORT` changes the service port and requires the corresponding Publisher V2 URL/WebRequest setting.

The service reads the bridge's existing health/calendar endpoints when a registered V2 publisher's feed changes. It preserves archive and changed observations, deduplicates by broker/value identity, and exposes the latest accepted rows. A completed query that no longer returns a previously stored record marks it `not-returned-by-latest-query`, preserving its history rather than treating it as a confirmed current release or inferring cancellation. Newer live observations are protected from an older query. A later fetch of an older bridge snapshot cannot overwrite a newer backfill/live observation. Archive imports cannot replace accepted network updates. Broker identity comes from the export's `account_server` and V2's `ACCOUNT_SERVER`.

Backfill jobs are currency-scoped, half-open date intervals, initially at most seven days. V2 performs one history query or one chunk transfer per timer tick after live work, caching event/country metadata. Storage acknowledges coverage only after every chunk validates and commits; empty successful queries count as queried dates. Failed queries remain pending with backoff. Other uncovered dates proceed while a job cools down, with its interval reserved to prevent duplicate jobs. Timeout, memory, internal and out-of-range failures reduce requests down to a minimum of one day; unresolved dates remain explicitly incomplete. V2.0.1 logs out-of-range value/event identities and timestamps separately from metadata errors, and transfers only the returned array count. Interrupted transfers resume by retrying the uncompleted batch; acknowledged date batches survive process restarts. Recent/future coverage expires daily for reconciliation, so a schedule snapshot does not permanently certify released readings. Older historical coverage remains stored.

Backfill uses storage endpoints directly, never the bridge's live snapshot endpoint. V2.0.2 requests complete broker days around each job and trims the successful result to its exact half-open interval: MT5 may otherwise return an all-day holiday earlier than an intraday query boundary. Only in-range rows count toward the atomic transfer; rows outside even the padded query still cause a diagnostic failure. History queries and WebRequest are synchronous, so a slow query can still delay that EA's own polling; small batches reduce the amount of work per turn. A stopped collector cannot capture every intermediate update between observations, but reconciliation refreshes the latest MT5 readings when collection resumes.

All raw calendar timestamps retain their original **broker-server clock**. The default API query (`time_basis=raw`) retains raw-date ordering and null `release_at` for compatibility. Inspector requests `time_basis=chart`: dates and pagination then use the native candle clock, with derived UTC `release_at` in milliseconds and `chart_time_seconds` in seconds. The separate `event_timing` table records the capture offset, timing basis and chart profile; raw observations are immutable. Migration restores archive offsets from their export manifests and legacy backfill offsets from lease clocks. Legacy live observations use the explicitly configured broker profile at their observation date. New observations record the actual publisher offset, including the offset leased for each backfill batch. A publisher restart or change in its recent window does not erase established history or change a selected release's UTC identity.

`storage/calendar_clock.py` explicitly configures **Elev8-Demo2** as EET/EEST (UTC+2 winter / UTC+3 summer, EU transition rules, supported years 2015–2031). This profile is inferred from the actual 2025/2026 native EURUSD trading sessions and checked against the broker's EET/EEST description; it is not inferred from the user's PC timezone. EU transitions follow [Directive 2000/84/EC](https://eur-lex.europa.eu/eli/dir/2000/84/oj/eng/pdf). Unknown broker identities have no guessed historical chart offset: their readings remain inspectable, with an explicit missing-timing message. Before adding another broker to `PROFILES`, verify its native candle clock and historical DST rules. Audit Elev8 candle alignment after the next DST change; a broker schedule change requires updating this explicit profile. No Python bridge dependency or MQL5 rebuild is required for this display conversion.

Storage supplies a persistent data `revision`; Inspector checks page revisions before displaying a completed range, cancels obsolete requests and polls for updates every ten seconds. Chart-date coverage uses each import or completed batch's retrieval clock, including empty queried dates; intervals without recoverable clock evidence remain conservative around their boundaries. Rows absent from a later successful query remain in storage as evidence but are excluded from the current Inspector release list.

For future consumers, `GET /api/v1/calendar` on port 8002 accepts `source_id`, `from_server_seconds`, `to_server_seconds`, optional `currency`, and a bounded `limit` (maximum 5000). Responses include origin, raw scaled values when available, missing intervals and an `after_time`/`after_id` continuation cursor. API schemas are available at port 8002 `/docs`.

Manual MT5 acceptance: confirm V2's live bridge snapshot/heartbeat still works; observe a completed backfill in Experts and storage health; interrupt/restart during a batch and check recovery; stop storage and confirm the live bridge continues; check a known release's units, Previous/revised Previous and raw server time. Automated storage tests cover restart/lease recovery, interrupted chunks, lost commit acknowledgements, validation, long absences, exact raw values, stale-source ordering, imports and real HTTP endpoints.

If the repository has been moved or `dev:all` reports that `vite` or a Node package cannot be found, repair both local dependency trees before launching again:

```powershell
pnpm install --frozen-lockfile --force
pnpm --dir frontend install --frozen-lockfile --force
pnpm run dev:all
```

The root and `frontend` each have their own lockfile and `node_modules`; installing only the root dependencies does not install the UI.
