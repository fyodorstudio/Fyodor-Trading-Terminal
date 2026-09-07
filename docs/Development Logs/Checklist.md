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

- [x] Inspect the smallest relevant discovery, scoring, execution, registry, and knowledge paths plus saved artifacts. Produce a concise gap map: implemented, incomplete, reusable, genuinely missing. Avoid a general repository audit.
- [x] Resolve the owner's Major Forex Extended universe from existing pair configuration. The Workbench and bridge now expose the same 28 configured major-currency pairs. The original seven retain registered setups; the 21 crosses are research-only until a frozen campaign qualifies them.
- [x] Complete the checkpointed 21-cross preparation campaign. Correct the canonical cross from unavailable `CADNZD` to broker-standard `NZDCAD`; cache H4 for all 28 markets and retain the sole source failure, CADCHF sentiment, where no registered release packages exist.
- [x] Build a durable generated coverage index by pair, source version, calendar/candle period, counts, status, and fingerprints. The 06 Sep 2026 ledger records 28/28 H4 markets and 111/112 completed source baselines under coverage hash `1698630b32a1b972e881619a8637043ea4bb610b386ec9801570a65b44458b34`.
- [x] Record calendar coverage, candle resolution/coverage, missing Forecast/Previous, revision provenance, and usable independent release counts. Missing history does not mean no event occurred.
- [x] Link every prior finding to experiment/artifact IDs, fingerprints, tested variants, conclusions, and the next justified action. Deduplicate equivalent recipes and shared trade cases; retain failed trials.

## Priority 2 — Research earlier entry for existing recipes

The owner's observation is that initial reactions often appear aligned while the later-H4 entry may miss them. Treat this as a hypothesis to measure across the registry, not an established improvement or proof of release-time profitability.

- [x] Preserve first strictly later H4 open as the unchanged baseline. The frozen pre-H4 reaction artifact measures delay, direction-adjusted move, favorable/adverse excursion, and the separate H1/H4 frozen outcomes across 4,746 evaluable recipe cases.
- [x] Declare a small entry comparison before inspecting its results: first later M1, first later H1, current later H4, and at most a small fixed post-release delay set justified by available candle coverage. Avoid an unrestricted timing grid. Frozen 06 Sep 2026 campaigns retain manifests, checkpoints, results, exclusions, and source fingerprints; M1 evidence is explicitly recent and sparse.
- [x] Separate historical scheduled-release candle proxies from prospective entries after the complete package was actually observed. A release-containing candle open can precede Actual availability and is not a valid post-decision entry.
- [x] For prospective comparisons, use first-seen complete-package/decision timestamps and the first eligible candle boundary strictly after the information was available. Preserve measured delay; never manufacture historical receipt times or fills.
- [x] Define ATR timeframe/period, completed-bar cutoff, stop/target basis, expiry, entry deadline, and any confirmation rule separately for each contract. Earlier entry must not use the eventual high/low/close of its unfinished H4 candle.
- [x] First compare entry timing with a declared common execution specification; only then research a bounded execution adjustment on development data. Report matched-case comparisons and coverage losses so differing samples cannot masquerade as improvements.
- [x] Use available finer candles for path ordering. Preserve ambiguous SL/TP ordering, gaps, and missing data; report their counts and result sensitivity without treating excluded cases as harmless.
- [x] Select on development history, judge on later chronology, and retain negative results. The trading-session H1 comparison matched 4,617 cases, selected 20 recipes on development, and retained eight positive later candidates; failures remain in the artifact.
- [x] Materialize supported alternatives as immutable candidates with timing provenance. The exact-active-contract followup retained eight H1 candidates under a fingerprinted manifest. They remain scheduled-release simulations; no active entry changed because historical candles cannot prove complete-package availability or fills.
- [x] Promote only the supported H1 candidates whose implementation audit confirms that the complete package can be observed before the planned H1 boundary. Eight reviewed successors activate prospectively at 06 Sep 2026 05:00 UTC; prospective cases require a complete first-seen decision before the eligible H1 boundary.
- [x] Implement entry timeframe as part of the immutable execution contract rather than a UI-only label. Make evaluation, pending lifecycle, late-capture protection, expiry units/time, context evaluation, Shadow Trader observation, chart geometry, and Next/Current/Recent read the same contract field.
- [x] Register each supported H1 successor with its own review ID, evidence fingerprint, activation timestamp, and exact current SL/TP/management rules. Every pre-activation event retains its original H4 contract; only the eight reviewed recipes change prospectively.
- [x] Reconcile the eight H1 successors against their frozen artifact, active execution fields, and activation boundary. All eight exact contracts passed targeted reconciliation.

## Priority 3 — Reproducible discovery campaigns

Extend the existing Workbench/Atlas and agent-facing research runner. A new screen is optional; owner-operated experiment management is not the goal.

