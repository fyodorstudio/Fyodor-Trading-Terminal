# Fyodor Trading Terminal Checklist

Last updated: 2026-08-04

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
- Event Lens should default to useful chart context instead of opening as an empty/unselected popover.
- Pair and timeframe changes should preserve the user's chart zoom/view intent where practical.
- Event Lens UI should feel like a clean chart tool, not a bulky text bookmark or debug panel.
- Release history should be presented visually and readably, not as cramped raw rows.
- Future scheduled events should remain discoverable on the right side of the chart even when historical marker caps hide older events.
- Event Lens factor evidence should be interactive enough to inspect older releases by selected factor.
- Chart-time Pair Matrix inspection is a future Charts-native idea, not an Overview expansion.
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

### 1. Charts Event Lens Interaction And Readability Polish

- [ ] Keep Charts as the main price-event-replay workspace.
- [ ] Default Event Lens selection:
  - [ ] remove the empty unselected Event Lens modal state;
  - [ ] when no event is selected, default to the nearest/current relevant loaded event;
  - [ ] prefer visible-range events when available;
  - [ ] if no loaded event exists, keep only the small bookmark and show the empty explanation after opening it.
- [ ] Preserve chart view:
  - [ ] changing pair should not blindly reset zoom/view;
  - [ ] preserve visible logical range shape where possible;
  - [ ] refocus automatically only when there is no meaningful previous chart range or when the user explicitly presses refocus.
- [ ] Bookmark redesign:
  - [ ] replace the text-heavy `Event Lens / Details` bookmark with a compact icon-only bookmark;
  - [ ] use a clean lucide icon such as `Bookmark`, `PanelLeftOpen`, or `CalendarSearch`;
  - [ ] position the bookmark just below the top-left pair selector area;
  - [ ] keep the bookmark visible but visually quiet with tooltip/aria text.
- [ ] Coverage placement:
  - [ ] remove `Loaded events: X / Visible: Y` from the tiny title area;
  - [ ] place coverage inside the expanded Event Lens modal where it fits naturally;
  - [ ] label coverage as chart/filter coverage, not macro meaning.
- [ ] Release Navigator redesign:
  - [ ] replace the cramped release list with a more visual release-history presentation;
  - [ ] use compact bar-chart style rows showing Actual and Forecast side-by-side where possible;
  - [ ] include date/time, actual, forecast, previous, and scheduled/ready state;
  - [ ] clicking a release still selects it and jumps the chart to that release.
- [ ] Future marker visibility:
  - [ ] keep marker cap/density logic for historical visible-range events;
  - [ ] do not let historical marker caps remove upcoming scheduled markers;
  - [ ] upcoming scheduled markers should always render up to the configured `futureMarkerLimit`;
  - [ ] future markers remain visually distinct and labeled as scheduled.
- [ ] Factor-driven release navigator:
  - [ ] make `Base / quote evidence` factors selectable;
  - [ ] selected factor changes the Release Navigator contents;
  - [ ] Release Navigator should show older releases for the selected factor/currency where loaded;
  - [ ] selecting a release still jumps the chart to that release time.
- [ ] Release Navigator visual detail:
  - [ ] present factor release history with a compact bar-chart style comparison where possible;
  - [ ] show Actual and Forecast side-by-side, with Previous/date/status readable;
  - [ ] keep source values conservative and do not invent missing units.
- [ ] Modal polish:
  - [ ] keep the current centered Event Lens modal direction;
  - [ ] improve spacing and alignment without inventing a totally new workflow;
  - [ ] make data regions feel intentionally composed and readable.
- [ ] Keep out of scope for this pass:
  - [ ] no bridge/data-contract changes;
  - [ ] no historical calendar backfill;
  - [ ] no Overview redesign;
  - [ ] no Event Replay tab redesign;
  - [ ] no CSS monolith work.

### 2. Charts Pair Matrix Time Lens

- [x] Plan separately before source edits; do not bundle with the immediate Event Lens polish unless explicitly reopened.
- [x] Add a second compact bookmark near Event Lens later.
- [x] Clicking the bookmark opens a compact Pair Matrix popover based on chart cursor time.
- [x] Matrix should show macro/factor data active at the hovered chart time.
- [x] Later design may support draggable matrix anchors placed on multiple chart times.
- [x] V1 should be read-only and use loaded broker/MT5 calendar rows plus active helpers only.

### 3. CSS Monolith Split And Guardrails

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

### 4. Backlog

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
- [x] Charts Pair Matrix Time Lens opens from a compact chart bookmark and follows cursor-time macro/factor context from loaded rows.
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
  - `pnpm --dir Main run typecheck`;
  - `pnpm --dir Main build`.
- Future Charts implementation must include manual or CDP screenshot inspection at 1440x900, 100% Chrome zoom:
  - no whole-page chart scroll;
  - event rail does not block x-axis labels or chart dragging;
  - bookmark is icon-only and positioned below the pair selector;
  - Event Lens opens with a useful selected event by default;
  - changing pairs preserves zoom/view shape where practical;
  - coverage appears inside the modal, not cramped in the header;
  - future scheduled markers remain visible on the right side under marker caps;
  - selecting a factor changes Release Navigator contents;
  - release navigator is readable and visually explains recent values;
  - future scheduled dots still appear when loaded;
  - Terminal Console is no longer visible below the chart.
- Future Pair Matrix Time Lens implementation should be planned separately before source edits.
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
- "Nearest current event" means the closest loaded relevant event to the current/latest candle time, preferring visible-range events when available.
- Event Lens bookmark icon should be chosen from the existing icon library and should stay visually quiet.
- Release Navigator visuals must stay source-honest; no source values are invented or unit-converted beyond existing conservative display helpers.
- Historical marker caps still exist for performance.
- Upcoming scheduled markers bypass historical-density hiding only up to `futureMarkerLimit`.
- Factor selection belongs inside Event Lens, not in the chart settings drawer.
- Pair Matrix Time Lens is not part of the immediate Event Lens polish implementation unless explicitly reopened.
- Mobile can use internal modal scrolling; "no scroll" target is desktop 1440x900.
- The app remains decision support, not a signal bot.
- Macro scope is current-data-only until the user explicitly approves external data.
