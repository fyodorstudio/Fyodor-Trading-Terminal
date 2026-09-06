# Fyodor Trading Terminal — FMS Implementation Plan

Last updated: 2026-09-06

## Purpose and authority

This is the active implementation command board. Read AGENTS.md and the current app/source maps first. Git history retains completed work and superseded plans; do not restore old checklists as requirements. Ignore docs/Private and garbage/prototype surfaces unless explicitly requested.

The owner describes the vision and discusses plans with the agent. The agent translates that vision into reproducible research, implementation, and a concise handoff. The primary objective is to research all 28 configured Major Forex Extended pairs, discover exact economic-release recipes with positive historical walk-forward expectancy, register supported non-duplicated recipes, improve existing contracts where evidence supports it, and monitor new occurrences. Economic explanations may help form hypotheses but are not required to demonstrate an observed association.

The owner understands that historical repeatability is potential opportunity, not a promise of future profit. Keep limitations in the relevant evidence; do not repeat generic warnings instead of doing useful work.

## Working agreement

- Discussion turns are for planning, suggestions, and challenging assumptions. This update authorizes documentation only; implementation starts with the owner's later implementation/goal-mode instruction.
- The owner has authorized replacing an existing H4 entry with an H1 entry when a frozen, no-lookahead, exact-contract comparison supports the change. Preserve the historical H4 contract and activation period; publish an immutable H1 successor with a new activation boundary rather than rewriting old arrows or outcomes.
- During an authorized implementation goal, own routine technical decisions and carry the agreed scope to completion without repeatedly asking the owner to operate the Workbench or approve ordinary reversible steps.
- The owner normally leaves the agent working and reads only the final response. Avoid narration and routine progress reports; communicate only blockers, material scope/risk changes, required questions, and brief updates required by higher-priority runtime instructions.
- Do not create new tests without explicit agreement. Avoid unnecessary tests, repeated full suites, exhaustive audits, browser automation, screenshots, or clean-database rebuilds after each pass.
- Use the smallest meaningful verification for the actual change. Run the repository TypeScript gate for TypeScript changes and targeted existing checks where calculation, persistence, or contract changes warrant them. Do not repeat passing checks without a new reason; explain the need before a broad suite.
- Research validation is part of the requested work: checking chronology, input availability, orientation, outcome ordering, and reproducibility cannot be replaced by a visual manual audit. Keep that validation targeted and reusable.
- No Playwright/CDP/smoke automation unless explicitly requested. For UI changes, finish with an exact short checklist for the owner to perform at 1440x900 and 100% Chrome zoom. State that visual verification remains with the owner.
- Final handoff: what changed or was discovered, what remains unresolved, relevant verification, and the exact manual checks. Do not require the owner to read intermediate messages.
- Use pnpm, preserve stable routes and surface-owned CSS. Main/mt5-bridge remains untouched unless the owner explicitly authorizes bridge work in the implementation scope. Identify any necessary bridge changes concretely before requesting that authorization.

## Daily product contract

Charts → FMS left panel is the primary workflow. Research complexity stays behind it; do not add another required daily dashboard.

- **Next:** pair, exact registered setup, release time/countdown, and explicit conditions being watched. Do not invent Actual, direction, ATR, or entry prices before they are available.
- **Current:** matching release/package and values, recipe/version, direction or No trade, entry timing/status, ATR period/timeframe/value, Entry, original SL, TP, expiry, management rules, and any integrity block.
- **Recent:** frozen plan beside observed result, with live-captured, recovered-offline, historical, pending, ambiguous, and unavailable provenance kept honest.
- Expand rows for the exact scoring calculation and evidence. Keep geometry together with price, pips, ATR, and R; show Jakarta time consistently.
- Preserve chart arrows and selected Entry/SL/TP lines. Initial reaction, best favorable move, and frozen trade P/L are distinct facts. MFE is not captured profit.
- Keep Next/Current/Recent compact with internal scrolling, readable labels, no overlap, and no whole-page desktop scrolling. Existing secondary disclosures/journal may remain useful but must not become mandatory duplicate workflows.

## Existing foundation — reuse, do not rebuild

