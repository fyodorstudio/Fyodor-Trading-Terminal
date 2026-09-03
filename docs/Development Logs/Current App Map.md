# Current App Map

Last updated: 2026-09-01

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
   - The left FMS dock is global across registered markets and opens on `Trade`: one fail-closed action card showing Enter now, Wait, Do not enter late, or Do not enter now together with direction, frozen entry, SL, TP, risk, expiry, reason, lifecycle, integrity, and setup health. Separate `Setups`, `Research`, `Knowledge`, and `Past Result` tabs retain the registry, diagnostics, durable findings, and selected-arrow audit without crowding the action. Pair-flag controls filter the Live Watchlist without changing the registry. Every setup owns an explicit historical-audit readiness badge; an incomplete or mismatched immutable audit blocks new Shadow Trader matching while preserving the row for inspection. Policy/inflation remains observational background and cannot alter a frozen trade. Spread, commission, slippage, and swap are excluded rather than estimated; no order is sent to MT5.
   - Shadow Trader filtering uses one flag per currency with inclusive pair membership, so selecting only USD retains every registered USD pair. The watchlist deliberately offers only TP-before-SL, soonest-release, and average-R sorts. Its open interaction path is memoized, countdowns share one imperative ticker, latest signals are indexed, and collapsed setup diagnostics mount only when opened instead of constructing every hidden reaction table.
   - Past FMS Result now begins with a pill-free four-cell summary: Signal, Initial move, Frozen plan, and Frozen result. Its unified geometry table exposes ATR, original SL, the frozen TP, and independent `0.25R` through `4R` target-path outcomes with pips/ATR/R and SL-first ordering. The target ladder is hindsight execution research and never rewrites the official frozen result.
   - Past FMS Result and an open Shadow Trader position expose entry-known market context: deterministic H4 price regime, past-only ATR percentile, room to the nearest confirmed repeated pivot zone, and Before-window economic alignment. `FMS-CONTEXT-CONDITIONAL-H4-v1` adds four fingerprint-locked, code-reviewed context rules above their unchanged parents. A match may use its reviewed contract on the same single arrow; a nonmatch retains the parent arrow and contract. Historical arrows before the activation boundary retain their original outcome while showing context provenance. USDCAD Canada retail sales remains research-only because positive execution did not coincide with majority directional alignment. Clicking an arrow adds the nearest confirmed H4 support/resistance barrier as a neutral amber price line.
   - `fms-execution-challenger-v2` now also stores a compact target frontier for every registered recipe while keeping the active SL and duration fixed. Older development history selects one target and later history audits it; this is review evidence only. Newly processed registered packages begin recording the first FMS-observed post-release bid/ask quote, while old history remains incapable of proving an executable release-time fill.
   - Expanded Shadow Trader setup rows now expose fixed-horizon reaction profiles at `1/3/6/12/30 H4`, direction-adjusted pips/ATR/R distributions, MFE/MAE timing and giveback, deterministic reaction classifications, and development-selected contract research that cannot rewrite the active contract. The Trade Monitor retains the latest registered decision even when it produced No trade or audit-only rather than an opened position. Arrow audits keep Initial move and Frozen trade outcomes beside the title, then use one aligned ATR/Entry/SL/TP geometry table, a release-to-result timeline, and collapsed exact-setup history. `Price followed the arrow` and `SL reached -1R` remain separate, simultaneously valid facts.
   - Registered-arrow outcomes use durable lifecycle reason codes and coverage metadata. Missing H4/M1 history is retried from MT5 before an arrow remains unavailable; recent incomplete cases stay Pending. Pending, ambiguous, and unavailable cases are excluded from win rates, expectancy, and account replay. Shadow Trader ends with a collapsed `Needs Codex review` queue for unresolved coverage, weakened active execution, and unapproved fixed/break-even/trailing/partial challengers. Contract research never changes the registry automatically; the three v5 overlays exist only through an explicit fingerprint-locked review allowlist.
   - The practical registry also writes an append-only prospective execution lifecycle after successful EA cycles. It advances paper trades without requiring Charts to be open and shows a compact demo-readiness surface in Shadow Trader. A package captured before entry is visibly queued with its planned strictly-later H4 time, then becomes Open when the entry candle exists. If Fyodor was offline at the original decision, it now reconstructs the frozen H4 entry, ATR, SL, TP, and outcome from stored MT5 history as `Recovered`; that counterfactual result remains separate from true first-seen forward statistics and is never presented as an order that actually opened. Forward breadth, fills, costs, and the older strict risk policy remain optional diagnostics rather than blockers for demo-only monitoring; real-money execution remains out of scope.
   - Open prospective trades expose a deterministic short MT5 comment tag for optional manual demo validation. The bridge reads only matching deals after verifying the connected account is demo, links later exit deals by position id, stores actual deal costs, and verifies the manual direction/SL/TP against the frozen contract. It never sends or modifies an MT5 order.
   - Every successful complete EA cycle now reconciles all seven registered markets in the background. Qualified and no-trade assessments are inserted once into an immutable first-seen decision ledger, exposed through a collapsed Shadow Trader audit and `/research/live-decisions`; later broker revisions cannot rewrite the recorded decision.
   - While Macro Bias is visible, Charts refreshes the global registry silently every 30 seconds even when no lifecycle is already active. This closes the discovery gap where a newly released setup could otherwise remain invisible until a reload; unchanged responses retain their React references, and transient refresh failures preserve the last honest state.
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
