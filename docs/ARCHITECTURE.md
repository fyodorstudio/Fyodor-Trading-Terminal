# Architecture

## Services

The React/Vite frontend uses loopback APIs for the MT5 bridge (8001), storage
(8002) and independent alarm worker (8003). Vite proxies `/storage-api` to storage.
The bridge supplies market data and calendar transport; storage owns persistence.
`FYODOR_BRIDGE_API_URL` and `FYODOR_STORAGE_API_URL` configure proxy targets.

## Frontend

| Module under `frontend/src/` | Responsibility |
| --- | --- |
| `terminal-shell`, `workspace-docking` | Chart workspace and panels |
| `market-data` | OHLC, Market Watch, chart navigation, drawings and indicators |
| `economic-calendar`, `inspector` | Event catalogue, filters, release packages and raw readings |
| `alert`, `events-alarms`, `price-alerts` | Calendar reminders and price notifications |
| `currency-ledger`, `currency-details`, `wildcards` | Timeline, metric comparisons and global manual events |
| `heatmap` | Returns, synthetic baskets, rankings and wildcard notes |
| `news-flow` | Right-panel RSS/Atom reader, provider setup and headline filters |
| `entry-trade` | Manual plans and journal |
| `appearance`, `system-connectivity`, `system-observability` | Theme, clocks, connection state and Activity |

Features support USD, EUR, GBP, JPY, CHF, CAD, AUD and NZD and their 28 FX pairs.
`config/chart-currency-scopes.json` also maps supported indices and other symbols.

Chart navigation retains a date window across pair and timeframe changes. Price
bounds are remembered per broker/instrument and shared across its timeframes,
including empty loading states. A new instrument inherits proportional price zoom
and position; revisiting one restores its own bounds. Explicit navigation and
Refocus replace the view. The native minimum candle span can temporarily widen a
very narrow higher-timeframe view; the original date target survives the return.

## Storage

`storage/persistence/schema.py` defines the SQLite calendar schema. Its tables
include sources, events, observations, coverage, jobs and event timing.
`storage/calendar_store.py` exposes the calendar store. The default database is
`storage/data/calendar.sqlite3`; `FYODOR_STORAGE_DATA_DIR` changes the data directory.
SQLite uses WAL mode.

Global Wildcards are stored in `storage/data/wildcards/wildcards.json`.
`storage/wildcards.py` provides revision-checked, atomic CRUD at `/api/v1/wildcards`.
An entry has a title, details, optional source URL, Jakarta date and optional UTC
timestamp. Entries apply to all instruments and brokers. The first read migrates
current manual News and broker wildcard notes; their original files remain intact.
Identical broker notes merge into one global entry. Backup/restore includes the
shared store and legacy files.

`frontend/src/wildcards/` owns the shared state and editor. The dock, chart icons,
Heatmap cells and Detail all use that state. Drawing-toolbar placement converts the
selected candle into a saved UTC timestamp. Chart timeframe changes regroup icons
without changing saved times. Heatmap groups timed entries by broker candle day;
date-only entries retain their entered date.

Fed readings and alarm state use local data subdirectories.
News Flow is isolated in `frontend/src/news-flow/` and `storage/news_flow/`.
The storage service collects free starter feeds independently of MT5 and the
panel, using conditional requests, one-second success cadence and error backoff.
Providers/current headline cache live in `storage/data/news-flow/news.sqlite3`,
included in offline backup/restore. No article-version archive is built.
News Flow Extended View uses provider tabs plus Browse/Priority/Settings.
Shared classification is All/Included/Excluded: Include matches without Exclude
matches are Included; the complement is Excluded, including unmatched titles.
Colour labels remain in All. Browser tag preferences use word boundaries and
currency-pair normalization; the matching backend rules live in `rules.py`.
Explicit Japan/Japanese and Democrat/Democrats/Democratic variants apply to both
classifiers and alerts. Tag inputs narrow existing labels while typing and save
pending valid tags when focus moves outside the editor. The panel has a provider
checkbox selector and debounced literal headline search; source/date/keyword and
search scopes apply before backend counting/deduplication/pagination. Row actions
are top-right icons. A separate 15-second UI clock updates relative ages without
feed changes; missing/future publication times display labelled first-collection
ages and retain the feed time in the tooltip. The calendar icon is an overlaid
native date input, opening directly without a collapsible form; an active date
chip clears the scope. Provider labels keep their native checkbox activation
through transient null-focus transitions, and the full row is a padded target.
A workspace-level listener plays optional built-in keyword sounds using a live
arrival cursor. Startup snapshots, history imports and duplicate URLs stay silent.
Provider polling defaults to 1s with per-source overrides and persisted retry
and next-fetch deadlines. Refresh/edits/restarts preserve cooldowns. Priority
combines explicit per-URL SQLite stars and conservative feed-text preview
candidates; no article-body extraction or generated odds. Headline actions open
the existing manual Wildcard editor with original publication time (or labelled
collection-time fallback). Chart markers bridge nearby market gaps to real
candles without altering stored event times. Extended modal state is retained
while the existing Wildcard editor owns focus.
Historical lookup uses scoped Google date queries for starter RSS providers and
Treasury's official yearly announcement index, with exact UTC window filtering,
shared per-provider locks and cached outcomes. Custom unsupported feeds explicitly
report cached-only results. Heatmap's daily shortcut opens News Flow using
historical broker-session UTC bounds, with source/keyword selections preserved.
See the feature READMEs in those folders for entry points and test commands.
`storage/run.py` provides service, import, status, backup, restore and Fed-data
commands. Manual trade journals retain their existing application path.

