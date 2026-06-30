# Fyodor Trading Terminal Checklist

Last updated: 2026-06-30

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
- “How to take advantage” means interpret event context, affected markets, confirmation workflow, traps, and stronger/weaker scenarios. It must not become buy/sell calls.
- Economic Calendar event explanation is a critical product surface because scheduled events are one of the main reasons price can move.
- Overview is active, but still needs compact event-feed polish and 100% Chrome zoom fit work.
- Event Replay is active, but still needs modal, past-release, replay-brief, and remaining viewport polish.
- Central Banks Data is an active reference surface and should not be redesigned casually.
- Differential Calculator should leave garbage and become an active Specialist Tools child, not a primary top-nav tab.
- Aesthetic Forge remains hidden. Future revival should start as a small header gear entrypoint, not a left bookmark or full Settings tab.
- Prototyping is a garbage drawer. Garbage tabs, supporting garbage logic, and garbage tests are ignored by default unless the user explicitly asks for them.
- Deprecated Overview, Six Questions, Work In Progress, and hidden Aesthetic Forge must not steer new product work.
- `react-world-flags` is still used and works. Its missing TypeScript declaration and large `FlagIcon` chunk are known non-blocking noise; do not replace or refactor flags unless explicitly asked.
- Do not create new tests unless the user explicitly agrees and the test's value is explained in plain English first.

## Active Roadmap

### 1. Economic Calendar Event Explainer Overhaul

This is the next active implementation lane.

- [x] Redesign the selected-event right drawer/popover UI.
- [x] Use the existing shared event explainer data as the source; do not add external data or web dependency.
- [ ] Present event help around:
  - [x] release/result snapshot;
  - [x] what this event is;
  - [x] why traders care;
  - [x] affected currency, pairs, and tradable themes;
  - [x] what to compare: actual, forecast, previous, and revisions where relevant;
  - [x] stronger/weaker outcome interpretation;
  - [x] practical confirmation workflow;
  - [x] traps and caveats.
- [x] Keep wording practical and exhaustive enough to fill knowledge gaps, but still cautious and descriptive.
- [x] Restore and continue the unfinished event knowledge coverage checklist:
  - [x] policy and rate decisions;
  - [x] CPI, PCE, and inflation;
  - [x] labor, NFP, unemployment, wages, and claims;
  - [x] retail sales;
  - [x] trade balance and current account;
  - [x] confidence and sentiment.
- [x] Add alias/fallback coverage work so broker event names do not silently fall back to generic explanations.
- [x] Keep the Economic Calendar and Event Replay explainer path shared where practical.

### 2. Viewport And Modal Polish

- [ ] Active tabs should target normal 100% Chrome zoom and should not require zooming to 75%.
- [ ] Overview:
  - [ ] remove the minor scroll when bridge data fills in;
  - [x] change `Pair Event Feed` to show upcoming events only;
  - [x] move recent releases into a popover opened by a clear `See recent releases` action;
  - [x] show upcoming and past releases in that popover, separated by a clean divider;
  - [x] allow base/quote macro cards to include compact upcoming event context beneath current data.
- [ ] Event Replay:
  - [x] remove remaining whole-tab scroll where possible;
  - [x] fix centered modal top/bottom overlap with the header/app frame;
  - [x] redesign `Past Releases` modal so date/time and actual/forecast/previous are readable;
  - [x] redesign `Replay Brief` content and layout so it feels like a useful study brief, not stacked debug boxes.
- [ ] Central Banks:
  - [x] rename `Global Mapping Audit` to `Terminal Console` for log naming consistency.

### 3. Global Settings / Visual Config Entry

- [x] Plan Aesthetic Forge revival as a small gear icon near the Fyodor title/header area.
- [x] Do not use a left bookmark tab for v1.
- [x] Do not add a full Settings primary tab for v1.
- [x] Keep the panel hidden by default until the gear is clicked.
- [x] Limit v1 scope to global configuration with a clear role.
- [x] Do not let the visual/config panel drive broad visual redesign until active surfaces are stable.

