# Fyodor Trading Terminal

Local manual-trading support app: React/Vite charts and FMS economic-event research backed by a FastAPI bridge to MetaTrader 5. Trusted FMS inputs are MT5 OHLCV and broker calendar rows. Results are gross simulations; Fyodor sends no trading orders.

## Start

On Windows with Python and MT5 installed:

```sh
pnpm install
pnpm run dev:all
```

The bridge uses `127.0.0.1:8001`; the frontend runs from `Main`. Set `MT5_EXE` if MT5 is installed outside its expected location. Use `pnpm` and the root `pnpm-lock.yaml`.

## Find the right file

- AI operating rules: [AGENTS.md](AGENTS.md)
- Durable vocabulary and architecture: [CONTEXT.md](CONTEXT.md)
- Current mission, unresolved checks and deferred work: [Checklist](docs/Development%20Logs/Checklist.md)
- Task-to-file map: [Navigation](docs/NAVIGATION.md)
- Frontend setup details: [Main README](Main/README.md)
- MT5 setup details: [Bridge README](Main/mt5-bridge/README.md)

These are references, not a mandatory reading sequence. Read only what the task requires.

Active navigation is Overview, Central Banks Data, Charts, Economic Calendar, and Specialist Tools (FMS Experiment Workbench and Differential Calculator). Historical Event Replay, Macro Drivers, and Prototyping remain under Garbage / Ignore. They are not active design guidance.

## Commands

| Command | Purpose |
| --- | --- |
| `pnpm run dev:all` | MT5, bridge and frontend |
| `pnpm run dev:app` | Frontend only |
| `pnpm run dev:bridge` | Bridge only |
| `pnpm run typecheck` | TypeScript gate |
| `pnpm run build` | Production build |
| `pnpm --dir Main exec vitest run <file>` | Targeted existing tests |

Charts uses `lightweight-charts`; TradingView Advanced Charts files are not included. Feature styles belong under `Main/src/styles/`; `styles.css` is the ordered import aggregator. See AGENTS for UI/manual-validation rules.
