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
- Future scheduled events should remain discoverable/selectable on the right side of the chart even when historical marker caps hide older events.
- Event Lens factor evidence should be interactive enough to inspect older releases by selected factor.
- Chart-time Pair Matrix inspection is Charts-native, not an Overview expansion.
- Pair Matrix Time Lens should become a chart-time driver-alignment tool: it should help inspect whether loaded economic data and observed price movement agree, conflict, or remain unclear.
- Pair Matrix base-vs-quote comparison must show real values and transparent math; avoid fake precision across unlike event units.
- Overview stays a compact pair summary for now; do not expand it into a second full analysis cockpit during the next Charts-focused pass.
- Existing Event Replay remains available, but the next implementation should ignore the tab unless a safe active helper can be reused.
- Chart event coverage is loaded-only in v1; missing old chart markers mean old calendar rows are not loaded, not that no event happened.
- Raw event values and observed price movement matter more than educational explainer text or trade-call language inside Charts.
- Active tabs target 100% Chrome zoom on normal desktop without whole-page vertical or horizontal scrolling.
- 100% Chrome zoom viewport audit passed at 1440x900 with live local feed data for Overview, Central Banks, Charts, Economic Calendar, Event Replay, Macro Drivers, and Differential Calculator.
- Aesthetic Forge is mounted behind the header gear and stays closed by default.
- External data sources remain out of scope unless explicitly approved later.
- `react-world-flags` works and has a local declaration; its large `FlagIcon` chunk is known non-blocking noise.
- Do not create broad/new test suites casually. Focused Charts tests are pre-approved for the next goal when they protect bookmark dock layout, Pair Matrix comparison math/rendering, or future marker visibility.
- `pnpm run typecheck` is expected to pass; quarantined garbage files use explicit `@ts-nocheck` rather than steering active type cleanup.

## Autonomous Goal Mode Rules

- Current autonomous implementation status: `Charts Bookmark Dock + Pair Matrix Comparison + Future Marker Visibility` is complete as of 2026-08-08.
- Do not start a new autonomous implementation lane until the user explicitly reopens one from Active Roadmap or Deferred / Backlog.
- Do not expand the next goal into full Event Lens modal redesign, Overview, Event Replay tab redesign, bridge/data contracts, external data, calendar backfill, or CSS monolith work.
- Do not delete unfinished roadmap items. Preserve non-next work under Deferred / Backlog unless the user explicitly asks to remove it.
- Focused tests are pre-approved when they protect behavior changed by the next Charts polish implementation.
- Broad/full test suites remain non-default; use the targeted verification commands below unless the change clearly requires more.
- If live MT5 candles/calendar rows are unavailable, static tests plus CDP no-data layout smoke are acceptable. Record that live-data behavior was not exercised.
- Roadmap and deferred sections should use unchecked boxes only. Completed work belongs in the dated `Completed Work Log`, not as checked checklist items.

## Active Roadmap

No active autonomous implementation target is queued after the completed Charts bookmark dock / Pair Matrix comparison / future marker visibility pass.

When the user reopens a lane, move the chosen work here as unchecked actionable tasks and preserve the rest under Deferred / Backlog.

## Deferred / Backlog

These are intentionally not active implementation items. Preserve them for later goal-mode work unless the user explicitly reprioritizes or removes them.

- [ ] Pair Matrix Time Lens later design may support draggable matrix anchors placed on multiple chart times.
- [ ] Charts Event Lens Interaction And Readability Polish:
  - [ ] add persisted Event Lens default-selection preference under Chart Events settings;
  - [ ] remove the empty unselected Event Lens modal state;
  - [ ] preserve chart view shape on pair/timeframe changes where practical;
  - [ ] move coverage into the expanded Event Lens modal;
  - [ ] make Release Navigator visual, readable, and factor-driven;
  - [ ] polish future scheduled marker behavior beyond the active visibility pass if needed.
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
- Pair Matrix polish implementation completed: button placement moved below the pair selector, matrix cells use readable title/value/time rows, Driver Alignment shows pips/percent plus surprise basis, Pair Matrix configuration persists in chart preferences, and the pass was verified with targeted Charts tests, typecheck, build, and 1440x900 CDP smoke.
- Charts bookmark dock / Pair Matrix comparison / future marker visibility implementation completed: Event Lens and Pair Matrix now share a compact icon dock, Pair Matrix opens without the old right-shift workaround, base-vs-quote comparison shows real values and transparent formulas, comparison preferences persist under Chart Settings > Appearance > Experimental, future scheduled markers are preserved through overlay caps, and the pass was verified with targeted Charts tests, typecheck, build, and 1440x900 CDP smoke.

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
- Future Charts or Event Lens implementation should run:
  - `pnpm --dir Main test -- chartView.test.ts chartsTab.test.ts calendarNavigation.test.ts navigationTruth.test.tsx`;
  - focused helper/component tests for Pair Matrix comparison math/rendering, bookmark dock rendering, and future marker visibility where behavior changes need protection;
  - `pnpm --dir Main run typecheck`;
  - `pnpm --dir Main build`.