- [x] Freeze a campaign manifest containing pair/event universe, source fingerprints, eligible periods, rule families, search budget, chronological windows, selection rule, execution grid, and deduplication policy before running it.
- [x] Search simple exact-series/package conditions first: Actual versus Forecast, Actual versus Previous, agreement/conflict, missing inputs, continuation/rejection, and past-only within-series surprise magnitude. Preserve country, unit, frequency, and package identity.
- [x] Keep economic comparison direction distinct from empirical pair-price direction. Check base/quote orientation and do not force all inflation or policy changes into a growth-style direction mapping.
- [x] Use small predefined entry/SL/TP/duration choices and reuse cached price paths. Resume interrupted campaigns and skip unchanged completed configurations by fingerprint.
- [x] Record every attempted configuration and failure, not just winners. Track release identity across pairs; one release moving seven pairs is not seven independent economic observations.
- [x] Evaluate the selection process chronologically: discover/select on older data, freeze, evaluate on the next period, and advance with the same procedure. Purge selection outcomes that cross evaluation boundaries; calculate features from prior available data only.
- [x] Track historical periods already inspected during previous research. Once later results influence a change, that period is development evidence for the change, not an untouched holdout. Do not relabel reused history as fresh validation.
- [x] Compare finalists with same-event always-long/always-short and opposite-direction controls under the same execution rules. Add a predeclared comparable non-event candle control where data permits; do not select favorable controls after results.
- [x] Report whether release-value conditions add value beyond the simpler controls. Compare year concentration, exceptional-trade dependence, nearby parameters, chronological consistency, and effective sample breadth.
- [x] Produce a compact ranked report with positive, fragile, unsupported, and insufficient findings and explicit reasons. Ranking must not silently reselect winners from the final evaluation window.

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

- [x] Review existing unactivated execution/reversal candidates before launching duplicate searches; compare against the actually active parent, including reviewed overlays.
- [x] For each 06 Sep cross-market finalist, record exact event membership, value condition, scoring/mapping, entry-information cutoff, ATR definition, entry/SL/TP/management/expiry, data identity, selection history, and activation boundary.
- [x] Base historical qualification on positive no-lookahead chronological average R under the complete fixed contract. Show sample size, uncertainty, stability, costs omitted, and drawdown as diagnostics; an academic confidence cutoff alone must not veto an otherwise positive historical recipe.
- [x] Use actual full-contract expectancy, including expiry/partial/break-even outcomes. Do not apply a simplistic TP-hit break-even formula to contracts with other possible exits.
- [x] Keep directional reaction knowledge when no execution contract works. Mark the declared search exhausted and revisit only for a documented new hypothesis or materially expanded archive.
- [x] Register the four supported cross-market non-duplicates through explicit reviewed immutable records. No runtime auto-promotion, silent mutation, or promotion solely from full-history profit.
- [x] Preserve parents and historical activation contracts. Ensure Workbench, registry, Charts, and prospective monitoring agree for the changed recipe using targeted reconciliation rather than repeatedly rebuilding everything.
- [x] Add numeric inflation/policy context or bounded candle-context interactions only as separate justified research families after simpler evidence. No policy-language parsing or new data source.

## Priority 5 — Evidence that stays useful after registration

- [x] Consolidate each recipe's report: fixed rule, later average R, median/profit frequency, independent release count, represented periods, drawdown/streak, parameter stability, data exclusions, and prospective result. Reuse existing metrics and disclosures.
- [x] Keep historical simulation, recovered-offline paths, true first-seen paper outcomes, and existing tagged-demo outcomes separate. A candle result cannot establish a real fill.
- [x] Research inputs remain MT5 economic calendar and OHLC candles only. No new external feeds, sentiment/news services, or tick-data dependency. Existing optional quote/demo observations may retain their provenance but must not become prerequisites for calendar/OHLC discovery.
- [x] Preserve gross results with spread, commission, slippage, and swap excluded. The owner explicitly chose gross-only FMS reporting; broker costs remain outside the research result and are not estimated here.
- [x] Continue all qualifying/no-trade prospective observations without cherry-picking. Preserve activation boundaries after losses and surface weakening evidence without rewriting the historical registration.
- [x] Freeze any new degradation/pause policy separately. Do not silently convert historical uncertainty diagnostics into blocks on research visibility or demo monitoring.

## Priority 6 — Finish the Charts handoff

- [x] Harden the narrow Trade-dock layout with an explicit `27% | 23% | 50%` Current-row contract and wrapping/overflow containment for the long state cell. Final visual confirmation remains in the owner audit.
- [x] Integrate supported registrations and entry-version details into Next/Current/Recent and selected-arrow geometry, keeping the daily workflow unchanged.
  - [x] Show per-recipe earlier-entry evidence in expanded Next/Current/Recent rows and label every chart arrow `H4 ENTRY · LONG/SHORT`; Entry/SL/TP lines remain the price geometry. No faster registration exists yet.
- [x] Keep package-level decisions distinct from component scores; a zero component must not imply that positive siblings were cancelled.
- [x] Make integrity, late-entry, missing-data, conflict, and unavailable reasons local to affected rows. Preserve last honest content during transient refresh failures.
- [x] Keep research diagnostics collapsed, cached, and unmounted until opened. Do not regress Charts/pair/timeframe loading while adding campaign results.

## Next goal-mode mission — Multi-zone price structure and Past Result hierarchy

The nearest-barrier target pass is already recorded in FMS Knowledge as an unsupported family: five of 51 recipes passed the older-development selection rule and zero preserved the required uplift in later chronology. For EURUSD US manufacturing employment, the development-selected 2:1 barrier variant improved by +0.079R before weakening to -0.068R versus the registered contract across 42 later cases. Preserve that negative result and the current registered TP/SL. It rejects that exact nearest-zone rule; it does not establish that every entry-known price-structure rule is useless.

The next hypothesis is narrower and materially different. A nearest H4 zone can be an intermediate obstacle while a wider, already-confirmed zone remains relevant if the nearer zone breaks. The research must represent a ranked zone ladder and sequential barrier state rather than selecting whichever historical line makes an individual trade look successful. Overfitting remains possible because many zone definitions, buffers, break rules, and exits can be chosen after seeing outcomes; freeze the small family below before reading results.

### Pass 1 — Audit and freeze price-structure semantics

