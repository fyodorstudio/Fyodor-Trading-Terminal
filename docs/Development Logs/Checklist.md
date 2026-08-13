# Fyodor Trading Terminal Checklist

Last updated: 2026-08-13

## Active Planning Source

This file is the current command board. Future AI sessions should read it before older roadmap, audit, or patch notes.

- Keep this file compact and current; git history owns implementation history.
- Ignore `docs/Private` unless the user explicitly asks to use it.
- Do not let Deprecated Overview, Six Questions, Work In Progress, or garbage-drawer code steer active product work.

## Current Product Truth

- Fyodor is a local manual-trading support terminal. It must not present automated execution, guaranteed outcomes, or disguised buy/sell calls.
- The trusted raw-data boundary is MT5 OHLCV plus broker/MT5 economic-calendar rows.
- The EA correctly scales the broker calendar's stored numeric values before sending them. It currently discards `unit`, `multiplier`, `frequency`, and `event_code`, so frontend formatting must remain conservative and source-preserving.
- Chart time is viewer-time-first: the selected timezone controls axis, crosshair, latest-candle, Pair Matrix, and viewer-clock labels.
- Charts is the primary workspace for price, loaded economic events, Event Lens, and Pair Matrix.
- Pair Matrix is a factual candle-range economic timeline for recognized fiat FX pairs. It follows one hovered candle by default and supports a locked, candle-snapped horizontal range.
- Pair Matrix separates releases that occurred `During` the candle/range from economic data `Known before` its opening boundary. Open is inclusive, close is exclusive, and the current candle never exposes future scheduled rows as releases.
- EUR and USD are independent timelines, not event-versus-event rows. During is chronological; Before is newest-first and keeps the latest loaded release per `currency + normalized exact broker title` inside the persisted 1-400 day lookback (90 days by default).
- `Other releases` is the eighth factor and catches every pair-relevant broker row not recognized by the seven curated factors. Unrelated currencies remain excluded.
- Pair Matrix shows raw `Actual`, `Forecast`, `Previous`, `Surprise`, and `Momentum`: `S = A - F`; `M = A - P`. A missing or unsafe input stays unavailable and is never replaced with a different basis.
- Exact series remain distinct across core/headline, m/m, y/y, q/q, and index-level titles.
- Pair Matrix infers percent only from an explicit source suffix or an explicit rate/frequency title. Percent differences display in percentage points; ambiguous values remain unitless. Plain CPI/index values must never acquire a guessed percent sign.
- Pair Matrix does not compare unlike releases, aggregate currency strength, declare a winner, color arithmetic as good/bad, or interpret price direction.
- Pair Matrix has two outward-facing currency timelines. Each entry owns its factor, title, A/F/P/S/M, and time; horizontal placement never claims cross-currency equivalence.
- Factor help explains how to read the category without deterministic currency labels. S/M audit text exposes the formula, raw inputs, unit handling, and the possibility that broker `Previous` is revised.
- Pair Matrix reuses current calendar coverage and lazily requests older anchor-bucketed windows from the existing endpoint. This cannot exceed the bridge's retained calendar history; unavailable backfill must remain an honest loading/error/empty state.
- Economic Calendar tab range controls do not expand the app-level feed or the bridge's retained history.
- Future scheduled chart events should remain discoverable/selectable even when historical marker caps hide older events.
- Active tabs target normal desktop use at 1440x900 and 100% Chrome zoom without whole-page scrolling. Dense surfaces use bounded internal scroll regions.
- Passing tests, typecheck, or build is not a visual audit. Visible Charts, Pair Matrix, or Event Lens changes require the user-facing manual audit checklist when browser automation was not explicitly requested.
- `react-world-flags` is the existing flag dependency. Its large `FlagIcon` build chunk is known non-blocking noise.
- `pnpm run typecheck` is the repository TypeScript gate. Do not create broad/new test suites casually; update focused existing tests for changed behavior.

## Active Roadmap

No active implementation lane is queued after the Pair Matrix candle-range timeline. Await manual UI audit or an explicit next priority.

## Resolved Pair Matrix Decisions

- The historical boundary is candle/range open, not free pointer time. A range closes at the last candle's nominal timeframe close rather than the next loaded candle.
- During shows every loaded release for the pair currencies. Before shows every latest normalized exact series inside the configured lookback across all eight factors.
- Preserve broker `Previous` as supplied even when it may already be revised.
- Keep S/M factual and neutral. No standardized score, cross-currency winner, strength summary, or automatic judgment belongs in this version.
- Keep raw-first frontend handling until MT5 metadata is propagated through the complete data path.
- Leave `Main/mt5-bridge` unchanged for this implementation.

## Deferred / Backlog

