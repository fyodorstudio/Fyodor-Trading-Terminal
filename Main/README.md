# Fyodor Trading Terminal - Main

This is the new Phase 1 app built in `C:\dev\Fyodor Trading Terminal\Main`.

It is a clean rebuild focused on 4 tabs only:

1. `Overview`
2. `Central Banks Data`
3. `Charts`
4. `Economic Calendar`

The goal of this app is to keep the chart workflow reliable, rebuild the calendar in a stricter way, and derive central-bank data directly from the MT5 economic calendar feed.

## What It Uses

- `React 18`
- `TypeScript`
- `Vite`
- `lightweight-charts`
- `date-fns`
- `lucide-react`
- existing local MT5 bridge HTTP/WebSocket API

## Data Source

This app does **not** use mock data.

It expects a working local MT5 bridge at:

`http://127.0.0.1:8001`

That bridge is expected to provide:

- `GET /history`
- `GET /symbols`
- `GET /server_time`
- `GET /health`
- `GET /calendar`

It also expects the MT5 EA calendar bridge to be pushing economic calendar events into that bridge.

## Main Behavior

- `Charts` keeps the live MT5 chart workflow and debug log, but shows `NO DATA` instead of fake candles when MT5 is unavailable.
- `Economic Calendar` is rebuilt from scratch and shows MT5 time first, local time second, plus strict live/stale/error states.
- `Central Banks Data` is auto-derived from MT5 calendar events using strict mapping rules for the major 8 currencies. If a match is uncertain, the UI shows `N/A` instead of guessing.
- `Overview` is intentionally blank for now and is reserved for the later calculator/dashboard phase.

## Run It

Recommended workflow from the repo root:

```bash
pnpm install
pnpm run dev:all
```

That starts MetaTrader 5, the vendored bridge in `Main/mt5-bridge`, and the frontend app together.

If you only want the frontend:

```bash
pnpm --dir Main run dev
```

Default frontend dev server:

`http://localhost:3001`

## Useful Commands

```bash
pnpm build
pnpm test
```

## Optional Config

If the bridge base URL ever changes, set:

`VITE_MT5_BRIDGE_BASE`

If not set, the app defaults to:

`http://127.0.0.1:8001`