- [x] Reproduce the owner-reported EURUSD arrow and identify its setup, release time, frozen entry/ATR/SL/TP/expiry, nearest H4 support, wider pre-entry support candidates, and the earlier resistance mentioned in the screenshot. Record which levels were genuinely confirmed before entry.
- [x] Audit the current `fms-market-context-v1` zone detector and its chart projection. Confirm how pivots cluster, how touch count and rejection strength are calculated, whether broken resistance can become support, and whether chain-merging or an averaged level can move a zone misleadingly.
- [x] Freeze `fms-price-structure-ladder-v1` before testing: use completed pre-entry H4 candles only; retain multiple ordered supports below entry and resistances above entry; give every zone a stable identity, price band, touch count, rejection strength, first/last confirmation times, age, distance in ATR, and provenance.
- [x] Define role reversal without hindsight. A former resistance may become support only after a completed H4 close breaks it and a later completed candle confirms the prescribed hold/retest before the signal entry. A post-entry break may update state only after its confirming candle closes and may affect no earlier decision or fill.
- [x] Define deterministic zone invalidation and dominance. Distinguish `active`, `testing`, `broken`, `role_reversed`, and `superseded`; never remove the wider ladder merely because the nearest zone exists or later breaks.
- [x] Reconcile the new ladder against the current nearest-zone output. Preserve existing registered context contracts and historical arrows unless a separately reviewed successor later passes exact artifact checks.

### Pass 2 — Make Past Result answer the trade question first

- [x] Redesign the top of Past Result as a compact decision header with this order: pair and setup; release date/time and provenance; Long/Short; outcome; Entry; ATR and ATR cutoff; SL with ATR/pips; TP with R/ATR/pips; risk:reward; entry timeframe; expiry duration and exact expiry time; management rule.
- [x] Put the triggering releases and their Actual/Forecast/Previous scores immediately below the decision header. Show whether the package implies an ordinary or historically exceptional move only when that label follows a frozen past-only rule.
- [x] Add a `Why this target was plausible historically` block. Show the registered setup's target-hit rate, average/median R, sample size, later-period result, typical MFE, probability of reaching the frozen target before SL, time-to-target distribution, and exceptional-trade dependence. Do not claim that a +4R contract predicts a huge move merely because its TP is +4R.
- [x] Add a compact price-structure ladder: nearest and wider directional zones, distance from entry in price/pips/ATR/R, touches/strength/age, role and confirmation time, whether each zone lies before or beyond TP, and its eventual post-entry state clearly labeled as hindsight outcome.
- [x] Keep the selected-arrow screenshot focus behavior. The Past Result close button restores all arrows; closing must also remove the selected trade and structure lines.
- [x] Move long context diagnostics and target ladders below the decision evidence in collapsible sections. Keep ordinary text readable with internal scrolling at 1440x900 and 100% Chrome zoom.

### Pass 3 — Explain large targets with existing historical evidence

- [x] For each registered recipe, derive frozen-target reach diagnostics from its existing path profiles: TP-before-SL rate, SL-before-TP rate, ambiguous/unavailable count, expiry rate, median and upper-quartile MFE in R, time to each declared R rung, and the share of total expectancy contributed by the largest one, three, and five wins.
- [x] Separate `large target historically reached often enough`, `large target depends on rare outsized wins`, and `large target not supported by later paths`. Base labels on declared numeric thresholds and later chronology, not prose judgment.
- [x] For the selected arrow, compare its release package magnitude only with prior same-series/package observations available before that release. Show percentile and comparable-case path distribution without using the selected event's later price path to classify its expected size.
- [x] Keep economic surprise magnitude, expected price excursion, MFE, target-hit probability, and realized trade result as different measurements. A large surprise must not automatically widen TP unless a frozen historical rule supports that mapping.

### Pass 4 — Frozen sequential multi-zone challenger

- [x] Reuse the 51 registered recipe cases and cached H4 paths. Do not create a new directional setup family in this pass; test price structure as an execution successor to each exact registered parent.
- [x] Predeclare a small challenger family: `(a)` registered stop with TP at the nearest qualifying zone; `(b)` take a declared partial at the nearest zone and retain the remainder toward the registered TP or next wider zone; `(c)` after a completed-H4 break/hold confirmation, advance the remaining target to the next pre-entry zone; `(d)` fixed registered contract as control. Use one fixed buffer and minimum-distance rule selected before outcomes.
- [x] Preserve risk accounting for partial exits and variable targets. Compute realized full-contract R from every tranche; do not use TP-hit formulas that ignore expiry, break-even, partials, ambiguous bars, or adverse gaps.
- [x] Use M1 only for finalist same-candle ordering where cached coverage exists. Keep missing and ambiguous order explicit and report sensitivity rather than assuming the favorable order.
- [x] Select a complete rule on older development history, freeze it, and judge it once on later chronology. Require sufficient development/later samples, positive averages in both, at least +0.05R later uplift versus the exact active parent, acceptable drawdown/streak behavior, multi-year breadth, and no dependence on one exceptional trade.
- [x] Report matched-case parent/challenger comparisons and barrier-state counts: no zone, nearest held, nearest broke, role reversal confirmed, wider target attempted, partial captured, and unresolved. The same release across pairs remains shared evidence rather than independent confirmation.
- [x] Retain every rejected rule and its fingerprint. Do not weaken thresholds, swap zone definitions, or select a different buffer after seeing later results.

### Pass 5 — Promotion decision and daily handoff