The current registry contains 51 base recipes across 10 pairs, including four cross-market registrations from the 06 Sep 2026 frozen campaign, with three reviewed break-even overlays and a separate reviewed context-contract layer. Verify identifiers against source/artifacts at the start of implementation rather than assuming every documentation count is current.

Already established: immutable experiments/candidates; chronological evaluation; Reaction Atlas; magnitude/scoring/context challengers; fixed/break-even/trailing/partial execution research; entry-known reversal research; recipe credibility and knowledge views; historical arrows; first-seen prospective decisions; recovered-offline separation; background lifecycle reconciliation; stale-feed checks; tagged manual-demo reconciliation; and cached Charts loading.

The previous plan records 14 review-worthy reversal-family winners across 11 recipes in `fms-entry-known-reversal-exit-v1`. These are research findings, not newly registered contracts. Locate and review existing artifacts before rerunning them. Existing Knowledge-ledger completeness must be inspected rather than assuming it is missing because an old checkbox remained open.

## Priority 1 — Establish research coverage and reuse

- [ ] Inspect the smallest relevant discovery, scoring, execution, registry, and knowledge paths plus saved artifacts. Produce a concise gap map: implemented, incomplete, reusable, genuinely missing. Avoid a general repository audit.
- [x] Resolve the owner's Major Forex Extended universe from existing pair configuration. The Workbench and bridge now expose the same 28 configured major-currency pairs. The original seven retain registered setups; the 21 crosses are research-only until a frozen campaign qualifies them.
- [x] Complete the checkpointed 21-cross preparation campaign. Correct the canonical cross from unavailable `CADNZD` to broker-standard `NZDCAD`; cache H4 for all 28 markets and retain the sole source failure, CADCHF sentiment, where no registered release packages exist.
- [x] Build a durable generated coverage index by pair, source version, calendar/candle period, counts, status, and fingerprints. The 06 Sep 2026 ledger records 28/28 H4 markets and 111/112 completed source baselines under coverage hash `1698630b32a1b972e881619a8637043ea4bb610b386ec9801570a65b44458b34`.
- [x] Record calendar coverage, candle resolution/coverage, missing Forecast/Previous, revision provenance, and usable independent release counts. Missing history does not mean no event occurred.
- [ ] Link every prior finding to experiment/artifact IDs, fingerprints, tested variants, conclusions, and the next justified action. Deduplicate equivalent recipes and shared trade cases; retain failed trials.

## Priority 2 — Research earlier entry for existing recipes

The owner's observation is that initial reactions often appear aligned while the later-H4 entry may miss them. Treat this as a hypothesis to measure across the registry, not an established improvement or proof of release-time profitability.

- [x] Preserve first strictly later H4 open as the unchanged baseline. The frozen pre-H4 reaction artifact measures delay, direction-adjusted move, favorable/adverse excursion, and the separate H1/H4 frozen outcomes across 4,746 evaluable recipe cases.
- [x] Declare a small entry comparison before inspecting its results: first later M1, first later H1, current later H4, and at most a small fixed post-release delay set justified by available candle coverage. Avoid an unrestricted timing grid. Frozen 06 Sep 2026 campaigns retain manifests, checkpoints, results, exclusions, and source fingerprints; M1 evidence is explicitly recent and sparse.
- [ ] Separate historical scheduled-release candle proxies from prospective entries after the complete package was actually observed. A release-containing candle open can precede Actual availability and is not a valid post-decision entry.
- [ ] For prospective comparisons, use first-seen complete-package/decision timestamps and the first eligible candle boundary strictly after the information was available. Preserve measured delay; never manufacture historical receipt times or fills.
- [ ] Define ATR timeframe/period, completed-bar cutoff, stop/target basis, expiry, entry deadline, and any confirmation rule separately for each contract. Earlier entry must not use the eventual high/low/close of its unfinished H4 candle.
- [ ] First compare entry timing with a declared common execution specification; only then research a bounded execution adjustment on development data. Report matched-case comparisons and coverage losses so differing samples cannot masquerade as improvements.
- [ ] Use available finer candles for path ordering. Preserve ambiguous SL/TP ordering, gaps, and missing data; report their counts and result sensitivity without treating excluded cases as harmless.
- [x] Select on development history, judge on later chronology, and retain negative results. The trading-session H1 comparison matched 4,617 cases, selected 20 recipes on development, and retained eight positive later candidates; failures remain in the artifact.
- [x] Materialize supported alternatives as immutable candidates with timing provenance. The exact-active-contract followup retained eight H1 candidates under a fingerprinted manifest. They remain scheduled-release simulations; no active entry changed because historical candles cannot prove complete-package availability or fills.
- [x] Promote only the supported H1 candidates whose implementation audit confirms that the complete package can be observed before the planned H1 boundary. Eight reviewed successors activate prospectively at 06 Sep 2026 05:00 UTC; prospective cases require a complete first-seen decision before the eligible H1 boundary.
- [ ] Implement entry timeframe as part of the immutable execution contract rather than a UI-only label. Make evaluation, pending lifecycle, late-capture protection, expiry units/time, context evaluation, Shadow Trader observation, chart geometry, and Next/Current/Recent read the same contract field.
- [x] Register each supported H1 successor with its own review ID, evidence fingerprint, activation timestamp, and exact current SL/TP/management rules. Every pre-activation event retains its original H4 contract; only the eight reviewed recipes change prospectively.
- [x] Reconcile the eight H1 successors against their frozen artifact, active execution fields, and activation boundary. All eight exact contracts passed targeted reconciliation.

