# Fyodor Trading Terminal Checklist

Last updated: 2026-08-20

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
- Pair Matrix keeps its raw timeline factual and adds a separate deterministic momentum layer. The layer compares each registered series only with its own Forecast and Previous values; it does not compare raw magnitudes across unlike releases, declare a winner, or claim price causation.
- Pair Matrix exposes an on-demand full-screen `How scoring works` guide. The live summary and guide share the same explicit During/Known before and Economy/Inflation/Policy vocabulary; per-column help owns arrow meaning and formula audits.
- Pair Matrix timeline rows can be grouped session-locally by `Factor` (the default) or exact `Release time`. Factor groups use the fixed eight-factor order; simultaneous packages never merge currencies, and all four currency/section rails keep independent accordion state.
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

- [x] Implement the Pair Matrix deterministic momentum engine:
  - [x] add the exclusive, auditable `PAIR_MATRIX_MOMENTUM_REGISTRY` for conservative economy, inflation, and canonical policy-rate titles;
  - [x] score equal-weight Surprise and Momentum directions with an agreement bonus, capped score groups, and one vote per economic factor;
  - [x] keep During/New Evidence and Known Before/Background calculations independent;
  - [x] render compact mirrored economy, inflation, and policy states with complete formula tooltips;
  - [x] add neutral scored-release ticks to the locked range band without disturbing existing chart-event dots or drag performance;
  - [x] update focused tests and complete the required typecheck, build, diff, and manual-audit handoff.

## Resolved Pair Matrix Decisions

- The historical boundary is candle/range open, not free pointer time. A range closes at the last candle's nominal timeframe close rather than the next loaded candle.
- During shows every loaded release for the pair currencies. Before shows every latest normalized exact series inside the configured lookback across all eight factors.
- Preserve broker `Previous` as supplied even when it may already be revised.
- Preserve raw S/M as factual audit data. The new judgment layer uses only registered per-series comparison direction (`+1/0/-1`), an agreement bonus, capped groups, and equal factor votes; it never standardizes or compares raw values across series.
- Economy outputs are `IMPROVING`, `WEAKENING`, `NET 0`, or `NO SCORED DATA`. Inflation and policy stay separate; the relative pair line uses economy only.
- Keep raw-first frontend handling until MT5 metadata is propagated through the complete data path.
- Leave `Main/mt5-bridge` unchanged for this implementation.

## Deferred / Backlog

These are intentionally not active implementation items. Preserve them unless the user explicitly reprioritizes or removes them.

- [ ] Propagate MT5 calendar `unit`, `multiplier`, `frequency`, and `event_code` through the EA, bridge, frontend types, and formatting logic.
- [ ] Add genuine historical calendar backfill beyond the bridge's retained in-memory window.
- [ ] Replace selected `Other releases` families with new curated factors when explicit inclusion/exclusion rules are agreed.
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

## Pair Matrix Research Lab

These are independent exploration sketches, not committed implementation specifications. Choose and refine one checkbox before implementation; preserve the trusted MT5 data boundary, factual raw timeline, and current deterministic scoring behavior while experimenting.

- [ ] Refresh the Charts right-side settings panel and improve its information hierarchy.
- [ ] Investigate Pair Matrix hover latency before choosing an architecture:
  - profile timeline selection, scoring, grouping, and React rendering;
  - try indexing, caching, narrower state updates, and a Web Worker first;
  - consider bridge/backend calculation only if measured frontend work remains excessive, because moving calculations alone may not fix rerender lag.
- [ ] Prototype a `Score chart` Pair Matrix mode:
  - retain the normal OHLC chart above with a time-aligned economic pane below;
  - open the mode by clicking a During-range release;
  - provide a right-side selector for other releases or families inside the locked range;
  - support event-point/stem views, family lanes, and experimental rolling or step-state scores;
  - keep the current raw timeline available as the audit source.
- [ ] Research same-family aggregation:
  - never average raw CPI/GDP/etc. magnitudes across different exact series;
  - experiment with aggregating their common deterministic `-3…+3` event scores;
  - compare capped sum, mean, most-recent, and release-package aggregation before choosing a permanent rule;
  - prevent release quantity from dominating a family.
- [ ] Research multi-family visualization:
  - compare selectable overlays, stacked family lanes, and small multiples;
  - preserve a shared time axis with OHLC;
  - distinguish discrete release impulses from background/known-before state.
- [ ] Design an editable scoring configuration for registry inclusion, direction inversion, family assignment, caps, weighting, recency, and aggregation, with transparent formulas and safe defaults.
- [ ] Add an experimental price-response audit that can display confirmation, rejection, or unresolved response without claiming causation or producing buy/sell calls.
- [ ] Show country/region provenance for EUR releases and evaluate `Euro area only` versus `Euro area + member countries` scope.
- [ ] Manually redesign the scoring tutorial after the scoring-chart workflow stabilizes.

## Fyodor Macro Signal

