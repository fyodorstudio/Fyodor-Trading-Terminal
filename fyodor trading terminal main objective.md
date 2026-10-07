# Fyodor Trading Terminal — main objective

## Mission

Interpret the numerical economic news in the stored dataset faithfully and reproducibly, so the user can read a release or a relationship between releases without manually reconstructing the numbers. The app does not need to explain every price movement or predict a trade outcome. Historical price disagreement is a reason to inspect the interpretation, not an optimization target.

Readings are facts within their source and vintage limitations. Direction, weights, thresholds, retention, and economic relationships are declared interpretation rules. Correct arithmetic alone does not prove those rules are economically valid. Every directional result must state what evidence it interprets, the comparison it uses, and the uncertainty that remains.

## Responsibilities

| Surface | Responsibility | Meaning of its output |
| --- | --- | --- |
| Standalone Inspector | Interpret this family's release using valid periods, units, revisions, and calibrated comparisons. | What this release says under its documented rules. |
| Roofs | Expose a named relationship between particular releases: reinforcement, contradiction, qualification, or fresh change. | What these inputs say together, available only at their activation clock. |
| Raycaster | Interpret accumulated available evidence as of the selected clock, with the selected currency scope. | Current numerical context, distinct from the latest improvement/deterioration. |
| Candy | Visualize Raycaster's same interpretation over time. | No separate model or additional vote. |
| Outside events | Preserve manual notes about context outside the numerical dataset. | Gray annotations, no inferred numerical contribution or confirmed causality. |

A valid standalone reading is not overwritten to agree with a combo or with price. A stronger new release can improve a still-weak context. A Roof about change can disagree with Candy about the accumulated level. Evidence strength describes support within declared rules; it is not a calibrated market probability.

## Scope and guardrails

- Audit all existing USD numerical families (CPI, NFP, Claims, ISM, Retail, PCE, PPI, GDP, Fed decisions), EUR numerical families (aggregate/country inflation and PMI, labor, wages, GDP, ECB decisions), and the existing relationship/aggregation paths.
- Use stored numerical observations only for calculations. Official methodological sources may clarify definitions; they must not become new live inputs. No speeches, forecasts unavailable in the dataset, geopolitical feeds, price-derived weights, or hindsight-specific exceptions.
- Preserve nominal budgets and disclose overlaps. Missing weights do not become invented measurements or automatically expand another family's vote.
- Distinguish measured zero, conflicting evidence, sparse evidence, unavailable data, and invalid data. A policy threshold must not be presented as a mathematical theorem.
- Preserve as-of publication chronology, reference-period continuity, unique observation checks, units, revision provenance, aggregate/proxy replacement, and one latest contribution per family.
- Keep heavy calculations in existing background jobs. No broad chart/UI refactor. Panning and pointer movement must not rescore history.
- Preserve existing changes and documentation moves. No commit, deployment, dataset rewrite, or new outside-data integration in this pass.
- Terminal tests, lint, and builds verify implementation. The user performs visual UI audits; no browser automation or screenshot inspection.

## Grand plan and tranches

Each tranche ends with recorded findings, decisions, changed files, and actual validation evidence. A checkbox is ticked only when that tranche's acceptance criteria are satisfied. Discovery may expand repair details inside these responsibilities, but must not replace this mission with price prediction or mere abstention.

