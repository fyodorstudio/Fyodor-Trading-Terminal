# Fyodor Trading Terminal Agent Guide

Use this file as the first stop for future AI sessions.

## Read First

1. `README.md`
2. `Main/README.md`
3. `docs/Development Logs/Current App Map.md`
4. `docs/Development Logs/UI Design.md`
5. `Main/src/app/tabs/README.md`
6. The smallest relevant source files for the requested task

Ignore `docs/Private` unless the user explicitly asks for it.

## Product Boundary

Fyodor is a local manual-trading support terminal. It helps inspect MT5 candles, broker economic-calendar rows, central-bank context, and event replay. It must not pretend to generate guaranteed trades or buy/sell calls.

FMS is the primary product objective. Its practical research loop is: discover immutable, no-lookahead economic-event recipes with positive historical walk-forward expectancy; register the non-duplicated recipes with their fixed scoring and execution contracts; display their historical arrows; then monitor future releases in Shadow Trader. Statistical confidence, stability, sample size, and trading-cost omissions must remain visible diagnostics, but an academic confidence threshold must not automatically veto an otherwise positive historical recipe. Never relabel this as guaranteed profitability or send an MT5 order.

Trusted live data is intentionally limited to MT5 OHLCV plus broker/MT5 economic-calendar rows unless the user explicitly changes that boundary.

## UI / Viewport Rule

- Active tabs should target normal desktop use at 100% Chrome zoom without whole-page vertical scrolling.
- Use bounded panels, popovers, modals, collapsible sections, and internal scroll regions when a surface needs more detail.
- If an active tab intentionally requires whole-page scrolling, document why in `docs/Development Logs/Checklist.md` before treating it as acceptable.
- UI changes are not complete just because tests, typecheck, or build pass. For visible Charts, Pair Matrix, Event Lens, table, popover, dock, or toolbar changes, do not run Playwright/CDP/smoke automation by default unless the user explicitly asks for it; it is too token-expensive for the preferred workflow. Instead, finish with a concise manual audit checklist for 1440x900 at 100% Chrome zoom, and state plainly that the user should perform that audit.
- Do not ship visible overlap, clipped ordinary text, accidental horizontal scroll, hidden controls, blank wasted panel space, or tiny unreadable labels. If a dense surface cannot fit all details, redesign the information hierarchy instead of squeezing smaller text into the same box.
- For fixed grid/table UIs such as Pair Matrix, every row must have a stable column contract. Do not add extra visible children, badges, chips, labels, or wrappers inside a fixed grid lane unless the grid template is updated and visually verified. Metadata belongs in an existing slot, title/details text, or a deliberate expanded detail area.
- Pair Matrix-specific warning: the Evidence rows must keep `Latest | Next` aligned across all factors, must not repeat bulky per-cell labels, and must never let bundle/reason/status text bleed into Compare or Driver columns.

## CSS Ownership Rule

- Do not casually add feature CSS to `Main/src/styles.css`.
- New styling must be owned by a specific active surface or by an explicitly shared primitive.
- `Main/src/styles.css` is the active import aggregator. Keep feature CSS in owned files under `Main/src/styles/`.
- `Main/src/styles/garbage.css` is the garbage-only import aggregator and should only be loaded by garbage routes.
- First CSS split pass is extraction-only: preserve selector names, selector order, and visual behavior.
- Do not rename selectors, delete dead CSS, or refactor global cascade during the first split.
- Garbage/prototype CSS must not steer active product design. Keep it isolated and ignored unless the user explicitly asks for garbage-drawer styling work.
- Do not add garbage/prototype CSS imports back into `Main/src/styles.css`.
- If a new selector is genuinely shared, document why it is shared instead of putting surface-specific styling into a global bucket.

## Active Surfaces

Primary top-nav surfaces:

- `Overview` - fresh pair-brief surface built from the selected pair, MT5 calendar rows, central-bank snapshots, and market status.
- `Central Banks Data` - current reference surface; avoid touching without a targeted reason.
- `Charts` - primary chart inspection surface.
- `Economic Calendar` - primary calendar and event inspector.
- `Specialist Tools` - drawer for active secondary tools plus Prototyping.

Secondary surfaces:

- `FMS Experiment Workbench` is the active Specialist Tool using the stable route id `macro-signal-lab`.
- `Differential Calculator` is an active experiment using route id `dashboard`.
- `Event Replay`, `Macro Drivers`, and `Prototyping` are grouped under `Garbage / Ignore`; their stable routes remain available but they must not steer active product design.
- `Main/src/app/tabs/secondary` should contain only active secondary shells/surfaces.
- Ignore `Main/src/app/tabs/garbage` unless the user explicitly asks for a file or route inside it. Do not read garbage files for general orientation.
- Ignore `Main/src/app/lib/garbage` unless the user explicitly asks for garbage-drawer supporting logic. Active Differential Calculator and FMS helpers remain in `Main/src/app/lib`; retained Event Replay and Macro Drivers helpers must not steer active product work.

## Repo Hygiene

- Use `pnpm`; do not introduce npm/yarn lockfiles.
- Leave `Main/mt5-bridge` alone unless the user explicitly asks for bridge work.
- Keep route ids stable unless the user approves a routing migration.
- Prefer helper extraction and docs maps over deleting old tools.
- Do not create new tests unless the user explicitly agrees. Before creating a test, explain in plain English what behavior it protects.
- Prefer targeted verification. Do not run broad/full test suites after every small pass; explain why before running full tests.
- `pnpm run typecheck` is the repo-level TypeScript gate. Garbage files that are intentionally quarantined may use `@ts-nocheck` so archived code does not pollute active-surface checks.
- `react-world-flags` currently works and has a local declaration at `Main/src/types/react-world-flags.d.ts`. Its large `FlagIcon` build chunk is known non-blocking noise; do not replace or refactor flags unless the user explicitly asks.
- Garbage tests live under `Main/src/app/tests/garbage`. Ignore them unless the user explicitly asks for garbage-drawer work.

## Token-Efficient Agent Protocol

- Do not repeat an accepted plan or narrate routine file inspection, edits, and verification.
- Combine related inspections and verification commands when practical.
- During clear implementation work, stay silent except when blocked, when material risk is discovered, when user input is required, or when higher-level runtime rules require a brief progress update.
- Finish with only a minimal completion statement, material caveats, and the exact manual audit checklist.
- This protocol never overrides safety requirements, approval boundaries, or higher-priority system/developer instructions.
