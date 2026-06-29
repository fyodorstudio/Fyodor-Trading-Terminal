# Fyodor Trading Terminal Checklist

Last updated: 2026-06-29

## Active Planning Source

This file is the active command board for the project.

- Future AI sessions should read this file before older roadmap, audit, or patch notes.
- `docs/Private` stays on disk, but should be ignored unless the user explicitly asks to use it.
- Do not delete `docs/Private` yet.
- Git history is the source for past implementation details; this checklist is for current truth and next work.

## Current Product Truth

- Fyodor is manual-trading decision support, not a signal bot.
- The user performs independent technical analysis in TradingView, then uses Fyodor to understand what is happening behind the selected pair.
- For now, the only trusted raw data sources are MT5 OHLCV and the broker/MT5 economic calendar.
- Central Banks Data is the current strongest reference surface and should not be redesigned casually.
- Event Replay is a serious edge/study surface, not a throwaway prototype.
- Overview should remain a blank rebuild surface until proven specialist outputs deserve summarizing.
- Six Questions, Work In Progress, and the left Aesthetic Forge panel are deprecated/context-risk surfaces for now; do not let them steer new implementation.
- Prototyping is a garbage drawer. Garbage tabs, supporting garbage logic, and garbage tests are ignored by default unless the user explicitly asks for them.
- `react-world-flags` is still used and works. Its missing TypeScript declaration and large `FlagIcon` chunk are known non-blocking noise; do not replace or refactor flags unless explicitly asked.
- Do not create new tests unless the user explicitly agrees and the test's value is explained in plain English first.

## Completed Recently

- [x] Chart UI Polish Pass
  - [x] Fixed timezone dropdown clipping, color contrast, and popover sizing.
  - [x] Made cursor readout modes visually match their intent: `Both` and `True cursor` move freely; `Candle` deliberately snaps to candle price.
  - [x] Separated chart settings and data cache entry points so the icons do not feel like duplicates.
  - [x] Simplified the chart right drawer into cleaner settings/cache views.
  - [x] Verified status rail, toolbar, and drawer behavior at desktop and narrower widths.

- [x] Economic Calendar Modal Redesign
  - [x] Replaced the old centered event modal with a right-side event inspector.
  - [x] Prioritized a concise trading brief, then learning/workflow details.
  - [x] Made actual/forecast/previous, release status, impact, and time context easier to scan.
  - [x] Kept cautious interpretation language and avoided trade-call wording.

- [x] Economic Calendar Visual Polish Follow-Up
  - [x] Fixed the malformed green `Live` status indicator.
  - [x] Replaced noisy freshness pills with quieter audit text.
  - [x] Replaced impact pills with calmer dot + text labels.
  - [x] Cleaned up impact, country, MT5 time, and viewer-time controls.

- [x] Project Skills Setup
  - [x] Installed Matt Pocock skills under `docs/Agent Skills`.
  - [x] Added `docs/Agent Skills/README.md` explaining how each skill can help this project.

- [x] Repo Audit
  - [x] Created `docs/Development Logs/Repo Audit 2026-05-21.md`.
  - [x] Identified repo drift, oversized files, scattered storage/fetch logic, stale docs, and prototype/legacy ambiguity.

- [x] Event Replay Hardening And Docs Truth Pass
  - [x] Kept `EVENT REPLAY` as a direct Specialist Tools child.
  - [x] Removed Event Tools from the Prototyping legacy list.
  - [x] Updated README and current-app map wording so Event Replay is primary, not planned/legacy.
  - [x] Noted older replay/event-quality surfaces as archive candidates, not current workflow.
  - [x] Verified with `pnpm --dir Main test` and `pnpm --dir Main build`.

- [x] Repo Tidiness And Garbage Quarantine
  - [x] Moved garbage-owned tabs into `tabs/garbage` and renamed files to match Prototyping labels.
  - [x] Moved garbage-owned helper logic into `lib/garbage`.
  - [x] Moved garbage tests into `tests/garbage`.
  - [x] Hid the global Aesthetic Forge panel while keeping theme plumbing available.
  - [x] Documented the test policy and known flag warning noise.
  - [x] Kept route ids stable so old garbage screens remain reachable from Prototyping.

## Ordered Roadmap

### 1. Repo Cleanup For AI Navigation

- [x] Treat this checklist as the first file to update when project direction changes.
- [x] Keep `docs/Private` ignored by default unless explicitly requested.
- [x] Record the clarified product direction from 2026-06-26.
- [x] Update root and `Main` READMEs so they match current app truth.
- [x] Add or update a short current-app map:
  - [x] current top-level tabs;
  - [x] Specialist Tools structure;
  - [x] legacy/prototype routes;
  - [x] which surface answers which trading question.
- [x] Prefer extracting stable helpers before deleting tabs or splitting CSS.
- [ ] Extract pure helper/storage/data logic from large tabs while preserving current UI behavior.
  - [x] Extract chart cache and favorites storage from `ChartsTab.tsx` into `chartStorage.ts`.
- [ ] Audit large Event Replay/Event Tools code for helper extraction after UI bug polish.
  - [x] Extract Event Replay localStorage keys, persistence helpers, and replay-count clamping into `eventReplayStorage.ts`.
  - [x] Extract Event Replay pure view helpers into `eventReplayView.ts`.
  - [x] Extract Event Replay chart lifecycle into `EventReplayCandlestickChart.tsx`.
  - [x] Extract Event Replay presentational panels into `EventReplayPanels.tsx`.
  - [x] Rename the active source from `EventToolsTab.tsx` to `EventReplayTab.tsx`.