- [x] **T1 — Inventory and interpretation contracts.** Inspect the authoritative code for every current family, relationship, and combined output; document formulas, baseline, overlap, version, as-of rules, and existing limitations. Identify reproducible defects rather than assume earlier work is correct.
- [x] **T2 — Standalone integrity.** Repair confirmed problems in reference periods, revisions, finite values/units, missing versus zero, cancellation, and calibration cutoffs. Add meaningful economic fixtures and cross-family invariants. Record families reviewed without a required numerical change.
- [x] **T3 — Combined context semantics.** Review coverage/primary vetoes, cancellation, currency-leg normalization, retention, conditional labor policies, and selected budgets. Implement a defensible distinction between available-evidence interpretation and incomplete whole-context certainty. Preserve missing weights and transparent uncertainty; never manufacture a direction to match price.
- [x] **T4 — Relationship integrity.** Audit every existing Roof type and participant clock. Ensure latest-only inputs, economic changes versus aging/renewal, domain overlap, mixed output, and activation are consistent. Document named relationships and repair demonstrated defects.
- [x] **T5 — Presentation consistency.** Ensure Inspector, Roof details, Raycaster, Candy, Fed/ECB context, and Notebook snapshots use the same underlying meanings and quality states. Keep outputs first, scope/limitations accessible, current versions traceable, advanced calculations optional.
- [x] **T6 — Historical and invariant verification.** Replay stored history without price fitting; test future-removal, duplicate/invalid/missing observations, simultaneous publications, zero/cancellation, proxy overlap, and selected inputs. Run all relevant regression suites, lint, build, and diff checks. Record unresolved limitations separately from defects.
- [x] **T7 — Completion audit and user handoff.** Verify each requirement against current files and command evidence. Finish the implementation report and a focused manual audit checklist. Mark the goal complete only when all required work is verified, with uncertain methodology explicitly documented.

## Completion criteria

Every existing scorer and combo has an auditable contract; confirmed defects are repaired with meaningful regression coverage; combined outputs communicate available support and uncertainty honestly; all presentation surfaces agree on semantics; source selection never introduces future information or duplicate votes; the full applicable tests, lint, and build pass. Deliver reviewable changes, this completed checklist, and a user-facing audit list. Unexplained price movements and out-of-dataset causes are not unfinished implementation requirements.

## Evidence log

### Start — 7 October 2026

- Active goal inspected: the user's request is to elaborate this mission, plan tranches, implement sequentially, and document progress here.
- Root objective file was empty. No on-disk AGENTS.md found at root; the user's supplied instruction assigns visual audits to the user.
- Worktree already contains the previous v7/v2 context and NFP v2.1 pass, plus documentation moved to `docs`. Those changes are preserved.
- Current combined quality uses 60% usable-budget and one-third agreement thresholds, plus an enabled CPI/NFP veto. These are prototype policy choices requiring semantic review, not automatically correct because tests encode them.
- No goal-budget limit specified. Work proceeds toward the completion criteria and may span continuation turns.

## User audit after completion

Pending: precise manual checks will be filled from the final implementation. Price alignment remains an observation independent of interpretation integrity.

## T1 — Current interpretation contracts and audit findings

Code inspected directly on 7 October 2026. These are the starting contracts; later tranches record any change explicitly. The version registry identifies CPI v4 (release engine v3.1), NFP v2.1, Claims v2, ISM v3, Fed v2, other USD scorers v1, and EUR scorers/ECB v1. The scoring README's introductory NFP v2 label is stale and must be corrected in T5.

### Standalone family contracts

USD positive signed magnitude supports USD / EURUSD Short; EUR positive supports EUR / EURUSD Long. Native derived features are rounded and calibrated per signal on earlier usable features. The shared minimum is 24 earlier samples, automatic nearest-rank absolute quantiles at one third, two thirds and 90%, or validated manual magnitude limits. Magnitudes are ordinal 0–4 policy points, not comparable physical units, estimated elasticities or probabilities. Missing components retain their allocated weight; no rescaling to 100%. Supporting tables do not add votes.

