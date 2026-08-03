# Fyodor Trading Terminal Checklist

Last updated: 2026-08-03

## Active Planning Source

This file is the current command board. Future AI sessions should read this before older roadmap, audit, or patch notes.

- Keep this file compact and current; git history owns implementation history.
- Ignore `docs/Private` unless the user explicitly asks to use it.
- Do not let Deprecated Overview, Six Questions, Work In Progress, or garbage-drawer code steer active product work.

## Current Product Truth

- Fyodor is manual-trading decision support, not a signal bot.
- The trusted raw data boundary is MT5 OHLCV plus broker/MT5 economic-calendar rows.
- Calendar `Actual / Forecast / Previous` values have no source unit metadata, so formatting must stay conservative and source-preserving.
- Chart time must be viewer-time-first: selected timezone should control axis labels, crosshair labels, latest-candle labels, and viewer clock.
- Economic Calendar event explanation is a critical product surface because scheduled events are a major driver of price movement.
- Charts is the intended main workspace for price, loaded economic events, and event replay context.
- Overview stays a compact pair summary for now; do not expand it into a second full analysis cockpit during the next Charts-focused pass.
- Existing Event Replay remains available, but the next implementation should ignore the tab unless a safe active helper can be reused.
- Chart event coverage is loaded-only in v1; missing old chart markers mean old calendar rows are not loaded, not that no event happened.
- Raw event values and observed price movement matter more than educational explainer text or trade-call language inside Charts.
- Active tabs target 100% Chrome zoom on normal desktop without whole-page vertical or horizontal scrolling.
- 100% Chrome zoom viewport audit passed at 1440x900 with live local feed data for Overview, Central Banks, Charts, Economic Calendar, Event Replay, Macro Drivers, and Differential Calculator.
- Aesthetic Forge is mounted behind the header gear and stays closed by default.
- External data sources remain out of scope unless explicitly approved later.
- `react-world-flags` works and has a local declaration; its large `FlagIcon` chunk is known non-blocking noise.
- Do not create new tests unless the user explicitly agrees and the test value is explained in plain English first.
- `pnpm run typecheck` is expected to pass; quarantined garbage files use explicit `@ts-nocheck` rather than steering active type cleanup.

## Active Roadmap

### 1. Charts Event Replay Lens

- [x] Treat Charts as the main price-event-replay workspace for the next implementation pass.
- [x] Redesign chart event markers:
  - [x] default to selected-pair relevant, high-impact loaded broker/MT5 calendar rows only;
  - [x] use a bottom event rail with subtle dots/badges;
  - [x] show vertical guide lines only on hover or selected event;
  - [x] cluster nearby events and open the Event Lens when a marker/cluster is clicked.
- [x] Add an `Event Lens` bottom deck:
  - [x] compact state shows selected event, event time, actual, forecast, previous, surprise, observed move, and Play/Pause;
  - [x] expand on hover/focus;
  - [x] click pins the deck open so replay controls do not disappear mid-study;
  - [x] expanded state shows essential replay controls and compact base/quote evidence rows;
  - [x] include a small `Open in Calendar` action without automatically navigating away.
- [x] Add Charts-native replay:
  - [x] use currently loaded/cached chart candles only for v1;
  - [x] anchor replay to the nearest candle or candle bucket for the selected timeframe;
  - [x] hide candles to the right of the selected event, then reveal forward during playback;
  - [x] define observed move as event candle price to current replay cursor candle;
  - [x] keep visible replay controls to Play/Pause, Reset, Step, and Speed.
- [x] Simplify Charts settings:
  - [x] organize drawer tabs as `Appearance`, `Events`, `Replay`, and `Diagnostics`;
  - [x] move Terminal Console into `Diagnostics`;
  - [x] keep event settings as minimal checkboxes/selects with minimal explanatory text;
  - [x] keep technical replay settings inside the drawer, not the Event Lens compact strip.
- [x] Do not redesign Overview, the existing Event Replay tab, old experiments, or CSS ownership as part of this Charts pass.
- [x] Verified with targeted tests, build, and 1440x900 Chrome/CDP inspection:
  - [x] no whole-page chart scroll;
  - [x] event rail does not cover the x-axis;
  - [x] clicking a marker dot opens Event Lens;
  - [x] replay hides future candles and play advances the cursor/observed move;
  - [x] Terminal Console is no longer visible below the chart.

### 2. CSS Monolith Split And Guardrails

