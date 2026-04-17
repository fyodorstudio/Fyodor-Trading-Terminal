# Fyodor Trading Terminal - Main

This is the active frontend app built in `C:\dev\Fyodor Trading Terminal\Main`.

The app is no longer a blank Phase 1 shell. It is now a live pre-trade briefing terminal built around:

1. `Overview`
2. `Central Banks Data`
3. `Charts`
4. `Economic Calendar`
5. `Specialist Tools`

`Specialist Tools` currently contains:

1. `Differential Calculator`
2. `Strength Meter`
3. `Event Tools`

The current product goal is to keep the app connection-first and honest: show what is live, what is stale, what is unresolved, and which market deserves attention right now without pretending to generate trade predictions.

## What It Uses

- `React 18`
- `TypeScript`
- `Vite`
- `lightweight-charts`
- `date-fns`
- `lucide-react`
- `motion` / `framer-motion`
- existing local MT5 bridge HTTP/WebSocket API

## Data Source

This app does **not** use mock data.

It expects a working local MT5 bridge at:

`http://127.0.0.1:8001`

That bridge is expected to provide:

- `GET /history`
- `GET /history_range`
- `GET /symbols`
- `GET /server_time`
- `GET /health`
- `GET /calendar`
- `GET /market_status`
- `POST /calendar_ingest`
- `WS /stream`

It also expects the MT5 EA calendar bridge to be pushing economic calendar events into that bridge.

## Main Behavior

- `Overview` is the main mission-control surface. It shows trust state, pair attention, macro backdrop, pair-relevant event risk, `Overview Confidence`, and compact specialist summaries around one selected FX pair.
- `Charts` keeps the live MT5 chart workflow and debug log, and shows explicit no-data / error states instead of fake candles.
- `Economic Calendar` is MT5-backed, supports range/filter/search workflows, and can deep-link from `Overview` into a target event with highlight + explainer behavior.
- `Central Banks Data` is derived from MT5 calendar events using strict mapping rules for the major 8 currencies. If a match is uncertain, the UI shows `N/A` instead of guessing.
- `Differential Calculator`, `Strength Meter`, and `Event Tools` provide deeper specialist views, and parts of their output are surfaced back into `Overview`.

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

Preferred workflow:

- run commands from the repo root when possible
- treat `pnpm` as the package-manager authority for this repo
- use `Main/package.json` only as the app-local manifest, not as an invitation to switch the workspace to npm

## Optional Config

If the bridge base URL ever changes, set:

`VITE_MT5_BRIDGE_BASE`

If not set, the app defaults to:

`http://127.0.0.1:8001`