- [x] If no challenger survives, keep all registered contracts unchanged, publish the exhausted hypothesis in FMS Knowledge, and retain the wider zone ladder as descriptive decision support.
- [x] If a challenger survives, materialize an immutable execution successor with parent ID, configuration/dataset/candle fingerprints, development/later evidence, activation timestamp, and exact zone-state/partial/expiry rules. Never rewrite pre-activation arrows or outcomes.
- [x] Apply a supported successor consistently to current qualification, recovered replay, prospective capture, pending lifecycle, chart Entry/SL/TP/partial/zone geometry, Next/Current/Recent, Past Result, Knowledge, and target-ladder audits.
- [x] Keep the primary daily workflow unchanged: open Charts, inspect Next/Current/Recent, and click an arrow for the ordered decision evidence. Research controls remain out of the required workflow.
- [x] Run one targeted reconciliation of every promoted contract, Python compilation, and the repository TypeScript gate. Do not add tests or run browser automation without new owner authorization.

### Acceptance and owner audit for this mission

- [x] At 1440x900 and 100% Chrome zoom, the Past Result top viewport shows date, setup, direction/outcome, Entry/ATR, SL, TP, risk:reward, expiry, and management without needing to hunt through lower sections.
- [x] The selected EURUSD example displays its nearest H4 support and every qualifying wider pre-entry support with stable labels; broken/role-reversed states and confirmation times are understandable and never presented as entry-known when they occurred later.
- [x] A +4R setup shows quantitative historical support or fragility for that target. The UI never infers expected move size from the configured target alone.
- [x] Selecting an arrow hides other FMS arrows; closing Past Result restores them and removes selected geometry.
- [x] One ordinary target, one large target, one nearest-zone break, one missing-zone case, and one ambiguous path agree across artifact, API, Past Result, and chart geometry.
- [x] The final handoff states whether any contract was promoted, lists exact evidence, and gives the owner a short manual visual checklist. No profit claim or invented execution cost is introduced.

### Multi-zone price-structure result - 07 Sep 2026

- [x] Materialized `fms-price-structure-ladder-v1` from completed pre-entry H4 candles. It preserves the legacy nearest-zone fields used by active context registrations while adding stable zone IDs, clustered bands, confirmation times, ordered wider zones, completed-break role reversals, entry-known invalidation, and separately labeled post-entry hindsight states.
- [x] Rebuilt all 51 registered recipe profiles: 5,654 historical paths, 3,303 with multiple directional zones and 1,287 with no directional zone. All displayed ladder confirmations were at or before entry.
- [x] Ran the frozen sequential challenger family. After pre-entry role-reversal invalidation was enforced, none of the 153 declared challengers across 51 recipes cleared the older-development screen; none advanced to later chronology. No registered contract or historical result changed.
- [x] Added exact historical execution-contract target evidence rather than applying today's contract to old arrows. The retained EURUSD +4R contracts are visibly fragile: US CPI later average +0.113R across 73 evaluable cases but median -1R and 6.85% TP-first; euro-area retail sales later average +0.083R across 28 cases, median -1R, and 0% TP-first. Both are labeled as relying on infrequent outsized outcomes rather than as forecasts of a huge move.
- [x] Kept release magnitude separate from target size. Existing past-only magnitude cohorts remain research diagnostics; no registered magnitude-to-TP mapping passed a frozen rule, so Past Result does not present a large surprise as proof that a large move is expected.
- [x] Past Result now puts release time/provenance, direction/outcome, Entry, SL, TP, R:R, ATR, expiry, and management first; target support and the full structure ladder follow the trigger. Entry-timing detail is collapsed below the decision evidence. The chart shows the nearest plus two wider directional levels to retain legibility; the dock lists the complete ladder.
- [x] Durable artifacts: `Main/mt5-bridge/multi_zone_execution_research.json` and `Main/mt5-bridge/support_resistance_execution_research.json`. FMS Knowledge records both exhausted families so they are not mined again unchanged.

## Deferred until research improvements warrant them

- Account-aware position sizing, simultaneous/correlated exposure limits, drawdown and consecutive-loss pauses, and a reproducible combined portfolio replay. Extend existing replay instead of assuming it is absent.
- A separately authorized manual real-execution ledger. Existing tagged-demo reconciliation is not authorization to read a real account or send orders.
- Frozen prospective proof stage: preserve the current registered contracts and activation boundaries; record every future qualifying and no-trade release from its first-seen complete package; retain the first genuinely available quote and eligible entry boundary; never tune a frozen recipe with the same observations later presented as unseen validation; and evaluate independent-release breadth, chronological halves, drawdown, losing streaks, regime stability, and dependence on exceptional wins before considering real-money use.
- Keep FMS research and displayed expectancy gross. Do not subtract, estimate, model, or gate setups using spread, slippage, commission, swap, or other execution costs. Preserve explicit gross-result labeling and leave any later broker-specific cost assessment to the owner using MT5/account records.
- If prospective evidence eventually justifies an owner-run real-money pilot, keep it manual and default to the broker's minimum 0.01-lot order size. Record the actual position, entry, exit, and broker costs separately without allowing live outcomes to rewrite old arrows. A fixed 0.01 lot has different monetary risk across pairs and SL distances, so the UI must show that exposure before any trade; FMS still must not send an order.
- Predeclare the prospective graduation and stopping rules before inspecting results: minimum independent release count and time/regime coverage; positive gross expectancy overall and across chronological halves; tolerable drawdown and losing streak; bounded contribution from the largest wins; no silent exclusions; and an explicit decision to continue, pause, retire, or redesign each frozen recipe. Do not promise that continued mining must produce a winner.
- New context families, under-sampled magnitude contenders, and unrelated calendar seasonality: revisit only with a declared hypothesis and sufficient coverage, not repeated unrestricted mining.
- Multi-scale OHLC price structure: retain H4 execution zones while adding D1/weekly swing zones for the broader map; measure swing prominence, clean independent reactions, recency/age, penetration depth, consolidation-bound touches, nested-zone merging, freshness/exhaustion, and breakout/retest state. Show whether the registered TP lies before, inside, or beyond higher-timeframe structure. Freeze deterministic definitions first, compare chronologically against each unchanged registered parent, and keep the result descriptive unless a successor survives later data. This is a materially different hypothesis from the rejected nearest-zone and sequential-exit families.
- Calendar metadata/backfill improvements only after confirming a real coverage gap and obtaining any needed bridge-work authorization; use the same MT5 source.
- Non-FMS UI cleanup only for a targeted owner request. External feeds, automatic orders, garbage-tool revival, and unrelated redesigns are outside this plan.