## Priority 3 — Reproducible discovery campaigns

Extend the existing Workbench/Atlas and agent-facing research runner. A new screen is optional; owner-operated experiment management is not the goal.

- [ ] Freeze a campaign manifest containing pair/event universe, source fingerprints, eligible periods, rule families, search budget, chronological windows, selection rule, execution grid, and deduplication policy before running it.
- [ ] Search simple exact-series/package conditions first: Actual versus Forecast, Actual versus Previous, agreement/conflict, missing inputs, continuation/rejection, and past-only within-series surprise magnitude. Preserve country, unit, frequency, and package identity.
- [ ] Keep economic comparison direction distinct from empirical pair-price direction. Check base/quote orientation and do not force all inflation or policy changes into a growth-style direction mapping.
- [ ] Use small predefined entry/SL/TP/duration choices and reuse cached price paths. Resume interrupted campaigns and skip unchanged completed configurations by fingerprint.
- [ ] Record every attempted configuration and failure, not just winners. Track release identity across pairs; one release moving seven pairs is not seven independent economic observations.
- [ ] Evaluate the selection process chronologically: discover/select on older data, freeze, evaluate on the next period, and advance with the same procedure. Purge selection outcomes that cross evaluation boundaries; calculate features from prior available data only.
- [ ] Track historical periods already inspected during previous research. Once later results influence a change, that period is development evidence for the change, not an untouched holdout. Do not relabel reused history as fresh validation.
- [ ] Compare finalists with same-event always-long/always-short and opposite-direction controls under the same execution rules. Add a predeclared comparable non-event candle control where data permits; do not select favorable controls after results.
- [ ] Report whether release-value conditions add value beyond the simpler controls. Compare year concentration, exceptional-trade dependence, nearby parameters, chronological consistency, and effective sample breadth.
- [ ] Produce a compact ranked report with positive, fragile, unsupported, and insufficient findings and explicit reasons. Ranking must not silently reselect winners from the final evaluation window.

### Goal-mode campaign order and cost controls

Run this sequence autonomously. Finish and checkpoint each stage before spending resources on the next.

1. **Prepare the 21 crosses:** resume `scripts/fms_prepare_extended_markets.py`; cache missing H4 archives and complete only the four frozen source baselines per pair.
2. **Build the coverage ledger:** summarize source availability, usable cases, calendar/candle periods, missing values, and fingerprints for all 28 pairs. Exclude unsupported work before launching experiments.
3. **Finish the eight H1 upgrades:** implement the shared entry-timeframe contract once, then reconcile and activate only candidates that pass exact-contract and information-timing checks.
4. **Run cheap discovery first:** exact-series/package direction and continuation/rejection treatments with sufficient sample sizes. Reuse cached outcomes and skip unchanged fingerprints.
5. **Run bounded execution research:** only for direction recipes that remain positive in later chronology. Avoid execution grids for failed or under-sampled direction hypotheses.
6. **Deduplicate across pairs and releases:** treat the same macro release observed through several pairs as shared evidence, while allowing genuinely different pair responses to remain separate recipes.
7. **Review and register:** register positive later-history non-duplicates or immutable upgrades; keep fragile findings visible as research and retain all failures.
8. **Publish the daily handoff:** update Charts Next/Current/Recent, Knowledge evidence, arrow/price geometry, and the compact final report.

