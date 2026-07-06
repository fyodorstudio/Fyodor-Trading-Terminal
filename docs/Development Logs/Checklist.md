# Fyodor Trading Terminal Checklist

Last updated: 2026-07-06

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
- Event Replay is active; modal, past-release, replay-brief, and viewport polish have had a first pass and still need visual inspection.
- Central Banks Data is an active reference surface and should not be redesigned casually.
- Differential Calculator is an active Specialist Tools child, not a primary top-nav tab.
- Macro Drivers is an active Specialist Tools child for forex and gold; its wide Calendar Factor Coverage table was removed, but the page still needs 100% Chrome zoom inspection.
- Charts event overlay uses clustered/adaptive markers; it should still be visually inspected on dense calendar weeks.
- Aesthetic Forge is mounted behind the header gear and stays closed by default.
- Prototyping is a garbage drawer. Garbage tabs, supporting garbage logic, and garbage tests are ignored by default unless the user explicitly asks for them.
- Deprecated Overview, Six Questions, and Work In Progress must not steer new product work.
- External data sources remain out of scope unless explicitly approved later.
- `react-world-flags` is still used and works. Its missing TypeScript declaration and large `FlagIcon` chunk are known non-blocking noise; do not replace or refactor flags unless explicitly asked.
- Do not create new tests unless the user explicitly agrees and the test's value is explained in plain English first.

## Active Roadmap

### 1. Visual Unification And Viewport Fit

This is reopened. The first pass helped, but it is not complete.

- [ ] Active tabs should target 100% Chrome zoom on normal desktop without whole-page vertical scrolling.
- [ ] Use bounded panels, popovers, modals, collapsible sections, and internal scroll regions for detail overflow.
- [x] Macro Drivers wide factor table removed; page height is reduced.
- [x] Overview pair-brief layout was redesigned around Pair Driver Snapshot.
- [x] Overview, Charts, and Macro Drivers were inspected at 1440x900 / 100% browser zoom with no document-level vertical scroll in the default/offline state.
- [x] Overview and Charts were inspected at 1440x900 / 100% browser zoom with simulated populated bridge/calendar data and no document-level vertical scroll.
- [ ] Recheck with the real local MT5 bridge when available before treating live-state viewport fit as fully proven.
- [ ] Future visual implementation must include manual viewport inspection at 100% Chrome zoom plus `pnpm --dir Main build`.

### 2. Charts Event Overlay Polish

- [x] Replace one badge per event with clustered event markers.
- [x] Use one clean vertical line per nearby time/candle cluster.
- [x] Summarize cluster badges, for example `EUR x4`, `USD high`, or `3 events`.
- [x] Use adaptive labels:
  - [x] always draw event lines;
  - [x] show badges for high-impact or selected/hovered clusters;
  - [x] suppress nonessential badges when the chart is crowded.
- [x] Clicking a cluster opens a compact mini event-list popover.
- [x] Each row in the mini popover opens the Economic Calendar inspector for that event.
- [x] Keep existing event overlay scope settings.
- [x] Do not add wider historical calendar fetching in this pass.
- [x] Dense chart-event clusters were inspected with simulated loaded broker-calendar rows; nearby clusters now keep lines but suppress lower-priority overlapping badges.
- [ ] Recheck dense chart-event weeks with real broker calendar rows when the local bridge is populated.

### 3. Overview Pair Driver Snapshot Redesign

- [x] Remove the dark standalone `Next Pair Event` card.
- [x] Remove redundant mini navigation/workflow buttons leading to other tabs.
- [x] Redesign the top-right Overview area as `Pair Driver Snapshot`.
- [x] Move pair-level Calendar Factor Coverage out of Macro Drivers and into Overview.
- [x] Put compact base/quote factor chips or mini cards under the base/quote macro cards.
- [x] Add a `Pair details` popover for detailed latest/next factor rows.
- [x] Keep upcoming pair-event information, but redesign `Pair Event Feed` so `See recent releases` still has a clear home.
- [x] Preserve the no-whole-page-scroll target at 1440x900 / 100% browser zoom in the default/offline state.
- [x] Preserve the no-whole-page-scroll target at 1440x900 / 100% browser zoom in a simulated populated bridge/calendar state.
- [ ] Recheck with real local bridge data because live broker titles and macro values can still change card height.

### 4. Macro Drivers Cleanup

- [x] Remove the current wide `Calendar Factor Coverage` table from Macro Drivers.
- [x] Keep Macro Drivers focused on:
  - [x] trend state;
  - [x] current macro snapshot;
  - [x] missing-data honesty;
  - [x] forex/gold driver context.
- [x] Keep Macro Drivers under Specialist Tools, not primary top nav.

### 5. Backlog

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
- [x] Aesthetic Forge is mounted behind a header gear and remains closed by default.
- [x] Differential Calculator was promoted to active Specialist Tools with stable route id `dashboard`.
- [x] Documentation maps were aligned after the fresh Overview checkpoint.
- [x] Garbage folders remain ignored by default:
  - [x] `Main/src/app/tabs/garbage`;
  - [x] `Main/src/app/lib/garbage`;
  - [x] `Main/src/app/tests/garbage`.

## Verification Rules

- Checklist-only edits require no app tests.
- Future display-trust implementation should run targeted calendar display, timezone, and chart tests plus `pnpm --dir Main build`.
- Future Macro Drivers implementation should explain any new test before creating it.
- Future Event Explainer implementation should run targeted Calendar/explainer tests and `pnpm --dir Main build`.
- Future viewport/modal work should use manual viewport inspection at 100% Chrome zoom plus `pnpm --dir Main build`.
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
