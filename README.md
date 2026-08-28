# Fyodor Trading Terminal

Fyodor Trading Terminal is a local manual-trading support workstation built around a React frontend and an MT5-backed bridge. The project focuses on live market context, chart access, broker economic-calendar data, central-bank context, and event-replay study without relying on mock data.

The primary product objective is FMS: discover immutable, no-lookahead economic-event recipes that produced positive historical walk-forward average R, register their fixed scoring/execution contracts, project their historical matches on Charts, and monitor future releases in Shadow Trader. The app remains decision support: Long/Short/No-trade is a hypothetical model output, not a guaranteed edge or an MT5 order. Confidence, stability, samples, and omitted costs remain visible diagnostics.

This repo uses `lightweight-charts` and does not include TradingView Advanced Charts files due to licensing and repository-privacy constraints.

## Current App Truth

The strongest current primary surfaces are:

- `Overview`
- `Central Banks Data`
- `Charts`
- `Economic Calendar`
- `Specialist Tools`, whose active children are `FMS Experiment Workbench` and `Differential Calculator`

`Overview` is now a fresh pair-brief surface: selected pair, next pair-relevant event/countdown, upcoming pair events, base/quote macro cards, and direct routes into deeper specialist surfaces. The previous large overview still exists as `Deprecated Overview`, routed through Specialist Tools > Prototyping for reference only.

`FMS Experiment Workbench` is the active repeatable research surface; `Differential Calculator` remains an active experiment. Event Replay, Macro Drivers, and Prototyping are retained under Garbage / Ignore. Charts exposes `FMS-REGISTERED-REACTION-H4-v3`: 16 immutable recipes across EURUSD, GBPUSD, USDJPY, AUDUSD, USDCAD, and NZDUSD, including continuation, rejection, and two past-only ordinary-magnitude rules. Every registration reconciles with its current scoring-engine experiment and walk-forward audit. Historical matches are explicitly hindsight; Current mode uses only immutable post-activation release observations. `FMS Shadow Trader` is global across registered markets and explicitly states that no setup is safe to follow blindly. Failed backtests remain explicit contender or avoid-directional-use knowledge instead of being discarded. Nothing is a guarantee or automatic order.

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

## CSS Ownership Warning

`Main/src/styles.css` is now the ordered active-style import aggregator. Garbage-drawer styling is isolated behind `Main/src/styles/garbage.css`, which is loaded only by garbage routes. The old monolith was split because the app grew through many AI-assisted visual passes, not because React/Vite/Tailwind is the wrong stack.

Current rules:

- do not add feature CSS directly to `Main/src/styles.css`;
- put new styling in the owning surface file or an explicitly shared primitive file;
- do not let garbage/prototype CSS influence active product surfaces;
- do not add garbage/prototype CSS imports back into `Main/src/styles.css`;
- preserve import/selector order when moving existing CSS;
- do not delete, rename, or refactor old selectors without build and visual verification.

The CSS cleanup remains extraction-first: ownership isolation first, then dead-code deletion only after build and screenshot verification.

## UI Anti-Regression Warning

Future AI sessions must treat visual fit as a hard correctness requirement, not polish. A passing unit test, typecheck, or production build does not prove the UI is acceptable.

- For any Charts, Pair Matrix, Event Lens, popover, dock, toolbar, table, or matrix change, verify the rendered app at 1440x900, 100% Chrome zoom before claiming completion.
- Do not leave horizontal scroll, overlapping text, clipped normal labels, tiny unreadable data, hidden controls, or large blank wasted panel space.
- Do not solve density problems by shrinking fonts below readable size. Rework the layout, grouping, disclosure, or information hierarchy.
- Do not add extra badges/labels into fixed grid rows unless the grid contract is recalculated. Pair Matrix Evidence rows in particular must keep `Latest | Next`, Compare, and Driver columns aligned without bleed.
- If browser/CDP visual inspection is blocked, record that limitation and do not present the UI as fully audited.

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
pnpm run typecheck
pnpm run test
```

## Notes

- The frontend expects the bridge API at `http://127.0.0.1:8001`
- Use `pnpm` from the repo root as the package-manager source of truth
- Do not add npm/yarn lockfiles; `pnpm-lock.yaml` is the lockfile source of truth
- The current chart stack uses `lightweight-charts` in the frontend
- Full `pnpm run dev:all` usage assumes Windows, Python, and MetaTrader 5 installed locally; if MT5 is not at the default path, set `MT5_EXE`
