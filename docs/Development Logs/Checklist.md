# Fyodor Trading Terminal Checklist

Last updated: 2026-07-02

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
- Overview is active, but still needs final 100% Chrome zoom fit review when bridge data is populated.
- Event Replay is active; modal, past-release, replay-brief, and viewport polish have had a first pass and still need visual inspection.
- Central Banks Data is an active reference surface and should not be redesigned casually.
- Differential Calculator is an active Specialist Tools child, not a primary top-nav tab.
- Macro Drivers is the intended next new active Specialist Tools child for forex and gold only.
- Aesthetic Forge is mounted behind the header gear and stays closed by default.
- Prototyping is a garbage drawer. Garbage tabs, supporting garbage logic, and garbage tests are ignored by default unless the user explicitly asks for them.
- Deprecated Overview, Six Questions, and Work In Progress must not steer new product work.
- External data sources remain out of scope unless explicitly approved later.
- `react-world-flags` is still used and works. Its missing TypeScript declaration and large `FlagIcon` chunk are known non-blocking noise; do not replace or refactor flags unless explicitly asked.
- Do not create new tests unless the user explicitly agrees and the test's value is explained in plain English first.

## Active Roadmap

### 1. Display Trust Fixes

This is the next active implementation lane. Fix these before building Macro Drivers.

- [x] Economic Calendar values:
  - [x] conservatively infer obvious units from value text and event title;
  - [x] preserve raw source value via hover/title or equivalent;
  - [x] keep uncertain values honest instead of pretending units are known;
  - [x] do not change the MT5 bridge contract.
- [x] Charts timezone:
  - [x] viewer time is the default truth;
  - [x] axis labels, crosshair labels, latest-candle labels, and viewer clock should agree with the selected viewer timezone;
  - [x] MT5/server time remains selectable as an audit/cross-check mode.

### 2. Overview Release Popover Polish

- [x] Update `See recent releases` popover to organize releases into two clear groups:
  - [x] `BASE/XXX`;
  - [x] `QUOTE/XXX`.
- [x] Keep upcoming and past releases visually separated.

### 3. Macro Drivers Tool

- [ ] Add `Macro Drivers` as an active Specialist Tools child, not primary nav and not garbage.
- [ ] Scope v1 to forex and gold.
- [ ] Use current data only:
  - [ ] MT5 OHLCV;
  - [ ] broker/MT5 calendar rows;
  - [ ] central-bank snapshots.
- [ ] Include a small missing-data note explaining what would improve with yields, COT, ETF/flow data, real-rate data, Fed pricing, DXY/risk proxies, and similar sources.
- [ ] Trend state defaults:
  - [ ] W1 = broad regime context;
  - [ ] D1 = main trend/breakout state;
  - [ ] H4 = confirmation/timing.
- [ ] Add plain-English tooltips explaining how trend/regime labels work.
- [ ] Put expanded pair metrics here first:
  - [ ] unemployment;
  - [ ] wages;
  - [ ] jobless claims;
  - [ ] retail sales;
  - [ ] PMI;
  - [ ] sentiment;
  - [ ] trade/current account;
  - [ ] inflation;
  - [ ] policy rate;
  - [ ] related calendar-derived factors.
- [ ] All metrics must show coverage/confidence/missing-data honesty.
- [ ] Gold support in v1 means XAUUSD price trend plus USD/calendar/central-bank context, with missing gold-specific drivers clearly noted.

### 4. Backlog

- [ ] External data connectors remain later.
- [ ] COT remains later because it is weekly and not currently in the app data stack.
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
- The next implementation should fix calendar values and chart timezone before building Macro Drivers.
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
