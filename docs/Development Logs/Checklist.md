# Fyodor Trading Terminal Checklist

Last updated: 2026-07-28

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
- Active tabs target 100% Chrome zoom on normal desktop without whole-page vertical or horizontal scrolling.
- 100% Chrome zoom viewport audit passed at 1440x900 with live local feed data for Overview, Central Banks, Charts, Economic Calendar, Event Replay, Macro Drivers, and Differential Calculator.
- Event Replay, Charts event overlays, Overview pair details, and CSS ownership remain active cleanup areas.
- Aesthetic Forge is mounted behind the header gear and stays closed by default.
- External data sources remain out of scope unless explicitly approved later.
- `react-world-flags` works and has a local declaration; its large `FlagIcon` chunk is known non-blocking noise.
- Do not create new tests unless the user explicitly agrees and the test value is explained in plain English first.
- `pnpm run typecheck` is expected to pass; quarantined garbage files use explicit `@ts-nocheck` rather than steering active type cleanup.

## Active Roadmap

### 1. Event Replay / Overview / Charts UI Polish

- [x] Overview Pair Details:
  - [x] widen the modal horizontally;
  - [x] desktop layout shows two currency rows: base row and quote row;
  - [x] each currency row shows compact factor cards across the row;
  - [ ] target no modal body scrolling at 1440x900, with internal scroll fallback for smaller screens or long broker text.
- [x] Event Replay Replay Brief:
  - [x] widen the modal;
  - [x] redesign into a two-row desktop layout;
  - [x] keep replay setup, observed move, actual, forecast, previous, surprise, and interpretation visible without cramped stacked boxes;
  - [ ] target no modal body scrolling at 1440x900, with internal scroll fallback.
- [x] Event Replay Past Releases:
  - [x] redesign as a wide modal with release list on the left and compact month calendar on the right;
  - [x] hovering a release row highlights its matching calendar date;
  - [x] selecting a row keeps current release-selection behavior.
- [x] Event Replay Select Event:
  - [x] remove the current top mode cards;
  - [x] remove `Countdown` as a separate sort mode;
  - [x] make `Upcoming next` include countdown directly;
  - [x] place `Recently released` as a dedicated right-side area;
  - [x] move `All / Usable / Limited / Weak` into a compact dropdown;
  - [x] remove the secondary sort dropdown;
  - [x] widen the modal and fix the white-corner/overlay framing issue.
- [x] Charts:
  - [x] cursor selector shows only `Crosshair` and `Sticky`;
  - [x] visible `Both` becomes `Crosshair`;
  - [x] remove visible `Exact`;
  - [x] migrate old saved `true_cursor` / Exact preference to `Crosshair`;
  - [x] remove `All high impact` from event currency scope;
  - [x] keep separate selectors for currency scope and impact;
  - [x] migrate old `high_impact` scope to `All loaded` while preserving the separate impact filter;
  - [x] fix the event rail translucent layer so it does not block x-axis time labels.
- [x] Manual 1440x900 browser audit:
  - [x] verify Overview Pair Details has no unnecessary modal body scroll with live data;
  - [x] verify Replay Brief has no unnecessary modal body scroll with live data;
  - [x] verify chart event rail no longer covers x-axis labels.

### 2. CSS Monolith Split And Guardrails

- [x] Start after the UI polish lane is complete; do not mix the UI redesign and CSS split in one commit.
- [x] Pass 1: extract existing selectors into ordered files with no selector renames and no behavior changes.
- [ ] Pass 2: separate active surface CSS from garbage/prototype CSS.
  - [x] Active Economic Calendar late-polish styles are isolated from Archived Event Quality CSS.
  - [x] Active macro/Differential Calculator primitives are isolated from old strength-meter v2/v3 CSS.
  - [x] Charts styles are isolated from the late-polish/deprecated command-hub slice.
  - [x] Active Event Replay late-modal styles are isolated from Deprecated Overview / archived replay-study CSS.
  - [x] Deprecated Overview and archived replay-study stylesheet bands are explicitly labeled as garbage.
  - [x] Legacy terminal/narrative overview and deprecated command-hub CSS files are explicitly labeled as garbage.
  - [ ] Continue separating Overview, Event Replay, and shared primitives from legacy/garbage cascade bands.
- [x] Pass 3: strengthen docs/AI rules so future AI does not grow the global monolith again.
- [ ] Pass 4: delete, rename, or refactor dead CSS only after screenshot/build verification.
- [x] Keep `Main/src/styles.css` as the import aggregator.
- [x] Preserve import order during extraction.
- [x] Prefer visual behavior preservation over prettier class names in the first split.

### 3. Backlog

- [ ] External data connectors remain later.
- [ ] COT remains later because it is weekly and not currently in the app data stack.
- [ ] Central Banks MoM/YoY toggle remains later backlog.
- [ ] Do not revive Deprecated Overview, Six Questions, WIP, or garbage logic as product sources.

## Completed Checkpoints

- [x] Active app shell no longer has the old fixed 1460px content ceiling.
- [x] Active viewport audit passed at 1440x900, 100% Chrome zoom, with live local feed data.
- [x] Overview was rebuilt fresh from `OverviewPlaceholderTab.tsx`, not Deprecated Overview.
- [x] Overview has pair selector, Pair Driver Snapshot, base/quote macro cards, factor chips, and recent-release popovers.
- [x] Charts event overlay uses a bottom rail, visible cluster dots, badge thinning, density caps, and honest event-causality wording.
- [x] Chart settings drawer has compact current-settings summary and readable wrapping.
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
- UI polish implementation should run:
  - `pnpm run typecheck`;
  - `pnpm --dir Main test -- overviewPlaceholderTab.test.tsx`;
  - `pnpm --dir Main test -- eventReplayDisplay.test.ts eventReplayView.test.ts eventReaction.test.tsx`;
  - `pnpm --dir Main test -- chartsTab.test.ts chartView.test.ts calendarNavigation.test.ts`;
  - `pnpm --dir Main build`.
- UI polish must include manual or CDP screenshot inspection at 1440x900, 100% Chrome zoom.
- CSS split implementation must run build and screenshot smoke checks after each extraction pass.
- Do not run broad/full test suites after every small visual pass by default.
- Before adding new tests, get explicit user agreement and explain what behavior the test protects.
- Bridge tests are only required if bridge contracts change.

## Stable Assumptions

- Current repo-hygiene lane is CSS ownership cleanup after the UI polish checkpoint.
- CSS splitting should proceed in small extraction checkpoints with build/equivalence verification.
- CSS split pass 1 is extraction-only: no selector renames, no visual redesign, no dead-code deletion.
- Mobile can use internal modal scrolling; "no scroll" target is desktop 1440x900.
- The app remains decision support, not a signal bot.
- Macro scope is current-data-only until the user explicitly approves external data.