- [x] Start after the Charts Event Replay Lens lane; do not mix the Charts replay redesign and CSS split in one commit.
- [x] Pass 1: extract existing selectors into ordered files with no selector renames and no behavior changes.
- [x] Pass 2: separate active surface CSS from garbage/prototype CSS.
  - [x] Active Economic Calendar polish styles are isolated from Archived Event Quality CSS.
  - [x] Active macro/Differential Calculator primitives are isolated from old strength-meter v2/v3 CSS.
  - [x] Charts styles are isolated from the late-polish/deprecated command-hub slice.
  - [x] Active Event Replay late-modal styles are isolated from Deprecated Overview / archived replay-study CSS.
  - [x] Archived Event Quality / Event Reaction continuation styles no longer live under an Event Replay filename.
  - [x] The mixed responsive leftovers file was split into active responsive slices and garbage responsive slices.
  - [x] Active Overview release/factor modal styles are split from old unused overview brief / decision / story CSS.
  - [x] Deprecated Overview and archived replay-study stylesheet bands are explicitly labeled as garbage.
  - [x] Legacy terminal/narrative overview and deprecated command-hub CSS files are explicitly labeled as garbage.
  - [x] Deprecated command-hub CSS is split from garbage strength-meter v4 legacy CSS.
  - [x] Unused legacy chart picker/status CSS is split out of active Economic Calendar CSS.
  - [x] Active Economic Calendar polish CSS no longer uses stale `late` naming.
  - [x] Garbage/prototype stylesheet imports are isolated behind `Main/src/styles/garbage.css`, loaded only by garbage lazy routes.
- [x] Pass 3: strengthen docs/AI rules so future AI does not grow the global monolith again.
- [x] Pass 4: dead CSS audit completed after build/smoke verification; reachable garbage CSS was retained and lazy-isolated instead of deleted.
- [x] Keep `Main/src/styles.css` as the import aggregator.
- [x] Preserve import order during extraction.
- [x] Prefer visual behavior preservation over prettier class names in the first split.

### 3. Backlog

These are intentionally not active implementation items.

- [x] External data connectors remain later.
- [x] COT remains later because it is weekly and not currently in the app data stack.
- [x] Central Banks MoM/YoY toggle remains later backlog.
- [x] Do not revive Deprecated Overview, Six Questions, WIP, or garbage logic as product sources.

## Completed Checkpoints

- [x] Active app shell no longer has the old fixed 1460px content ceiling.
- [x] Active viewport audit passed at 1440x900, 100% Chrome zoom, with live local feed data.
- [x] Overview was rebuilt fresh from `OverviewPlaceholderTab.tsx`, not Deprecated Overview.
- [x] Overview has pair selector, Pair Driver Snapshot, base/quote macro cards, factor chips, and recent-release popovers.
- [x] Charts event overlay uses a bottom rail, visible cluster dots, badge thinning, density caps, and honest event-causality wording.
- [x] Charts Event Replay Lens opens from chart event markers and replays loaded candles in place.
- [x] Chart settings drawer has compact current-settings summary and readable wrapping.
- [x] Active CSS now loads without garbage-drawer stylesheet bands; garbage CSS is lazy-loaded only by garbage routes.
- [x] Economic Calendar table uses an internal desktop scroll region and wraps event titles, timezone labels, and source values.
- [x] Economic Calendar selected-event drawer uses shared explainer data for practical event context without trade calls.
- [x] Event Replay preserves pair -> event -> release -> replay setup -> playback.
- [x] Event Replay modals reserve header-safe space, and Past Releases / Replay Brief had a first readability pass.
- [x] Macro Drivers is active for forex/gold current-data-only driver context and keeps detailed pair factor rows out of the main page.
- [x] Differential Calculator is an active Specialist Tools child with route id `dashboard`.
- [x] `Main/src/styles.css` was reduced to an ordered import aggregator; first-pass extracted CSS lives under `Main/src/styles/`.
- [x] Garbage folders remain ignored by default:
  - [x] `Main/src/app/tabs/garbage`;
  - [x] `Main/src/app/lib/garbage`;
  - [x] `Main/src/app/tests/garbage`.

## Verification Rules

- Checklist/docs-only edits require no app tests.
- Future Charts implementation should run:
  - `pnpm --dir Main test -- chartView.test.ts chartsTab.test.ts calendarNavigation.test.ts navigationTruth.test.tsx`;
  - `pnpm --dir Main build`.
- Future Charts implementation must include manual or CDP screenshot inspection at 1440x900, 100% Chrome zoom:
  - no whole-page chart scroll;
  - event rail does not block x-axis labels or chart dragging;
  - selecting an event opens the Event Lens;
  - replay hides future candles and plays forward;
  - Terminal Console is no longer visible below the chart.
- Future CSS cleanup must run build and screenshot smoke checks after each extraction pass.
- Do not run broad/full test suites after every small visual pass by default.
- Before adding new tests, get explicit user agreement and explain what behavior the test protects.
- Bridge tests are only required if bridge contracts change.

## Stable Assumptions

- Historical calendar backfill, external data, Overview redesign, and Event Replay tab redesign remain out of scope until explicitly reopened.
- Existing Event Replay remains available but should not steer the Charts Event Replay Lens UI.
- Old garbage/deprecated experiments are ignored by default.
- CSS cleanup should proceed in small extraction checkpoints with build/equivalence verification.
- The completed CSS split was extraction-first: no selector renames, no visual redesign, and no reachable garbage CSS deletion.
- Mobile can use internal modal scrolling; "no scroll" target is desktop 1440x900.
- The app remains decision support, not a signal bot.
- Macro scope is current-data-only until the user explicitly approves external data.
