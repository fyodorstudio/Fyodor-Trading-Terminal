# Fyodor Trading Terminal Checklist

Last updated: 2026-09-01

## Active Planning Source

This file is the current command board. Future AI sessions should read it before older roadmap, audit, or patch notes.

- Keep this file compact and current; git history owns implementation history.
- Ignore `docs/Private` unless the user explicitly asks to use it.
- Do not let Deprecated Overview, Six Questions, Work In Progress, or garbage-drawer code steer active product work.

## FMS Grand Plan — From Historical Research to Rule-Based Live Readiness

This is the highest-priority product program. Its practical goal is a Shadow Trader that can monitor every frozen registered setup, state exactly what it would do, and show the evidence supporting that decision without requiring the user to manually interpret every calendar release.

The program must remain honest about the word **proven**:

- `Historically profitable` means the exact immutable recipe and execution contract produced positive no-lookahead walk-forward average R on the recorded MT5 calendar and candle archive.
- It does **not** mathematically prove that the next trade will profit.
- No backtest alone makes a setup safe to follow blindly with real money.
- Shadow Trader must keep `Historically qualified?` separate from `Eligible for rule-based live use?`, but that distinction does not require a permanent oversized banner above the operating workflow.
- The app must never use `Safe to follow blindly: Yes`. Even a live-validated model can fail, enter a losing streak, or stop matching the market regime.

### Shadow Trader Readiness Presentation

- [x] Remove the redundant full-width `Can I follow this blindly?` and `Watching N registered setups` blocks. The first viewport now begins with the operational Trade Monitor.
- [x] Preserve readiness honestly in compact setup/account details and the bottom research explanation rather than repeating a large generic warning before every useful row.
- [x] Give every setup its own readiness badge. Global readiness must never hide a setup-level failure.
- [x] Default affected setup readiness to `AUDIT INCOMPLETE` after any scoring, direction, entry, data-identity, or execution-contract change until all required audits are rebuilt.

### Phase 0 — Contain and Audit the Currency-Orientation Defect

- [x] Repair policy rescoring so non-EURUSD markets preserve their original base/quote currency orientation instead of inheriting EURUSD orientation.
- [x] Add a focused regression proving that `USD` improvement maps to Long USDCAD after Forecast Guard rescoring.
- [x] Quarantine every active registration whose historical or live direction could have passed through the defective rescorer; corrected failures remain archived as avoid-directional-use evidence:
  - all USD-driven USDCAD registrations;
  - all USD-driven USDJPY registrations;
  - every non-EURUSD registration driven by that market's base currency;
  - any experiment or candidate whose immutable snapshot used the affected rescoring path.
- [x] Build a complete orientation truth table for every supported pair and both currencies:
  - base improves → Long pair;
  - base weakens → Short pair;
  - quote improves → Short pair;
  - quote weakens → Long pair.
- [x] Apply that truth table to baseline, Surprise-only, Momentum-only, no-agreement-bonus, Forecast Guard, single-series, and same-time package paths; downstream exact/partial/Both-direction selection preserves the candidate's explicit base/quote identity.
- [x] Recompute the complete practical registry from the corrected engine and relink every surviving active benchmark to its new immutable experiment/audit. Historical arrows, Shadow Trader assessments, and account replay now consume only the rebuilt registry.
- [x] Invalidate stale experiment reuse by including `pair-orientation-v2` in immutable experiment configurations and registration provenance checks.
- [x] Compare old versus corrected direction and outcome case-by-case. The durable `pair-orientation-v2` audit compared 2,910 cases across 23 rebuilt USD-base registrations: 0 direction changes, 0 inclusion changes, 0 outcome changes, and 0.0R aggregate stressed-P/L change. The rebuilt immutable experiments now own the active provenance.
- [x] Remove or demote every registration that is no longer historically profitable after correction: USDCAD PMI, USDCAD labor claims, and USDJPY US labor claims are no longer active.
- [x] Keep every provenance-verified recipe explicitly labelled `Orientation audited`, including unaffected EURUSD and quote-currency recipes.
- [x] Do not allow `Eligible for rule-based live use: Yes`; all 47 active recipes are historically audited but remain explicitly `not_live_validated`.

### Phase 1 — Freeze a Serious New FMS Generation

- [x] Preserve all existing identifiers and results as immutable legacy research; do not rename history in place.
- [x] Freeze the corrected research engine identity as `FMS-RELEASE-REACTION-H4-v1`, distinct from the active `FMS-REGISTERED-REACTION-H4-v4` registry assembled from its immutable experiments.
- [x] Freeze the corrected and expanded Charts/Shadow registry as `FMS-REGISTERED-REACTION-H4-v4`: 47 immutable, provenance-verified recipes across seven supported pairs, with no duplicate market/package direction.
- [x] Make the active registry contain only recipes reconstructed from immutable Workbench experiments with:
  - exact market and pair orientation;
  - exact country/region and normalized-series identity;
  - exact release/package membership;
  - exact scoring policy and Forecast Guard state;
  - exact direction mapping;
  - exact entry, SL, TP/exit, and maximum-duration contract;
  - fixed dataset fingerprint, configuration hash, and activation boundary.