Cost discipline:

- Prefer deterministic local scripts and compact JSON summaries over repeated conversational inspection.
- Do not print large raw artifacts, profile JSON, candle arrays, or routine command output into the conversation.
- Query only the fields needed for decisions; summarize counts and hashes.
- Reuse existing runs, candles, experiments, and checkpoints by fingerprint.
- Do not run M1 acquisition across the full universe. Request finer candles only for finalist paths requiring intrabar ordering or a declared entry comparison.
- Do not rerun typecheck or reconciliation after documentation-only or artifact-only steps. Run each relevant gate once after the corresponding implementation batch.
- Stay silent during goal-mode implementation except for blockers, required input, material risk, or the final handoff.

## Priority 4 — Improve and register supported recipes

06 Sep 2026 cross-market campaign: the frozen Stage A manifest tested 278 declared baselines across the 20 research-ready crosses and retained five research candidates. The first bounded Stage B followup retained three momentum-scored finalists. A second bounded pass examined the strongest positive but parameter-fragile baselines and retained one direction-specific finalist. Exact fixed contracts selected on development history were then checked on untouched chronological holdouts and registered prospectively: AUDJPY Japanese industrial output (1.25 ATR stop, 3R target, 42 H4; holdout N 37, stressed +0.448R), EURJPY euro-area composite/services PMI (0.5 ATR, 1.5R, 30 H4; evaluable N 33, stressed +0.287R), EURCAD euro-area consumer sentiment (2 ATR, 3R, 12 H4; N 39, stressed +0.112R), and short-only AUDJPY Japanese headline/core inflation (0.5 ATR, 0.5R, 30 H4; evaluable N 26, stressed +0.210R). Their immutable experiments, frozen candidates, fingerprints, reaction profiles, limitations, and activation boundary are retained. CHFJPY Japanese CPI remained directionally positive but did not improve under the bounded challenger, and AUDJPY Australian business sentiment weakened materially.

A third bounded followup tested AUDNZD Australian business sentiment, CHFJPY Japanese core CPI, and EURJPY Japanese trade balance. All 21 declared variants were rejected; retain the manifest and result so these families are not repeated without a new hypothesis or more data.

The four cross registrations were then replayed under their exact fixed contracts with first-later-H1 versus registered H4 entry and the same final H4 expiry. None passed the development-and-later promotion rule: AUDJPY industrial output was -0.046R on development and flat later; AUDJPY short inflation was -0.081R on development despite +0.058R later; EURCAD sentiment was negative in both partitions; EURJPY PMI was -0.133R development and -0.227R later. All four retain H4 entry. Their bounded execution and context challengers also failed the existing registration checks, so no overlay was forced.

- [ ] Review existing unactivated execution/reversal candidates before launching duplicate searches; compare against the actually active parent, including reviewed overlays.
- [x] For each 06 Sep cross-market finalist, record exact event membership, value condition, scoring/mapping, entry-information cutoff, ATR definition, entry/SL/TP/management/expiry, data identity, selection history, and activation boundary.
- [ ] Base historical qualification on positive no-lookahead chronological average R under the complete fixed contract. Show sample size, uncertainty, stability, costs omitted, and drawdown as diagnostics; an academic confidence cutoff alone must not veto an otherwise positive historical recipe.
- [ ] Use actual full-contract expectancy, including expiry/partial/break-even outcomes. Do not apply a simplistic TP-hit break-even formula to contracts with other possible exits.
- [ ] Keep directional reaction knowledge when no execution contract works. Mark the declared search exhausted and revisit only for a documented new hypothesis or materially expanded archive.
- [x] Register the four supported cross-market non-duplicates through explicit reviewed immutable records. No runtime auto-promotion, silent mutation, or promotion solely from full-history profit.
- [ ] Preserve parents and historical activation contracts. Ensure Workbench, registry, Charts, and prospective monitoring agree for the changed recipe using targeted reconciliation rather than repeatedly rebuilding everything.
- [ ] Add numeric inflation/policy context or bounded candle-context interactions only as separate justified research families after simpler evidence. No policy-language parsing or new data source.

