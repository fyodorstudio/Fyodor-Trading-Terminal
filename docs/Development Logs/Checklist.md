# Fyodor Trading Terminal Checklist

Last updated: 2026-07-25

## Active Planning Source

This file is the active command board for the next goal-mode run.

- Future AI sessions should read this file before older roadmap, audit, or patch notes.
- `docs/Private` stays on disk, but should be ignored unless the user explicitly asks to use it.
- Git history is the source for past implementation details; this checklist is for current truth and next work.
- This checklist should stay current and compact. Do not turn it back into a completed-work changelog.

## Current Product Truth

- Fyodor is manual-trading decision support, not a signal bot.
- The user performs independent technical analysis in TradingView, then uses Fyodor to inspect what is happening behind the selected pair.
- Trusted raw data remains MT5 OHLCV plus broker/MT5 economic-calendar rows.
- "How to take advantage" means interpret event context, affected markets, confirmation workflow, traps, and stronger/weaker scenarios. It must not become buy/sell calls.
- Calendar `Actual / Forecast / Previous` values have no source unit metadata, so formatting must be conservative and source-preserving.
- Chart viewer time must be trustworthy: selected viewer timezone should control axis labels, crosshair labels, latest-candle labels, and viewer clock.
- Economic Calendar event explanation is a critical product surface because scheduled events are one of the main reasons price can move.
- Active tabs should target normal desktop use at 100% Chrome zoom without whole-page vertical scrolling.
- Overview is active, but still needs pair-brief layout work and final 100% Chrome zoom fit review when bridge data is populated.
- Event Replay is active; it still needs selection/config/result hierarchy cleanup.
- Central Banks Data is an active reference surface and should not be redesigned casually.
- Differential Calculator is an active Specialist Tools child, not a primary top-nav tab.
- Macro Drivers is an active Specialist Tools child for forex and gold; its wide Calendar Factor Coverage table was removed, but the page still needs 100% Chrome zoom inspection.
- Charts event overlay uses clustered/adaptive markers, but it must become performance-safe on H4/D1 and dense loaded histories.
- Economic Calendar should default toward high-signal rows first while keeping lower-impact rows available through filters.
- Aesthetic Forge is mounted behind the header gear and stays closed by default.
- Prototyping is a garbage drawer. Garbage tabs, supporting garbage logic, and garbage tests are ignored by default unless the user explicitly asks for them.
- Deprecated Overview, Six Questions, and Work In Progress must not steer new product work.
- External data sources remain out of scope unless explicitly approved later.
- `react-world-flags` is still used and works. Its missing TypeScript declaration and large `FlagIcon` chunk are known non-blocking noise; do not replace or refactor flags unless explicitly asked.
- Do not create new tests unless the user explicitly agrees and the test's value is explained in plain English first.

## Active Roadmap

### 1. Event Replay Workflow Polish

- [x] Move `Replay Setup` controls into the `Replay Brief` modal.
- [x] Treat `Replay Brief` as the study/config panel containing:
  - [x] timeframe;
  - [x] before/after candle counts;
  - [x] replay interpretation/brief content.
- [x] Keep the main left rail focused on:
  - [x] pair;
  - [x] event;
  - [x] release;
  - [x] playback.
- [x] Add an always-visible compact result strip near the chart header/action row showing:
  - [x] observed move;
  - [x] actual;
  - [x] forecast;
  - [x] previous;
  - [x] surprise.
- [x] Rework `Select Event` so the primary discovery modes are three prominent cards:
  - [x] `Upcoming next`;
  - [x] `Countdown`;
  - [x] `Recently released`.
- [x] Keep secondary sort/filter controls available, but do not let them visually compete with those three primary event-selection modes.
- [x] Preserve Event Replay's pair -> event -> release -> playback workflow and active Specialist Tools route.

### 2. Charts Event Overlay Performance And UX Polish