- [x] Move every old unlinked, mismatched, or corrected-negative registration out of the active registry while preserving its immutable history.
- [x] Replace vague user-facing `legacy` labels with plain archive/active language. Internal compatibility identifiers remain stable, while active setup readiness is stated as `Historical audit complete`, `Orientation audited`, or `Audit incomplete`.

### Phase 2 — Build the Event/Price Reaction Atlas

#### Completed pass — Seven-Pair Event Reaction Atlas

> **Completed — 2026-08-29:** the all-case and declared magnitude atlas runs, candidate reconciliation, Registered Reaction v3 integration, Workbench/Shadow intelligence, and current-engine provenance verification are complete. Specialized Policy, policy-guidance, and richer context models remain separate future research rather than unfinished v3 work.

- [x] Run a staged, immutable reaction sweep across EURUSD, GBPUSD, USDJPY, AUDUSD, USDCAD, NZDUSD, and USDCHF without unrestricted filter mining.
- [ ] Classify every sufficiently sampled exact series/package for each pair as:
  - continuation;
  - rejection;
  - magnitude-dependent;
  - volatility-only;
  - avoid as standalone direction;
  - insufficient evidence.
- [x] First test all-case scoring recipes; apply ordinary/top-20% magnitude treatments only as predeclared challengers so magnitude does not create an uncontrolled combinatorial search.
- [x] Record both useful and failed results in the durable atlas, materialize practical finalists as immutable experiments, and expose pair-specific reaction evidence in Workbench and Shadow Trader.
- [x] Promote no recipe automatically; register only non-duplicated practical recipes with positive development, later-period, recent, and walk-forward expectancy under a fixed execution contract.

#### Deferred specialized models

- [ ] Build Policy as a separate model covering canonical decisions, Holding/Tightening/Easing, and later policy-path/guidance research; do not score it as ordinary growth evidence.
- [ ] Build Inflation as a separate model covering headline/core/producer evidence and heating/cooling; test policy context independently before combining it with Economy.
- [x] Measure directional continuation/reversal after 1, 3, 6, 12, and 30 H4 candles for every sufficiently sampled candidate; retain MFE/MAE and volatility-only classification as separate path research.

#### Deferred magnitude and context challengers

- [x] Re-audit every active registered setup against baseline, Surprise-only, Momentum-only, no-agreement-bonus, Forecast Guard, ordinary magnitude, and top-20% magnitude while keeping its registered execution contract fixed.
- [x] Prioritize Japan wages exceptional-magnitude, USDJPY consumer-sentiment Momentum-only, and Japan inflation magnitude as named challengers; retain their current sample-size limitations.
- [x] Apply entry-known H4 trend, volatility regime, release session, and confirmed support/resistance only to specific finalist/loss-review hypotheses—not as unrestricted intersections. These remain named research challengers and do not silently filter live signals.
- [x] Record the archive conclusion: all-case and magnitude expansion produced additional recipes, USDCHF produced none, upper-tail magnitude was not broadly useful, and further gains require specialized models, more independent observations, or new trusted inputs rather than unrestricted filter mining.

- [x] Add past-only exact-series Surprise and Momentum magnitude percentiles with no cross-series normalization or future leakage.
- [x] Add ordinary, large, exceptional, and predeclared top-20% magnitude treatments while retaining raw directional votes.
- [x] Add separate Surprise-only, Momentum-only, and no-agreement-bonus scoring challengers without rewriting existing experiments.
- [x] Record the first fixed-contract magnitude challengers: USDJPY E064-E066.
- [x] Extend the magnitude comparison from the five active recipes to every sufficiently sampled atlas family, preserving one declared family of trials and immutable failures.
- [ ] Treat USDJPY wage upper-tail magnitude as an under-sampled challenger; do not replace the broad registered rule until later observations increase its independent sample.

- [x] Evaluate every supported exact series and same-time package independently for each supported pair; never assume one event behaves the same across pairs.
- [x] For each economic direction, record both possible price responses:
  - continuation: price follows the economic direction;
  - rejection: price consistently moves against the economic direction.
- [x] Produce four evidence lists directly in Shadow Trader and Workbench:
  - `Registered — historically profitable directional recipe`;
  - `Contender — promising but unstable or under-sampled`;
  - `Avoid as standalone direction — repeated price rejection/randomness`;
  - `Insufficient evidence — no honest conclusion`.
- [ ] Preserve the current evidence-backed avoid list and rebuild it after the orientation correction:
  - EURUSD · US labor claims;
  - EURUSD · US consumer inflation direct mapping;
  - EURUSD · US consumer sentiment direct mapping;
  - GBPUSD · US producer inflation direct mapping.
- [ ] Preserve current contenders and retest them under the corrected engine:
  - EURUSD · Euro-area retail-sales improvement;
  - EURUSD · aligned US manufacturing PMI.
