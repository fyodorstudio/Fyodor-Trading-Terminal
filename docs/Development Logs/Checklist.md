# Fyodor Trading Terminal Checklist

Last updated: 2026-08-08

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
- Chart-time Pair Matrix inspection is Charts-native, not an Overview expansion.
- Pair Matrix Time Lens should become a chart-time driver-alignment tool: it should help inspect whether loaded economic data and observed price movement agree, conflict, or remain unclear.
- Overview stays a compact pair summary for now; do not expand it into a second full analysis cockpit during the next Charts-focused pass.
- Existing Event Replay remains available, but the next implementation should ignore the tab unless a safe active helper can be reused.
- Chart event coverage is loaded-only in v1; missing old chart markers mean old calendar rows are not loaded, not that no event happened.
- Raw event values and observed price movement matter more than educational explainer text or trade-call language inside Charts.
- Active tabs target 100% Chrome zoom on normal desktop without whole-page vertical or horizontal scrolling.
- 100% Chrome zoom viewport audit passed at 1440x900 with live local feed data for Overview, Central Banks, Charts, Economic Calendar, Event Replay, Macro Drivers, and Differential Calculator.
- Aesthetic Forge is mounted behind the header gear and stays closed by default.
- External data sources remain out of scope unless explicitly approved later.
- `react-world-flags` works and has a local declaration; its large `FlagIcon` chunk is known non-blocking noise.
- Do not create broad/new test suites casually. Focused Pair Matrix tests are pre-approved for the next goal when they protect Driver Alignment math or changed rendering behavior; tests outside that scope still need explicit user agreement.
- `pnpm run typecheck` is expected to pass; quarantined garbage files use explicit `@ts-nocheck` rather than steering active type cleanup.

## Autonomous Goal Mode Rules

- Next autonomous implementation target: `Charts Pair Matrix Time Lens Polish` only.
- Do not expand the next goal into Event Lens redesign, Overview, Event Replay tab redesign, bridge/data contracts, external data, or CSS monolith work.
- Do not delete unfinished roadmap items. Preserve non-next work under Deferred / Backlog unless the user explicitly asks to remove it.
- Focused tests are pre-approved when they protect behavior changed by the next Pair Matrix implementation.
- Broad/full test suites remain non-default; use the targeted verification commands below unless the change clearly requires more.
- If live MT5 candles/calendar rows are unavailable, static tests plus CDP no-data layout smoke are acceptable. Record that live-data behavior was not exercised.
- Roadmap and deferred sections should use unchecked boxes only. Completed work belongs in the dated `Completed Work Log`, not as checked checklist items.

## Active Roadmap

### 1. Charts Pair Matrix Time Lens Polish

- [ ] Keep this pass Pair Matrix-only:
  - [ ] no Event Lens redesign;
  - [ ] no Overview expansion;
  - [ ] no Event Replay tab redesign;
  - [ ] no bridge/data-contract changes;
  - [ ] no external data sources;
  - [ ] no CSS monolith/global cleanup.
- [ ] Move the Pair Matrix Time Lens expand button below the pair selector area.
- [ ] Standardize matrix cell readability:
  - [ ] title line;
  - [ ] compact `Actual / Forecast / Previous` value row;
  - [ ] one clean time row;
  - [ ] no repeated or broken timestamp text.
- [ ] Add configurable Driver Alignment inside the open Pair Matrix:
  - [ ] compare data bias against price movement from release to hovered cursor;
  - [ ] show pips and percent move from release close to cursor close;
  - [ ] show surprise value and comparison basis, not only a generic label;
  - [ ] classify each readable row as `Aligned`, `Rejected`, `Muted`, or `Unclear`.
- [ ] Persist Pair Matrix configuration in chart preferences.
- [ ] Add easy in-popover controls for visual learning:
  - [ ] driver read mode;
  - [ ] surprise sensitivity;
  - [ ] row sort mode, including factor order and driver-strength order;
  - [ ] display density if needed for readability.