## Priority 5 — Evidence that stays useful after registration

- [ ] Consolidate each recipe's report: fixed rule, later average R, median/profit frequency, independent release count, represented periods, drawdown/streak, parameter stability, data exclusions, and prospective result. Reuse existing metrics and disclosures.
- [ ] Keep historical simulation, recovered-offline paths, true first-seen paper outcomes, and existing tagged-demo outcomes separate. A candle result cannot establish a real fill.
- [ ] Research inputs remain MT5 economic calendar and OHLC candles only. No new external feeds, sentiment/news services, or tick-data dependency. Existing optional quote/demo observations may retain their provenance but must not become prerequisites for calendar/OHLC discovery.
- [ ] Preserve gross results with spread, commission, slippage, and swap excluded rather than estimated. Show break-even average execution-cost budget in R as an arithmetic diagnostic, not measured net profitability; do not double-count costs in any existing actual-execution report.
- [ ] Continue all qualifying/no-trade prospective observations without cherry-picking. Preserve activation boundaries after losses and surface weakening evidence without rewriting the historical registration.
- [ ] Freeze any new degradation/pause policy separately. Do not silently convert historical uncertainty diagnostics into blocks on research visibility or demo monitoring.

## Priority 6 — Finish the Charts handoff

- [ ] Fix the known narrow Trade-dock status/source/timestamp overlap if it remains reproducible in the owner-reported layout.
- [ ] Integrate supported registrations and entry-version details into Next/Current/Recent and selected-arrow geometry, keeping the daily workflow unchanged.
  - [x] Show per-recipe earlier-entry evidence in expanded Next/Current/Recent rows and label every chart arrow `H4 ENTRY · LONG/SHORT`; Entry/SL/TP lines remain the price geometry. No faster registration exists yet.
- [ ] Keep package-level decisions distinct from component scores; a zero component must not imply that positive siblings were cancelled.
- [ ] Make integrity, late-entry, missing-data, conflict, and unavailable reasons local to affected rows. Preserve last honest content during transient refresh failures.
- [ ] Keep research diagnostics collapsed, cached, and unmounted until opened. Do not regress Charts/pair/timeframe loading while adding campaign results.

## Deferred until research improvements warrant them

- Account-aware position sizing, simultaneous/correlated exposure limits, drawdown and consecutive-loss pauses, and a reproducible combined portfolio replay. Extend existing replay instead of assuming it is absent.
- A separately authorized manual real-execution ledger. Existing tagged-demo reconciliation is not authorization to read a real account or send orders.
- New context families, under-sampled magnitude contenders, and unrelated calendar seasonality: revisit only with a declared hypothesis and sufficient coverage, not repeated unrestricted mining.
- Calendar metadata/backfill improvements only after confirming a real coverage gap and obtaining any needed bridge-work authorization; use the same MT5 source.
- Non-FMS UI cleanup only for a targeted owner request. External feeds, automatic orders, garbage-tool revival, and unrelated redesigns are outside this plan.

## Completion and manual handoff

A research pass is complete when its manifest and results are durable, all declared trials are accounted for, selection/evaluation provenance is honest, and supported findings have a concrete review or registration outcome. Discovering no upgrade is a valid result; do not force a winner to claim completion.

An implementation pass is complete when the authorized changes work with appropriate targeted verification, historical contracts remain reproducible, and the owner receives a concise self-contained result. Do not label unperformed browser checks as passed.

For a visible FMS change, tailor this manual checklist to the changed behavior and explicitly ask the owner to perform it:

- [ ] At 1440x900, Chrome 100% zoom, open Charts → FMS; switch Next/Current/Recent and expand rows. Check ordinary text, timestamps, controls, internal scrolling, and no overlap or whole-page overflow.
- [ ] Inspect one affected setup/arrow: triggering values, recipe/version, entry time, ATR definition/value, Entry/SL/TP, management, and expiry agree across its row and chart details.
- [ ] Inspect one pending/no-trade/recovered case relevant to the change: status and provenance are clear and unavailable prices are not invented.
- [ ] Switch pair/timeframe and reopen the panel: content stays responsive and no previous pair's late response replaces the current selection.

For documentation-only changes, no app audit, build, or test run is required.