- [ ] Show the tested direction, opposite/rejection direction, sample size, walk-forward average R, TP-before-SL rate, positive years, recent result, and uncertainty for every atlas row.
- [ ] Never infer `avoid` from one losing chart example; require a recorded immutable experiment.

### Phase 3 — Replace One Fixed Exit with Path Research

- [x] Keep every existing fixed-contract backtest reproducible as the immutable baseline.
- [ ] Split every setup audit into two explicit gates:
  - `Evidence reaction`: whether price followed or rejected the frozen economic direction at declared `1/3/6/12/30 H4` horizons;
  - `Trade execution`: whether the exact entry, SL, TP, expiry, and management contract produced positive later walk-forward average R.
- [x] Record four outcomes separately in every registered reaction audit: direction worked + trade profited, direction worked + trade lost, direction failed + trade profited, and direction/execution both failed.
- [x] Complete the reusable path-research artifact for every newly evaluated candidate, calculated from data strictly after its entry:
  - maximum favorable excursion (MFE) in ATR/R;
  - maximum adverse excursion (MAE) in ATR/R;
  - time to MFE and MAE;
  - return after 1, 3, 6, 12, 18, 30, 42, 60, 90, and 120 H4 candles;
  - first reach of ±0.25, ±0.5, ±0.75, ±1, ±1.5, ±2, ±3, and ±4 ATR;
  - reversal after favorable excursion and drawdown before eventual target.
- [x] Use unrestricted path observation only for discovery. Maximum future profit remains an audit field and is never presented as a tradable entry-time result.
- [x] Preserve loss-path observations without rewriting the original signal: adverse-before-best-favourable, favourable-then-giveback, target not reached, direction not working at six H4, duration ended negative, plus the separate ambiguous intrabar outcome.
- [x] Convert discovered path behavior into a small predeclared contract set on development data only:
  - fixed SL/TP;
  - time exit;
  - break-even rule;
  - trailing stop;
  - partial exit only as a separately declared strategy;
  - no-SL/no-expiry observation only as research, never live readiness.
- [x] Freeze the chosen challenger per management family from development data before later walk-forward evaluation. Later data judges but never selects it.
- [x] Build price-path profiles once per candidate and reuse them across the declared contract grid rather than rescanning candle history per contract.
- [x] Require any execution challenger to improve the complete parent recipe on later walk-forward data without materially worsening drawdown or losing streak; never add a rescue rule because it fixes one memorable losing chart.
- [ ] Preserve a useful directional recipe as reaction knowledge when no execution contract survives, and mark its execution research `Exhausted` after the fixed matrix and small declared management set fail honestly.
- [x] Display both directional reaction and actual strategy expectancy; every registered setup now carries a chronological later-test six-H4 reaction audit, while each arrow audit preserves MFE/MAE, fixed-horizon responses, giveback, and the final frozen-contract result.
- [x] Replace generic `Not evaluable` with stable lifecycle/reason codes: waiting for entry candle, trade still running, missing ATR history, missing outcome candles, historical price data unavailable, or intrabar order unknown. Pending, ambiguous, and unavailable cases never enter expectancy or account replay.
- [x] Retry missing registered-arrow H4/M1 history from MT5 before preserving an unavailable result; retain the exact required and available coverage interval when repair cannot succeed.
- [x] Add a collapsed Shadow Trader `Needs Codex review` queue. It reports unresolved reasons, weakened active contracts, and immutable execution challengers without exposing a promotion path or rewriting the active registry.
- [x] Materialize `fms-execution-challenger-v1` for all 47 registered recipes: 1,908 declared fixed/break-even/trailing/partial configurations per recipe, M1 ordering when available, immutable dataset/configuration/candle fingerprints, and ten review-worthy challengers in the 2026-08-31 artifact. These are review findings only; zero active contracts were changed.
- [x] Upgrade the artifact to `fms-execution-challenger-v2` with one-grid-step neighboring-contract stability and a frozen practical review gate. Explicitly activate three fingerprint-locked break-even overlays in `FMS-REGISTERED-REACTION-H4-v5`: AUDUSD US producer inflation, NZDUSD US producer inflation, and USDJPY Japan inflation. Preserve v4 contracts for every historical event before the v5 activation boundary; no regenerated artifact can silently change the allowlist.
- [x] Add a universal per-arrow target path ladder at `0.25/0.5/0.75/1/1.5/2/3/4R`, measured independently against the original SL and maximum duration. Resolve same-H4 ordering from M1 when available; otherwise preserve `Both touched — order unknown`.
- [x] Add an immutable per-recipe target frontier that holds the active SL and duration constant, selects one target on older development history, and reports later performance without changing the registered target.
- [x] Redesign Past FMS Result so Signal, Initial move, Frozen plan, and Frozen result appear as a plain at-a-glance table. Show ATR, Entry, original SL, the complete target ladder, pips, ATR, R, and result meaning in one stable hierarchy rather than status pills.