- [ ] Keep visual tone readable but restrained:
  - [ ] use chips, small bars, and subtle row accents;
  - [ ] avoid trade-call styling, buy/sell wording, or guaranteed-edge language.

## Deferred / Backlog

These are intentionally not active implementation items. Preserve them for later goal-mode work unless the user explicitly reprioritizes or removes them.

- [ ] Pair Matrix Time Lens later design may support draggable matrix anchors placed on multiple chart times.
- [ ] Charts Event Lens Interaction And Readability Polish:
  - [ ] add persisted Event Lens default-selection preference under Chart Events settings;
  - [ ] remove the empty unselected Event Lens modal state;
  - [ ] preserve chart view shape on pair/timeframe changes where practical;
  - [ ] redesign Event Lens bookmark as compact icon-only;
  - [ ] move coverage into the expanded Event Lens modal;
  - [ ] make Release Navigator visual, readable, and factor-driven;
  - [ ] keep future scheduled markers visible/selectable while replay controls stay disabled.
- [ ] External data connectors remain later.
- [ ] COT remains later because it is weekly and not currently in the app data stack.
- [ ] Central Banks MoM/YoY toggle remains later backlog.
- [ ] Historical calendar backfill remains later.
- [ ] Overview redesign/expansion remains later.
- [ ] Event Replay tab redesign remains later.
- [ ] Future CSS cleanup should remain small, documented, and verified after each extraction or deletion pass.
- [ ] Do not revive Deprecated Overview, Six Questions, WIP, or garbage logic as product sources.

## Completed Work Log

### 2026-08-08

- Charts Pair Matrix Time Lens v1 was added as a read-only Charts-native popover. It opens from a compact chart bookmark and follows cursor-time macro/factor context from loaded MT5/broker calendar rows.
- Checklist command-board structure was tightened so the next autonomous goal is explicit and unfinished roadmap items are preserved instead of deleted.
- Pair Matrix polish decisions were locked for the next autonomous pass: button placement below pair selector, standardized readable cells, persisted configuration, and Driver Alignment with pips/percent plus surprise basis.

### Prior Completed Context

- Active app shell no longer has the old fixed 1460px content ceiling, and active viewport audit passed at 1440x900, 100% Chrome zoom, with live local feed data.
- Overview was rebuilt fresh from `OverviewPlaceholderTab.tsx` and includes pair selector, Pair Driver Snapshot, base/quote macro cards, factor chips, and recent-release popovers.
- Charts event overlay uses a bottom rail, visible cluster dots, badge thinning, density caps, and honest event-causality wording.
- Charts Event Replay Lens opens from chart event markers and replays loaded candles in place.
- Chart settings drawer has compact current-settings summary and readable wrapping.
- Active CSS loads without garbage-drawer stylesheet bands; garbage CSS is lazy-loaded only by garbage routes.
- Economic Calendar table uses an internal desktop scroll region and wraps event titles, timezone labels, and source values.
- Economic Calendar selected-event drawer uses shared explainer data for practical event context without trade calls.
- Event Replay preserves pair -> event -> release -> replay setup -> playback, with header-safe modals and a first readability pass for Past Releases / Replay Brief.
- Macro Drivers is active for forex/gold current-data-only driver context and keeps detailed pair factor rows out of the main page.
- Differential Calculator is an active Specialist Tools child with route id `dashboard`.
- `Main/src/styles.css` is an ordered import aggregator; first-pass extracted CSS lives under `Main/src/styles/`.
- Garbage folders remain ignored by default: `Main/src/app/tabs/garbage`, `Main/src/app/lib/garbage`, and `Main/src/app/tests/garbage`.

## Verification Rules

