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
| `entry-trade` | Manual plans and journal |
| `appearance`, `system-connectivity`, `system-observability` | Theme, clocks, connection state and Activity |

Features support USD, EUR, GBP, JPY, CHF, CAD, AUD and NZD and their 28 FX pairs.
`config/chart-currency-scopes.json` also maps supported indices and other symbols.

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
The event catalogue maps exact calendar series to chart measures. The shared
browser configuration stores currency/event selection, styles, categories and
layout. Currency tabs restore independent axes and lane arrangements while
retaining each currency's selections and styles. Named presets include these views
and support JSON import/export. On first use after the MFDI essentials update,
the previous setup is saved as **Before MFDI essentials** and exact calendar
selections are added for all eight currency tabs. Subsequent removals are retained.
`macro-essentials.ts` defines the selections and current catalog gaps. Existing
selections and lane anchors remain; the update applies the category palette and
enables values for essential events. It never overwrites existing named presets.

Category colors apply across the working currency setups. Individual series can
override them, and newly selected series inherit their category color. Actual
values use filled rectangles centered on the plot; upcoming forecasts use outlined
rectangles. Style settings also offer labels above dots or dots alone. A spatial
grid suppresses overlapping value boxes while preserving their underlying points.
One optional non-numerical row combines the active currency's scheduled
speeches/announcements with global Wildcards. It belongs to Uncategorized by
default and uses the shared category ordering, lane movement, scrolling and saved
placement. Grouped dots show text tooltips and never create numerical series.

Actuals are plotted on their containing chart candles. Numerical plots use each
measure's own scale; lane view places them on straight rows. Forecast visibility
is independent per measure. The existing Fed supplement is implemented by
`storage/fed_forecasts.py` and stored in `storage/data/fed-forecasts/`.
`pnpm storage:fed-forecasts --help` lists its commands.

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