### Phase 4 — Research Entry at Release Without Lookahead

- [x] Preserve `first strictly later H4 open` as the reproducible baseline entry.
- [x] Do not call the exact scheduled release timestamp a tradable entry: Actual values, bridge delivery, calculation, and order decision necessarily arrive afterward.
- [ ] Add alternative entry contracts only when their required data exists:
  - first M1 open strictly after the first-seen EA observation;
  - first tradable MT5 tick after the complete package is frozen;
  - first H1 open after observation;
  - current first strictly later H4 open.
- [x] Persist first-seen EA receipt/bridge-acknowledgement time, EA completed-package time, immutable decision time, and the first retrievable MT5 bid/ask tick after observation. Fall back explicitly to a current observed snapshot when tick history is unavailable.
- [x] Use actual observed bid/ask and spread when available; never invent or estimate spread, commission, slippage, or swap.
- [x] Treat old history without first-seen latency/tick evidence as incapable of proving release-time execution. It may remain H4/M1 reaction research only.
- [x] Compare prospective observation delay, missed candle entries, and price gaps across the first later M1, H1, and H4 opens in each arrow audit without changing its frozen result.
- [ ] Compare expectancy across prospective entry contracts after enough immutable observations exist; do not backfill or reconstruct unavailable release-time prices.
- [x] Begin prospective post-release-entry evidence by capturing the first FMS-observed MT5 bid/ask quote for a newly processed registered package within the release window. Persist it with the immutable decision/signal and label its delay from scheduled release; it is an observed quote, never a claimed fill.
- [x] Keep historical arrows honest: old rows without immutable first-seen quote evidence continue to use the later-H4 baseline and cannot prove an executable release-time entry.

### Phase 5 — Sensible Context Progression

Test one additional entry-known condition at a time. Do not mine unrestricted combinations.

- [ ] Establish the corrected unfiltered release/package baseline first.
- [ ] Test same-time package completeness: full, partial, and single release.
- [ ] Test Surprise/Momentum state: agreement, conflict, Surprise unavailable, Momentum-only, and Forecast Guard exclusion.
- [ ] Test `Before` alignment without allowing later releases into the decision.
- [ ] Test score magnitude and number of contributing exact series without allowing release quantity to dominate.
- [ ] Add inflation context as a separately frozen condition:
  - heating, cooling, or unresolved;
  - headline/core/producer families remain separate;
  - inflation does not automatically mean currency-positive;
  - test whether it changes the release reaction, do not assume it does.
- [ ] Add policy/rate context as a separately frozen condition:
  - tightening, holding, easing, or unresolved from canonical numeric decisions;
  - communications remain unscored until a separately specified text-data system exists;
  - test policy alignment, conflict, and time since last decision.
- [ ] Test inflation × policy combinations only after their individual effects are measured and only when sample size remains usable.
- [ ] Test one nearby high-impact release window at a time with fixed boundaries declared before results are inspected.
- [ ] Test continuation and rejection treatments separately rather than forcing every event into economic-direction continuation.
- [ ] Require every added condition to outperform the simpler baseline on later walk-forward data and remain understandable from the UI.
- [ ] Reject a condition that only improves the in-sample result, destroys usable case count, or depends on a tiny number of years.

### Phase 6 — Qualification and Promotion Contract

- [ ] Define `historically qualified` using the exact registered execution contract, not broad source-family statistics:
  - positive pooled chronological walk-forward average R;
  - TP-before-SL rate above that contract's simple gross break-even rate;
  - enough later cases and represented years to avoid a one-period anecdote;
  - no single calendar year or release package responsible for most profit;
  - drawdown, losing streak, expiry, ambiguity, and unavailable-price rates shown;
  - result remains positive across nearby reasonable parameters, or instability is prominently disclosed;
  - no direction/orientation/data-identity mismatch;
  - all selection and reused-history disclosures preserved.
- [ ] Academic confidence remains a diagnostic rather than an automatic veto, but weak uncertainty must prevent `live validated` status.
- [ ] Define promotion stages:
  - `Experiment`: immutable recorded trial;
  - `Candidate`: positive historical recipe awaiting review;
  - `Historically qualified`: corrected positive walk-forward recipe eligible for Charts research arrows;
  - `Paper validated`: future first-seen observations meet the frozen rule and remain positive after a declared minimum evidence period;
  - `Limited live validation`: user-recorded real executions exist with actual costs and controlled risk;
  - `Live validated`: sufficient real executions remain consistent with the frozen contract;
  - `Retired`: edge degraded, data contract changed, or integrity audit failed.
- [ ] Never promote automatically from one experiment result. Promotion must write an immutable registry record and an audit trail.
- [ ] Automatically demote or block a setup when data is stale, a package is incomplete, its fingerprint changes, or the live rule cannot be reproduced.

### Phase 7 — Shadow Trader as the Daily Operating Surface

