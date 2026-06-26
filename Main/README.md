# Fyodor Trading Terminal - Main

This is the active frontend app built in `C:\dev\Fyodor Trading Terminal\Main`.

The app is a local manual-trading support terminal built around MT5 candles, broker economic-calendar rows, central-bank derivations, and event-replay study. The user still performs independent technical analysis outside Fyodor; this app explains the macro/event context behind the pair being inspected.

Current top-level navigation:

1. `Overview`
2. `Central Banks Data`
3. `Charts`
4. `Economic Calendar`
5. `Specialist Tools`

Important current-state note:

- `Overview` is intentionally a blank rebuild surface right now.
- The previous large overview is still available as `Legacy Overview` through Specialist Tools/prototype routing.
- The strongest current primary surfaces are `Central Banks Data`, `Charts`, `Economic Calendar`, `Event Replay`, and the `Specialist Tools` shell.
- `Central Banks Data` is the current reference surface and should remain stable unless a targeted fix is needed.
- `Six Questions`, `Work In Progress`, and `Aesthetic Forge` are historical/prototype context, not active product direction.

`Specialist Tools` currently contains:

1. `SIX QUESTIONS`
2. `EVENT REPLAY`
3. `WORK IN PROGRESS`
4. `PROTOTYPING`

The `PROTOTYPING` area links to active experiments and older tools, including `Strength Meter`, `Differential Calculator`, and `Legacy Overview`.

`Event Replay` is the promoted pair-first replay workflow. It lets the user pick a pair, inspect base/quote event types first, keep major global movers separate, select past releases, and replay MT5 candles around the release marker.

The current product goal is to keep the app connection-first and honest: show what is live, what is stale, what is unresolved, and what macro/event context may explain or threaten the user's chart idea without pretending to generate trade predictions.

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
For now it should stay limited to MT5 OHLCV plus broker/MT5 economic-calendar rows. Do not add another live data source unless the user explicitly changes that boundary.

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

- `Overview` is currently a rebuild placeholder, not the mission-control source of truth.
- `Legacy Overview` keeps the older mission-control surface available for reference while the new direction is clarified.
- `Charts` keeps the live MT5 chart workflow and debug log, and shows explicit no-data / error states instead of fake candles.
- `Economic Calendar` is MT5-backed, supports range/filter/search workflows, and can deep-link from `Overview` into a target event with highlight + explainer behavior.
- `Central Banks Data` is derived from MT5 calendar events using strict mapping rules for the major 8 currencies. If a match is uncertain, the UI shows `N/A` instead of guessing.
- `Specialist Tools` is the routing shell for Event Replay plus older prototype/legacy tools.
- `Event Replay` is the main pair-first event replay surface. It is descriptive study support, not a signal engine.
- `EventReactionTab.tsx` and `EventQualityTab.tsx` are older replay/event-quality surfaces kept on disk as archive candidates until the Specialist Tools audit decides keep, merge, rewrite, or archive.

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

## Planning Docs

Use these as the active local planning sources:

- `../docs/Development Logs/Checklist.md`
- `../docs/Development Logs/Current App Map.md`

Ignore `../docs/Private` unless explicitly requested; it is archival context and can dilute future AI sessions.