### Deferred goal-mode mission - FMS reliability, controlled discovery, and daily journal

This mission is approved. The first autonomous implementation completed the reliability/UI passes and a bounded controlled-filter campaign; the larger OHLC hypothesis families remain ranked research rather than being falsely labelled exhausted. Preserve the MT5 calendar plus OHLC boundary, gross-result convention, manual execution, immutable historical contracts, and token-efficient validation.

#### Pass 0 - Repair frozen-arrow crashes before expanding FMS

- [ ] Reproduce clicks on blue/purple historical arrows across at least one H1 successor, one H4 parent, one recovered case, and one unavailable/ambiguous case. Static inspection found and repaired the unsafe compact-marker `events` access; the exact runtime matrix belongs to the required owner audit because browser automation is disabled.
- [x] Audit marker-only projections, selected-arrow enrichment, pattern lookup, optional event/path/context fields, stale pair responses, and Past Result assumptions. A compact frozen marker must either open a safe provisional audit or state that detail is loading/unavailable; missing optional fields must never crash React.
- [x] Preserve immediate Entry/SL/TP geometry where immutable marker data exists, reversible same-arrow selection, close-to-clear behavior, and pair-switch cancellation. Add a local error boundary or explicit failed-detail state only if the reproduced failure warrants it.
- [ ] Verify the fix manually at 1440x900 and 100% Chrome zoom without Playwright/CDP: repeated select/deselect, rapid pair changes, blue and purple arrows, missing geometry, and failed bridge detail. Run only Python compilation and the TypeScript gate required by the actual edit.

#### Pass 1 - Establish what has and has not been searched

- [x] Build one deduplicated exhaustion ledger from existing manifests, fingerprints, FMS Knowledge, 28-pair coverage, 111/112 source baselines, the 278-baseline cross campaign, registered recipes, challengers, and rejected families. Count exact event/package, pair, direction treatment, scoring treatment, execution contract, context family, chronological period, and failure reason.
- [x] Distinguish `exhausted exact hypothesis`, `partially searched`, `coverage blocked`, `under-sampled`, `review pending`, and `unsearched`. Never call the combinatorial search space exhausted merely because the current bounded campaigns completed.
- [x] Deduplicate shared economic identities across pairs and identify which of the 28 configured pairs still have no registered recipe. The ledger also inventories 218 currency/family cells from the broker archive: represented, available but unregistered, or broker-series absent.
- [x] Produce a ranked next-search map based on usable independent release count, untouched chronological room, source completeness, economic identity, and computational cost. Do not rank by the best result already seen.

#### Pass 2 - Controlled mining sandbox without corrupting the registry

- [x] Create an explicitly separate `Exploratory mined candidate` lane. A deliberately high-search or overfit candidate may be stored, inspected, and shadow-monitored, but it must not inherit the meaning of `Registered` until one frozen selection survives later chronology and prospective evidence.
- [x] Freeze a search-budget manifest before outcomes: eligible pairs/events, source and candle fingerprints, feature families, maximum configurations, parameter grid, chronological folds, embargo/purge rules, selection objective, deduplication, controls, and one final untouched evaluation boundary. Record every attempt, including failures.
- [x] Permit a broader but finite hypothesis library using existing calendar/OHLC only: asymmetric relative-magnitude thresholds; Actual/Forecast/Previous agreement and conflict shapes; prior same-series surprise reversals; package disagreement; session/release windows; pre-release range, trend, gap and volatility state; directional room; pair-orientation-correct cross-pair confirmation; and deterministic combinations of at most two features. Post-release multi-horizon shape remains an outcome diagnostic because using it to choose an entry would introduce lookahead.
- [x] Research no-trade filters as first-class candidates: event/package exclusions, unreliable forecasts, conflicted components, insufficient directional room, extreme instability, and historically random direction. Compare every filter on the exact matched parent cases so avoiding losses is credited only after accounting for the winners it also removes.
- [x] Keep TP-before-SL as a prominent objective, but never optimize it alone. Require gross average R, median R, expiry behavior, maximum drawdown, losing streak, year/regime breadth, sample size, parameter-neighbour stability, and largest-win contribution beside hit rate. A 90% hit rate with unfavorable payoff can still lose money.
- [x] Use nested chronological selection where data permits: inner development and validation plus the next selection block choose one rule per recipe; only that winner opens the final campaign block. The manifest retains all 15,300 trials, nested-applicability state, survival count, and an explicit correlated-multiple-search warning. The block is untouched within this campaign but honestly labelled reused history globally.
- [x] Compare finalists against always-long, always-short, opposite-direction, parent recipe, and a same-direction seven-calendar-day shifted non-event control under identical execution. Advance only incremental calendar-value information rather than a generic pair drift or volatility effect.
- [x] Shadow-monitor surviving mined candidates prospectively with a conspicuous `Exploratory / high overfit risk` identity. Current-response robustness fields now support exact rule matching; FMS Knowledge keeps first-seen and recovered gross results separate and every candidate out of the actionable registered lane.

#### Pass 3 - Registered-setup evidence and quirk labels