- [x] Apply the deferred information-architecture pass:
  - begin with one compact Trade Monitor showing open hypothetical trades, then the last opened trade;
  - move `Possible next setups` directly under the last-opened row, support multiple upcoming registered releases, and keep the list collapsed by default;
  - remove the redundant scanner/count summary and `Earlier <pair> calendar row` box;
  - move `What history says / What to watch and avoid` to the bottom;
  - center clickable pair-flag filters between the Live Watchlist title and sort control, with clear selected/unselected states and a reset/show-all action;
  - merge Hypothetical Account and Performance Replay into one coherent account-replay box.
- [x] Repair and explain account-replay credibility before treating its total as meaningful:
  - distinguish the all-pair since-activation ledger from selected-pair history, or build a true all-registered-pair historical ledger before labelling it global;
  - define the portfolio collision rule in advance instead of allowing stable-id ordering to silently choose among simultaneous setups;
  - count opposite directions as a conflict only when they concern the same pair; different-pair simultaneous signals are competing opportunities, not directional contradictions;
  - display the exact sequential-compounding formula and plain-language definitions for overlap, simultaneous alternative/conflict, ambiguous, pending, and unevaluable cases;
  - reconcile displayed totals against the immutable signal ledger and retain the gross/no-cost boundary.
- [x] Make the global table the primary daily workflow with three deliberate sorts only: TP-before-SL rate, next registered release, and historical average R. Filter with one flag per currency; selecting only USD includes every registered pair containing USD.
- [x] Keep the open Shadow Trader interaction path lightweight: one shared imperative countdown ticker, a memoized panel with stable Charts props, indexed latest-signal lookup, and lazily mounted registered-setup diagnostics so collapsed rows do not build every reaction table.
- [x] Active rows distinguish `Watching`, `Awaiting Actual`, `Qualified — waiting entry`, `Trade open`, `Target reached`, `Stop reached`, `Expired`, `No trade`, and `Blocked`; retired recipes remain outside the active table in the research archive.
- [ ] Every actionable row must state, in reading order:
  - pair flags and exact setup;
  - exact triggering release/package;
  - Long/Short/No trade;
  - why the complete package produced that result;
  - entry rule and current entry status;
  - actual entry/SL/TP/expiry when available;
  - exact historical walk-forward benchmark for that contract;
  - readiness state and missing live requirements.
- [ ] Keep individual event scores distinct from the complete package decision. A zero subrow must never imply that positive sibling rows were cancelled.
- [x] Add a prominent `What would FMS do now?` trade monitor, but never send an MT5 order.
- [x] Add a durable immutable live decision ledger. First-seen qualified/no-trade assessments are insert-only, survive bridge restarts and broker revisions, and are reviewable from a collapsed Shadow Trader table and bridge endpoint.
- [x] Add post-trade loss review to arrow audits with the frozen release package, observational context, MFE/MAE, fixed-horizon responses, giveback, loss-path observations, and final lifecycle without rewriting the original rule.
- [x] Historical arrow audits present triggering evidence/direction first, then reaction, best/worst path, frozen trade result, the reaction/execution distinction, and aggregate recipe history.
- [x] Restructure Past FMS Result around the event and its two headline outcomes, then show one aligned ATR/Entry/SL/TP geometry table with pip/ATR/R distances, a release-to-result timeline, and collapsed exact-setup history.
- [x] Replace the Trade Monitor's misleading `Last opened trade` row with `Latest registered decision`, including No trade, audit-only, waiting-entry, open, and resolved registered releases, with a click-through calculation audit.

### Phase 8 — Paper and Limited-Live Validation

#### Deferred historical-repeatability real-money workflow

The user explicitly accepts the product claim: `This fixed setup showed positive gross historical repeatability and may repeat again.` This workflow must not be blocked on future evidence and must keep spread, commission, slippage, and swap excluded rather than estimated. It is not a claim of safety or guaranteed performance.

- [ ] Rebuild all registered setups as one chronological gross portfolio with overlaps, conflicts, drawdown, losing streaks, and account replay.
- [ ] Add configurable per-trade risk, total open risk, correlated-currency exposure, drawdown pause, and consecutive-loss pause.
- [ ] Produce one immediate `Trade / No trade` card containing pair, direction, evidence, entry, SL, TP, position size, expiry, historical record, and every skip reason.
- [ ] Fail closed on stale/incomplete calendar packages, missing ATR/price data, late entry, conflicting signals, or breached portfolio limits.
- [ ] Freeze one reproducible historical-repeatability release containing registry, formulas, contracts, dataset fingerprint, portfolio settings, and gross results. Later changes create a new version.
- [ ] Add an immutable manual-trade journal recording FMS instruction, actual user execution, deviations, and result without enabling MT5 order transmission.

