# Fyodor Trading Terminal

Fyodor Trading Terminal is a local manual-trading support workstation built around a React frontend and an MT5-backed bridge. The project focuses on live market context, chart access, broker economic-calendar data, central-bank context, and event-replay study without relying on mock data.

The current product boundary is decision support, not trade calls. The user performs independent technical analysis elsewhere, then uses Fyodor to understand the fundamental and event context behind the selected pair. The app should help decide what deserves attention, what data can be trusted, and where to inspect next; it should not pretend to be a signal bot or guaranteed edge machine.

This repo uses `lightweight-charts` and does not include TradingView Advanced Charts files due to licensing and repository-privacy constraints.

## Current App Truth

The strongest current primary surfaces are:

- `Overview`
- `Central Banks Data`
- `Charts`
- `Economic Calendar`
- `Specialist Tools`, whose active children are `Differential Calculator` and `Event Replay`

`Overview` is now a fresh pair-brief surface: selected pair, next pair-relevant event/countdown, upcoming pair events, base/quote macro cards, and direct routes into deeper specialist surfaces. The previous large overview still exists as `Deprecated Overview`, routed through Specialist Tools > Prototyping for reference only.

`Specialist Tools` is intentionally short: `DIFFERENTIAL CALCULATOR` is the active rate/inflation arithmetic tool, `EVENT REPLAY` is the active replay experiment, and `PROTOTYPING` is a garbage drawer for old unfinished surfaces that should be ignored unless explicitly requested. `Event Replay` is pair-first, shows base/quote event types before separate global movers, and replays MT5 candles around past scheduled releases without making trade calls.

For now the trusted data boundary is deliberately narrow: MT5 OHLCV plus broker/MT5 economic-calendar rows. Do not add new live data sources without an explicit product decision.

For the active roadmap, read:

- `AGENTS.md`
- `docs/Development Logs/Checklist.md`
- `docs/Development Logs/Current App Map.md`

`docs/Private` is archival/context-noise by default. Do not use it unless explicitly requested.
The old Six Questions and Work In Progress surfaces are historical/prototype context, not active product direction. Aesthetic Forge is only available from the header gear.

## Workspace Layout

- `Main/` - primary app workspace
- `Main/src/` - React + Vite frontend
- `Main/mt5-bridge/` - local Python FastAPI bridge for MetaTrader 5
- `scripts/` - helper scripts for local development
- `docs/Development Logs/` - active local planning docs

See:

- `Main/README.md` for frontend details
- `Main/mt5-bridge/README.md` for bridge details

## Quick Start

From the repo root:

```bash
pnpm install
pnpm run dev:all
```

This starts the local development stack, including:

- MetaTrader 5
- the FastAPI bridge on `127.0.0.1:8001`
- the frontend app in `Main`

## Useful Commands

```bash
pnpm run dev:app
pnpm run dev:bridge
pnpm run build
pnpm run test
```

## Notes

- The frontend expects the bridge API at `http://127.0.0.1:8001`
- Use `pnpm` from the repo root as the package-manager source of truth
- Do not add npm/yarn lockfiles; `pnpm-lock.yaml` is the lockfile source of truth
- The current chart stack uses `lightweight-charts` in the frontend
- Full `pnpm run dev:all` usage assumes Windows, Python, and MetaTrader 5 installed locally; if MT5 is not at the default path, set `MT5_EXE`