- [x] Reopen Charts event overlay as active work, not complete.
- [x] Add event overlay controls for:
  - [x] impact defaulting to `High only`;
  - [x] selected-pair/relevant-currency scope;
  - [x] configurable maximum number of rendered event markers.
- [x] Make dense timeframe behavior performance-safe:
  - [x] do not render thousands of DOM event markers on H4/D1 or wide views;
  - [x] prefer visible-range rendering with a hard event cap;
  - [x] keep the cap user-configurable.
- [x] Replace x-axis-disrupting vertical lines with a bottom event rail:
  - [x] vertical lines stop before the x-axis;
  - [x] event interaction lives in a thin rail above the x-axis;
  - [x] cluster/badge interaction should not block normal chart scrolling.
- [x] Keep event markers honest: they show known calendar timing only and must not imply the event caused the price move.

### 3. Economic Calendar Polish

- [x] Add a `Next Week` preset immediately after `This Week` in schedule controls.
- [x] Change the default Impact filter from `All` to `High`.
- [x] Keep lower-impact events available through the Impact selector.
- [x] Preserve existing custom range behavior and calendar route/filter state unless a future implementation plan explicitly changes it.

### 4. Backlog

- [ ] Active tabs should target 100% Chrome zoom on normal desktop without whole-page vertical scrolling.
- [ ] Recheck Overview, Charts, Macro Drivers, and Event Replay with the real local MT5 bridge when available before treating live-state viewport fit as fully proven.
- [ ] External data connectors remain later.
- [ ] COT remains later because it is weekly and not currently in the app data stack.
- [ ] Central Banks MoM/YoY toggle remains later backlog.
- [ ] Do not start broad CSS splitting yet.
- [ ] Do not revive Deprecated Overview, Six Questions, WIP, or garbage logic as product sources.

## Completed Checkpoints

- [x] Visual unification and viewport first pass completed, but viewport fit remains an active quality gate.
- [x] Active app shell no longer has the old fixed 1460px content ceiling.
- [x] Charts diagnostic `Terminal Console` is collapsible.
- [x] Central Banks focus view is denser, with audit logs collapsed.
- [x] Economic Calendar table uses a desktop scroll region.
- [x] Economic Calendar toolbar clock/filter readouts wrap instead of hiding freshness or timezone details.
- [x] Economic Calendar event titles, timezone option labels, and Actual/Forecast/Previous cells wrap instead of hiding source values behind ellipses.
- [x] Overview source shell is bounded to the app viewport with internal overflow for pair brief content.
- [x] Overview Pair Details uses readable factor cards and wraps event titles instead of truncating key context.
- [x] Macro Drivers source shell is bounded to the app viewport; missing-data notes open on demand instead of consuming page height.
- [x] Central Banks source shell is bounded to the app viewport with internal overflow for command/focus content.
- [x] Differential Calculator source shell is bounded to the app viewport with separate internal scroll panels for rate and inflation cards.
- [x] Macro Drivers, Charts, and Event Replay now use fixed app-height root shells instead of relying on whole-page height.
- [x] Charts event overlay now shows a bottom rail and an explicit density note when visible events are capped.
- [x] Charts event rail was tightened so markers stay visually separated from the x-axis, capped-event notes fit the rail, and event popover values wrap instead of clipping.
- [x] Chart settings drawer now shows a compact current-settings summary before detailed controls.
- [x] Chart settings summaries and chart-event popover rows wrap important text instead of hiding it behind ellipses.
- [x] Event Replay Past Releases rows were widened and made value-readable with full actual/forecast/previous/surprise readouts.
- [x] Event Replay result values wrap instead of truncating in the chart header and Replay Brief cards.
- [x] Event Replay selected-release comparison and preview context wrap instead of truncating event meaning.
- [x] `Main/src/styles.css` ownership was audited; do not split it without a specific visual-regression plan.
- [x] Overview was rebuilt fresh from `OverviewPlaceholderTab.tsx`, not Deprecated Overview.
- [x] Overview has pair selector, Pair Driver Snapshot, base/quote macro cards, factor chips, and recent-release popovers.
- [x] Event Replay preserves pair -> event -> release -> replay setup -> playback.
- [x] Overview -> Event Replay opens on the selected Overview pair without forcing normal Event Replay launches to mirror Overview.
- [x] Event Replay keeps pair-first event grouping and major global movers separate.
- [x] Economic Calendar selected-event drawer now presents release snapshot, event meaning, affected markets, comparisons, confirmation workflow, outcome scenarios, and caveats from the shared explainer data.
- [x] Calendar event aliases now cover more broker title variants for policy, inflation, labor, retail, trade/current-account, export/import, and confidence/sentiment releases.
- [x] Overview Pair Event Feed now shows upcoming events only, with recent releases moved into a separated releases popover.
- [x] Central Banks log section was renamed to `Terminal Console` for consistency with Charts.
- [x] Event Replay modals now reserve header-safe space; Past Releases and Replay Brief were redesigned for readable study workflow.
- [x] Event Replay modal panels now rely on the shared header-safe modal sizing rule instead of conflicting inline max-height utilities.
- [x] Aesthetic Forge is mounted behind a header gear and remains closed by default.
- [x] Differential Calculator was promoted to active Specialist Tools with stable route id `dashboard`.
- [x] Documentation maps were aligned after the fresh Overview checkpoint.
- [x] Event Replay workflow, Charts event overlay density, and Economic Calendar defaults were verified against the active sprint board.
- [x] Garbage folders remain ignored by default:
  - [x] `Main/src/app/tabs/garbage`;
  - [x] `Main/src/app/lib/garbage`;
  - [x] `Main/src/app/tests/garbage`.