- [x] After every successful complete EA cycle, automatically reconcile every registered market from immutable first-seen observations and append every qualified/no-trade decision to the durable ledger; no Charts visit or manual cherry-pick is required.
- [x] Add an append-only forward execution lifecycle for the practical registry. Pending trades advance automatically from fresh MT5 H4/M1 candles after successful EA cycles, terminal outcomes cannot rewrite the first-seen decision, and the first available post-entry bid/ask is retained with capture lag and `near entry` versus `late snapshot` quality.
- [x] Add a compact Shadow Trader demo-readiness surface showing prospective decisions, tracked/resolved cases, and forward average without making future-sample breadth, fills, costs, or strict account-risk checks block demo-only monitoring.
- [x] Preserve the earlier 30-trade/five-setup manual-demo breadth calculation as an optional diagnostic only; it no longer gates the user's demo-only Shadow Trader workflow.
- [x] Add read-only manual-demo reconciliation. Every qualified signal receives a short deterministic `FMS-…` order-comment tag; the bridge records only explicitly tagged deals from an MT5 account verified as demo, follows the same position id through untagged exit deals, persists actual entry/exit/profit/commission/swap/fee, verifies direction plus the frozen SL/TP and terminal lifecycle, blocks duplicate positions using one tag, and never calls an order API.
- [x] Preserve `FMS-MANUAL-DEMO-RISK-v1` as an optional diagnostic, but do not let that deliberately conservative legacy policy suppress demo-only Shadow Trader signals.
- [x] Exclude bridge-start catch-up releases from prospective decisions whenever the complete package or its decision was first observed at/after the frozen H4 entry. Keep them as explicit audit-only `late_for_contract` rows.
- [x] Freeze a qualifying decision before its future H4 entry candle exists, calculate the planned strictly-later H4 boundary, show it under `Queued for the next H4 entry`, and transition it to Open only when that candle becomes available.
- [x] Refresh the visible global Shadow Trader every 30 seconds even when no trade is currently pending. A newly released registered package can therefore appear as No trade or Queued without a page reload; the same refresh advances Pending/Open results and covers all seven registered markets without clearing the previous honest state on a transient failure.
- [x] Add a fail-closed operational preflight for new demo decisions: a missing/stale successful EA cycle or any failed calendar batch changes Shadow Trader to `feed waiting` and states exactly why the user must not act yet. This blocks presentation only; Fyodor still sends no order.
- [x] Compare tagged MT5 demo execution with the frozen candle-path assumption: actual entry delay, direction-adjusted entry difference in R, gross fill result versus frozen result, recorded costs, and contract adherence. Treat entry difference as the combined effect of delay, spread, and market movement because deal history cannot truthfully decompose it.
- [x] Keep the minimum paper requirement setup-specific and show elapsed time plus case count; do not promise that waiting a fixed year guarantees anything. `FMS-SETUP-FORWARD-GATE-v1` requires at least 10 resolved cases, 90 elapsed days, positive average R, and 80% near-entry quote coverage for that exact setup.
- [ ] Do not permit `Paper validated` when only historical replay exists.
- [ ] If the user chooses real execution, keep it manual and begin with a separately configured limited-live ledger; never infer fills from candle OHLC.
- [x] Record actual tagged-demo entry, exit, volume, commission, swap, fee, protection levels, partial/open lifecycle, and user contract deviations when supplied by MT5 account history. Preserve spread/slippage decomposition as unknown rather than estimating it.
- [ ] Require explicit maximum risk per trade, maximum simultaneous risk, and a kill-switch condition before showing `Eligible for rule-based live use: Yes`.
- [x] Automatically revert setup-level prospective readiness when at least 10 resolved forward cases have non-positive average R. Keep the historical registration intact, show `Needs review`, and never move the frozen boundary after losses merely to preserve a setup.
- [x] Add an advisory manual limited-live review gate per exact setup. It requires the setup-specific forward gate, at least five completed contract-adherent tagged demo trades with positive average net R, the globally observed 30-trade manual-demo risk policy, and a current operational preflight. Keep order transmission disabled and show every unmet requirement instead of converting this into a live-trading permission.

### Phase 9 — Verification and Release Gate

- [ ] Extend existing focused tests—do not create an uncontrolled parallel suite—to cover every pair orientation, scoring policy, package shape, readiness transition, stale-data block, and cache invalidation path.
- [ ] Add golden immutable cases for every registered setup from raw calendar rows through score, direction, entry, and outcome.
- [ ] Verify historical arrow, Shadow Trader decision, Workbench experiment, and registry audit all produce the same direction and contract for the same package.
- [ ] Rebuild all active registry results from a clean durable database and compare fingerprints with the shipped registry.
- [ ] Run targeted bridge/FMS/Charts tests, repository typecheck, production build, and `git diff --check` after each phase.
- [ ] Manually audit Charts and Shadow Trader at 1440x900 and 100% zoom for hierarchy, flags, timestamps, readiness visibility, no clipped explanations, no overlap, internal scrolling, and no whole-page overflow.
- [x] Add a live readiness-report endpoint that lists:
  - active registered setups;
  - quarantined/retired setups;
  - corrected historical metrics;
  - paper/live evidence;
  - actual known costs and unknown costs;
  - unresolved integrity risks;
  - the exact answer to `Eligible for rule-based live use?`.