- Checklist/docs-only edits require no app tests.
- Future Pair Matrix implementation should run:
  - `pnpm --dir Main test -- chartView.test.ts chartsTab.test.ts calendarNavigation.test.ts navigationTruth.test.tsx`;
  - focused helper/component tests for Driver Alignment math and changed Pair Matrix rendering behavior;
  - `pnpm --dir Main run typecheck`;
  - `pnpm --dir Main build`.
- Future Pair Matrix implementation must include manual or CDP screenshot inspection at 1440x900, 100% Chrome zoom:
  - no whole-page chart scroll;
  - Pair Matrix button sits below the pair selector;
  - Pair Matrix popover does not overlap toolbar, event rail, x-axis, or Event Lens controls;
  - matrix cells are readable and do not repeat/break timestamps;
  - Driver Alignment updates while hovering chart candles;
  - pips, percent, surprise value, and comparison basis are visible;
  - configurable controls are usable without crowding the chart;
  - Terminal Console is no longer visible below the chart.
- If live MT5 candles/calendar rows are unavailable, static tests plus CDP no-data layout smoke are acceptable; record the limitation in the final report.
- Future CSS cleanup must run build and screenshot smoke checks after each extraction pass.
- Do not run broad/full test suites after every small visual pass by default.
- Focused tests are pre-approved for the next Pair Matrix implementation when they protect newly changed behavior.
- Before adding tests outside that Pair Matrix scope, get explicit user agreement and explain what behavior the test protects.
- Bridge tests are only required if bridge contracts change.

## Stable Assumptions

- Historical calendar backfill, external data, Overview redesign, and Event Replay tab redesign remain out of scope until explicitly reopened.
- Existing Event Replay remains available but should not steer the Charts Event Replay Lens UI.
- Old garbage/deprecated experiments are ignored by default.
- CSS cleanup should proceed in small extraction checkpoints with build/equivalence verification.
- The completed CSS split was extraction-first: no selector renames, no visual redesign, and no reachable garbage CSS deletion.
- Pair Matrix Time Lens polish is the next autonomous implementation target.
- Pair Matrix Driver Alignment compares data-implied pair direction against price movement from release close to hovered-cursor close.
- Driver Alignment must display actual move in pips and percent plus surprise value/basis.
- Driver Alignment labels are `Aligned`, `Rejected`, `Muted`, and `Unclear`; they are context labels, not buy/sell calls.
- Data bias uses Actual vs Forecast when numeric forecast exists, otherwise Actual vs Previous when available.
- Unemployment/jobless-style events invert direction because lower readings are usually more supportive for the event currency.
- Supportive base-currency data implies pair up; supportive quote-currency data implies pair down. Negative base implies pair down; negative quote implies pair up.
- Driver strength, surprise sensitivity, row sort mode, and display density should be configurable because the user wants to learn visually which read works.
- Event Lens default selection is a persisted Chart Events preference with `nearest`, `impact`, and `past` strategies.
- "Nearest current event" means the closest loaded relevant event to the current/latest candle time, preferring visible-range events when available.
- "Highest-impact nearby event" means higher impact wins before distance among nearby loaded relevant events.
- "Latest past replay-ready event" means the most recent loaded past event with matching loaded candles.
- Event Lens bookmark icon should be chosen from the existing icon library and should stay visually quiet.
- Release Navigator visuals must stay source-honest; no source values are invented or unit-converted beyond existing conservative display helpers.
- Release Navigator bars are relative raw-value comparisons within the matching release set only.
- Historical marker caps still exist for performance.
- Upcoming scheduled markers bypass historical-density hiding only up to `futureMarkerLimit`.
- Factor selection belongs inside Event Lens, not in the chart settings drawer.
- Factor-driven Release Navigator shows the selected factor and selected factor currency only.
- Pair Matrix Time Lens v1 exists but needs polish before Event Lens work resumes.
- Mobile can use internal modal scrolling; "no scroll" target is desktop 1440x900.
- The app remains decision support, not a signal bot.
- Macro scope is current-data-only until the user explicitly approves external data.
