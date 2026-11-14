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
| `currency-ledger`, `currency-details`, `currency-news` | Timeline, metric comparisons and saved news |
| `cross-asset` | Returns, synthetic baskets, rankings and wildcard notes |
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

Manual News entries are stored in `storage/data/manual-news/news.json`. The model
and CRUD operations are in `storage/manual_news.py`; the API supports GET/POST and
PUT/DELETE by entry ID at `/api/v1/currency-news`. Entries contain date, currencies,
title, details and an optional source URL.

Fed readings, wildcard notes and alarm state use local data subdirectories.
`storage/run.py` provides service, import, status, backup, restore and Fed-data
commands. Manual trade journals retain their existing application path.

## Clocks and calendar

The UI defaults to Asia/Jakarta (UTC+07:00, AM/PM). Publication timestamps and
broker candle coordinates are separate fields. Historical broker offsets are
configured in `config/broker-clock-profiles.json`. Date-only events have no exact
publication timestamp. Calendar measure definitions are in `config/calendar-measures.json`.
Detail groups calendar readings into Monetary policy, Inflation, Labor and Growth.
Ledger and Detail use the same selected date.

## MFDI

Implementation: `frontend/src/market-data/indicators/macro/`.
The event catalogue maps exact calendar series to chart measures. The shared
browser configuration stores currency/event selection, styles, categories and
layout. Named presets are separate snapshots with JSON import/export.

Actuals are plotted on their containing chart candles. Numerical plots use each
measure's own scale; lane view places them on straight rows. Forecast visibility
is independent per measure. The existing Fed supplement is implemented by
`storage/fed_forecasts.py` and stored in `storage/data/fed-forecasts/`.
`pnpm storage:fed-forecasts --help` lists its commands.

## Cross-Asset

Daily returns compare OHLC with the previous available D1 close; weekly returns
compare the week's OHLC with the preceding week's final close. Synthetic currency
baskets use equal-weight geometric returns across seven counterparts. Event-window
views use a fixed pre-window baseline. These calculations live in
`frontend/src/cross-asset/`.

## Alarms

`storage/alarms.py`, `storage/alarm_service.py` and `storage/alert_subscriptions.py`
implement durable calendar notifications. Settings, selections and delivery history
live under `storage/data/alarms/`. Price alerts have independent browser settings.
Notifications operate while the worker and Windows are running. Alarm selections
refer to MT5 calendar release packages. Desktop notifications support opening
the terminal, sound control, snooze and dismiss.