### Definition of Done

FMS is ready for rule-based limited real-money consideration only when all of the following are true:

- [ ] the complete currency-orientation and registry-reconstruction audit passes;
- [ ] every active setup is linked to an immutable corrected experiment and exact execution contract;
- [ ] historical results remain positive under no-lookahead walk-forward evaluation and transparent robustness diagnostics;
- [ ] release-time entries use actually capturable post-observation prices, or remain explicitly H4-entry strategies;
- [ ] future first-seen paper results support the frozen behavior;
- [ ] actual costs are measured where available and unknown costs remain explicit;
- [ ] operational stale-data, incomplete-package, and feed-failure blocks work;
- [ ] risk and degradation limits are frozen before live use;
- [ ] Shadow Trader can explain every action and non-action from immutable inputs;
- [ ] the readiness banner says `Eligible for rule-based live use: Yes` for the exact setup.

Even then, `Safe to follow blindly` remains `No`. The correct final product is a reproducible, evidence-backed, rule-based trading assistant—not a guarantee that the next trade will win.

## Deferred — FMS Pattern Discovery, Setup Ratings, and Demo Execution

**Recorded:** 2026-08-30

These are research directions, not approved live-trading behavior. FMS seeks repeatable historical behavior without pretending to know every causal driver. Historical repeatability, directional alignment, volatility information, and trade profitability remain separate claims. Existing path research already calculates much of the required MFE/MAE and fixed-horizon behavior; this backlog expands complete coverage, classification, and UI exposure.

### Near-term research

- [x] Add a registered-setup reaction table showing, per exact setup and evidence direction:
  - price alignment at fixed `1/3/6/12/30 H4` horizons;
  - minimum, lower quartile, median, average, upper quartile, and maximum direction-adjusted movement in pips, ATR, and R;
  - MFE, MAE, time to each extreme, and giveback over the declared 30-H4 path;
  - TP-before-SL and SL-before-TP remain visible as separate execution statistics;
  - deterministic continuation, short-lived impulse, delayed continuation, initial rejection, volatility-only, or no-dependable-reaction classification.
- [ ] Add historical Surprise/Momentum percentile conditioning to the reaction table. The 2026-08-30 reaction-profile artifact intentionally measures price paths without silently changing the frozen evidence recipe.
- [x] Keep every horizon explicit; never present one context-free percentage as universal `price respect`.
- [x] Materialize all 47 registered reaction profiles into one durable artifact and expose development-selected execution-contract challengers as research only. A challenger never rewrites the frozen arrow or trade result.
- [x] Surface existing MFE/path data beside TP/SL results:
  - label it `Best favorable move`, not realized profit;
  - show maximum favorable and adverse movement;
  - preserve the actual frozen trade result separately;
  - never imply hindsight maximum gain was capturable.
- [x] Add a transparent registered-setup credibility scorecard using separate visible dimensions:
  - later walk-forward expectancy;
  - sample size and represented years;
  - directional alignment;
  - drawdown and losing streak;
  - parameter/year stability;
  - data/package reliability;
  - immutable forward observations;
  - known and excluded execution costs.
- [x] Produce `Strong`, `Moderate`, `Fragile`, or `Unproven` from frozen rules rather than subjective AI judgment. Never translate the rating into guaranteed safety. `Strong` requires the declared sample, expectancy, year, direction-audit, and uncertainty checks; live validation remains separate.

### Controlled pattern expansion

- [ ] Create a separate Pattern Atlas for predeclared, explainable calendar families:
  - Christmas/year-end;
  - month-end and quarter-end;
  - weekday;
  - trading session;
  - major scheduled release windows.
- [ ] Test calendar patterns independently per pair and timeframe using chronological walk-forward evaluation.
- [ ] Measure direction, magnitude, volatility, duration, MFE/MAE, and execution expectancy even when no economic cause is claimed.
- [ ] Record every declared trial and failed result to prevent repeatedly rediscovering flattering coincidences.
- [ ] Apply multiple-testing, year-concentration, regime-stability, and neighbouring-parameter diagnostics.
- [ ] Do not permit arbitrary unrestricted OHLC/calendar mining or promote a pattern solely because its full-history average is positive.
- [ ] Keep causal economic recipes and non-causal recurring market patterns visibly separated while allowing both to become registered only through immutable evidence.

### Arrow-audit presentation

- [x] Rename hindsight MFE to `Best favorable move`, label it as not-realized profit, retain the frozen outcome separately, and draw selected-signal Entry/SL/TP price lines directly on the chart.

- [x] Redesign the Past FMS Result popover to show:
  - exact event/pattern and decision first;
  - frozen SL/TP/expiry and actual outcome;
  - clear risk and reward levels on the chart;
  - best favorable and adverse path as separate hindsight diagnostics;
  - the first-H4 direction-adjusted reaction before the frozen trade result, so `price followed the arrow` and `SL reached -1R` can both be true and visible.
