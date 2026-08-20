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

- `Overview` is now a fresh pair-brief surface: pair selector, next pair-relevant event/countdown, upcoming pair events, base/quote macro cards, and route buttons into Charts, Event Replay, Economic Calendar, and Central Banks.
- The previous large overview is still available as `Deprecated Overview` through Specialist Tools > Prototyping.
- The strongest current primary surfaces are `Central Banks Data`, `Charts`, `Economic Calendar`, `Event Replay`, and the `Specialist Tools` shell.
- `Central Banks Data` is the current reference surface and should remain stable unless a targeted fix is needed.
- `Six Questions` and `Work In Progress` are historical/prototype context, not active product direction. `Aesthetic Forge` is available only from the header gear.

`Specialist Tools` currently contains:

1. `DIFFERENTIAL CALCULATOR` under `Active Tool`
2. `MACRO DRIVERS` under `Active Tool`
3. `EVENT REPLAY` under `Active Experiment`
4. `MACRO SIGNAL LAB` under `Active Experiment`
5. `PROTOTYPING` under `Garbage / Ignore`

The `PROTOTYPING` area is a garbage drawer for old unfinished surfaces. It contains unstable experiments, old planning drafts such as `Six Questions Draft` and `WIP Map Archive`, and older tools such as `Strength Meter` and `Deprecated Overview`. Ignore it unless explicitly requested.

`Differential Calculator` is the active rate/inflation arithmetic tool under Specialist Tools. `Event Replay` is the promoted pair-first replay workflow. It lets the user pick a pair, inspect base/quote event types first, keep major global movers separate, select past releases, and replay MT5 candles around the release marker.

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

- `Overview` is a fresh pair brief built from active selected-pair state, MT5 calendar rows, central-bank snapshots, and market status. It is glanceable decision support, not a trade-call surface.
- `Deprecated Overview` keeps the older mission-control surface available only through Prototyping as a warning/reference route.
- `Charts` keeps the live MT5 chart workflow and debug log, and shows explicit no-data / error states instead of fake candles.
- `Economic Calendar` is MT5-backed, supports range/filter/search workflows, and can deep-link from `Overview` into a target event with highlight + explainer behavior.
- `Central Banks Data` is derived from MT5 calendar events using strict mapping rules for the major 8 currencies. If a match is uncertain, the UI shows `N/A` instead of guessing.
- `Specialist Tools` is the routing shell for Differential Calculator, Macro Drivers, Event Replay, and the Prototyping archive.
- `Event Replay` is the main pair-first event replay surface. It is descriptive study support, not a signal engine.
- `Macro Signal Lab` is a EURUSD/H4 immutable-version research experiment backed by durable MT5 calendar history. It preserves rejected Economy v1 plus country-aware Labor v2, Sentiment v3, Policy/Inflation v5, and Growth v7. Charts owns opt-in `FMS-EURUSD-MULTI-H4-CQ-v9`: `Current model` uses only post-activation immutable releases matching frozen Euro-area-consumer-sentiment directional or US-industrial-output Short conditions; `Research replay` also exposes payroll, unemployment, and producer-inflation candidates as hindsight. The `FMS Shadow Trader` reports Long/Short/No-trade, why, a configurable gross-only sequential account replay, the hypothetical ATR position, next possible registered setup, and descriptive policy/inflation context. It permits one simulated position at a time and excludes spread, commission, slippage, and swap rather than estimating them. Release rings connect to strictly later H4 arrows. H1 is an H4-model view, not an H1 backtest. Nothing executes an order or guarantees an outcome.
- `tabs/primary/` contains always-visible primary workflow tabs.
- `tabs/secondary/` contains Differential Calculator, Macro Drivers, Event Replay, and the Prototyping shell.
- `tabs/garbage/` contains old unfinished, deprecated, or ignored routed surfaces. Do not read it for general orientation unless explicitly requested.
- `tests/garbage/` contains tests for garbage-drawer surfaces. Do not read or run them for normal active-surface work unless explicitly requested.
- `hooks/` contains app-shell side effects extracted from `App.tsx`.
- `types/` contains domain type files and package declarations; `types.ts` remains a compatibility barrel.

Known non-blocking noise:

- `react-world-flags` works in the app through `src/types/react-world-flags.d.ts`. Its large generated `FlagIcon` chunk is known and should not be chased unless the user explicitly asks to revisit flags.

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
pnpm typecheck
pnpm test
```

Preferred workflow:

- run commands from the repo root when possible
- treat `pnpm` as the package-manager authority for this repo
- use `Main/package.json` only as the app-local manifest, not as an invitation to switch the workspace to npm
- do not add `package-lock.json` or yarn lockfiles

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

## UI Quality Gate

Frontend changes are not done until the rendered viewport is acceptable. For Charts, Pair Matrix, Event Lens, docks, popovers, tables, and matrix layouts, verify at 1440x900 and 100% Chrome zoom. Do not leave overlapping text, clipped normal labels, horizontal scroll, hidden controls, unreadably tiny text, or blank wasted panel space. Pair Matrix fixed rows must keep `Latest | Next`, Compare, and Driver aligned; do not add extra badges or labels that become unintended grid children.