### 4. Differential Calculator Promotion

- [ ] Promote Differential Calculator from garbage into active Specialist Tools.
- [ ] Keep it under Specialist Tools, not primary top nav.
- [ ] Use existing route id `dashboard` for compatibility unless a later route migration plan explicitly changes it.
- [ ] Move `DifferentialCalculatorTab` out of `tabs/garbage` into active secondary tools.
- [ ] Move its supporting helper logic out of `lib/garbage`.
- [ ] Add it as a Specialist Tools child, likely grouped as `Active Tool`.
- [ ] Keep Prototyping as garbage-only.

### 5. Backlog

- [ ] Central Banks MoM/YoY toggle remains later backlog.
- [ ] Do not start broad CSS splitting yet.
- [ ] Do not revive Deprecated Overview, Six Questions, WIP, or garbage logic as product sources.

## Completed Checkpoints

- [x] Visual unification and viewport first pass completed.
- [x] Active app shell no longer has the old fixed 1460px content ceiling.
- [x] Charts diagnostic `Terminal Console` is collapsible.
- [x] Central Banks focus view is denser, with audit logs collapsed.
- [x] Economic Calendar table uses a desktop scroll region.
- [x] `Main/src/styles.css` ownership was audited; do not split it without a specific visual-regression plan.
- [x] Overview was rebuilt fresh from `OverviewPlaceholderTab.tsx`, not Deprecated Overview.
- [x] Overview has pair selector, next pair event/countdown, route buttons, base/quote macro cards, and recent pair-relevant events.
- [x] Event Replay preserves pair -> event -> release -> replay setup -> playback.
- [x] Overview -> Event Replay opens on the selected Overview pair without forcing normal Event Replay launches to mirror Overview.
- [x] Event Replay keeps pair-first event grouping and major global movers separate.
- [x] Economic Calendar selected-event drawer now presents release snapshot, event meaning, affected markets, comparisons, confirmation workflow, outcome scenarios, and caveats from the shared explainer data.
- [x] Calendar event aliases now cover more broker title variants for policy, inflation, labor, retail, trade/current-account, export/import, and confidence/sentiment releases.
- [x] Overview Pair Event Feed now shows upcoming events only, with recent releases moved into a separated releases popover.
- [x] Central Banks log section was renamed to `Terminal Console` for consistency with Charts.
- [x] Event Replay modals now reserve header-safe space; Past Releases and Replay Brief were redesigned for readable study workflow.
- [x] Aesthetic Forge is mounted behind a header gear and remains closed by default.
- [x] Documentation maps were aligned after the fresh Overview checkpoint.
- [x] Garbage folders remain ignored by default:
  - [x] `Main/src/app/tabs/garbage`;
  - [x] `Main/src/app/lib/garbage`;
  - [x] `Main/src/app/tests/garbage`.

## Verification Rules

- Checklist-only edits require no app tests.
- Future Event Explainer implementation should run targeted Calendar/explainer tests and `pnpm --dir Main build`.
- Future viewport/modal work should use manual viewport inspection at 100% Chrome zoom plus `pnpm --dir Main build`.
- Future Differential promotion should run targeted navigation/Specialist Tools tests plus `pnpm --dir Main build`.
- Do not run broad/full test suites after every small visual pass by default.
- Before adding new tests, get explicit user agreement and explain what behavior the test protects.
- Before CSS splitting, require a specific plan because global cascade risk is high.
- Before reviving Aesthetic Forge, require a specific plan because app-wide styling risk is high.
- Bridge tests are only required if bridge contracts change.

## Stable Assumptions

- The next goal-mode run should start from this checklist.
- Header gear is the chosen settings/config entrypoint.
- Differential Calculator should become an active Specialist Tools child, not a primary tab.
- Event explanation must help decision-making without generating trade calls.
- The app remains decision support, not a signal bot.
- No MT5 bridge API changes are planned for the current roadmap.
- Do not add external data sources until the user explicitly changes the data boundary.