- [x] Give every setup one compact evidence classification derived from frozen thresholds: `High TP frequency`, `Balanced expectancy`, `Rare-winner dependent`, `Expiry dependent`, `Median loss`, `Small sample`, `Unstable by period`, `Long losing streak`, `Context conditional`, `Prospective evidence pending`, or `Avoid standalone direction`. Allow one primary label plus a short quirk count; keep the full reasons in details instead of producing a badge wall.
- [x] Make target quality explicit: TP-before-SL, gross average and median R, later N, break-even hit-rate reference, MFE reach, expiry contribution, largest-win share, drawdown, and represented years. A positive average with negative median must be visible before the user treats it like an ordinary setup.
- [x] Treat `Avoid as standalone direction` as reusable knowledge, not a discarded failure. Test whether an exact entry-known exclusion improves its parent on matched cases and later chronology. Promote only a validated no-trade rule; never blacklist an event merely because its full-history average looked bad after inspection.
- [x] Triage existing challengers and edge cases automatically into `review worthy`, `rejected`, `insufficient sample`, `missing calendar series`, `missing candle coverage`, `ambiguous ordering`, and `artifact mismatch`. FMS Knowledge maps unresolved reason codes to a concrete recovery action rather than asking the owner to interpret research internals.

#### Pass 4 - Redesign Next setup rows and disclosure hierarchy

- [x] Replace the visually dominant frozen-contract sentence with a stable four-part row: `Setup`, `Next release`, `Historical evidence`, and `Trade plan`. Evidence should keep `TP before SL`, `Gross avg R`, and `Later N` together, followed by the primary evidence/quirk label. The compact trade plan should read like `H1 · SL 0.75 ATR · TP 4R · max 6 H4` and remain secondary to evidence.
- [x] Keep pair flags, pair, event family, Jakarta release time, and countdown easy to scan. Do not imply a direction, ATR value, Entry, or trade before Actual values and the complete package exist.
- [x] Reorder expanded details for the user's decision path: historical evidence and quirks first; frozen decision rule second; required package and scoring calculation third; entry/expiry and management fourth; earlier-entry research and identifiers last in collapsed technical provenance.
- [x] Use readable alignment, spacing, emphasis, and explicit `Show details`/`Hide details` controls. Preserve a stable table/grid column contract and internal scrolling at 1440x900; do not solve density by shrinking ordinary text.

#### Pass 5 - Make Current, Recent, and Journal own distinct lifecycle states

- [x] Define `Current` by lifecycle rather than capture provenance: queued, waiting-for-entry, or open hypothetical trades belong in Current whether live-captured or recovered offline. Keep `Recovered offline` visibly attached because it remains counterfactual rather than a trade that actually opened.
- [x] Define `Recent` as closed outcomes outside the frozen historical backtest, ordered by close time. Do not mix still-open recovered cases into Recent and do not silently combine live-captured, recovered, ambiguous, or unavailable outcomes in one performance number.
- [x] Make `Journal` the performance-history surface: a five-market-day current-week strip, previous weeks, month/year/all-time ranges, per-day closed trades, gross R won/lost, wins/losses/expiry/ambiguous/unavailable counts, and drill-down to the exact frozen plan and provenance.
- [x] Provide separate gross totals for true first-seen prospective cases, recovered-offline counterfactuals, and tagged manual executions. An optional clearly labeled research aggregate may compare them, but it must never masquerade as live realized P/L.
- [x] Keep Next/Current/Recent as the fast daily workflow. Journal owns longer performance history so the action panel does not become a reporting dashboard.

#### Pass 6 - Owner contribution and final handoff

- [x] Add a compact `Owner action needed` queue only for work Codex cannot infer: exact crash reproduction if it remains environment-specific; keeping MT5/EA calendar capture running; initiating a declared broker-calendar backfill; confirming broker symbol availability; resolving genuinely missing event identity; and optionally recording manual 0.01-lot executions. Never ask the owner to choose favorable backtest cases or label winners.
- [x] For absent event data, state whether the broker never supplied the series, the EA window missed it, values were incomplete, or candles are missing. Give one concrete acquisition/recovery instruction and preserve the exclusion if recovery is impossible.
- [x] Finish with an exhaustion report, all attempted configuration counts/fingerprints, registrations or explicit non-promotions, promoted no-trade knowledge, unresolved owner actions, targeted verification, and a short 1440x900 manual audit. Keep all displayed performance gross and send no MT5 order.

#### Acceptance criteria

- [ ] No blue/purple frozen arrow can crash Charts; selection, deselection, provisional geometry, detail loading, failure, close, and pair switching have deterministic visible states.
- [ ] The owner can scan setup, release/countdown, TP-before-SL, gross average R, later N, primary quirk, and compact contract without expanding a Next row.
- [ ] Open recovered cases appear in Current with honest provenance; Recent contains closed post-backtest cases; Journal separates prospective, recovered, and manual performance across week and all-time ranges.
- [x] Controlled mining can search more broadly without silently turning the best historical accident into a registered real-money setup. Every trial and final boundary remains auditable.
- [x] Negative research can become an evidence-backed no-trade rule or `Avoid standalone direction` knowledge, while failed or under-sampled filters remain visibly unpromoted.
- [x] The final result identifies what the owner can materially help acquire and what Codex can complete autonomously.

## Completion and manual handoff

### Reliability, research-ledger, and journal implementation - 07 Sep 2026

#### Arrow audit selector and controlled-mining addendum