| Family | Formula / budget | Admission and limitation |
| --- | --- | --- |
| CPI | Latest core m/m minus prior 3-month mean 35%; overlapping 3-month mean change 35%; annual core Actual minus supplied Previous 20%; headline m/m minus prior 3-month mean 10%. | At least one calibrated core component. Monthly windows require consecutive reference months. Fresh and trend are algebraically dependent views of core inflation, grouped together for evidence. Annual supplier-baseline provenance and precision require review. No Fed target inferred from CPI. |
| NFP | Payroll change minus max(0, prior 3-month mean) 40%; inverse unemployment monthly change 30%; wage m/m minus prior 3-month mean 15%; preceding-month payroll revision 10%; hours monthly change 5%. | Hiring or unemployment required. Verified consecutive references; nearest supplied revision replaces an already-existing prior observation. Falling participation halves a positive unemployment vote without reallocating it. Broader labor/composition figures do not vote. Raw-only invalid revision detection is inconsistent and requires repair. |
| Claims | Prior reported 4-week initial average minus latest average 45%; prior 4-week continuing mean minus latest 4-week mean 40%; prior 4-week initial mean minus latest week 15%. | Exact consecutive weekly references; continuing is one week behind initial where both exist. Millions convert to thousands. Non-overlapping trend windows. Levels and revision notices are non-voting. Weekly report replacement does not stack old votes. |
| ISM | Services 70%, Manufacturing 30%. Services orders/activity/employment/prices = 35/25/25/15; Manufacturing orders/employment/prices = 50/35/15. Each index minus max(50, prior 3-month mean). | Same reference month, original components counted once. Composite is non-voting. Pending/missing sector budget stays missing. Official 2026 availability/calendar guard and weekend check; other years are not extrapolated. Demand/employment conflict caps grade. |
| Retail | Control group 60%, ex-autos/gas 25%, headline 15%; each actual m/m minus max(0, prior 3-month mean). | Underlying control or ex-autos/gas required. Consecutive history and nearest supplied revision. Nominal spending and nested components, not real GDP shares or independent statistical confirmations. |
| PCE | Core m/m pace 45%, core annual change 30%, headline m/m pace 15%, headline annual change 10%. Monthly = Actual minus prior 3-month mean; annual = Actual minus supplied Revised Previous/Previous. | Core required. Monthly comparison history consecutive; invalid revisions unavailable. The annual headline 2% target comparison is context only. Annual baseline provenance is not independently certified by the feed. |
| PPI | Core monthly pace 50%, core annual change 30%, headline monthly pace 15%, headline annual change 5%; monthly/annual baselines as PCE. | Core required. Producer inflation is a separate upstream-price interpretation, not a direct measured CPI forecast. |
| US GDP | Real GDP 50%, real consumption 30%, real final sales 20%. New quarter versus max(0, prior 4-quarter mean); revision versus earlier same-quarter estimate. | GDP required. Separate new-quarter and revision calibration populations. No fallback to another quarter for revisions. Consumption/output overlap is acknowledged; prices/inventories and other stored supporting figures do not vote. |
| Fed | Stored target-rate action: Actual minus Revised Previous/Previous in basis points. | Hold supplies no standalone direction. Numerical action and accumulated economic-context reading stay separate. Speeches/guidance unavailable. A meeting adds no macro vote or renewal. |
| Euro-area inflation | Annual core change 50%, overlapping 3-period core trend 35%, annual headline change 15%. | Consecutive distinct months; flash/final for same period replace rather than add calibration samples. Annual-inflation group counts once. Supplied Previous does not substitute for a distinct prior period. |
| German inflation | Annual HICP change 60%, HICP trend 25%, CPI change 15%. | Same distinct-period rules, one annual-inflation group. Country proxy, not another euro-area aggregate vote. |
| Euro-area / German / French PMI | Composite 100%; if unavailable, Services then Manufacturing is the single selected reading. Below 50 = Actual minus 50; otherwise Actual minus max(50, prior 3-month mean). | Distinct monthly references and 0–100 diffusion indexes. Composite and sectors never sum. Fallback admission is based on feature availability; calibration behavior needs counterexample review. |
| Euro-area labor | Combined unemployment/employment/annual employment 60/30/10; monthly-only unemployment 100%; quarterly employment/annual 75/25. Inverse unemployment change; employment growth-rate changes versus distinct prior periods. | Monthly unemployment and quarterly employment retain separate context memories. Same-period revisions are not a preceding-quarter comparator. |
| Euro-area wages | Annual wage-cost change 70%, total labor-cost change 30%. | Distinct consecutive quarterly references; related cost measures share a group. |
| Euro-area GDP | Quarterly growth-rate change 80%, annual growth-rate change 20%. | Prior distinct quarter, rather than earlier same-quarter estimate. This differs deliberately from the US GDP revision interpretation and must remain disclosed. |
| ECB | Deposit-facility rate anchors direction; available other rate actions must agree. | Hold has no action direction. Missing ancillary rates are disclosed rather than treated as extra confirmations. Macro context stays separate. |

