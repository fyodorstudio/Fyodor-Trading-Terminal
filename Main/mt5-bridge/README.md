# MT5 Bridge

This is the local Python FastAPI bridge used by the new app in `Main`.

It exposes the MT5-backed endpoints the frontend needs:

- `GET /health`
- `GET /server_time`
- `GET /symbols`
- `GET /history`
- `GET /history_range`
- `GET /calendar`
- `GET /market_status`
- `GET /research/coverage`
- `GET /research/versions/current`
- `GET /research/versions`
- `GET /research/backtests/latest`
- `GET /research/backtests/{run_id}`
- `GET /research/forward`
- `POST /research/backtests`
- `POST /calendar_ingest`
- `POST /calendar_ingest_cycle`
- `WS /stream`

The bridge folder also now includes the MT5 companion EA script:

- `FyodorCalendarBridge.mq5`

Use that EA version if you want the bridge/app to preserve:

- real MT5 `countryCode`
- all `(event id, event time)` rows
- future blank schedule rows needed for next-event dates

The bridge also exposes health metadata the frontend relies on, including `last_calendar_ingest_at`, and it is now part of the app's trust-state story rather than just a passive candle proxy.

Calendar rows are stored durably in a local SQLite database rather than a 400-day in-memory list. Set `FYODOR_RESEARCH_DB` to override its location; the Windows default is `%LOCALAPPDATA%\Fyodor Trading Terminal\fyodor-research.sqlite3`.

The research endpoints own immutable Macro Signal versions used by Macro Signal Lab. Frozen v1 remains the failed Economy baseline; active `FMS-EURUSD-LABOR-H4-v2` uses country-aware exact-series identity and treats all pre-registration history as exploratory. Backtests run on a single background worker, reuse cached H4 candles, fetch M1 only when an H4 bar touches both stop and target, and never execute an order.

The EA posts `/calendar_ingest_cycle` only after all batches in a timer pass have been attempted. A successful zero-failure cycle lets the bridge freeze first-seen released values for the v2 forward-paper ledger; failed cycles never create paper candidates. The ledger advances outcomes in a separate background worker and is exposed by `/research/forward`.

## Normal Usage

You usually do not need to start this manually.

From the repo root, use:

```bash
pnpm run dev:all
```

That command launches MetaTrader 5, bootstraps this bridge venv if missing, and starts the bridge automatically.

The normal frontend/bridge contract is:

- candles and streams for `Charts`
- calendar rows and ingest freshness for `Economic Calendar`
- market-session status for `Overview` and `Charts`
- central-bank derivation source data for `Central Banks Data`
- historical range access for `Event Reaction Engine`
- durable calendar coverage and versioned EURUSD/H4 research for `Macro Signal Lab`

## Manual Usage

From `Main/mt5-bridge`:

```bash
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe -m uvicorn server:app --reload --host 127.0.0.1 --port 8001
```

## Tests

From `Main/mt5-bridge`:

```bash
.\.venv\Scripts\python.exe -m pytest tests
```

Current test coverage focuses on:

- calendar-ingest contract behavior
- durable `(event id, event time)` history and release-row updates
- ingest timestamp health behavior
- `history_range` validation
- market-status/session helper behavior
- frozen signal scoring, strict H4 entry timing, ATR risk, expiry, and ambiguous intrabar outcomes
