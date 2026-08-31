# Current App Map

Last updated: 2026-08-31

This is the short orientation doc for future AI and human sessions. Read it with `Checklist.md` before using older roadmap, audit, or patch notes.

## Active Planning Rule

- `docs/Development Logs/Checklist.md` is the active command board.
- `docs/Private` stays on disk but should be ignored unless the user explicitly asks for it.
- Git history is the source for old implementation details.

## Product Direction

- Fyodor supports manual trading decisions; it does not produce trade calls.
- The user does technical analysis outside the app, mainly in TradingView, then uses Fyodor to inspect fundamentals, calendar risk, central-bank context, and event reaction history for the pair of interest.
- Current trusted raw data is limited to MT5 OHLCV plus broker/MT5 economic-calendar rows.
- Central Banks Data is the strongest current reference surface and should remain stable unless a targeted bug requires changes.
- FMS is the primary research objective. Event Replay and Macro Drivers are retained garbage/reference surfaces and must not steer active work.
- Six Questions and Work In Progress are deprecated/context-risk surfaces for now; do not use them as controlling product direction. Aesthetic Forge is mounted behind the header gear and stays closed by default.

## Current Top-Level Tabs

1. `Overview`
   - Current state: fresh pair-brief surface.
   - Uses the selected pair, active MT5 calendar rows, active central-bank snapshots, and market status.
   - Shows pair selector, Pair Driver Snapshot, next loaded pair event/countdown, base/quote macro cards, compact factor coverage, pair details popover, and recent-release popover.
   - It is a glanceable decision-support brief, not a signal or trade-call surface.
   - The older implementation is still available as `Deprecated Overview` through Prototyping.

2. `Central Banks Data`
   - Current state: primary, useful surface.
   - Uses MT5 calendar rows to derive major-currency policy/inflation snapshots.
   - Unresolved values should stay unresolved.

3. `Charts`
   - Current state: primary, useful surface.
   - Research engine `FMS-RELEASE-REACTION-H4-v1` feeds `FMS-REGISTERED-REACTION-H4-v5`: the immutable 47-recipe v4 registry plus three reviewed break-even execution overlays for AUDUSD US producer inflation, NZDUSD US producer inflation, and USDJPY Japan inflation. The overlays were selected on development data, remained positive on later data, improved drawdown/losing streak, and stayed positive across neighboring contracts. Historical arrows retain the execution contract active at their event time. Every base recipe still reconciles with its current-scoring-engine experiment; Shadow Trader explicitly says no setup is safe to follow blindly.
   - Workbench static catalog/model/data-period payloads are cached durably by source-run, candle, and registry revision. Opening the Workbench reads the small shell plus current experiment/candidate headers; it does not deserialize every candle and source outcome after each tab visit.
   - Uses `lightweight-charts`, MT5 history/stream data, chart cache, cursor readout modes, chart settings, and clustered broker-calendar event markers.
   - Bridge MT5 access is serialized because the Python MT5 session is process-global. Foreground history routes use a bounded wait and durable-candle fallback, so background FMS work cannot indefinitely block Charts; successful live reads refresh the cache.
   - Registered FMS markets have one opt-in `Macro bias` view. The scanner always uses the registered current rules; `Past arrows` merely shows or hides their hindsight history, so users no longer choose between separate Current Model and Research Replay modes. All arrows project the frozen H4 contract across the selected chart timeframe; they do not claim a native lower- or higher-timeframe backtest. One clickable directional arrow owns the first strictly later H4 activation candle; the release timestamp remains in its audit instead of using a detached dot and connector.
   - The top-right `FMS Shadow Trader` is global across registered markets. It opens with `What would FMS do now?`, the current/last hypothetical Trade Monitor, and a collapsed multi-release upcoming-setup list. Pair-flag controls filter the Live Watchlist without changing the registry. Every setup owns an explicit historical-audit readiness badge; an incomplete or mismatched immutable audit blocks new Shadow Trader matching while preserving the row for inspection. The watchlist sorts by actionability, readiness, historical average R, TP-before-SL, sample, next release, or market/family. Its combined account/replay surface explicitly separates the all-pair post-activation ledger from selected-pair historical replay, documents sequential compounding and collision exclusions, and no longer treats opposing directions on different pairs as conflicts. Policy/inflation remains collapsed observational background and cannot alter a frozen trade. Research contenders and avoid-direction knowledge remain available at the bottom. Arrow audits follow the task reading order—triggering event/package and direction first, result second, timing third, historical benchmark fourth, disclaimer last—and leave broader diagnostics to the Workbench. Spread, commission, slippage, and swap are excluded rather than estimated; no order is sent to MT5.
   - Expanded Shadow Trader setup rows now expose fixed-horizon reaction profiles at `1/3/6/12/30 H4`, direction-adjusted pips/ATR/R distributions, MFE/MAE timing and giveback, deterministic reaction classifications, and development-selected contract research that cannot rewrite the active contract. Arrow audits show the first-H4 price reaction before the frozen TP/SL result, so `price followed the arrow` and `SL reached -1R` remain separate, simultaneously valid facts.
   - Registered-arrow outcomes use durable lifecycle reason codes and coverage metadata. Missing H4/M1 history is retried from MT5 before an arrow remains unavailable; recent incomplete cases stay Pending. Pending, ambiguous, and unavailable cases are excluded from win rates, expectancy, and account replay. Shadow Trader ends with a collapsed `Needs Codex review` queue for unresolved coverage, weakened active execution, and unapproved fixed/break-even/trailing/partial challengers. Contract research never changes the registry automatically; the three v5 overlays exist only through an explicit fingerprint-locked review allowlist.
   - Every successful complete EA cycle now reconciles all seven registered markets in the background. Qualified and no-trade assessments are inserted once into an immutable first-seen decision ledger, exposed through a collapsed Shadow Trader audit and `/research/live-decisions`; later broker revisions cannot rewrite the recorded decision.
   - Registered setup details now include a deterministic `Strong / Moderate / Fragile / Unproven` historical-credibility scorecard built from immutable-audit status, later-test expectancy/sample, represented years, direction-audit coverage, and uncertainty. This rating is historical evidence only and remains separate from live validation. Selecting an arrow draws integrated Entry, SL, and TP chart levels; its MFE is labelled `Best favorable move` and never counted as realized profit.
   - FMS requests wait until chart history and a visible candle range exist. The scanner always uses registered current rules; `Past arrows` controls only the hindsight projection. Clicking an arrow opens its evidence and reaction-versus-execution audit.
   - Arrows are research classifications, not automatic orders, guarantees, or proof that the release caused the later move.