- [ ] Add distinct expiry and exit markers when they can be rendered without reintroducing detached duplicate chart dots. Entry, SL, and TP levels are already integrated with the selected arrow.
- [x] Use outcome colors only for realized frozen results and selected-signal price levels; keep evidence direction and credibility neutral.

### Demo-account automation — far future

- [ ] Add an explicitly opt-in, demo-only MT5 execution mode after paper-readiness work is complete.
- [x] Before any automated execution, provide a safer manual-demo evidence path: show the exact FMS comment tag on an open hypothetical trade and ingest matching demo-account history without sending or modifying orders.
- [ ] Verify through MT5 account metadata that the connected account is a demo account before every order; fail closed when account type cannot be verified.
- [ ] Make real-account order transmission unavailable in this phase.
- [ ] Require frozen per-setup contracts, maximum risk per trade, maximum simultaneous exposure, duplicate-order protection, stale/incomplete-data blocks, connection-health checks, and an immediate kill switch.
- [ ] Record decision time, requested order, broker acknowledgement, fill, spread, slippage, commission, swap, modification, and exit in an immutable execution ledger.
- [ ] Show demo positions prominently in Shadow Trader so the user can inspect them and independently decide whether to place a real trade manually.
- [ ] Never copy a demo order into a real account or describe demo profitability as proof of future real execution.

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
  - [x] preserve chart view shape on pair/timeframe changes where practical;
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

- [x] Replace the version-heavy Macro Signal Lab with the bounded FMS Experiment Workbench: guarded exact-signature experiments, single/controlled-matrix execution, durable E/C records, failed-gate acknowledgement, current-model summary, frozen-candidate table, AI/JSON handoff, full-screen tutorial, and collapsed immutable v1-v13 archive. Reserve M identifiers for a separate reviewed Charts implementation and expose no automatic promotion path.

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
- [x] Explain sparse Macro Bias regions with the last replay-arrow date and later nonmatching scored-package count; repair the audit/current-card toolbar overlap; then simplify each signal to one activation arrow with release timing retained in its audit.
- [x] Freeze country-aware Growth source `FMS-EURUSD-GROWTH-H4-v7`, reject the negative broad baseline and unstable GDP/PMI/retail/trade signatures, preserve interim v8 immutably, then freeze Charts `FMS-EURUSD-MULTI-H4-CQ-v9` with positive stressed 1R/1.5R/2R required, promote US-industrial-output Short, and move payroll Short to Research Replay after its lower targets failed that stronger gate.
- [x] Freeze and run country-aware `FMS-EURUSD-POLICY-INFL-H4-v5`: deduplicate exact series/timestamps, test strict consumer/producer inflation and canonical Fed/ECB decisions, reject direct policy arrows, and retain Euro-area producer-inflation Long as failed-year-gate research only.
- [x] Freeze Charts `FMS-EURUSD-MULTI-H4-CQ-v6`: preserve the two v4 Current Model patterns, add factual EUR/USD Policy/Inflation context, add the v5 producer-inflation candidate only to Research Replay, and connect each release ring visually to its strictly later H4 activation arrow.
- [x] Replace the Current Model card with `FMS Shadow Trader`: configurable `$1,000`/`0.5%` defaults, one gross hypothetical position at a time, 1x ATR(14) stop, frozen 2R target, sequential compounding, historical current-pattern replay, explicit No-trade/Waiting/Possible-next-setup states, and no MT5 execution. Exclude spread, commission, slippage, and swap instead of estimating them; keep the Research Replay audit below the Pair Matrix dock.
- [x] Turn Shadow Trader into the current-registry benchmark: larger readable type, MT5-time countdown and explicit if/then outcomes for the next setup, expandable gross N/target-first/stop-first/expectancy/recent/year/development/holdout/past-only/target-sensitivity evidence for every eligible setup, flexible `$1+` and `0.01–100%` simulation inputs, and sub-second cached Current Model responses that do not reload across H4/H1 switches.
- [x] Freeze Charts `FMS-EURUSD-MULTI-H4-CQ-v10` with separate per-setup exits for complete US producer-inflation cooling and exact US payroll packages while retaining the v9 sentiment and industrial patterns.
- [x] Implement `FMS-EURUSD-NUMERIC-ROBUST-H4-v11` as a separate reused-history research layer: test S/M modes, prior-Actual revision reliability, package completeness, Before alignment, score magnitude, continuation/rejection direction, and flexible exits; retain v10 unchanged and record 12 deduplicated exploratory leads with no strict lower-95 holdout pass.
- [x] Run the fixed Forecast-policy comparison, repair its zero-MAD over-flagging with a past-only movement-scale floor, and freeze prospective `FMS-EURUSD-FORECAST-GUARD-H4-v13` with the existing setup registry. Preserve suspect raw Forecasts, exclude only their Surprise contribution, keep Momentum, and never retroactively open pre-activation trades.
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