### Raycaster, Candy and Roof contracts

- USD nominal budget: inflation 40% (CPI 28, PCE 10, PPI 2); labor 40% (NFP 30, Claims 10); activity 20% (ISM 10, Retail 7, GDP 3). Optional labor policy transfers remain within their stated budgets. Selected inputs reduce the configured coverage denominator, not expand their numerical weights.
- USD starts with each family's signed weighted score, currently multiplies it by both retention and component coverage. Because partial standalone totals already retain missing component weights, this may attenuate missing components twice; T3 must resolve the intended meaning with arithmetic fixtures.
- USD half-lives: Claims 7, GDP 90, other families 30 broker days. Hard expiry: Claims 14 elapsed days, GDP 120, others 45. Latest unavailable publications replace rather than silently resurrect older valid evidence. Same-time updates are atomic; daily memory stages are precomputed.
- Relative mode compares normalized EUR pressure minus USD pressure; EUR slots inflation 40%, unemployment 20%, employment 10%, wages 10%, PMI 15%, GDP 5%. Aggregate replaces same-period country proxies; German inflation max share 40% of inflation; German/French PMI 60/40 of PMI. No missing leg assumed zero.
- Current combined decision: 60% usable configured coverage, one-third net/gross agreement, and USD primary CPI/NFP veto. Zero/cancellation is Mixed. Sparse context is Insufficient. T3 will review primary veto, coverage attenuation, finite-value handling and qualified available-evidence semantics. Age is not component completeness.
- **Labor + inflation priority Roof:** complete Strong deteriorating NFP opposing complete CPI, subject to numerical inflation escalation guards and optional PCE/PPI escalation check. Transfer 20 points CPI → NFP. Guards are prototypes, not official Fed reaction coefficients. Sources explain the existing accumulated interpretation.
- **Claims challenge older NFP Roof:** aging (14+ days) Weak/incomplete NFP plus three opposing complete trend-confirmed Claims releases 4–10 days apart, at least 80% coverage, latest Moderate/Strong. Transfer 10 points NFP → latest Claims; earlier Claims are confirmation only.
- **ISM sectors Roof:** both sector publications known for the month, original component budget resolves one family result. Its standalone ISM direction is independent of the whole-context gate.
- **Fresh-news Roof:** latest comparable change per family inside seven days; matching component IDs/weights and assessment stage, equal coverage >=60%, active predecessor. Economic change currently includes coverage again; renewal/coverage/availability separated. At least two economic domains agree; exact cancellation has no directional roof. Magnitude-point changes can include recalibration effects because boundaries can change; T4 must review this provenance rather than claim every score change is a measured economic delta.
- Roof activation is the known-by clock, not the left edge or an inferred holding period. All participants must be available then. Roofs stay USD-only even when Candy shows EUR vs USD. Candy visualizes the same Raycaster result; no hidden alternate calculation.

### Primary sources checked for methodological grounding

