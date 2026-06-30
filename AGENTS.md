# Fyodor Trading Terminal Agent Guide

Use this file as the first stop for future AI sessions.

## Read First

1. `README.md`
2. `Main/README.md`
3. `docs/Development Logs/Current App Map.md`
4. `Main/src/app/tabs/README.md`
5. The smallest relevant source files for the requested task

Ignore `docs/Private` unless the user explicitly asks for it.

## Product Boundary

Fyodor is a local manual-trading support terminal. It helps inspect MT5 candles, broker economic-calendar rows, central-bank context, and event replay. It must not pretend to generate guaranteed trades or buy/sell calls.

Trusted live data is intentionally limited to MT5 OHLCV plus broker/MT5 economic-calendar rows unless the user explicitly changes that boundary.

## Active Surfaces

Primary top-nav surfaces:

- `Overview` - fresh pair-brief surface built from the selected pair, MT5 calendar rows, central-bank snapshots, and market status.
- `Central Banks Data` - current reference surface; avoid touching without a targeted reason.
- `Charts` - primary chart inspection surface.
- `Economic Calendar` - primary calendar and event inspector.
- `Specialist Tools` - short drawer for Event Replay plus Prototyping.

Secondary surfaces:

- `Event Replay` is the only active secondary experiment.
- `Prototyping` is a garbage drawer for old unfinished surfaces.
- `Main/src/app/tabs/secondary` should contain only active secondary shells/surfaces.
- Ignore `Main/src/app/tabs/garbage` unless the user explicitly asks for a file or route inside it. Do not read garbage files for general orientation.
- Ignore `Main/src/app/lib/garbage` unless the user explicitly asks for garbage-drawer supporting logic. Active Event Replay helpers remain in `Main/src/app/lib`.

## Repo Hygiene

- Use `pnpm`; do not introduce npm/yarn lockfiles.
- Leave `Main/mt5-bridge` alone unless the user explicitly asks for bridge work.
- Keep route ids stable unless the user approves a routing migration.
- Prefer helper extraction and docs maps over deleting old tools.
- Do not create new tests unless the user explicitly agrees. Before creating a test, explain in plain English what behavior it protects.
- Prefer targeted verification. Do not run broad/full test suites after every small pass; explain why before running full tests.
- `react-world-flags` currently works. Its missing TypeScript declaration and large `FlagIcon` build chunk are known non-blocking noise; do not replace or refactor flags unless the user explicitly asks.
- Garbage tests live under `Main/src/app/tests/garbage`. Ignore them unless the user explicitly asks for garbage-drawer work.
