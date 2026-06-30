# Fyodor Trading Terminal Checklist

Last updated: 2026-06-30

## Active Planning Source

This file is the active command board for the project.

- Future AI sessions should read this file before older roadmap, audit, or patch notes.
- `docs/Private` stays on disk, but should be ignored unless the user explicitly asks to use it.
- Git history is the source for past implementation details; this checklist is for current truth and next work.
- This checklist should stay current and compact. Do not turn it back into a completed-work changelog.

## Current Product Truth

- Fyodor is manual-trading decision support, not a signal bot.
- The user performs independent technical analysis in TradingView, then uses Fyodor to inspect what is happening behind the selected pair.
- Trusted raw data remains MT5 OHLCV plus broker/MT5 economic-calendar rows.
- Event Replay is mature enough to count as an active specialist output.
- Central Banks Data is an active reference surface and should not be redesigned casually.
- Prototyping is a garbage drawer. Garbage tabs, supporting garbage logic, and garbage tests are ignored by default unless the user explicitly asks for them.
- Deprecated Overview, Six Questions, Work In Progress, and hidden Aesthetic Forge are context-risk surfaces. They must not steer new product work.
- `react-world-flags` is still used and works. Its missing TypeScript declaration and large `FlagIcon` chunk are known non-blocking noise; do not replace or refactor flags unless explicitly asked.
- Do not create new tests unless the user explicitly agrees and the test's value is explained in plain English first.

## Active Roadmap

### 1. Visual Unification And Viewport Fit

This is the next active implementation lane.

- [x] First pass: remove the active app shell's fixed 1460px content ceiling.
- [x] First pass: apply a shared full-width workspace wrapper to active primary tabs.
- [x] First pass: make Charts use viewport-aware chart height and a shorter terminal console.
- [x] Charts pass: collapse the diagnostic terminal console by default and give the chart more viewport height.
- [x] Central Banks pass: compact Strategic Focus spacing and collapse the mapping audit log by default.
- [x] Economic Calendar pass: compact the filter rail and make the event table the desktop scroll region.
- [x] Audit why primary tabs felt horizontally constrained while Event Replay used the screen more fully.
- [x] Compare shell width, tab wrappers, section max widths, and page padding across:
  - [x] Overview placeholder;
  - [x] Central Banks Data;
  - [x] Charts;
  - [x] Economic Calendar;
  - [x] Event Replay.
- [x] Identify the main 100% Chrome zoom offenders: fixed shell width, tall Charts diagnostics, oversized Central Banks audit/detail spacing, and Calendar page-level table scroll.
- [ ] Prefer better layout density, popovers, modals, drawers, and viewport-aware panels over forcing the user to zoom to 75%.
- [ ] Preserve a full-screen operational feel: reduce unnecessary blank left/right gutters and avoid cramped centered columns where they hurt workflow.
- [ ] Audit `Main/src/styles.css` ownership before splitting it.
- [ ] Do not split global CSS until the visual/layout audit identifies safe feature boundaries.
- [ ] Keep the hidden Aesthetic Forge / left visual config panel off by default until its role is proven.
- [ ] Do not let the visual config panel drive app-wide design decisions before the active tabs have a stable layout direction.

### 2. Fresh Overview Rebuild

This comes after visual unification, so the new Overview does not inherit the current shell/gutter/scroll problems.

- [ ] Build from `OverviewPlaceholderTab.tsx`, not Deprecated Overview.
- [ ] Do not read or reuse `DeprecatedOverviewTab.tsx` or `app/lib/garbage/overview.ts` as the implementation source.
- [ ] Add a pair selector.
- [ ] Show the selected pair's upcoming relevant event plus countdown.
- [ ] Add pressable routing buttons to:
  - [ ] Charts;
  - [ ] Event Replay;
  - [ ] Economic Calendar;
  - [ ] Central Banks Data.
- [ ] Show base/quote macro cards similar in spirit to Differential Calculator, but implemented fresh from active data.
- [ ] Show recent pair-relevant events.
- [ ] Show base/quote policy rate, inflation, and related central-bank context.
- [ ] Keep the goal glanceable: pair brief first, deeper study via routed specialist surfaces.
- [ ] Keep language descriptive and cautious. Do not generate trade calls.

### 3. Event Replay Continued Polish

- [ ] Keep Event Replay as an active specialist output.
- [ ] Preserve the main workflow order: pair -> event -> release -> replay setup -> playback.
- [ ] Preserve pair-first event grouping and major global movers as separate context.
- [ ] Continue layout polish only when it improves the replay workflow or reduces viewport friction.
- [ ] Keep Event Replay explanations concise and shared with the Economic Calendar explainer pipeline where practical.

### 4. Central Banks Backlog

- [ ] Consider a MoM/YoY toggle or equivalent period-mode control later.
- [ ] Do not make this the next lane unless the user explicitly returns to Central Banks work.
- [ ] Keep unresolved values unresolved. Do not invent missing data.

### 5. Documentation And AI Hygiene

- [ ] Keep this checklist as the first planning source.
- [ ] Keep `docs/Development Logs/Current App Map.md`, root `README.md`, and `Main/README.md` aligned when product direction changes materially.
- [ ] Keep garbage folders ignored by default:
  - [ ] `Main/src/app/tabs/garbage`;
  - [ ] `Main/src/app/lib/garbage`;
  - [ ] `Main/src/app/tests/garbage`.
- [ ] Treat older docs as historical unless the user explicitly asks to use them.
- [ ] Before adding tests, get explicit user agreement and explain what behavior the test protects.

## Verification Rules

- Checklist-only edits require no app tests.
- Visual/layout implementation should use targeted viewport inspection, screenshots when useful, and `pnpm --dir Main build`.
- Do not run broad/full test suites after every small visual pass by default.
- Before CSS splitting, require a specific plan because global cascade risk is high.
- Before reviving Aesthetic Forge, require a specific plan because app-wide styling risk is high.
- Bridge tests are only required if bridge contracts change.

## Stable Assumptions

- The next actual implementation should start with visual unification and viewport fit, not Overview.
- Overview will be rebuilt fresh from the blank placeholder and active helpers/data only.
- Deprecated Overview may be referenced only as a warning or route target, not as design or logic source.
- Event Replay is active product work, not garbage.
- The app remains decision support, not a signal bot.
- No MT5 bridge API changes are planned for the current roadmap.
- Do not add external data sources until the user explicitly changes the data boundary.