## Verification Rules

- Checklist-only edits require no app tests.
- Future Event Replay workflow implementation should run targeted Event Replay tests plus `pnpm --dir Main build`.
- Future Charts overlay implementation should run targeted chart/calendar navigation tests plus `pnpm --dir Main build`.
- Future Economic Calendar polish should run targeted calendar render/navigation tests plus `pnpm --dir Main build`.
- Future display-trust implementation should run targeted calendar display, timezone, and chart tests plus `pnpm --dir Main build`.
- Future Macro Drivers implementation should explain any new test before creating it.
- Future Event Explainer implementation should run targeted Calendar/explainer tests and `pnpm --dir Main build`.
- Future viewport/modal work should use manual viewport inspection at 100% Chrome zoom plus `pnpm --dir Main build`, especially H4/D1 chart event density and Event Replay viewport fit.
- Future Differential promotion should run targeted navigation/Specialist Tools tests plus `pnpm --dir Main build`.
- Do not run broad/full test suites after every small visual pass by default.
- Before adding new tests, get explicit user agreement and explain what behavior the test protects.
- Before CSS splitting, require a specific plan because global cascade risk is high.
- Before reviving Aesthetic Forge, require a specific plan because app-wide styling risk is high.
- Bridge tests are only required if bridge contracts change.

## Stable Assumptions

- The next goal-mode run should start from the remaining unchecked items in this checklist.
- Display trust remains important: calendar values should stay source-preserving, and chart time should stay viewer-time-first.
- Header gear is the chosen settings/config entrypoint.
- Differential Calculator is an active Specialist Tools child, not a primary tab.
- Event explanation must help decision-making without generating trade calls.
- Macro Drivers should explain drivers and missing evidence, not generate buy/sell calls.
- Chart policy is viewer-time-first.
- Calendar value policy is conservative formatting.
- Macro scope is current-data-only until the user explicitly approves external data.
- The app remains decision support, not a signal bot.
- No MT5 bridge API changes are planned for the current roadmap.
- Do not add external data sources until the user explicitly changes the data boundary.