These are intentionally not active implementation items. Preserve them unless the user explicitly reprioritizes or removes them.

- [ ] Propagate MT5 calendar `unit`, `multiplier`, `frequency`, and `event_code` through the EA, bridge, frontend types, and formatting logic.
- [ ] Add genuine historical calendar backfill beyond the bridge's retained in-memory window.
- [ ] Replace selected `Other releases` families with new curated factors when explicit inclusion/exclusion rules are agreed.
- [ ] Design a tailored deterministic judgment engine only if the user later asks for interpretation; keep it separate from the factual snapshot.
- [ ] Charts Event Lens interaction and readability polish:
  - [ ] add persisted Event Lens default-selection preference under Chart Events settings;
  - [ ] remove the empty unselected Event Lens modal state;
  - [ ] preserve chart view shape on pair/timeframe changes where practical;
  - [ ] move coverage into the expanded Event Lens modal;
  - [ ] make Release Navigator visual, readable, and factor-driven;
  - [ ] polish future scheduled marker behavior if audit finds a specific problem.
- [ ] External data connectors remain later.
- [ ] COT remains later because it is weekly and outside the current app data stack.
- [ ] Central Banks MoM/YoY toggle remains later backlog.
- [ ] Overview redesign/expansion remains later.
- [ ] Event Replay tab redesign remains later.
- [ ] Future CSS cleanup should remain small, documented, and verified after each extraction or deletion pass.
- [ ] Do not revive Deprecated Overview, Six Questions, WIP, or garbage logic as product sources.

## Completed Work Log

### 2026-08-13

- Pair Matrix was reduced from the deleted Evidence Signal/scoring design to a historical source-data snapshot following hovered candle open.
- Pair Matrix now retains the latest release of every normalized exact title independently and renders the mirrored A/F/P/S/M contract, centered release times, visible age, flags, factor help, and neutral S/M audit details.
- Legacy Pair Matrix scoring/preferences/settings, next-event values, price reaction, comparison, driver, and winner language remain removed.
- Pair Matrix candle-range timeline added: a header range tool snaps across complete candles, locks with adjustable handles, and drives independent During/Known Before currency timelines.
- `Other releases`, exact open/close boundaries, current-candle future exclusion, persisted custom Before lookback, nominal timeframe closes, and pair-scoped historical loading are now part of the factual contract.
- Candle-range overlay repair completed: visible bounds now derive from actual candle centers plus bar spacing, drag preview stays local to the overlay, only release commits timeline state, and heavy timeline rendering is memoized away from unrelated crosshair movement.

### Prior Completed Context

- Pair Matrix initially shipped as a Charts-native lens and shares the compact chart-tool dock with Event Lens.
- Charts calendar-window loading, candle-time anchoring, timezone conversion, unsupported-instrument handling, and bounded bottom-panel mounting were established before the exact-series upgrade.
- Active app surfaces were previously audited at 1440x900 and 100% Chrome zoom, but every visible redesign still needs its own manual audit.
- Overview, Central Banks Data, Economic Calendar, Event Replay, Macro Drivers, and Differential Calculator remain active surfaces.
- Active CSS is split into owned files under `Main/src/styles/`; garbage CSS and code remain isolated and ignored by default.

## Verification Rules

- Pair Matrix changes should update the existing focused Pair Matrix/Charts tests; do not create a parallel suite.
- Verify range snapping/reset, nominal timeframe closes, During/Before boundaries, independent sorting, Other classification, pair isolation, lookback persistence, S/M formatting, honest load states, and absence of automated judgments.
- Run targeted Pair Matrix/Charts tests, `pnpm run typecheck`, production build, and `git diff --check`.
- Do not run Playwright/CDP unless the user explicitly asks.
- The user should manually inspect Charts at 1440x900 and 100% Chrome zoom for header fit, range overlay/handles, forward/reverse drag behavior, independent timeline readability, divider clarity, internal scrolling, adequate chart height, and no whole-page overflow.
- Bridge tests are required only when bridge contracts change.

## Stable Assumptions

- Historical calendar backfill, external data, Overview redesign, Event Replay redesign, and a judgment engine remain out of scope until explicitly reopened.
- Existing Event Replay remains available but should not steer the Charts Event Replay Lens UI.
- Old garbage/deprecated experiments are ignored by default.
- Calendar coverage is loaded-only: a missing old row means it is not retained/loaded, not that no release occurred.
- Pair Matrix follows the hovered candle, falls back to the latest loaded candle, and gives a locked user-selected range precedence over both.
- Mobile may use internal panel scrolling; the no-whole-page-scroll target is desktop 1440x900.
- Macro scope remains current trusted data only until the user explicitly approves another source.