- [x] Freeze and document `FMS-EURUSD-ECO-H4-v1` before inspecting results.
- [x] Replace the bridge's temporary calendar list with durable local SQLite history and explicit EUR/USD coverage reporting.
- [x] Add the versioned backend Economy simulation with strict next-H4 entry, ATR(14) Wilder risk, 1R/1.5R/2R targets, 30-H4 expiry, independent cases, and M1 ambiguity resolution.
- [x] Add the bounded Specialist Tools `Macro Signal Lab` with coverage/backfill guidance, target summaries, holdout gate, cohort breakdowns, and case audit.
- [x] Perform the controlled EUR/USD MT5 historical backfill and verify actual broker coverage.
- [x] Run the frozen v1 result once, audit chronological holdout evidence, and record `No validated edge` without changing the formula.
- [x] Add plain-language v1 conclusions, development-versus-holdout cohort comparisons, and a source-data quality audit to Macro Signal Lab.
- [x] Pre-register country-aware Labor-only `FMS-EURUSD-LABOR-H4-v2`; disclose that its historical data was selected after viewing v1 and is not untouched evidence.
- [x] Freeze the v2 forward-paper boundary at registration plus a 365-day, 100-evaluable-case, positive-lower-95%, ambiguity, and future cost-model gate.
- [x] Run v2's exploratory historical baseline and implement its immutable automatic forward-paper ledger without promoting it to Charts.
- [x] Activate the forward ledger by compiling/reloading the upgraded calendar EA and verify a successful complete-cycle acknowledgement; genuinely new v2 releases now accumulate without manual backtest refreshes.
- [x] Add an opt-in EURUSD/H4 `Macro bias` Charts layer for recurring v2 patterns that pass fixed development-and-holdout historical gates, with clickable sample/expectancy/source-event audits and no automatic execution.
- [x] Harden Charts signals as `FMS-EURUSD-LABOR-H4-CQ-v3`: separate immutable post-activation Current Model from hindsight Research Replay; move directional arrows to the first strictly later H4 entry candle; retain a release dot; end active state on resolved outcomes; add three-pip stress, 1R/1.5R/2R sensitivity, cost break-even, uncertainty, recent-window, year-stability, and past-only qualification audits; freeze US-payroll Short as current while demoting recently weakened Euro-area-unemployment Long to replay-only.
- [x] Run a fixed-factor EURUSD/H4 search across registered Economy families; reject unstable activity, trade, and retail leads; register country-aware `FMS-EURUSD-SENTIMENT-H4-v3`; and freeze `FMS-EURUSD-MULTI-H4-CQ-v4` with US-payroll Short plus symmetric Euro-area-consumer-sentiment direction as Current Model patterns.
- [x] Add the Charts v4 real-time decision card: explicit Long/Short/No-qualified-bias state, exact condition, historical target-first/stop-first/stressed-average audit, next EUR/USD event, next structurally possible frozen setup, and an honest H4-model-on-H1 view.
- [x] Explain sparse Macro Bias regions with the last replay-arrow date and later nonmatching scored-package count; repair the audit/current-card toolbar overlap; and make release connectors follow chart drag/zoom through imperative frame updates rather than React rerenders.
- [x] Freeze country-aware Growth source `FMS-EURUSD-GROWTH-H4-v7`, reject the negative broad baseline and unstable GDP/PMI/retail/trade signatures, preserve interim v8 immutably, then freeze Charts `FMS-EURUSD-MULTI-H4-CQ-v9` with positive stressed 1R/1.5R/2R required, promote US-industrial-output Short, and move payroll Short to Research Replay after its lower targets failed that stronger gate.
- [x] Freeze and run country-aware `FMS-EURUSD-POLICY-INFL-H4-v5`: deduplicate exact series/timestamps, test strict consumer/producer inflation and canonical Fed/ECB decisions, reject direct policy arrows, and retain Euro-area producer-inflation Long as failed-year-gate research only.
- [x] Freeze Charts `FMS-EURUSD-MULTI-H4-CQ-v6`: preserve the two v4 Current Model patterns, add factual EUR/USD Policy/Inflation context, add the v5 producer-inflation candidate only to Research Replay, and connect each release ring visually to its strictly later H4 activation arrow.
- [x] Replace the Current Model card with `FMS Shadow Trader`: configurable `$1,000`/`0.5%` defaults, one gross hypothetical position at a time, 1x ATR(14) stop, frozen 2R target, sequential compounding, historical current-pattern replay, explicit No-trade/Waiting/Possible-next-setup states, and no MT5 execution. Exclude spread, commission, slippage, and swap instead of estimating them; keep the Research Replay audit below the Pair Matrix dock.
- [x] Turn Shadow Trader into the current-registry benchmark: larger readable type, MT5-time countdown and explicit if/then outcomes for the next setup, expandable gross N/target-first/stop-first/expectancy/recent/year/development/holdout/past-only/target-sensitivity evidence for every eligible setup, flexible `$1+` and `0.01–100%` simulation inputs, and sub-second cached Current Model responses that do not reload across H4/H1 switches.
- [x] Freeze Charts `FMS-EURUSD-MULTI-H4-CQ-v10` with separate per-setup exits for complete US producer-inflation cooling and exact US payroll packages while retaining the v9 sentiment and industrial patterns.
- [x] Implement `FMS-EURUSD-NUMERIC-ROBUST-H4-v11` as a separate reused-history research layer: test S/M modes, prior-Actual revision reliability, package completeness, Before alignment, score magnitude, continuation/rejection direction, and flexible exits; retain v10 unchanged and record 12 deduplicated exploratory leads with no strict lower-95 holdout pass.
- [ ] Freeze a small non-overlapping next-version experiment from v11 rather than promoting every mined lead. Start with EUR manufacturing-PMI S/M agreement and the EUR business-sentiment rejection pattern; keep the boundary-selected USD CPI-cooling rule and the weakened industrial-output rule out until a separately declared decision is made.
- [ ] Keep learned weights, policy-language interpretation, regime-fitted filters, and additional broader signal patterns deferred until separately versioned research justifies them.

