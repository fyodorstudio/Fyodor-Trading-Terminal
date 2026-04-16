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
- `POST /calendar_ingest`
- `WS /stream`

The bridge folder also now includes the MT5 companion EA script:

- `FyodorCalendarBridge.mq5`

Use that EA version if you want the bridge/app to preserve:

- real MT5 `countryCode`
- all `(event id, event time)` rows
- future blank schedule rows needed for next-event dates

The bridge also exposes health metadata the frontend relies on, including `last_calendar_ingest_at`, and it is now part of the app's trust-state story rather than just a passive candle proxy.

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
- dedupe rules for `(event id, event time)`
- ingest timestamp health behavior
- `history_range` validation
- market-status/session helper behavior
