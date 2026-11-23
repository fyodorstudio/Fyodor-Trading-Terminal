# Architecture

## Services

The React/Vite frontend uses the MT5 bridge (8001), storage (8002), and alarm
worker (8003). Vite proxies their loopback APIs. `FYODOR_BRIDGE_API_URL` and
`FYODOR_STORAGE_API_URL` override the bridge and storage targets.
`pnpm dev:all` restarts the stack and the private phone-news services.

## Frontend

| Module under `frontend/src/` | Responsibility |
| --- | --- |
| `terminal-shell`, `workspace-docking` | Chart workspace and panels |
| `market-data` | OHLC, Market Watch, drawings and indicators |
| `economic-calendar`, `inspector` | Calendar catalogue, filters and release details |
| `alert`, `events-alarms`, `price-alerts` | Calendar reminders and price notifications |
| `currency-ledger`, `currency-details`, `wildcards` | Currency readings and manual events |
| `heatmap` | Returns, currency baskets and rankings |
| `news-flow` | Desktop and phone news readers |
| `entry-trade` | Manual trade plans and journal |
| `appearance`, `system-connectivity`, `system-observability` | Theme, clocks, connections and Activity |

Features support eight major currencies and their 28 FX pairs.
`config/chart-currency-scopes.json` maps other supported instruments.
Chart navigation retains dates across instruments/timeframes and remembers
price bounds per broker/instrument. Refocus returns to the latest candles.

## Storage

`storage/calendar_store.py` combines the modules in `storage/persistence/`.
The SQLite database defaults to `storage/data/calendar.sqlite3` and uses WAL.
`FYODOR_STORAGE_DATA_DIR` changes the data directory.

`storage/current_calendar.py` selects one current reading per series, publication
and reference period for Alert, recent/upcoming lists and reminder lookups.
Unavailable rows are excluded; revisions, available actuals, update time and
numeric value ID determine which duplicate wins. Different series and periods
remain separate. Existing reminders follow replacement IDs for the same release.
A fresh bridge snapshot can restore an unchanged reading marked unavailable;
an old cached row accompanying a delta cannot.

Global Wildcards use `storage/data/wildcards/wildcards.json` and
`storage/wildcards.py`. The shared editor and chart/dock integrations live in
`frontend/src/wildcards/`. Timed entries use broker candle dates on charts;
date-only entries keep their entered Jakarta date.

News Flow owns its collection, cache and phone delivery in `storage/news_flow/`.
Desktop/mobile code lives in `frontend/src/news-flow/`. See the
[backend guide](../storage/news_flow/README.md),
[frontend guide](../frontend/src/news-flow/README.md), and
[Android setup](../storage/news_flow/PHONE.md).

`storage/run.py` provides service, import, status, backup, restore and Fed-data
commands. The trade journal is saved under `Market Analyst Workflow/entry-trade/`
through `frontend/scripts/entry-trade-journal-plugin.mjs`.

## Clocks and calendar

The default display is Asia/Jakarta (UTC+07:00, AM/PM). Publication UTC and broker
candle coordinates are separate. Broker DST rules live in
`config/broker-clock-profiles.json`; date-only events have no exact timestamp.
Calendar measures are defined in `config/calendar-measures.json`.

Manual corrections in `config/calendar-overrides/*.json` are applied by
`storage/calendar_overrides.py`. Files identify currency, country, event ID and
value ID, with numeric replacements or a timezone-qualified `released_at`.
Omitted fields keep their values; `null` clears a number. Restart storage after
editing corrections.

The [calendar audit workflow](../config/calendar-overrides/README.md) compares
publisher evidence with MT5. Verified releases under `config/calendar-overrides/publisher/`
join the existing calendar read model and can appear in Inspector, MFDI and Alert
before a matching MT5 row exists.

Ledger and Detail share the selected chart time. Detail can follow the cursor
or stay pinned to a clicked candle.

## MFDI

`frontend/src/market-data/indicators/macro/` owns numerical series and the shared
announcement/Wildcards row. Currency tabs share one saved browser configuration.
Series controls selection, categories, order and visibility; Settings controls
appearance. Actuals use filled rectangles and forecasts use outlines. Numerical
series have independent price scales and share chart dates.

Fed forecasts are managed by `storage/fed_forecasts.py` and
`storage/data/fed-forecasts/`; use `pnpm storage:fed-forecasts --help`.

## Heatmap

Daily returns compare OHLC with the previous D1 close. Weekly returns compound
across the broker week. Currency baskets use equal-weight geometric returns
against seven counterparts. Basket high/low values are sampled from synchronized
M1 observations. `storage/heatmap_baskets.py` loads the visible sessions and caches
aggregates; `frontend/src/heatmap/` owns selection, ranking and export.
The dock and standalone ranking share the same calculations and instrument
navigation. Ranking animations respect reduced motion.

## Alarms

`storage/alarms.py`, `storage/alarm_service.py` and `storage/alert_subscriptions.py`
own calendar reminders. Settings and selections live in `storage/data/alarms/`.
Notifications need the worker and Windows running. Price alerts are browser-local;
see the [price-alert guide](../frontend/src/price-alerts/README.md).

News uses shared server-backed Off/Included/All settings and a publication-age
limit. Desktop audio/popups need the terminal page open; Android delivery runs
in storage through ntfy. See the News Flow guides for setup and tests.
