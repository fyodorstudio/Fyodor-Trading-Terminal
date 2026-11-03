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
| entry-trade | Manual plans, pins, independent chart arrows and tracked journal |
| price-alerts | Broker/symbol lines, local persistence, Bid monitoring and browser sound |
| research / storage/research_reports.py | Named date-range evidence exports for optional historical studies |
| appearance / system-connectivity / system-observability | Theme/time, bridge status and Activity |
| Market Analyst Workflow/tools | Focused calendar/report/OHLC helpers and news CLI |

## Currency News

Open Currency News in the bottom dock. All shows the eight currencies; individual
buttons focus a currency. Copy refresh prompt asks the agent to investigate the
selected publication window (default three hours). Run the prompt in the agent
chat. Reload saved news only reloads stored output. There is no automatic AI
schedule or news ingestion. Publication time, source-check time, older background
and coverage gaps stay distinct. Existing results keep their own lookback/time.
The date revolver opens on Today. Each currency shows its own latest refresh saved
on the selected Jakarta day; earlier versions are selectable in that row. Empty
dates keep the eight-row table. All/individual currencies filter the same records
without duplicate research. Past/future dates are browsing only; Today offers the
refresh prompt and lookback. Markdown exports preserve selected rows and source
clocks. History remains local and is included in storage backups.

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

## Preserved terminal behavior

Market Watch keeps favourites, sections/order and sorting. Daily % is the largest
signed excursion from the selected broker D1 open to its high/low; it is not the
current close change. Date navigation never borrows another day's candle.
The chart header retains high/low distances and indicative regional sessions.
Daily-candle reads attach only to the bridge's exact terminal/account, with
bounded caches; no login, symbol selection or broker changes.

Inspector Save shares selected families across pairs containing each currency;
icon style/grouping/colors remain chart-specific. The chart calendar toggle
controls event icons and External Source stars without changing selections.
All series, date-only/unknown times, unknown-ID admission, blank-chart dismissal,
future axis and saved drawings remain supported. Jakarta AM/PM is the display
default; publication UTC and historical broker/chart clocks remain independent.

Alert shows all captured events for a selected Jakarta date, including released
rows, with source-specific Actual/Forecast/Previous. Agent impact remains sourced
or Unreviewed; MT5 importance never supplies it. One bell controls each timed
release package. Browsing, news saves and filters do not change choices. Windows
must remain awake for the independent worker; delivery never invokes AI.
Manual price alerts remain independent.

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
