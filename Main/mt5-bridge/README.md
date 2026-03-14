# MT5 Bridge

This is the local Python FastAPI bridge used by the new app in `Main`.

It exposes the MT5-backed endpoints the frontend needs:

- `GET /health`
- `GET /server_time`
- `GET /symbols`
- `GET /history`
- `GET /calendar`
- `POST /calendar_ingest`
- `WS /stream`

## Normal Usage

You usually do not need to start this manually.

From the repo root, use:

```bash
pnpm run dev:all
```

That command launches MetaTrader 5, bootstraps this bridge venv if missing, and starts the bridge automatically.

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