- Future Charts polish implementation must include manual or CDP screenshot inspection at 1440x900, 100% Chrome zoom:
  - no whole-page chart scroll;
  - shared bookmark dock sits cleanly near/below the pair selector;
  - Event Lens and Pair Matrix buttons do not overlap chart controls;
  - Pair Matrix popover is bounded and readable without artificial centering caused by the old Event Lens bookmark;
  - base-vs-quote comparison updates with the cursor anchor;
  - raw numbers, formula/basis, and winner state are visible;
  - future markers remain visible/selectable with chart lenses open;
  - Terminal Console is no longer visible below the chart.
- If live MT5 candles/calendar rows are unavailable, static tests plus CDP no-data layout smoke are acceptable; record the limitation in the final report.
- Future CSS cleanup must run build and screenshot smoke checks after each extraction pass.
- Do not run broad/full test suites after every small visual pass by default.
- Focused tests are pre-approved for the next Charts polish implementation when they protect newly changed behavior.
- Before adding tests outside that Pair Matrix scope, get explicit user agreement and explain what behavior the test protects.
- Bridge tests are only required if bridge contracts change.

## Stable Assumptions

- Historical calendar backfill, external data, Overview redesign, and Event Replay tab redesign remain out of scope until explicitly reopened.
- Existing Event Replay remains available but should not steer the Charts Event Replay Lens UI.
- Old garbage/deprecated experiments are ignored by default.
- CSS cleanup should proceed in small extraction checkpoints with build/equivalence verification.
- The completed CSS split was extraction-first: no selector renames, no visual redesign, and no reachable garbage CSS deletion.
- Charts Bookmark Dock + Pair Matrix Comparison + Future Marker Visibility is complete as of 2026-08-08.
- Pair Matrix Driver Alignment compares data-implied pair direction against price movement from release close to hovered-cursor close.
- Driver Alignment must display actual move in pips and percent plus surprise value/basis.
- Driver Alignment labels are `Aligned`, `Rejected`, `Muted`, and `Unclear`; they are context labels, not buy/sell calls.
- Data bias uses Actual vs Forecast when numeric forecast exists, otherwise Actual vs Previous when available.
- Unemployment/jobless-style events invert direction because lower readings are usually more supportive for the event currency.
- Supportive base-currency data implies pair up; supportive quote-currency data implies pair down. Negative base implies pair down; negative quote implies pair up.
- Driver strength, surprise sensitivity, row sort mode, and display density should be configurable because the user wants to learn visually which read works.
- Pair Matrix comparison follows the same cursor-time anchor as Pair Matrix Time Lens, falling back to the latest loaded candle.
- Pair Matrix comparison default mode is `Macro surprise`; experimental modes may expose `Macro + price` and `Raw values`.
- Pair Matrix comparison controls belong under `Chart Settings > Appearance > Experimental`.
- Pair Matrix comparison should expose actual values and math basis before any summary label.
- Pair Matrix comparison winner labels are learning aids, not certainty scores or trade calls.
- Event Lens default selection is a persisted Chart Events preference with `nearest`, `impact`, and `past` strategies.
- "Nearest current event" means the closest loaded relevant event to the current/latest candle time, preferring visible-range events when available.
- "Highest-impact nearby event" means higher impact wins before distance among nearby loaded relevant events.
- "Latest past replay-ready event" means the most recent loaded past event with matching loaded candles.
- Event Lens and Pair Matrix bookmark icons should be chosen from the existing icon library and should live together in a visually quiet shared chart dock.
- Release Navigator visuals must stay source-honest; no source values are invented or unit-converted beyond existing conservative display helpers.
- Release Navigator bars are relative raw-value comparisons within the matching release set only.
- Historical marker caps still exist for performance.
- Upcoming scheduled markers bypass historical-density hiding only up to `futureMarkerLimit` and should remain selectable while lenses are open.
- Factor selection belongs inside Event Lens, not in the chart settings drawer.
- Factor-driven Release Navigator shows the selected factor and selected factor currency only.
- Pair Matrix Time Lens v1, its first polish pass, comparison, and shared chart-tool layout are complete.
- Mobile can use internal modal scrolling; "no scroll" target is desktop 1440x900.
- The app remains decision support, not a signal bot.
- Macro scope is current-data-only until the user explicitly approves external data.