4. `Economic Calendar`
   - Current state: primary, useful surface.
   - MT5-backed event schedule with range/filter/search, freshness wording, and a right-side event inspector.
   - Event explanations should remain cautious and concise.

5. `Specialist Tools`
   - Current state: `FMS Experiment Workbench` is the sole Active Tool; Differential Calculator is an Active Experiment; Event Replay, Macro Drivers, and Prototyping are retained under Garbage / Ignore.
   - Six Questions and WIP Map are no longer direct Specialist Tools children.

## App Loading

- Heavy route tabs are lazy-loaded from `App.tsx`.
- `OverviewPlaceholderTab` remains eager because it is the initial top-level surface. Despite the file name, it now contains the fresh pair-brief implementation.
- `FlagIcon` currently uses `react-world-flags`; the large production chunk and missing TypeScript declaration are known non-blocking noise. Do not revisit flags unless explicitly requested.

## Specialist Tools Children

Current direct children under `Specialist Tools`:

1. `Active Tool` / `FMS EXPERIMENT WORKBENCH`
   - Bounded registered-market H4 workbench with direction variants, plainly named contract controls, recorded experiments, frozen review candidates, Reaction Atlas, and raw A/F/P/S/M plus trade-outcome audits.
   - New durable identifiers are E (recorded experiment), C (frozen review candidate), and reserved M (reviewed Charts model). Freezing never changes Charts; there is intentionally no promotion API or UI.
   - Uses durable bridge calendar storage and cached MT5 H4/M1 candles.
   - Reports gross historical Long/Short bias cases, explicit ambiguity, holdout results, and paper-eligibility checks without placing orders.
   - Completed EA cycle acknowledgements activate immutable first-seen capture. Registered recipes enforce their declared package identity, scoring treatment, case filter, reaction mapping, and execution contract. Unregistered candidates remain research only.
   - Legacy definitions and runs remain reproducible but no longer occupy primary Workbench navigation; opening the Workbench reads durable summaries rather than recalculating historical research.

2. `Active Experiment` / `DIFFERENTIAL CALCULATOR`
   - Rate/inflation arithmetic view for major FX pairs.
   - Keeps route id `dashboard` for compatibility.

3. `Garbage / Ignore`
   - Event Replay, Macro Drivers, Prototyping, older planning drafts, and ignored tools remain routed only for reference.

## Secondary Routes

Garbage drawer routes:

- `Currency Strength From Candles`
- `Watchlist Engine`
- `Macro State`
- `Six Questions Draft`
- `WIP Map Archive`
- `Strength Meter`
- `Deprecated Overview`

Do not read, delete, or promote these unless the user explicitly asks for garbage-drawer work.

## Tab Folder Map

- `Main/src/app/tabs/primary/` contains always-visible primary workflow tabs.
- `Main/src/app/tabs/secondary/` retains the stable route components, but only FMS Experiment Workbench and Differential Calculator are active product surfaces. Event Replay, Macro Drivers, and Prototyping are navigation-level Garbage / Ignore surfaces.
- `Main/src/app/tabs/garbage/` contains old unfinished, deprecated, or ignored routed surfaces. Ignore it unless the user explicitly asks for one of those screens.
- `Main/src/app/lib/garbage/` contains supporting logic for garbage-drawer routes. Ignore it unless the user explicitly asks for that logic.
- `Main/src/app/tests/garbage/` contains tests for garbage-drawer routes and logic. Ignore it unless the user explicitly asks for garbage-drawer work.

## Test Policy

- Do not create new tests unless the user explicitly agrees.
- Before creating a test, explain in plain English what behavior it protects.
- Prefer targeted verification. Do not run broad/full test suites after every small pass.

## Docs Noise Rule

Older docs may be historically useful, but they are not current truth unless the user says so.

Default read order:

1. `docs/Development Logs/Checklist.md`
2. this file
3. root `README.md`
4. `Main/README.md`
5. relevant source files

Avoid reading `docs/Private` by default.
