# Fyodor Trading Terminal

Fyodor Trading Terminal is a local trading workstation built around a React frontend and an MT5-backed bridge. The project focuses on live market context, chart access, calendar data, and specialist trading workflows without relying on mock data.

This public repo uses `lightweight-charts` and does not include TradingView Advanced Charts files due to licensing and repository-privacy constraints.

## Workspace Layout

- `Main/` - primary app workspace
- `Main/src/` - React + Vite frontend
- `Main/mt5-bridge/` - local Python FastAPI bridge for MetaTrader 5
- `scripts/` - helper scripts for local development

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
- the vendored FastAPI bridge on `127.0.0.1:8001`
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