- [x] Show the actual quirk names in the collapsed Historical evidence column; expanded details now have a dedicated `Quirks` row instead of hiding the meaning behind `1 quirk`.
- [x] Add a `Choose setups` checkbox selector beside Past arrows. It filters every chart arrow by setup for the selected pair, reports each setup's frozen-history count, supports All/None, and clears a selected arrow when its setup is hidden. The separate Past arrows switch still controls whether frozen history joins current/journal markers.
- [x] Expand the controlled library with release window, surprise/momentum shape, package disagreement, prior recipe-direction state, relative magnitude, directional room, pre-release H4 range/trend/gap, and entry ATR regime. Cap the frozen budget at 300 rules per recipe and two features per rule.
- [x] Re-run nested selection and all controls across 15,300 declared configurations. The result retained 34 recipe-level exploratory finalists; 18 remained positive with minimum N in the final reused-history audit. Registrations remain zero.
- [x] Add exact post-registration shadow matching for exploratory rules, with separate first-seen and recovered gross-R ledgers. Increment the durable chart-response schema so old cached responses cannot omit required robustness fields.
- [x] Add fully entry-known D1 and Monday-anchored weekly swing zones beside the existing H4 ladder. Past Result and chart price lines now label H4/D1/W1 explicitly and state whether each opposing zone lies before or beyond the frozen TP.
- [x] Freeze and run the matching multi-scale no-trade challenger: 153 configurations across 51 recipes. No variant cleared the older-development gate, so none entered later review and no registered contract changed; wider zones remain descriptive context.

- [x] Frozen blue/purple markers now open a safe provisional audit while their full package loads; missing `events` and detail-fetch failures have explicit non-crashing states. Runtime coverage remains in the owner audit because browser automation is intentionally disabled.
- [x] The exhaustion ledger records 51 recipes across 10 of 28 markets, exact recipe identities/contracts/fingerprints, shared economic identities, bounded campaign states, 18 markets without a registration, and a ranked next-search map. The result explicitly says the broader space is not exhausted.
- [x] The first controlled no-trade-filter campaign froze its budget, now evaluates 15,300 bounded calendar/OHLC rules across all 51 registered parents, retains every attempt, selected 34 recipe-level exploratory finalists, and found 18 with positive final reused-history uplift and minimum final N. It registered zero setups; all remain `Exploratory / high overfit risk` pending fresh forward evidence.
- [x] Next rows now prioritize TP-before-SL, gross average R, Later N, evidence class/quirks, then the compact trade plan. Expanded details expose median R, expiry dependence, largest-win share, drawdown, and losing streak before provenance.
- [x] Open recovered cases belong to Current with counterfactual provenance; Recent excludes open/waiting cases; Journal uses close-time lifecycle, five Jakarta market days, week/month/year/all-time scopes, and separate prospective, recovered, and tagged-manual ledgers. All model performance remains gross.
- [x] FMS Knowledge exposes the exhaustion result, next-search order, controlled-mining disclosure/candidates, measurable no-trade principle, and the limited owner-action queue.
- [x] Targeted validation passed: repository TypeScript gate, Python compilation for the research scripts and bridge server, artifact invariants, and diff whitespace validation.
- [ ] Owner visual/runtime audit remains: use the checklist below at 1440x900 and 100% Chrome zoom.


### Charts pair-switch and arrow-selection repair - 07 Sep 2026

- [x] Make arrow selection reversible from the chart: clicking the selected arrow again clears it, while the Past Result close control retains the same behavior.
- [x] Clear selected-arrow state on every pair change and reject a stale previous-pair FMS response during the transition.
- [x] Render immutable historical Entry/SL/TP geometry immediately from the cached marker projection; enrich Past Result with the full path/structure audit asynchronously instead of withholding the dock and price lines.
- [x] Version and prewarm geometry-bearing historical marker caches for every registered market. Repeated marker reads measured about 0.25-0.30 seconds for the largest sampled caches.
- [x] Restrict a selected-arrow reconstruction to its exact registered pattern and reuse its one annotated outcome stream. An uncached EURUSD arrow audit measured about 0.55 seconds instead of the prior 18-59 second full-market reconstruction; a cached repeat remains effectively immediate.
- [x] Python compilation, repository TypeScript typecheck, and diff whitespace validation passed. Browser automation was not run; use the owner audit below.

### Charts FMS loading pass — 07 Sep 2026

- [x] Keep a durable last-known current response per registered market so calendar-ingest revisions no longer force a multi-second research rebuild during ordinary pair switches.
- [x] Keep a durable last-known global registry response so opening FMS does not synchronously rebuild all ten registered markets.
- [x] Delay the first lifecycle refresh until the existing refresh interval. Fresh computation now runs as an explicit background refresh and replaces the durable snapshots when complete.
- [x] Bound a selected historical-arrow reconstruction to its one immutable event and cache the completed target ladder by model hash, market, recipe, and release time.
- [x] Preserve current/recent/next semantics, immutable historical contracts, and live-refresh behavior. No scoring, registration, execution, or trade result changed.
- [x] Targeted gates: Python compile and repo TypeScript typecheck passed. Local endpoint measurements reduced ordinary current-pair retrieval from 9–21 seconds to roughly 0.2–0.6 seconds and ordinary global retrieval from 32–50 seconds to roughly 1.2–1.9 seconds. A repeated historical-arrow audit now returns in roughly 0.13 seconds after its first immutable reconstruction; the first uncached reconstruction remains bounded but can still take several seconds.

### Selected-arrow focus and support/resistance execution pass — 07 Sep 2026