- [Federal Reserve dual mandate and PCE target](https://www.federalreserve.gov/faqs/what-economic-goals-does-federal-reserve-seek-to-achieve-through-monetary-policy.htm): labor and price stability motivate the policy-pressure framework; this does not validate app weights, thresholds, or a currency direction.
- [BLS July 2025 Employment Situation](https://www.bls.gov/news.release/archives/empsit_08012025.htm): household/establishment surveys differ and prior payroll estimates are revised. The broker's one prior field is not the full official two-month revision.
- [S&P Global PMI methodology FAQ](https://www.spglobal.com/market-intelligence/en/solutions/products/resources/pmi-faq): diffusion-index 50 is the unchanged threshold. The app's recent-mean floors and fallback priorities are its own rules, not the official survey calculation.

No web fact enters historical scoring or repairs stored observations. These sources support definitions only. Price is not part of the numerical acceptance tests.

## T2 — Standalone integrity implementation

- Baseline: all 50 pre-existing frontend suites passed before edits. This establishes existing behavior, not mathematical correctness by itself.
- Added `frontend/tests/inspector/test_interpretation_integrity.mjs`; before repair it failed with a stale unemployment delta of +0.2 despite a populated invalid raw revision. After repair it passes.
- NFP now recognizes a supplied revision in either numeric or raw field. Invalid supplied revisions block that comparison; a valid revised-only baseline is accepted when the unique preceding reference month is independently established. A supplied revision still cannot fill a missing month.
- CPI now uses the shared safe native-number path for actual and annual-baseline readings. Unsafe raw rates cannot pass merely because their BigInt difference happens to be small. Its declared treatment of Revised Previous remains unchanged.
- Shared derived features reject non-finite arithmetic; NaN no longer silently rounds to zero. Non-finite historical samples cannot satisfy the 24-observation minimum or produce Extreme magnitude.
- EUR PMI fallback now selects the first **calibrated** Composite / Services / Manufacturing reading. A present but uncalibrated composite no longer hides a usable Services result. Exactly one PMI reading votes, preserving overlap control.
- Reviewed Claims, Retail, PCE, PPI, GDP, ISM, Fed, ECB, EUR inflation/labor/wages/GDP. Existing reference, domain, revision, overlap, action/hold and cutoff rules are retained; no economically justified wholesale formula or weight replacement was found. Annual supplied baselines do not certify their original historical vintage. Published standalone tie priorities remain explicit Weak model choices, distinct from combined Mixed.
- Validation passed: new integrity suite; existing NFP, CPI, EUR, PCE, ISM v3, Retail, Claims, expanded GDP/PPI/Fed, and scorer/Scatter parity suites. New suite registered in the serial runner. Full final regression and public version/document updates remain T5/T6 tasks.

### T3 arithmetic decision to implement

Partial standalone totals already use their original component weights. Multiplying those totals by coverage again squares the missing-data penalty. Replace this with source total × nominal family weight × age retention. Keep usable coverage as a separate completeness measure and quality qualification. Apply the same rule to normalized EUR slots; do not normalize missing components back to a full vote.

The combined conclusion describes **available evidence**, not a claim that missing families agree. Keep the disclosed 60% configured-budget and one-third agreement policy thresholds for continuity; remove the independent CPI/NFP veto when overall usable coverage passes. Direction with incomplete coverage must be qualified, at most Weak, and name missing/incomplete sources. Below the aggregate coverage threshold remains Insufficient; cancellation/narrow agreement remains Mixed. These thresholds are not fitted to price and remain documented prototype choices.

## T3 — Combined semantics implementation and evidence

- USD and EUR votes retain missing component weights **once**. The USD formula is source total × assigned family weight × age retention; the EUR formula is slot score / 4 × assigned slot/proxy weight × retention. Neither multiplies component coverage again.
- Worked arithmetic test: one CPI annual signal at +3 points and 20% standalone weight contributes `3 × .20 × .28 = .168` to USD, rather than `.0336`. For all families with 80% of components measured at +4, combined pressure is 3.2 rather than 2.56. No missing vote is normalized upward.
- Removed the individual CPI/NFP completeness veto. Overall coverage below 60% still withholds direction; a direction above that threshold with incomplete coverage is Weak and explicitly names incomplete/missing/expired inputs. The relative calculation independently assesses pair agreement and each leg's aggregate usable coverage.
- Zero is available information; missing is not zero. Invalid totals, gross sums or coverage cannot acquire a direction. Future source clocks cannot vote through direct core calls. Duplicate enabled family IDs do not expand coverage denominators.
- Retention and component usability remain separate. UI calculations now show retained assigned weight and retained usable budget distinctly, with the exact new formula and qualifiers. Candy/Raycaster continue sharing the same result.
- Validation passed: `test_context_arithmetic.mjs` (new, registered), quality, memory/weekly-priority, EUR/proxy, and USD timeline suites. Complete source/sector budgets retain their previous arithmetic. No numeric weight, half-life, expiry, policy-transfer guard or price-fitting change was made.

### T4 provenance decision to implement

Fresh roofs currently subtract ordinal scores calibrated at different release dates. Automatic limits can move while a derived economic feature stays unchanged, so a score-only change is not necessarily new economic information. Carry compact component/limit provenance in background assessments; compare both releases under the latest available calibration, separate the calibration effect, and never let calibration drift, age renewal, changed membership or newly available components create a fresh directional vote. Labels should say **change in interpreted support**, not imply an exact native-unit economic delta.

## T4 — Relationship integrity implementation

- Assessments now carry compact derived component values, weights and calibration
  limits. Common-calibration comparison regrades the preceding features using
  limits known at the latest release; historical snapshots are not rewritten.
- Fresh change excludes calibration drift, memory renewal, altered availability,
  changed comparison stage or membership, and unknown calibration provenance.
  The four disclosed parts sum to replacement at the constant base family weight.
- Magnitude calibration moving from +2 to +3 on an unchanged feature creates zero
  support-change vote. A counterexample where the raw score rises but the native
  feature falls produces the correct opposite common-calibration comparison.
- Shared labor relationships retain their disclosed guard thresholds and budgets.
  Zero/cancelling NFP no longer supplies a false opposing priority via its
  standalone tie-break direction. Confirmation-only weekly reports never stack.
- Passed new common-calibration fixtures and sequence/policy core tests. Mounted
  presentation tests are being rerun after intentional wording/version updates.

## T5 — Presentation and documentation consistency

- Current versions: USD context v8, relative EURUSD v3, relationship derivation v3,
  CPI Inspector v4.1 / standalone v3.2, NFP v2.2, EUR numerical v1.1.
  Other family versions remain; saved magnitude and input preferences are retained.
- Context tables and CPI publication explanations use exactly the core arithmetic,
  showing coverage separately. Zero votes cannot be described as opposition;
  an update from Mixed to directional no longer claims the bias remained unchanged.
- Roof summaries/settings distinguish common-calibration interpreted-support
  change from native economic growth, standalone direction and accumulated context.
- Updated subsystem documentation, scoring library, trading workflow and manual
  audit checklist. Archived version sections/reports remain clearly historical.
  User documentation moves to `docs/` are preserved.

## T6 — Verification underway

The live storage service was unavailable. The read-only CalendarStore constructor
and normal chart-query rules provided a single SQLite snapshot without starting
services, migrating tables or changing observations. Revision 78619 contains
76,971 queried rows (41,559 USD / 35,412 EUR) through the capture clock on 7 October
2026. Future/missing/absent observations are still filtered by canonical scorers.
The frozen settings are explicit automatic settings, not an assertion that browser
local manual preferences were read. Manual-calibration invariance is checked with
an isolated override, alongside existing all-signal calibration parity fixtures.

Replay checks component-to-family arithmetic, aggregate/proxy budgets, zero/missing
semantics, Roof clocks, four-part replacement decomposition, both Candy modes,
future-removal replay, forecast independence, and outliers relative to their actual
calibrated Extreme boundary. No price is loaded and no outlier is removed just
because its output disagrees with price.

### T6 historical result

The replay passed: 5,696 USD and 8,299 EUR snapshots; 15,484 Candy/core parity
checks; 15,491 exact four-part replacement decompositions; nine future-removal
assertions at three separated cutoffs; full USD forecast-field independence;
140 unchanged CPI feature sets under a manual override (84 scores changed).
Existing Roof annotations: 113 ISM sectors, 11 labor/inflation, 30 weekly labor,
557 fresh-news. Counts overlap and are not statistical performance evidence.

The largest fifteen feature-to-Extreme-boundary ratios occur in 2020 labor
releases. April 16 stored Claims levels match the official DOL release scale;
May 8 stored payroll loss matches the BLS release scale. Their valid extreme
features retain bounded 0–4 points; no outlier deletion or price-based tuning.
Sources and caveats are recorded in `reports/Interpretation-integrity-v8-audit.md`.
Current stored-vintage uncertainty remains explicit, including BLS archived reissues.

All 53 registered suites passed across sequential regression/resumption runs.
Final uninterrupted `pnpm --dir frontend test`: all 53 suites passed. Production
`pnpm --dir frontend build`: TypeScript and Vite passed (364 modules). Version-label
assertions were updated to the deliberate public revision numbers. No visual UI
inspection was performed. `pnpm --dir frontend lint` is clean; tracked diff checks
report no whitespace errors (Git emits its normal Windows line-ending notices).

## T7 — Completion audit and handoff

All seven implementation tranches are complete. Authoritative family contracts,
source admission and declared policies were inspected; confirmed defects have
regression fixtures; every current context/relationship meaning and public
version is documented. The full uninterrupted 53-suite run, production build,
lint and tracked whitespace checks pass. Historical integrity replay and
methodological spot checks are recorded in the reviewed report.

- Implementation/evidence report: `reports/Interpretation-integrity-v8-audit.md`.
- Current user guidance: `docs/trading workflow.md`.
- Visual audit checklist: top section of `docs/manual edit.md`.
- Current revisions and retired behavior: `docs/scoring system library.MD`.
- Reproduction tools: `frontend/scripts/usd-context/capture-integrity-input.py`
  and `audit-interpretation-integrity.mjs`; frozen local input/result/log files
  are ignored under `storage/data/context-v8-*`.

Begin the user audit with equal publication clocks and mode/input settings.
Check standalone versus relationship versus accumulated context separately,
then record price agreement/disagreement as a separate observation. An opposing
price move is not by itself a failed numerical acceptance test. Inspect ambiguous
or qualified output before inferring that missing observations agree.

Remaining limitations: original stored vintages are not fully reconstructible;
forecast surprises/text guidance are outside these numerical formulas; economic
budgets, comparison floors, evidence thresholds, memory and relationship guards
remain declared prototypes rather than estimated causal FX coefficients.
Manual UI and broader economic-policy validation remain user audit/research,
not silently certified by the passing arithmetic tests.

No services were started, observations/preferences overwritten, changes committed,
or UI/browser automation performed. Existing uncommitted work and user document
moves are preserved. The reviewable pass is ready for manual audit.

# Authorized USD Roof expansion — 7 October 2026

Raycaster/Candy conflict-label changes are explicitly deferred. This pass expands
Roofs only; their accumulated-context votes, direction gates and colors stay intact.

- [x] R1: Register all 28 macro pairs and eight Fed/macro pairs. Explain unavailable
  relationships as well as eligible ones. Compose every larger selected subset
  on demand with the same budgets rather than generating hundreds of fake votes.
- [x] R2: Repair ISM fresh comparisons per sector against its own preceding
  comparable publication. Retain 70/30 sector budget, original clocks, common
  calibration, explicit availability residual and seven-day expiry.
- [x] R3: Resolve Roof support into Aligned, Conflicted · Long/Short leads,
  Balanced conflict and Insufficient evidence; show numerical support split,
  leading contributors and narrow-lead qualification. Preserve net-zero honesty.
- [x] R4: Add publication-time relationship Roofs and an inspectable complete
  catalogue with release/fresh modes and multi-family selection. Use shared
  snapshots and bounded chart display; do not create all subsets on every frame.
- [x] R5: Add Fed action/context relationships without inventing a Fed magnitude
  budget or converting basis points into comparable macro points. Hold is no
  rate-action direction; macro evidence remains explicit and separate.
- [x] R6: Verify registry completeness, all subset compositions, source/clock and
  budget invariants, ISM September audit, conflict/zero/missing cases, UI headless
  interaction, full regressions/build/lint; document manual visual audit.

A catalogue entry is a declared interpretation relationship, not a discovered
causal coefficient. Same-domain readings retain existing domain budgets. Pair
and subset inspection never adds a second vote to Raycaster. Only known sources
can contribute. A source at zero is available unchanged evidence, not missing.

Evidence: `reports/Roof-v4-expansion-audit.md` and selected frozen replay JSON.
All 54 suites passed; final affected suites, build and lint passed. All 502 USD
groups compose without new votes. The Sep 3 Claims clock now exposes ISM +
Claims, with later Services kept separate. Pure cached projection remains
bounded (100 pans / nine ms in the synthetic benchmark); visual performance
and UI readability are explicitly left to the user's checklist. Raycaster/Candy
conflict labels remain a separate deferred pass. No commit or preference/data
mutation was performed.