## Completed Work Log

### 2026-08-15

- Pair Matrix deterministic momentum engine completed as a separate auditable layer above the unchanged raw timeline.
- The exclusive `PAIR_MATRIX_MOMENTUM_REGISTRY` now recognizes conservative economy and inflation families plus canonical policy decisions for USD, EUR, GBP, JPY, AUD, CAD, NZD, and CHF. Every rule records its direction, score group, rationale, and official source reference; unmatched releases remain visible but unscored.
- Each exact series now receives equal-weight Surprise and Momentum direction points, with a same-direction agreement bonus. Related releases are capped within score groups and each economic factor casts at most one currency vote, preventing release quantity or numeric scale from dominating.
- During/New Evidence and Known Before/Background remain fully separate. Economy reads `IMPROVING`, `WEAKENING`, `NET 0`, or `NO SCORED DATA`; inflation reads heating/cooling separately; policy reports tightening/holding/easing from the latest canonical decision without treating statement guidance as the rate value.
- Compact mirrored summaries expose the complete formula and contributing-row audit through accessible tooltips. The pair line uses economy votes only and makes no causation or trade-direction claim.
- Locked ranges now show neutral top-edge ticks for scored During releases, clustered per actual candle when necessary. Existing calendar dots and local-only range-drag preview behavior remain separate.
- Pair Matrix keeps its compact default height but now has an accessible top-edge vertical resize separator, allowing an expanded chart/panel split while preserving a usable chart. Momentum summary values, vote arrows, currency codes, and enlarged flags use a consistent prominent presentation; populated timeline rows use a two-pixel type-size increase with taller rows.
- Pair Matrix scoring onboarding completed: an edge-to-edge accessible guide teaches time boundaries, raw A/F/P/S/M, equal-weight event scoring, agreement, group caps, factor votes, lower-is-better inversion, limitations, and the chart workflow. Its collapsed registry reference is generated from the exclusive live registry and links each rule to its official source.
- Pair Matrix timeline grouping completed: a session-local `Group by` control defaults to collapsed factor parents and can switch to exact-timestamp packages, while EUR/USD and During/Known-before expansions remain independent and raw A/F/P/S/M child rows stay unchanged.
- Focused Pair Matrix/Charts verification passed with 56 tests, repository typecheck passed, and the production build passed. The known large main-chunk warning remains non-blocking.

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
- Verify range snapping/reset, nominal timeframe closes, During/Before boundaries, independent sorting, Other classification, pair isolation, lookback persistence, S/M formatting, honest load states, exact-series-only comparisons, score inversion, group caps, factor votes, registry exclusions, canonical policy aliases, and complete audit formulas.
- Preserve the boundary between the factual raw timeline and deterministic interpretation: no cross-series magnitude comparison, standardization, price-causation claim, trade direction, or hidden scoring of unmatched releases.
- Run targeted Pair Matrix/Charts tests, `pnpm run typecheck`, production build, and `git diff --check`.
- Do not run Playwright/CDP unless the user explicitly asks.
- The user should manually inspect Charts at 1440x900 and 100% Chrome zoom for header fit, range overlay/handles, forward/reverse drag behavior, independent timeline readability, divider clarity, internal scrolling, adequate chart height, and no whole-page overflow.
- Bridge tests are required only when bridge contracts change.

## Stable Assumptions

- Historical calendar backfill, external data, Overview redesign, and Event Replay redesign remain out of scope until explicitly reopened.
- Existing Event Replay remains available but should not steer the Charts Event Replay Lens UI.
- Old garbage/deprecated experiments are ignored by default.
- Calendar coverage is loaded-only: a missing old row means it is not retained/loaded, not that no release occurred.
- Pair Matrix follows the hovered candle, falls back to the latest loaded candle, and gives a locked user-selected range precedence over both.
- Mobile may use internal panel scrolling; the no-whole-page-scroll target is desktop 1440x900.
- Macro scope remains current trusted data only until the user explicitly approves another source.