## Clocks and calendar

The UI defaults to Asia/Jakarta (UTC+07:00, AM/PM). Publication timestamps and
broker candle coordinates are separate fields. Historical broker offsets are
configured in `config/broker-clock-profiles.json`. Date-only events have no exact
publication timestamp. Calendar measure definitions are in `config/calendar-measures.json`.
Detail groups calendar readings into Monetary policy, Inflation, Labor and Growth.
Ledger and Detail use the same selected time. Detail's cursor-follow mode batches
hover updates by animation frame; clicking pins the candle time. Its Wildcards
section shows the selected day during hover, or the preceding seven days when
pinned, excluding entries after the selected time. Date-only entries become
eligible at the end of their Jakarta date.

Manual calendar corrections live in `config/calendar-overrides/*.json` and are
applied by `storage/calendar_overrides.py` when reading calendar and Ledger data.
Each file identifies a currency, country and MT5 event ID; each release identifies
its value ID and the fields to replace (`actual`, `forecast`, `previous`,
`revised_previous`, or `released_at`). Omitted fields keep their MT5 values;
`null` clears a numeric field. Release timestamps include their timezone and are
converted to each broker's chart clock. Raw SQLite records stay unchanged.
Restart storage after editing these files. The RBA history uses the supplied
Investing.com table, with pasted times interpreted as Asia/Jakarta.
Eurozone CPI corrections cover the 21 release dates in 2026 through 4 November,
using Eurostat's release-specific HICP tables. Each corrected release links to its
official table. Older CPI history has not been verified by these correction files.

## MFDI

Implementation: `frontend/src/market-data/indicators/macro/`.
The exact calendar catalog supplies numerical series and selectable announcements.
One browser configuration applies across instruments. Currency tabs choose the
active event list and restore its axes, lane order, spacing, folded/hidden groups,
and visibility of the shared announcement/Wildcards row. Category definitions and
colors are shared across currencies. Custom categories support editing and hiding.
Duplicate category names and former standard-category IDs are merged with their
saved assignments, colors and references in every currency view.

Series owns event selection, removal, row appearance and category organization.
Pointer and keyboard handles reorder rows/categories; chart lanes follow the same
order. Hidden rows and empty categories consume no lane height. Folding a group
only folds its drawer list. Category visibility retains individual eye choices.
Lane dragging and the scrollbar share one bounded vertical position; legacy free
offsets are folded into that position. The lock enables group dragging in both
views. Blank-space clicks restore the lock and clear Series highlights. Numerical
plots retain independent scales and linked-axis navigation. Layout-only updates
reuse plotted data and leave the shared time window alone. Divider gestures are
excluded from price panning, hold the price/date view, and persist final MFDI
placements after release. Pointer redraws are batched by animation frame; lane
geometry and Series controls are refreshed only when their inputs change.
UI listeners and timers are cancelled on scope changes
and removal. Appearance settings use drafts with OK/Cancel; working Series changes
persist immediately. `macro-essentials.ts` defines initial numerical selections and
catalog gaps. Initial announcement selections remain editable thereafter.

Actual values use filled rectangles; forecast values use outlined rectangles.
A spatial grid suppresses overlapping labels while preserving hoverable dots.
F controls historical and upcoming forecasts; N controls value text. Placement can
be inside rectangles or above markers. Category colors apply across currency tabs,
with individual series overrides. Appearance reset retains event selections and
visibility. The Settings window contains only global appearance controls.

The shared text row combines selected active-currency announcements with global
Wildcards. Its contents do not create numerical series. Actuals align to containing
chart candles. Policy rates carry forward; other series join released points.
The Fed supplement remains in `storage/fed_forecasts.py` and
`storage/data/fed-forecasts/`. `pnpm storage:fed-forecasts --help` lists its commands.

## Heatmap

Daily returns compare OHLC with the previous available D1 close; weekly returns
compare the week's OHLC with the preceding week's final close. Synthetic currency
baskets use equal-weight geometric returns across seven counterparts. Event-window
views use a fixed pre-window baseline. These calculations live in
`frontend/src/heatmap/`.

## Alarms

`storage/alarms.py`, `storage/alarm_service.py` and `storage/alert_subscriptions.py`
implement durable calendar notifications. Settings, selections and delivery history
live under `storage/data/alarms/`. Price alerts have independent browser settings.
Notifications operate while the worker and Windows are running. Alarm selections
refer to MT5 calendar release packages. Desktop notifications support opening
the terminal, sound control, snooze and dismiss.