- [ ] Do not remove legacy/prototype tabs until the six-question mapping marks each one as keep, merge, rewrite, or archive.
- [ ] Later, split global CSS by feature area without renaming selectors.
- [x] Split route/tab bundles with `React.lazy` so inactive heavy tabs are not loaded into the initial app chunk.
- [x] Keep `react-world-flags` as the working flag implementation and document its known non-blocking warnings.

### 2. Event Tools Pair Replay V1

- [x] Promote Event Tools from legacy/prototype framing into a primary Specialist Tools destination.
- [x] Make Event Tools pair-first:
  - [x] user selects a pair such as `EURUSD`;
  - [x] Event Tools owns and remembers its own selected pair;
  - [x] base/quote currency events appear first;
  - [x] major global movers appear in a separate section.
- [x] Let the user select an event type, then select past releases of that event type.
- [x] Replay candle behavior around release time for the selected pair and sample.
- [x] Support configurable candle count before and after the event.
- [x] Preserve timeframe selection.
- [x] Preserve sample navigation.
- [x] Preserve play/pause replay.
- [x] Add simple teaching hints explaining how to read the replay.
- [x] Compare prior releases primarily by `actual vs forecast`.
- [x] Use `actual vs previous` only as secondary context when forecast is missing.
- [x] Keep language descriptive: show how price reacted; do not call trades.
- [ ] Polish current Event Replay layout bugs:
  - [x] Base/Quote Events must not be hidden behind another UI region.
  - [x] Past Releases and previous/next sample controls should be visually close enough to read as one workflow.
  - [x] Main replay workflow should require less vertical scrolling on normal desktop viewports.
  - [x] Replay visual hierarchy should clearly read as pair -> event type -> sample -> candle replay.

### 3. Concise Event Explainer Knowledge Base

- [ ] Use one local knowledge base for both Economic Calendar and Event Tools.
- [x] Reuse `getCalendarEventExplainer` inside Event Replay for selected historical releases.
- [ ] Keep explanations short and practical, not textbook-length.
- [ ] Target major movers first:
  - [ ] policy and rate decisions;
  - [ ] CPI, PCE, and inflation;
  - [ ] labor, NFP, unemployment, wages, and claims;
  - [ ] GDP;
  - [ ] PMI, ISM, and activity;
  - [ ] retail sales;
  - [ ] trade balance and current account;
  - [ ] confidence and sentiment.
- [ ] Each selected-event explainer should answer:
  - [ ] what this event is;
  - [ ] why traders care;
  - [ ] what to compare;
  - [ ] common traps or caveats;
  - [ ] stronger/weaker outcome.
- [ ] Keep explanations local; no live web dependency.
- [ ] Add alias/matching tests so broker event names do not silently fall back to generic explanations.

### 4. Specialist Tools Promotion / Six Questions Mapping

- [ ] Audit every Specialist Tools tab, but do not let Six Questions become product truth.
- [ ] Mark each tab as keep, merge, rewrite, archive, or primary.
- [ ] Map every surviving tab to either a real trading workflow step or archive it; six-question mapping is optional support, not the controlling framework.
- [x] Quarantine old unfinished surfaces in the Prototyping garbage drawer.
- [x] Promote Event Tools once pair-first replay v1 is reliable.
- [ ] Remove or hide prototype framing from surfaces that become primary workflow.
  - [x] Removed Event Replay from Prototyping legacy framing.
- [x] Demoted Six Questions and Work In Progress to draft/archive Specialist Tools labels.
- [ ] Do not promote outputs into Overview until the specialist surface is mature enough to deserve summarizing.

### 5. Visual System Cleanup

- [ ] Define the current operational UI direction before broad redesign.
- [ ] Keep Central Banks, Charts, and Economic Calendar visual improvements as reference points.
- [ ] Reduce tab-to-tab design drift after core workflows stabilize.
- [ ] Split `styles.css` by feature ownership only after helper extraction begins.
- [ ] Avoid redesigning style infrastructure before product surfaces are stable.

### 6. Left Style Panel Beta / Later Redesign

- [x] Do not redesign the left-side style panel during the first cleanup or replay passes.
- [x] Hide the global Aesthetic Forge entrypoint while keeping its theme plumbing on disk.
- [ ] Revisit Aesthetic Forge only if the user asks to reuse it.
- [ ] Add a visible `BETA` or deprecated/prototype label if the panel is mounted again later.
- [ ] Treat the panel as late-stage style infrastructure, not core trading workflow.
- [ ] Do not let the panel drive app-wide design decisions until core surfaces are stable.

## Verification Rules

- [ ] After checklist-only edits: no app tests required unless code changed.
- [ ] Before adding new tests: get explicit user agreement and explain what behavior the test protects.
- [ ] After repo cleanup helper extraction:
  - [x] run `pnpm --dir Main test`;
  - [x] run `pnpm --dir Main build`;
  - [x] preserve existing UI behavior.
- [ ] After Event Tools replay work:
  - [x] unit tests for event filtering by pair base/quote;
  - [x] unit tests for global mover grouping;
  - [x] unit tests for replay candle window sizing;
  - [x] component/static render test for pair selector, event list, replay controls, and teaching hints.
  - [x] run `pnpm --dir Main test`;
  - [x] run `pnpm --dir Main build`.
- [ ] After explainer work:
  - [ ] tests for major broker title aliases;
  - [ ] tests for specific vs family vs generic fallback;
  - [ ] tests that Calendar and Event Tools use the same explainer source.
- [ ] Bridge tests are only required if bridge contracts change.

## Stable Assumptions

- Event Tools is intended to become the main trading-edge research surface.
- Event Tools should be pair-first.
- Base/quote events are primary; global movers are separate.
- Explanations should be concise and practical.
- The app remains decision support, not a signal bot.
- No MT5 bridge API changes are planned for the current roadmap.
- Do not add external data sources until the user explicitly changes the data boundary.