- [x] When a chart arrow is selected, render only that FMS arrow until the Past Result close button clears the selection. Preserve the complete signal collection, historical-match count, audit, and Entry/SL/TP/context geometry.
- [x] Freeze an entry-known support/resistance execution family before inspecting results: nearest confirmed directional H4 pivot barrier, 120 completed H4 bars, two-bar pivot confirmation, 0.25 ATR clustering, at least two touches, target 0.10 ATR before the barrier, and a 0.50 ATR minimum target distance.
- [x] Compare three bounded variants across all 51 registered recipes: retain the active stop, tighten to equal risk/reward, or tighten for 2:1 reward/risk. Preserve the active target when no qualifying nearer barrier exists and preserve each recipe's management and expiry.
- [x] Select only on older development chronology with N >= 20, positive average R, and at least +0.05R uplift; judge the frozen selection on later chronology with N >= 10, positive average R, and at least +0.05R uplift.
- [x] Retain the negative result. Five recipes qualified for later evaluation, but none preserved the required uplift. EURUSD US manufacturing employment selected the 2:1 variant on development (+0.079R uplift), then weakened across 42 later cases to +0.027R average and -0.068R versus its registered contract. No TP/SL contract or historical arrow was changed.
- [x] Store the complete reproducible result in `Main/mt5-bridge/support_resistance_execution_research.json` and expose the exhausted family in FMS Knowledge so it is not repeated as if untested.

A research pass is complete when its manifest and results are durable, all declared trials are accounted for, selection/evaluation provenance is honest, and supported findings have a concrete review or registration outcome. Discovering no upgrade is a valid result; do not force a winner to claim completion.

An implementation pass is complete when the authorized changes work with appropriate targeted verification, historical contracts remain reproducible, and the owner receives a concise self-contained result. Do not label unperformed browser checks as passed.

For a visible FMS change, tailor this manual checklist to the changed behavior and explicitly ask the owner to perform it:

- [ ] At 1440x900, Chrome 100% zoom, open Charts → FMS; switch Next/Current/Recent and expand rows. Check ordinary text, timestamps, controls, internal scrolling, and no overlap or whole-page overflow.
- [ ] Inspect one affected setup/arrow: triggering values, recipe/version, entry time, ATR definition/value, Entry/SL/TP, management, and expiry agree across its row and chart details.
- [ ] Inspect one pending/no-trade/recovered case relevant to the change: status and provenance are clear and unavailable prices are not invented.
- [ ] Switch pair/timeframe and reopen the panel: content stays responsive and no previous pair's late response replaces the current selection.

For documentation-only changes, no app audit, build, or test run is required.

## Approved next mission — Invisible forward proof and continued discovery

Keep the owner's workflow limited to Charts → Next / Current / Recent. Collection, replay, maturity classification, degradation review, and research remain automatic background work. Historical registrations remain immutable; all model results remain gross; Fyodor sends no order.

- [x] Extend the existing immutable first-seen ledger instead of creating a duplicate tracker. Per setup, retain resolved N, TP-before-SL, gross average and median R, drawdown, longest losing streak, largest-win share, chronological-half averages, quote coverage, and elapsed time.
- [x] Freeze readable maturity states before future outcomes accumulate: `Awaiting fresh evidence`, `Early observation`, `Promising, unproven`, `Weakening`, `Pause candidate`, and `Prospectively supported`. A pause state warns the owner but never rewrites or silently deletes the registered contract.
- [x] Put one compact Fresh status in Next and the fuller fresh record inside expanded Next/Current details. Keep research controls out of the daily path.
- [x] Add an all-market first-seen portfolio replay that keeps overlaps, reports combined gross R/drawdown/losing streak, maximum concurrency, and same-direction currency concentration. Improve the Current warning so a shared currency only warns when both open positions lean the same way.
- [x] In expanded Current details, default the owner's intended manual pilot to a 0.01-lot exposure readout. When MT5 is connected, use broker `order_calc_profit` to show the account-currency loss at the frozen SL; otherwise show 0.01 lot and stop pips without inventing conversion values.
- [x] Build the next frozen discovery campaign from the 57 broker-available but unregistered currency/family cells and 18 markets without registrations. The first new lane used exact multi-factor co-releases, excluded every market/package identity from the 278 Stage-A baselines, and required at least 36 occurrences before spending trials.
- [x] Run the ranked co-release campaign reproducibly. It tested 9,600 frozen direction/reaction/execution configurations across 20 new exact packages and all 18 unregistered markets. None produced a development-qualified contract, so there was no later finalist and no registration. Result hash `366ba8033a1680ce9ff18cb38db569bedf0a42604260d6d358d7198fd7e841e2`; the negative family is retained in FMS Knowledge and the exhaustion ledger.
- [ ] Owner visual audit at 1440x900 and 100% Chrome zoom: Fresh status remains secondary to historical evidence; expanded metrics wrap cleanly; Current concentration/pause warnings are readable; Journal's portfolio disclosure does not crowd the daily workflow.

### Charts-open crash / saturation repair — 07 Sep 2026

- [x] Reproduce the backend saturation: while Charts was open, the UI forced `/research/chart-signals/global?refresh=true` every 30 seconds. That bypassed every durable market cache, repeatedly rebuilt all registered markets, occupied a full CPU core, and raised the bridge worker to roughly 800 MB.
- [x] Remove the global forced-refresh interval. Refresh only the selected pair, and only when its loaded calendar revision actually changes after initial hydration. Merge that fresh pair into the existing global snapshot so Next/Current/Recent keep the same workflow without repeatedly rebuilding unrelated markets.
- [x] TypeScript validation passes. A full app/process restart is required to remove the old interval from an already-loaded browser bundle and release the saturated bridge worker.
- [x] Second crash hardening: compact global/current signals may omit `events`; Knowledge exploratory matching and the legacy Setups audit no longer call `.map`, `.some`, or `.filter` on a missing array.
- [x] Add an FMS-dock error boundary keyed by panel and market. A malformed optional FMS payload can no longer unmount the entire Charts surface; the dock reports the exact render error while the chart stays usable.
