# Fyodor Trading Terminal

Fyodor Trading Terminal is a local pre-trade workstation built around a React frontend and an MT5-backed bridge. The project focuses on live market context, chart access, broker economic-calendar data, central-bank context, and specialist trading workflows without relying on mock data.

The current product boundary is decision support, not trade calls. The app should help decide what deserves attention, what data can be trusted, and where to inspect next; it should not pretend to be a signal bot or guaranteed edge machine.

This repo uses `lightweight-charts` and does not include TradingView Advanced Charts files due to licensing and repository-privacy constraints.

## Current App Truth

The strongest current primary surfaces are:

- `Central Banks Data`
- `Charts`
- `Economic Calendar`
- `Specialist Tools`

`Overview` is currently a blank rebuild surface. The previous large overview still exists as `Legacy Overview`, routed through Specialist Tools/prototype navigation for reference.

`Event Tools` currently exists, but is still in transition. The planned direction is to promote it into a primary Specialist Tools destination focused on pair-first event replay.

For the active roadmap, read:

- `docs/Development Logs/Checklist.md`
- `docs/Development Logs/Current App Map.md`

`docs/Private` is archival/context-noise by default. Do not use it unless explicitly requested.

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
- The current chart stack uses `lightweight-charts` in the frontend
- Full `pnpm run dev:all` usage assumes Windows, Python, and MetaTrader 5 installed locally; if MT5 is not at the default path, set `MT5_EXE`
