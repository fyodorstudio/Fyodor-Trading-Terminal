# Scoring system overhaul

Discussion and design record, updated 2026-10-10. USD R1 is implemented and terminal-verified on `codex/usd-scoring-r1`; baseline `93a6ecd`. Earlier deferred-implementation statements describe their historical phase. Visual review remains manual.

Current recommendation: [USD evidence design R1](#usd-evidence-design-r1), with the accepted [Claims fractional refinement](#accepted-claims-fractional-refinement--r11) and [Manufacturing New Orders refinement](#accepted-manufacturing-new-orders-refinement--r11). Earlier sections preserve the discussion and agreed CPI baseline. Numerical choices are design policies, not source-estimated USD coefficients.

Design and targeted evaluation are complete. Start with [R1 formulas and relationships](#usd-evidence-design-r1), then [worked examples and sensitivity findings](#r1-evaluation-and-worked-examples). CPI V5 and the user's existing magnitude bands, including the Extreme x4 cap, are preserved. Current implementation status is recorded at the end of this document.

The recommended product reads each selected release, shows which side has greater weighted evidence, and combines current releases through inflation/labor/activity/Fed budgets. The primary view needs only a direction and strength, supportive/negative totals, and one reason. Sources justify economic definitions and the interpretation structure; the evaluated numerical policies remain choices rather than proven optimal weights.

## Objective and scope

- Interpret an event release as USD-supportive or USD-negative economic evidence; do not predict or explain the subsequent market price movement.
- Exclude forecast. Delta means Actual minus Previous (A-P).
- Exclude speeches from the current scoring scope. Focus on USD; EUR, GBP, AUD, JPY and other currencies are future scope.
- Keep the primary output simple: USD Strengthening / USD Weakening, with a short explanation and supportive/negative evidence totals.
- Respect the user's existing historical magnitude categories. A magnitude describes the size of a change, not a probability of USD movement.
- Define the family and relationship structure before implementing CPI as the first example, then expand incrementally.

## Accepted overall structure

Accepted after the inflation-family research discussion. Implementation remains deferred until the remaining standalone and relationship rules are defined.

| Category | Releases | Interpretation role |
|---|---|---|
| Inflation | CPI, PCE, PPI | Changing consumer/producer inflation pressure |
| Labor | Jobs/NFP, unemployment, wages, jobless claims | Changing labor conditions |
| Growth/activity | GDP, retail sales, ISM manufacturing/services | Changing economic activity |
| Monetary policy | Fed rate decision | Actual hike, cut or hold |

- Each release has an independent standalone interpretation: supportive evidence, negative evidence, net direction and a short explanation.
- The overall USD interpretation combines category evidence through defined relationships rather than adding every release as an unrestricted extra vote.
- Within-release series weights and between-category weights answer different questions and must be justified separately. A relationship weight cannot repair an unsuitable standalone interpretation.
- Overlapping inputs and inherited outputs must not become additional independent confirmations. Group budgets bound category influence but do not statistically eliminate shared-source overlap.
- Respect reference periods within categories. Across categories, retain actual frequencies: weekly claims, monthly releases and quarterly GDP cannot all be forced into a same-month rule.
- Relationship rules must describe both agreement and opposition and preserve the supportive/negative contribution breakdown.
- Actual policy action is distinct from the economic pressure suggested by inflation, labor and growth. A hold supplies zero rate-change direction without erasing underlying evidence.
- CPI V5 remains the agreed baseline. Exact PCE/PPI standalone weights, their blend/selection rules, category allocations, policy-action priority and strength thresholds remain open.

### PCE target versus momentum

The Fed targets annual headline PCE inflation while core measures help assess underlying trends. Actual headline PCE relative to the target and A-P inflation momentum answer different questions. Core priority is a proposed principle for assessing momentum, not proof that PCE must inherit CPI's exact 50/20/15/15 weights. Do not turn target-distance context into an extra vote without agreeing an explicit rule. See the Fed inflation source below.

### Intended user-facing result

- Selected release: one USD direction, supportive/negative evidence totals and one short explanation of the dominant contributions. Raw release numbers and calculation details remain available optionally.
- Overall USD evidence: one direction from the category relationship rules, supportive/negative totals and one explanation of which categories outweighed the opposing side.
- Keep the selected release's result distinct from the overall interpretation. A supportive release can oppose an overall negative evidence balance.
- Historical interpretation uses only information available at the selected time. Latest interpretation must follow the agreed freshness/reference-period rules.
- Exact balance, insufficient data and magnitude categories not yet configured need explicit handling rather than an invented directional signal.

## Design sequence before implementation

1. Define the overall scoring contract: what an event direction and overall USD direction mean, comparable contribution scales, category budgets and exception handling.
2. Finalize inflation standalone and relationship rules, including PCE's target/trend distinction, PPI core definition, shared sources and period alignment.
3. Define labor rules and relationships, including opposite sign conventions for unemployment/claims and avoiding duplicate wage votes.
4. Define growth/activity rules, including levels such as contraction/expansion thresholds and overlapping spending/activity information.
5. Define how hike/cut/hold interacts with the category evidence without reusing inherited context as extra votes.
6. Review the assembled system on agreement, opposition, timing, revisions and missing-data cases; examine sensitivity to plausible weights and magnitude boundaries.
7. Record the agreed formulas and expected example outputs. Begin implementation only after the user authorizes it; implementation is currently deferred.

Future currencies should reuse the structure and evidence explanations, with currency-specific measures and interpretation rules reviewed separately. USD weights must not automatically be copied to other currencies.

## Agreed baseline: USD-CPI-SCORING-SYSTEM-V5

The formula is fixed as a candidate baseline, not established as the most accurate interpretation policy.

| Input | Weight |
|---|---:|
| Core CPI m/m | 50 |
| Core CPI y/y | 20 |
| Headline CPI m/m | 15 |
| Headline CPI y/y | 15 |

For each included inflation-rate series:

1. Direction = +1 when A-P > 0; -1 when A-P < 0; 0 when unchanged.
2. Magnitude multiplier = Small 1, Medium 2, Large 3, Extreme 4; unchanged contributes zero.
3. Contribution = weight x direction x magnitude multiplier.

Supportive evidence = sum of positive contributions.
Negative evidence = sum of negative contributions, displayed with its minus sign.
Net score = supportive evidence + negative evidence.

- Positive net: USD Strengthening lean.
- Negative net: USD Weakening lean.
- Zero net: no net direction from this score. Exact-tie presentation/handling remains open; no tie-break rule has been agreed.
- Score points are neither percentage probabilities nor expected currency returns.
- Negative A-P means a lower inflation rate; prices may still be rising.

Exclude index-level rows and additional non-seasonally-adjusted representations from directional voting. They can remain in optional data details. Corresponding index data may derive a missing percentage input if period and adjustment match; it must replace that input rather than add a vote.

### Discussion examples

These use the user's attached exemplars and supplied magnitude labels, not independently verified historical releases.

| Exemplar | Supportive evidence | Negative evidence | Net |
|---|---:|---:|---:|
| March 11, 2026 | +15 | -50 | -35 |
| June 10, 2026 | +65 | -115 | -50 |
| July 14, 2026 | 0 | -280 | -280 |

## Family relationships: established distinction and open proposals

- A rate hold alone contributes no direction under the proposed change-based framework. Inflation, labor and growth can provide the context.
- A combined hold/CPI output retains CPI's lean; it does not turn the hold into a separate directional vote.
- A 25 bp hike is conventionally USD-supportive through the interest-rate channel; a cut is conventionally USD-negative. These are interpretation leans, not guaranteed market reactions.
- The greater-evidence approach is the current proposal for opposing family signals. Cross-family numeric weights and scaling remain unagreed.
- The previously illustrated Fed contribution of +/-100 points was an example only. It is not a locked weight. Automatic Fed precedence was also not agreed.
- Count underlying evidence once; an inherited CPI lean must not be added back as another independent family vote.
- Use only information available at the interpretation time; distinguish release date from the economic period measured.

## Supporting sources and their limits

1. [BLS: Calculating CPI percent changes](https://www.bls.gov/cpi/factsheets/calculating-percent-changes.htm): percentage changes derive from index levels; monthly and annual changes cover different periods. Supports avoiding extra index votes, not V5's weights.
2. [BLS: Using seasonally adjusted and unadjusted CPI data](https://www.bls.gov/cpi/seasonal-adjustment/using-seasonally-adjusted-data.htm): seasonally adjusted changes are generally preferred for short-term trends.
3. [Fed: Evaluating inflation](https://www.federalreserve.gov/faqs/economy_14419.htm): core measures help assess underlying trends, multiple-month context matters, and the Fed's inflation target uses headline PCE. Supports considering core and longer periods; does not establish monthly core weight 50.
4. [Chicago Fed: Composite-index methodology](https://www.chicagofed.org/publications/chicago-fed-letter/2013/june-311): demonstrates weighted aggregation with weights estimated for a specific economic objective. Does not validate a USD scoring formula.
5. [Fed: Monetary policy transmission](https://www.federalreserve.gov/faqs/money_12856.htm): policy rates influence broader rates and financial conditions; effects on inflation and employment are indirect and delayed.
6. [Fed: Dollar sensitivity to monetary-policy expectations](https://www.federalreserve.gov/econres/notes/ifdp-notes/the-sensitivity-of-the-us-dollar-exchange-rate-to-changes-in-monetary-policy-expectations-20170922.htm): market-reaction research studies policy surprises and relative rates, with effects varying over time and currencies. It does not directly validate a forecast-excluded A-P interpretation system.

## Pending decisions

- Standalone PCE, PPI, labor and growth interpretation rules; speeches remain excluded.
- Cross-family weighting, comparable scales, shared inflation inputs and overlapping evidence.
- How absolute levels and longer trends should contextualize A-P momentum.
- Freshness, reference-period alignment, revisions and missing inputs.
- Strength labels, magnitude-boundary sensitivity and exact ties.
- Validation benchmark: independent economic interpretation, weight sensitivity and later-release evaluation using data available at each release. Price-return accuracy is a separate objective.

## Inflation-family research: 2026-10-09

Research findings below are not new user agreements and do not alter CPI V5.

- The proposed PCE/CPI/PPI 60/30/10 split has no direct empirical validation in the sources reviewed. It should remain an unvalidated candidate, not an implementation default justified by these sources.
- [BEA: PCE source methodology](https://www.bea.gov/help/faq/521) states that most PCE price indexes derive from BLS consumer and producer price indexes. Same-period agreement is therefore not three independent confirmations.
- [BEA: PCE/CPI reconciliation](https://www.bea.gov/help/faq/555) identifies formula, weight, scope and other effects. Shared sources do not make the measures identical or make their differences useless.
- [Fed Governor Jefferson: Recent Inflation and the Dual Mandate](https://www.federalreserve.gov/newsevents/speech/jefferson20230227a.htm) explains why PCE is the policy target and why core measures help assess trends. This supports policy relevance, not a universal fixed USD influence ratio.
- [BLS: PPI/CPI comparison](https://www.bls.gov/ppi/methodology-reports/comparing-the-producer-price-index-for-personal-consumption-with-the-us-all-items-cpi-for-all-urban-consumers.htm) explains why PPI and CPI need not move together; headline final-demand PPI covers more than consumer purchases.
- [Richmond Fed: Building a Pipeline Between Producer and Consumer Prices](https://fraser.stlouisfed.org/files/docs/historical/frbrich/econbrief/frbrich_eb_22-38.pdf), September 2022, finds relationships between intermediate-demand PPI and PCE in a fitted model and reviews mixed earlier evidence. Its coefficients cannot be transferred directly to headline final-demand PPI, V5's A-P categories or a 10% USD weight.
- [New York Fed: Multivariate Core Trend Inflation](https://www.newyorkfed.org/research/policy/mct) models shared versus sector-specific and persistent versus transitory inflation. It supports explicitly addressing shared movements; it does not validate V5 or fixed family shares.
- [Cleveland Fed: Nowcasting Inflation](https://www.clevelandfed.org/-/media/project/clevelandfedtenant/clevelandfedsite/publications/working-papers/2024/wp2406.pdf), 2024, models release timing and sequential information availability. Relevant methodological lesson: reference period and publication availability matter. Forecast estimates are not authorized inputs to this system.

### Verified reference periods for the March examples

| Publication | Economic period | Source |
|---|---|---|
| CPI, March 11, 2026 | February 2026 | [BLS archived release](https://www.bls.gov/news.release/archives/cpi_03112026.htm) |
| PCE, March 13, 2026 | January 2026 | [BEA archived release](https://www.bea.gov/sites/default/files/2026-03/pi0126.pdf) |
| PPI, March 18, 2026 | February 2026 | [BLS archived release](https://www.bls.gov/news.release/archives/ppi_03182026.htm) |

The PCE release was delayed from February 26 because of the October-November 2025 government shutdown. Publication recency is not measurement recency.

### Refinements proposed for discussion

- Retain independent standalone scores. In any aggregate, allocate one explicit inflation-family budget rather than allowing additional reports to automatically increase inflation's influence over labor/growth.
- A bounded weighted average limits total scale but does not remove shared-source overlap or establish independent evidence.
- Align reference periods and information availability before selecting or blending CPI/PCE/PPI; retain older periods as identified history rather than silently treating them as contemporaneous votes.
- Consider a simple consumer-inflation selection rule: newest available reference month first; if CPI and PCE cover that same month, use PCE as the policy-oriented anchor and CPI as comparison. Keep PPI standalone/contextual until its independent numeric modifier is justified. This is a proposed simplifying policy, not a research-validated USD rule.
- A more complete simultaneous blend would require an explicit objective and fitted treatment of shared data, lagged relationships and revisions, validated on later releases. No exact family blend is locked.

## USD design brief and evidence standard: 2026-10-09

The user authorizes the assistant to develop the whole USD design and maintain this note. Application implementation remains deferred. Read/write access for this research task is restricted by the user's instruction to this document; public-source research is permitted. This section records the design process and research findings, not acceptance of additional coefficients.

### What a source can establish

Separate four questions for every rule:

1. **Measurement:** What does the input actually measure? Verify its definition, units, adjustment and reference period with its publisher.
2. **Economic interpretation:** Why would the change provide USD-supportive or USD-negative evidence through the chosen economic/interest-rate channel? Distinguish a supported mechanism from an unconditional sign claim.
3. **Numerical design:** Why use this weight, magnitude multiplier or relationship allocation? Mark a coefficient as a design choice unless a study estimates it for a sufficiently matching objective and inputs.
4. **Validation:** Does the assembled rule remain sensible across conflicting, unusual and later-release cases? Record the results, including failures and sensitivity.

A source supporting core inflation's relevance does not validate core m/m weight 50. A source establishing PCE's policy role does not establish a 60% PCE allocation. Several supporting citations do not add up to empirical validation of the entire formula.

Use statuses: **user-agreed baseline**, **source-supported principle**, **proposed numerical policy**, **scenario-checked**, and **historically evaluated**. These statuses can coexist. Historical evaluation must specify its benchmark and sample; it does not establish a uniquely best formula.

The design objective is a consistent interpretation of economic evidence. Its benchmark is economic interpretation under the stated scope, rather than subsequent exchange-rate returns. Deterministic output is achievable; choosing deterministic rules alone does not settle their economic adequacy.

### Common scoring contract proposed for review

- Retain CPI V5 as the agreed baseline. Propose other standalone rules explicitly; do not silently copy CPI's weights.
- For each comparable A-P input, specify its sign convention, its own magnitude boundaries and its contribution weight. Inflation, payrolls, claims and survey points must not share raw-unit boundaries.
- Separate changing conditions from absolute conditions. Lower positive inflation means slower price increases; lower positive payroll growth means fewer jobs added; a rising PMI below 50 can mean contraction becoming less widespread.
- Preserve supportive and negative contributions through aggregation. A category's net alone loses the opposition within it; retain the original signed contributions and apply the relationship multiplier to each one.
- Proposed common scale: if a release has fixed weights totaling 100 and multipliers at most 4, divide its raw contributions by 4 for a bounded +/-100 scale. This is arithmetic normalization, not probability calibration. Do not divide by only the inputs that changed, which would exaggerate sparse evidence.
- Missing inputs and unconfigured magnitudes are unavailable evidence, not observed zero changes. Keep coverage separate; define partial-result eligibility before producing an aggregate. Do not silently redistribute missing weights.
- Positive net selects strengthening; negative net selects weakening. Ordinary opposing inputs do not force a generic mixed result. Exact cancellation cannot support an invented direction; display evidence balanced. Insufficient eligible evidence requires a separate unavailable result.
- Strength labels and direction robustness are separate. A large net describes the selected scoring policy; robustness describes whether the direction survives plausible alternative policies. Neither is a statistical confidence percentage.

### Measurement findings for the remaining menu

The candidate interpretations below concern the conventional activity/labor/interest-rate channel. The sources establish measurements and mechanisms, not exact USD weights. Full standalone formulas and their exceptional cases still require design and evaluation.

| Family/input | A-P interpretation to investigate | Required distinction | Primary evidence |
|---|---|---|---|
| PCE | Higher inflation rate: supportive pressure; lower: negative pressure | Annual headline is the Fed's target measure; core helps assess trend. A row called Price Index m/m is a percentage change and remains eligible despite the word index. | [Fed inflation explanation](https://www.federalreserve.gov/faqs/economy_14419.htm), [BEA shared PCE inputs](https://www.bea.gov/help/faq/521) |
| PPI | Higher producer inflation: supportive inflation-pressure evidence; lower: negative | Verify which core exclusion is supplied. Final-demand producer prices are not a direct substitute for consumer inflation. | [BLS PPI definitions](https://www.bls.gov/ppi/faqs/questions-and-answers.htm), [BLS comparison with CPI](https://www.bls.gov/ppi/methodology-reports/comparing-the-producer-price-index-for-personal-consumption-with-the-us-all-items-cpi-for-all-urban-consumers.htm) |
| NFP/payroll change | Higher monthly jobs added: improving hiring momentum, conventionally supportive; lower: negative | A-P compares monthly employment changes, not employment levels. Payrolls count jobs; household employment counts people. Do not add all employment representations as independent votes. | [BLS employment guide](https://www.bls.gov/bls/empsitquickguide.htm) |
| Unemployment rate | Higher: conventionally negative labor evidence; lower: supportive | The rate uses the labor force as its denominator. Participation changes can complicate a falling rate; review such cases before treating every fall as stronger employment. | [BLS employment guide](https://www.bls.gov/bls/empsitquickguide.htm) |
| Average hourly earnings growth | Higher: candidate supportive wage/inflation-pressure evidence; lower: negative | Average earnings also reflect workforce composition and payment factors. A higher average is not automatically a pay rise for the same worker. Count wage evidence once. | [BLS earnings concepts](https://www.bls.gov/opub/hom/ces/concepts.htm) |
| Initial/continuing claims | Higher: negative labor evidence; lower: supportive | Initial claims indicate emerging conditions; continuing claims measure insured unemployment. They cover different weeks in the same release. A moving average overlaps its weekly components. | [DOL weekly claims and technical notes](https://www.dol.gov/ui/data.pdf) |
| Real GDP growth | Higher growth: candidate supportive activity momentum; lower: negative | Compare quarters for growth momentum. A second/third estimate changes the estimate of the same quarter and is a revision, not another quarter of growth. | [BEA GDP definition](https://www.bea.gov/data/gdp/gross-domestic-product), [BEA release vintages](https://www.bea.gov/news/gdp-release-additional-information) |
| Retail sales growth | Higher: candidate supportive spending momentum; lower: negative | Published sales are in current dollars: higher spending need not mean more goods purchased. Headline and subset measures overlap. | [Census retail definitions](https://www.census.gov/retail/definitions.html) |
| ISM manufacturing/services | Higher headline PMI: candidate improving activity evidence; lower: deteriorating | The headline already combines components. Supplier-delivery delays can increase the index; test supply-disruption cases rather than assuming every rise represents stronger demand. Above/below 50 concerns the sector's expansion/contraction, separately from A-P. | [ISM manufacturing methodology](https://go.weareism.org/ism-manufacturing-pmi), [ISM services report and methodology](https://www.ismworld.org/supply-management-news-and-reports/reports/ism-pmi-reports/services/august) |
| Fed decision | Hike: supportive rate-change evidence; cut: negative; hold: zero action direction | Score the action separately from incoming data and the level of rates. Do not assign the Fed another copy of the macro evidence it considered. | [Fed transmission and exchange-rate channel](https://www.federalreserve.gov/monetarypolicy/monetary-policy-what-are-its-goals-how-does-it-work.htm) |

[Fed monetary-policy principles](https://www.federalreserve.gov/monetarypolicy/principles-for-the-conduct-of-monetary-policy.htm) support considering inflation and resource utilization together and responding to persistent conditions. Their policy-rule examples use levels/gaps and economic assumptions; copying their coefficients into this A-P magnitude score would not be justified. This is a mechanism reference, not an additional scoring input.

### Relationship design to resolve

1. **Inflation:** Compare a period-aware consumer anchor with a bounded blend. Assess what PPI contributes beyond shared CPI/PCE inputs. Choose one explicit policy; record the competing policy and cases where outputs differ. Do not present shared-data agreement as independent confirmation.
2. **Labor:** Establish a monthly jobs/wages result and one current claims result. Weekly releases replace the current claims state; they must not accumulate four extra votes against one monthly jobs release. Resolve participation and wage-composition exceptions.
3. **Activity:** GDP provides quarterly coverage; retail and ISM provide newer monthly coverage. Define how their different periods and overlapping spending/employment information affect their budgets. A category budget bounds influence but does not remove correlation.
4. **Policy:** Compare actual action with macro evidence without assuming action always overrides it. A hold keeps the macro evidence balance; it contributes no rate-change vote. Decide whether the latest action is eligible until the next decision or for a shorter interval, and test that choice explicitly.
5. **Overall USD:** Define category allocations only after comparable standalone scales and eligibility rules exist. Justify each priority, then test alternatives. Preserve both evidence totals and identify the largest reasons on each side.

Reference period, publication time, source vintage and revised Previous must be explicit. Historical results must use information available then. Later revisions update the current view without silently rewriting the original release interpretation. A same-period revision replaces that period's current estimate, rather than adding a second period vote.

### Evidence required before recommending implementation

- Every included family has a complete formula, series definitions, sign conventions, magnitude treatment, unavailable-data handling, source rationale and at least one worked example.
- Every relationship has explicit rules for agreement, opposition, timing, replacement, overlap and partial coverage. No unresolved rule is hidden behind a fixed coefficient.
- Scenario checks cover all-positive/all-negative releases, monthly-versus-annual opposition, unchanged high levels, contraction improving, jobs losses becoming smaller, rising wages alongside falling employment, GDP revisions, supplier delays and rate hold/hike/cut against both macro directions.
- Mathematical checks cover correct sign reversal for claims/unemployment, contribution reconciliation, bounded scale, unchanged contribution zero, invariance to duplicated representations and deterministic exact-tie handling. A series rising in the supportive direction must not reduce its contribution when everything else is fixed.
- Compare plausible weight sets and adjacent magnitude-boundary choices. Report which examples change direction, not only changes in score size. Do not choose coefficients merely to reproduce the examples used to propose them.
- Evaluate public historical releases spanning different economic conditions, preserve their original vintages, and reserve later cases for evaluation after choices are fixed. Benchmark economic interpretations using independent published analysis where available; otherwise mark the case as a logical scenario rather than independent validation.
- Document unsupported choices and remaining evidence gaps. If no historical sample or independent benchmark has been evaluated, call the result a researched, scenario-checked design, not historically validated.
- Present one preferred complete design and the material alternatives for user review. Application implementation remains deferred until separately authorized.

### End-product example

Selected CPI release, using the agreed March exemplar:

> USD Weakening lean
> Supportive evidence +15 | Negative evidence -50
> Slower core inflation outweighs faster headline inflation.

Overall USD uses the same presentation, with category-weighted totals and the dominant economic reasons. These overall totals cannot be calculated from the CPI exemplar alone. Raw data, sources and formula details belong in optional audit details.

### Suggested persistent research goal

Design and document a complete, source-grounded USD economic-evidence scoring system in this file. Cover CPI, PCE, PPI, jobs/wages, claims, GDP, retail sales, ISM manufacturing/services and Fed rate decisions, including standalone outputs and their relationships. Preserve the agreed CPI V5 baseline while evaluating alternatives. Exclude forecasts and speeches as scoring inputs. Propose and justify numerical policies, clearly distinguish source support from validation, work through conflicting/timing/revision cases, and evaluate sensitivity and public historical examples where feasible. Finish with a reviewable recommended design, evidence gaps and expected outputs for every family and relationship. Only read/write this document; do not inspect the repository or implement application changes.

Goals support sustained work toward a defined outcome; they do not make the numerical policy empirically valid. [Official Codex Goals documentation](https://developers.openai.com/cookbook/examples/codex/using_goals_in_codex).

## USD evidence design R1

Status: complete recommended candidate, with targeted historical evaluation, worked examples and sensitivity findings below. CPI V5 remains unchanged. This section resolves the earlier open design questions for the recommended candidate; historical discussion above remains evidence of how the design developed. All new weights, cutoffs, selection priorities and expiry policies below are proposed numerical/operational policies. Publisher definitions and economic mechanisms support the structure, not the exact coefficients.

### Meaning of the result

The system interprets changes in measured conditions through the conventional US activity/labor/interest-rate channel. The standalone result answers what this release contributes. The overall result answers which side outweighs the other within the selected, currently eligible evidence. It is a momentum interpretation: a condition improving from a weak level can contribute supportive evidence while remaining weak. Levels are explanatory context and do not supply additional votes.

The USD scope does not compare US evidence with another country's evidence. A pair's base/quote position changes the optional pair-direction translation, not the USD score: USD strengthening implies a downward USD-side lean for EURUSD and an upward USD-side lean for USDJPY. Other-currency evidence requires a separately designed system.

### Common arithmetic and data contract

For scored input i, let d_i = A_i - P_i; p_i is +1 for ordinary sign inputs and -1 for claims/unemployment. Let z_i = p_i * sign(d_i), and m_i be the configured magnitude 1/2/3/4. An observed zero has z_i = 0 and contribution zero. Raw contribution c_i = w_i * z_i * m_i, with fixed release weights totaling 100. Standalone supportive B = sum(max(c_i, 0)); negative E = sum(min(c_i, 0)); net S = B + E. Preserve signed leaf contributions, not just S.

For relationships use b_i = c_i / 4, so every complete standalone result has net in [-100, 100]. Relationship coefficients multiply every leaf contribution by the same nonnegative coefficient. Overall supportive and negative totals sum the resulting positive and negative leaves separately. Display standalone totals in raw V5-style points and aggregate totals in normalized evidence points; optional audit details state the scale. The direction always comes from the unrounded net.

Required metadata: semantic series identity, unit, seasonal adjustment, economic reference period, publication timestamp in UTC, release/vintage identity, A, P, P's reference period, and magnitude-configuration version. Preserve original publisher precision. Use decimal or scaled-integer arithmetic; equality at a magnitude boundary belongs to the lower band. Format only after calculating. Do not let binary floating-point residue create a +1 sign or push 0.2 into the next band.

Use revised Previous reported in the current release when available. Otherwise use the latest comparable previous-period value available at that timestamp and identify that vintage. Never substitute a later revised historical value. Do not mix annualized with nonannualized rates, adjusted with unadjusted monthly inputs, or revisions with period-to-period changes. A feed's label alone is insufficient to identify these.

Price-index levels and duplicate NSA monthly rates remain excluded from CPI/PCE/PPI votes. Claims counts and PMI diffusion-index values are eligible measurements: excluding price-index-level duplicates is not a ban on every series named index or every level-valued series. Rates may be derived from matching index levels to replace a missing percentage series; derived rates use the registered rounding convention and never add an extra vote.

### Standalone formulas

Inflation input order throughout this specification is **core m/m, core y/y, headline m/m, headline y/y**.

| Family / registered profile | Fixed raw weights | Sign rule | Primary rationale and limitations |
|---|---|---|---|
| CPI V5 | 50 / 20 / 15 / 15 | Higher inflation rate positive | User-agreed baseline; core trend priority, some annual context. Exact weights remain a policy. |
| PCE R1 | 50 / 15 / 20 / 15 | Higher inflation rate positive | Core 65%, monthly 70%; slightly more headline-monthly influence than CPI. Measures changing inflation pressure. Headline annual level versus the Fed's target remains context, not a reason to add a second target-distance vote. |
| PPI R1 | 40 / 15 / 30 / 15 | Higher producer inflation rate positive | Monthly 70%, core 55%; headline remains meaningful for broad producer-price changes. Use final demand less foods and energy as core for this profile. Less foods/energy/trade is a distinct alternative profile, never an additional core vote. |
| Jobs R1 | NFP monthly change 60; unemployment rate 30; average hourly earnings m/m growth 10 | NFP and earnings growth positive; unemployment negative | Direct employment evidence takes 90%. Earnings averages can reflect composition, so extreme wage acceleration cannot outweigh both employment inputs deteriorating by even one band: +40 versus at least -90. Wage y/y, household employment, participation and hours are context; no extra votes. |
| Claims R1 | Seasonally adjusted initial claims 70; seasonally adjusted continuing claims 30 | Both negative | Initial claims prioritize emerging conditions; continuing claims provide context on insured unemployment. Their measured weeks differ and remain attached to their own A/P comparisons. Four-week averages and NSA versions are context, not extra votes. |
| GDP R1 | Real GDP q/q annualized growth 100 | Higher growth rate positive | One output-growth signal. GDP price indexes, nominal GDP, inventories and consumption components are context; do not add them as additional GDP votes. Revision handling below is mandatory. |
| Retail R1 | Total retail and food services SA m/m growth 100 | Higher nominal sales growth positive | One broad spending-momentum signal. Ex-auto and control-group results are overlapping context. Do not call nominal spending growth real consumption growth or divide it by headline CPI to invent an exact retail volume measure. |
| ISM manufacturing demand R1 | New Orders index 60; Production index 40 | Higher index positive | Prefer direct demand/activity components to prevent slower deliveries mechanically becoming stronger activity evidence. Employment is already in labor; inventories/deliveries are context. This is a custom evidence score, not the official PMI. |
| ISM services demand R1 | New Orders index 60; Business Activity index 40 | Higher index positive | Same demand/activity question as manufacturing. Keeps delivery delays and the employment component from becoming additional activity votes. Required components must be available; do not infer them from headline PMI. |
| Fed action R1 | One published target-rate change; range midpoint only when both bounds are verified | Hike positive; cut negative; hold zero | Raw S_F = 100 * sign(delta_bp) * min(abs(delta_bp)/25, 4); normalized F = S_F/4. Thus 25/50/75/100+ bp gives 25/50/75/100 normalized points. Unusual increments use the continuous formula, not invented categories. |

PCE/PPI weighting differences are explicit design choices for examination, not claimed estimates of their USD importance. PCE's target status is handled principally through consumer-anchor selection, not by making the annual inflation change stand in for target distance.

ISM data requirement: the preferred R1 profile needs two published subindexes per sector in addition to metadata. No repository/feed inspection has been performed, so availability is unverified. If only headline PMI is available, the separately named **ISM headline-only H1** profile scores that headline with weight 100, using its own magnitude configuration. It may be shown standalone as a composite-survey interpretation; it is excluded from the preferred overall activity aggregate because a rising headline can reflect supply delays. Do not silently switch profiles across history. This is a concrete data requirement for later implementation, not unfinished arithmetic.

If an ISM sector is selected for the preferred aggregate but its subindexes are unavailable, retain that sector's assigned uncertainty. A headline-only H1 result does not fill the missing demand-profile slot. Intentionally deselecting the sector is a separate scope choice.

GDP release standalone rules: when P refers to the preceding quarter, score growth momentum A-P. When P is an earlier estimate of the same quarter, score A-P as a **revision contribution**, with copy such as Growth estimate raised/lowered. For the current overall activity slot, always recompute the newest quarter's growth minus the latest available preceding quarter's growth, using comparable vintages. The revision replaces that slot; its standalone revision score is never added to the slot's recomputed momentum score. If the period relationship is unknown, GDP is unavailable for scoring.

Actual levels inform concise explanations when needed: falling but still positive CPI means prices rising more slowly; rising but still negative payroll change means smaller job losses; a rising New Orders index below 50 means orders contracting less broadly. A below-50 component does not itself add a negative vote. This keeps the A-P contract intact.

### Magnitude configuration

Production uses the user's existing, versioned per-series boundaries. R1 does not overwrite them or claim to have evaluated the user's 2015-present dataset. The user reconfirmed that the existing Extreme multiplier is capped at 4; outlier-size protection already exists. No additional outlier cap, raw-size multiplier or winsorization is proposed. Missing boundaries mean magnitude unavailable for a nonzero delta; an observed zero still contributes zero without needing a magnitude band. Keep the 1/2/3/4 multiplier; do not use relative percentage change in an inflation rate or a score/probability interpretation.

For reproducible public-case evaluation only, register **AUDIT-BANDS-R1** below. These are provisional numerical policies, not empirically fitted thresholds and not a replacement for the user's bands. For absolute delta x: Small if 0 < x <= s; Medium if s < x <= m; Large if m < x <= l; Extreme if x > l. Zero is unchanged.

| Series | Unit of A-P | s / m / l audit boundaries |
|---|---|---|
| Headline CPI m/m | percentage points (pp) | 0.2 / 0.4 / 0.6 |
| Core CPI m/m | pp | 0.1 / 0.2 / 0.3 |
| Headline CPI y/y | pp | 0.1 / 0.3 / 0.5 |
| Core CPI y/y | pp | 0.1 / 0.2 / 0.3 |
| PCE core/headline m/m | pp, separately registered series | 0.1 / 0.2 / 0.3 |
| PCE core/headline y/y | pp, separately registered series | 0.1 / 0.3 / 0.5 |
| PPI core/headline m/m | pp, separately registered series | 0.2 / 0.4 / 0.6 |
| PPI core/headline y/y | pp, separately registered series | 0.2 / 0.5 / 1.0 |
| NFP monthly employment change | thousands of jobs | 50 / 100 / 200 |
| Unemployment rate; hourly earnings m/m growth | pp, separately registered series | 0.1 / 0.2 / 0.3 |
| Initial claims | thousands of claims | 10 / 25 / 50 |
| Continuing claims | thousands of claims | 25 / 50 / 100 |
| GDP growth and same-quarter revision | annualized pp, separate profiles | 0.5 / 1 / 2 |
| Retail m/m growth | pp | 0.2 / 0.5 / 1 |
| Each ISM subindex; headline-only H1 | index points, separate profiles | 1 / 2 / 4 |

These bands make evaluation repeatable but do not establish historical rarity. Broad historical calibration is a later dataset exercise. For a new series without manual settings, an optional calibration policy is quantiles 50/80/95 of nonzero absolute earlier A-P observations, at least 60 comparable observations, with tied thresholds coalesced rather than creating overlapping bands. Freeze a configuration version before evaluating subsequent releases. This optional policy is also a design choice; never silently recalibrate old outputs or fit using later observations.

### Category relationships

Use normalized leaf scores. All ratios below are recommended policies; none is source-established.

**Inflation:** among selected consumer publications available as of the chosen time, identify the newest known reference month; within that month prefer PCE, otherwise CPI. Select the anchor before assessing completeness/freshness. A newer incomplete or stale report must not silently send the selector back to an older complete month; retain the assigned uncertainty. An unknown reference period is unavailable and requires a recorded coverage exception. Publication recency does not override reference-month recency. Score only the selected consumer anchor, not CPI and PCE together. With PPI selected as well, I = 0.90 * consumer + 0.10 * same-reference-month PPI. PPI from another month remains standalone/history and is an unavailable 10% slot in this aggregate. Older consumer reports remain history/context, not additional current votes. If only consumers are selected, anchor receives 100%. If only PPI is selected, its standalone normalized result defines the selected producer-inflation category; describe that narrower scope explicitly. If both consumer sources are selected but the preferred source has missing inputs, retain its uncertainty; use an alternate complete source from that month only under an explicitly recorded fallback, never because its sign is convenient.

PCE replaces CPI as an anchor for the same month because of policy relevance and broader coverage; it does not prove the earlier CPI score was wrong. New CPI for a later month can replace an older PCE anchor. PPI's 10% permits limited counterevidence without treating it as another consumer report. PPI still shares inputs with PCE: this bounded combination is not statistically independent evidence. Compare a zero-PPI alternative and a 20% PPI alternative in sensitivity checks.

**Labor:** L = 0.80 * current jobs result + 0.20 * current claims result. The monthly and weekly reference periods remain distinct; this is a current-information view, not a same-month measurement. Each new claims report replaces the previous claims result. A jobs revision updates the jobs slot without also becoming another labor vote. Wage inputs do not appear again in the inflation category.

**Activity:** G = 0.50 * current GDP momentum + 0.20 * current retail result + 0.20 * current ISM services demand + 0.10 * current ISM manufacturing demand. GDP gets the largest allocation for broad real output; retail and surveys supply newer evidence. Services receive more than manufacturing as an explicit broad-coverage policy, not a measured 2:1 USD effect. Retail overlaps GDP; survey activity overlaps actual output. The weights budget these indicators, not remove their correlation. Headline-only ISM H1 remains outside this preferred aggregate.

**Policy:** F is the most recent eligible action score, replaced by the next decision, including a hold that replaces the earlier hike/cut with zero. It remains evidence about the last action during that decision interval, not a fresh action on every subsequent release. Do not cumulate previous hikes/cuts. No speeches, guidance forecasts, dot plots or balance-sheet-policy votes are included.

Within labor/activity, intentionally unchecked families are removed and the remaining registered coefficients are normalized to total 1. Within inflation, use the explicit scope rules above. This scope normalization is different from missing-data renormalization: a selected but unavailable family keeps its assigned uncertainty and receives no extra weight elsewhere. Freeze the selection before calculating; show the selection in optional details.

### Overall relationship and all Fed-action cases

Preferred category budgets: inflation 35%, labor 30%, activity 15%, actual Fed action 20%.

Overall T = 0.35 * I + 0.30 * L + 0.15 * G + 0.20 * F. Inflation/labor together get 65% for the dual-mandate channel, activity 15% as broader context, and policy 20% for actual action. These exact allocations are unsupported numerical choices to test, not a Fed policy rule. No automatic Fed precedence is assumed.

If a category is intentionally unselected, normalize the remaining selected category budgets to total 1. If a selected category is unavailable, retain its budget as uncertainty. A result for CPI plus Fed alone is a selected-evidence result, not the complete USD picture.

If no families/categories are selected, show No evidence selected; do not divide by zero or label USD. If selected evidence has no usable inputs, its uncertainty interval yields Insufficient evidence. Unknown consumer reference periods that make anchor ordering ambiguous leave the consumer slot unavailable; they do not authorize a silent older-source fallback.

Let H = 0.35 I + 0.30 L + 0.15 G for the full-menu view. Then:

| Macro contribution | Hold | Hike 25 bp | Cut 25 bp |
|---|---|---|---|
| H > 0 | Strengthening | Strengthening | Strengthening if H > 5; balanced if H = 5; weakening if 0 < H < 5 |
| H = 0 | Balanced | Strengthening | Weakening |
| H < 0 | Weakening | Strengthening if -5 < H < 0; balanced if H = -5; weakening if H < -5 | Weakening |

For 50/75/100+ bp, replace 5 with 10/15/20. These thresholds arise from the selected score scale and 20% policy budget; they are not economically estimated thresholds. With another selection/budget the formula determines the threshold. Hold preserves the macro direction, while changing coverage and possible absolute strength interpretation only through the defined overall scale.

### Timing, replacement and corrections

As-of views include only publications with timestamp <= as-of time. Each release family has one current slot: newest comparable reference period, latest available vintage of that period. GDP revisions follow their special rule; initial and continuing claims preserve their separate weeks. Never add a release simply because it was published more often.

Original expiry proposal (superseded by the [accepted freshness refinement](#accepted-freshness-refinement-10-october-2026)): a family remains current until the next publisher-scheduled comparable release plus 24 hours. Use the latest schedule amendment available at the as-of time; an announced postponement changes the expected date. For GDP, a scheduled second/third estimate is a comparable update. An unscheduled Fed decision immediately replaces the scheduled-cycle action. During a genuine missed update, the old slot becomes stale after the grace period and contributes uncertainty. If no verified schedule is available, current-view freshness is unknown and the slot is unavailable; a selected historical release can still be scored standalone. Scheduled dates are administrative timing metadata, not forecast values. The 24-hour grace is an operational choice; compare zero/72-hour alternatives in timing tests.

A publisher correction updates the current vintage after its correction timestamp. Preserve the original release snapshot separately. If an archive itself has been overwritten and the original vintage cannot be recovered, mark the historical case corrected-vintage and do not claim original-time validation. Configuration changes similarly create new result versions.

### Missing evidence, ties, strength and robustness

For any score, sum known signed contributions N and the maximum absolute contribution of unavailable selected inputs U. On a raw standalone scale, missing input weight w contributes at most 4w to U; on the normalized/aggregate scale apply the same /4 and relationship coefficients. The completion interval is [N-U, N+U]. Observed unchanged inputs have U = 0. Exact duplicates and intentionally excluded inputs have no budget and no uncertainty.

- If N-U > 0, output strengthening. If N+U < 0, output weakening. State limited coverage briefly when material.
- If U > 0 and the interval touches/crosses zero, output Insufficient evidence. Do not pretend missing values were neutral.
- If U = 0 and N = 0, output Evidence balanced. A tie-break invented from priority would contradict the recorded evidence totals.
- Otherwise use the sign of N. Opposing observed contributions alone do not force a mixed label.

Proposed descriptive strength, on the normalized net: 0 < abs(N) <= 10 slight; 10 < abs(N) <= 30 moderate; abs(N) > 30 strong. They describe score size under this policy and require sensitivity evaluation. With incomplete coverage, assign strength using the minimum guaranteed absolute net max(0, abs(N)-U), so missing evidence cannot inflate strength.

Compute robustness separately by testing the alternative weights/bands listed in the evaluation section. Display Direction sensitive to weighting only when tested variants change the sign or reach zero. Keep detailed variants in optional audit information. This does not replace the preferred direction with a generic mixed result.

Register the sensitivity pass precisely: vary one family or relationship node at a time, holding other nodes at their preferred policies. Within a family, jointly enumerate its listed weight variants and per-series boundary factors 0.9/1.0/1.1; use the actual configured boundaries when available. Propagate each alternative through the selected aggregate. Separately vary PPI share 0/10/20%, jobs share 60/80/90%, GDP share 30/50/70% with the other activity shares in 2:2:1, and the three listed overall budgets. For intentionally reduced scopes, normalize the selected coefficients under each variant. This is robustness to the registered tests, not every possible simultaneous cross-family alternative. For incomplete evidence, compare each variant's guaranteed completion-interval direction; a variant losing that guaranteed direction also triggers the flag. Freshness grace 0/24/72 hours is a separate timing sensitivity test and must not silently override the preferred 24-hour eligibility rule.

### Explanation and output contract

Primary output: direction plus descriptive strength, supportive/negative totals, one sentence naming the largest winning reason and the largest opposing reason when useful. Select reasons by absolute weighted contribution, consolidating related monthly/annual inputs to avoid repetitive copy. Explain weak starting levels only when omitting them would misstate the result. Available details: raw A/P, components, formula version, current scope, reference periods, source/vintage, coverage and sensitivity. These are optional audit details rather than repeated footnotes.

No N% inflation figure is derived by averaging different series. Evidence points stay evidence points. Only an individual published percentage series can supply a factual inflation percentage in optional data details.

## R1 evaluation and worked examples

Evaluation completed 2026-10-09. This is a researched, scenario-checked candidate with a targeted public-release audit. It is not a fitted USD model or a statistically validated optimum. Existing user magnitude settings remain authoritative; the public-case calculations below deliberately use the separately named AUDIT-BANDS-R1, except where a user-band comparison is explicitly identified.

### Standalone public-release ledger

The sample covers 23 public cases/actions across 2020, 2022, 2023, 2024, 2025 and 2026. Cases were chosen to expose disagreement, unusual conditions, revisions and timing. They were not a random sample or a blinded holdout; no accuracy percentage is calculated. Source-linked A/P values permit the calculations to be reproduced.

Inflation vectors are ordered **core m/m, core y/y, headline m/m, headline y/y**, all in percent. Contributions are raw standalone points. An entry B / E / S means supportive / negative / net. Annual Previous values not restated by the current release use the linked prior publication available at the time.

| Release / reference period | Actual vector | Previous vector | B / E / S | Source |
|---|---|---|---|---|
| CPI, June 10, 2022 / May | 0.6 / 6.0 / 1.0 / 8.6 | 0.6 / 6.2 / 0.3 / 8.3 | +90 / -40 / +50 | [May release](https://www.bls.gov/news.release/archives/cpi_06102022.htm), [April annual rates](https://www.bls.gov/news.release/archives/cpi_05112022.htm) |
| CPI, July 12, 2023 / June | 0.2 / 4.8 / 0.2 / 3.0 | 0.4 / 5.3 / 0.1 / 4.0 | +15 / -240 / -225 | [June release](https://www.bls.gov/news.release/archives/cpi_07122023.htm), [May annual rates](https://www.bls.gov/news.release/archives/cpi_06132023.htm) |
| CPI, May 15, 2024 / April | 0.3 / 3.6 / 0.3 / 3.4 | 0.4 / 3.8 / 0.4 / 3.5 | 0 / -120 / -120 | [April release](https://www.bls.gov/news.release/archives/cpi_05152024.htm), [March annual rates](https://www.bls.gov/news.release/archives/cpi_04102024.htm) |
| PCE, June 30, 2022 / May | 0.3 / 4.7 / 0.6 / 6.3 | 0.3 / 4.9 / 0.2 / 6.3 | +80 / -30 / +50 | [BEA May tables](https://www.bea.gov/news/2022/personal-income-and-outlays-may-2022) |
| PCE, July 28, 2023 / June | 0.2 / 4.1 / 0.2 / 3.0 | 0.3 / 4.6 / 0.1 / 3.8 | +20 / -155 / -135 | [BEA June tables](https://bea.gov/news/2023/personal-income-and-outlays-june-2023) |
| PCE, May 31, 2024 / April | 0.2 / 2.8 / 0.3 / 2.7 | 0.3 / 2.8 / 0.3 / 2.7 | 0 / -50 / -50 | [BEA April tables](https://www.bea.gov/news/2024/personal-income-and-outlays-april-2024) |
| PPI, June 14, 2022 / May | 0.5 / 8.3 / 0.8 / 10.8 | 0.2 / 8.8 / 0.4 / 10.9 | +140 / -45 / +95 | [May release](https://www.bls.gov/news.release/archives/ppi_06142022.htm), [previous core annual rate](https://www.bls.gov/news.release/archives/ppi_05122022.htm) |
| PPI, July 13, 2023 / June | 0.1 / 2.4 / 0.1 / 0.1 | 0.1 / 2.8 / -0.4 / 0.9 | +90 / -75 / +15 | [June release, revised May monthly/headline annual](https://www.bls.gov/news.release/archives/ppi_07132023.htm), [previous core annual rate](https://www.bls.gov/news.release/archives/ppi_06142023.htm) |
| PPI, May 14, 2024 / April | 0.5 / 2.4 / 0.5 / 2.2 | -0.1 / 2.4 / -0.1 / 1.8 | +240 / 0 / +240 | [April release, revised March monthly/headline annual](https://www.bls.gov/news.release/archives/ppi_05142024.htm), [previous core annual rate](https://www.bls.gov/news.release/archives/ppi_04112024.htm) |

PPI core in all three rows is final demand less foods and energy. The less-foods-energy-trade series is not substituted. June 2023's small positive score comes from monthly headline inflation rebounding from a negative rate, despite lower annual rates; the output must mention that opposing annual evidence. This is a sensitive case, not proof of a uniformly stronger inflation trend.

| Release / measured period | Comparable A-P inputs | B / E / S | Source / interpretation check |
|---|---|---|---|
| Jobs, May 8, 2020 / April, corrected archive | NFP about -20.5m versus March -881k: about -19.62m; unemployment 14.7% versus 4.4%: +10.3 pp; derived earnings growth 4.7% versus 0.5%: +4.2 pp | +40 / -360 / -320 | [BLS corrected archive](https://www.bls.gov/news.release/archives/empsit_05082020.htm). The publisher attributes much of the average-earnings jump to losses of lower-paid jobs. |
| Jobs, August 2, 2024 / July | NFP 114k versus revised June 179k: -65k; unemployment 4.3% versus 4.1%: +0.2 pp; earnings growth 0.2% versus derived June 0.3%: -0.1 pp | 0 / -190 / -190 | [BLS original release tables](https://www.bls.gov/news.release/archives/empsit_08022024.htm). Hiring continued, but more slowly; do not describe the NFP delta as 65k jobs lost. |
| Claims, March 26, 2020 | Initial 3,283k versus 282k: +3,001k, week ending March 21; continuing 1,803k versus 1,702k: +101k, week ending March 14 | 0 / -400 / -400 | [DOL archive](https://www.dol.gov/sites/dolgov/files/OPA/newsreleases/ui-claims/20200510.pdf). Different measured weeks remain explicit. |
| Claims, October 8, 2026 | Initial 197k versus revised 199k: -2k, week ending October 3; continuing 1,716k versus 1,699k: +17k, week ending September 26 | +70 / -30 / +40 | [DOL archive](https://www.dol.gov/sites/dolgov/files/OPA/newsreleases/ui-claims/20261561.pdf). Fewer initial claims outweigh more continuing claims under 70/30. |
| GDP, April 28, 2022 / Q1 advance | Real annualized growth -1.4% versus Q4 +6.9%: -8.3 pp | 0 / -400 / -400 | [BEA advance estimate](https://www.bea.gov/news/blog/2022-04-28/gross-domestic-product-first-quarter-2022). Overall output fell despite increased consumer spending and investment; the output is not a claim that every GDP component weakened. |
| GDP, May 26, 2022 / Q1 second estimate | Same-quarter estimate -1.5% versus advance -1.4%: revision -0.1 pp | 0 / -100 / -100 | [BEA second estimate](https://www.bea.gov/news/2022/gross-domestic-product-second-estimate-and-corporate-profits-preliminary-first-quarter). Overall GDP slot instead compares -1.5% with Q4 6.9%, staying -400; it does not also add -100. |
| Retail, June 16, 2020 / May | Monthly nominal sales growth 17.7% versus revised April -14.7%: +32.4 pp | +400 / 0 / +400 | [Census original release](https://www2.census.gov/marts/adv2005.pdf). Strong rebound momentum; sales were still below their year-earlier level. |
| ISM manufacturing, May 1, 2020 / April | New Orders 27.1 versus 42.2: -15.1 points; Production 27.5 versus 47.7: -20.2 | 0 / -400 / -400 | [ISM-issued April report](https://www.prnewswire.com/news-releases/pmi-at-41-5-april-2020-manufacturing-ism-report-on-business-301050619.html). Delivery delays increased their component, cushioning the falling headline. |
| ISM services, May 5, 2020 / April | New Orders 32.9 versus 52.9: -20.0; Business Activity 26.0 versus 48.0: -22.0 | 0 / -400 / -400 | [ISM-issued April report](https://www.prnewswire.com/news-releases/nmi-at-41-8-april-2020-non-manufacturing-ism-report-on-business-301052413.html). Slower supplier deliveries accompanied severe activity declines. |
| ISM manufacturing, July 1, 2024 / June | New Orders 49.3 versus 45.4: +3.9; Production 48.5 versus 50.2: -1.7 | +180 / -80 / +100 | [ISM-issued June report](https://www.prnewswire.com/news-releases/manufacturing-pmi-at-48-5-june-2024-manufacturing-ism-report-on-business-302186137.html). Improving orders outweigh softer production; both latest component levels remain below 50. |
| ISM services, July 3, 2024 / June | New Orders 47.3 versus 54.1: -6.8; Business Activity 49.6 versus 61.2: -11.6 | 0 / -400 / -400 | [ISM-issued June report](https://www.prnewswire.com/news-releases/services-pmi-at-48-8-june-2024-services-ism-report-on-business-302188467.html). Demand/activity components both deteriorated. |
| Fed, June 15, 2022 | Target range 1.50-1.75% versus 0.75-1.00%: +75 bp | +300 / 0 / +300 | [June action](https://www.federalreserve.gov/newsevents/pressreleases/monetary20220615a.htm), [previous May action](https://www.federalreserve.gov/newsevents/pressreleases/monetary20220504a.htm). Normalized action +75. |
| Fed, September 18, 2024 | Target range 4.75-5.00% versus 5.25-5.50%: -50 bp | 0 / -200 / -200 | [September action](https://www.federalreserve.gov/newsevents/pressreleases/monetary20240918a.htm), [previous July decision](https://www.federalreserve.gov/newsevents/pressreleases/monetary20240731a.htm). Normalized action -50. |
| Fed, January 29, 2025 | Target range unchanged at 4.25-4.50%: 0 bp | 0 / 0 / 0 | [January hold](https://www.federalreserve.gov/newsevents/pressreleases/monetary20250129a.htm), [previous December action](https://www.federalreserve.gov/newsevents/pressreleases/monetary20241218a.htm). Replaces the previous cut with zero current action direction. |

Archive qualification: April 2020's jobs page reports corrections after the original May 8 release. Treat that row as a corrected-archive stress case, not a recovered original-time result. Its extremely negative employment inputs remain Extreme despite rounding. Earnings growth is derived and rounded to one decimal from hourly levels 30.01 / 28.67 for April and 28.67 / 28.52 for March. July 2024's June earnings growth is similarly rounded from 34.99 / 34.88. These derivations replace a missing growth input; they do not add votes.

The user's latest NFP screenshot supplies an example configuration of 100 / 200 / 300 thousand, with Extreme above 300 thousand capped at 4. Recalculating July 2024 with those NFP boundaries, keeping the other audit boundaries, gives 0 / -130 / -130 instead of -190. Direction stays weakening. April 2020 stays +40 / -360 / -320. The difference reinforces why audit bands must never silently replace production settings.

June 2024 manufacturing is a material semantic divergence: the official headline fell from 48.7 to 48.5, so H1 gives -100, while the custom demand R1 gives +100. R1 interprets the chosen orders/production evidence, not the direction of the published composite. Neither score proves manufacturing was already expanding. If a product must interpret only the headline, use the named H1 profile and accept its different question; do not display the R1 result as a rising official PMI.

An external economic cross-check, the [Fed's July 2024 Monetary Policy Report](https://www.federalreserve.gov/monetarypolicy/2024-07-mpr-summary.htm), describes easing inflation that remains above target and moderating GDP growth with still-solid domestic demand. This supports the distinction between changing momentum and absolute conditions. It is a broader-period interpretation, not independent USD labels for each ledger row, and is not a scoring input.

### User exemplars and complete contribution examples

Preserve the user's CPI categories instead of reclassifying them with audit boundaries. Entries below are direction multiplied by magnitude, in the common inflation order.

| CPI exemplar | Signed magnitudes | Raw contributions | B / E / S | Primary explanation |
|---|---|---|---|---|
| March | -1 / 0 / +1 / 0 | -50 / 0 / +15 / 0 | +15 / -50 / -35 | Slower core inflation outweighs faster headline inflation. |
| June | -2 / +1 / -1 / +3 | -100 / +20 / -15 / +45 | +65 / -115 / -50 | Slower monthly inflation outweighs higher annual inflation. |
| July | -2 / -3 / -4 / -4 | -100 / -60 / -60 / -60 | 0 / -280 / -280 | Monthly and annual inflation both slowed. |

Using AUDIT-BANDS-R1 solely to demonstrate the user's unconfigured March PCE/PPI examples:

- PCE deltas 0 / +0.1 / -0.1 / -0.1 pp produce 0 / +15 / -20 / -15 points: supportive +15, negative -35, net -20. Slower headline inflation outweighs higher annual core inflation.
- PPI deltas -0.3 / +0.3 / +0.2 / +0.5 pp produce -80 / +30 / +30 / +30: supportive +90, negative -80, net +10. Headline and annual increases narrowly outweigh slower monthly core inflation.
- Those dates measure January PCE versus February CPI/PPI, as documented earlier. They cannot be combined as three same-month reports. Their directions also depend on weights/bands; see sensitivity below.

### Historical inflation relationship and publication order

April 2024 has conflicting consumer and producer evidence under the audit settings. Normalized CPI = -30, PCE = -12.5 and PPI = +60.

| As-of event | Consumer anchor | Relationship consequence |
|---|---|---|
| May 14: April PPI arrives | Latest selected consumer month is still March | New April PPI is not same-period evidence for a March anchor. The selected PPI allocation is unavailable, not a substituted +60 vote against March consumers. |
| May 15: April CPI arrives | April CPI | Same-month I = 0.9(-30) + 0.1(60) = -21; supportive +6, negative -27. |
| May 31: April PCE arrives | April PCE replaces April CPI | I = 0.9(-12.5) + 0.1(60) = -5.25; supportive +6, negative -11.25. CPI is comparison/history, not another negative vote. |
| Later CPI covers a newer month than PCE | Newer-month CPI | The selector returns to CPI for that newer month; publication availability and freshness still apply. |

The first three rows use the linked April releases in the ledger. The final row describes the rule, not a newly audited historical release. Both matched April combinations lean weakening, but the preferred anchor changes the strength. With PPI shares 0% / 10% / 20%, April CPI combinations are -30 / -21 / -12; April PCE combinations are -12.5 / -5.25 / +2. The latter flips at 20%, so the relationship itself needs a weighting-sensitivity flag. The zero-PPI alternative gives a simpler consumer-only reading; 10% remains the recommended limited modifier, not a source-estimated independent effect.

On June 15, 2022, selected CPI/PPI/Fed evidence provides another worked relationship: May CPI +12.5 and same-month PPI +23.75 yield I = +13.625. The +75 bp action gives F = +75. With only inflation and policy selected, normalize 35:20 to 7:4: overall net = (7/11)(13.625) + (4/11)(75) = +35.9432, supportive +42.3864 and negative -6.4432. May PCE was not published until June 30 and is excluded at this as-of time. This is a selected-evidence example, not a complete historical USD aggregate.

### Fully assembled relationship example

The following is synthetic: all slots are assumed timely and complete, and CPI/PPI are assumed to cover the same month. It tests arithmetic and opposing categories, not a real historical combination.

- Consumer CPI uses the June user signed magnitudes: normalized supportive +16.25, negative -28.75, net -12.5.
- Same-month PPI has raw +90 / -80, normalized +22.5 / -20, net +2.5. Inflation therefore has +16.875 / -27.875, net -11.
- Jobs has signed magnitudes -1 / -2 / +1: raw -60 / -60 / +10, normalized +2.5 / -30, net -27.5. Claims has raw +70 / -30, normalized +17.5 / -7.5, net +10. Labor therefore has +5.5 / -25.5, net -20.
- Activity slots are GDP -25, retail +25, services +25 and manufacturing -25, each internally one-sided. Activity has +10 / -15, net -5.
- Fed hikes 25 bp: normalized +25 / 0.

| Category | Supportive | Negative | Net | Overall budget |
|---|---:|---:|---:|---:|
| Inflation | +16.875 | -27.875 | -11 | 35% |
| Labor | +5.5 | -25.5 | -20 | 30% |
| Activity | +10 | -15 | -5 | 15% |
| Fed action | +25 | 0 | +25 | 20% |
| Overall weighted evidence | +14.05625 | -19.65625 | -5.6 | 100% |

Expected primary output:

> USD Weakening — slight
>
> Supportive evidence +14.06 | Negative evidence -19.66
>
> Slower inflation and weaker labor evidence outweigh the rate hike.

Summing only positive and negative category nets would conceal the supportive inflation/labor evidence inside those negative categories. Preserving leaves produces the displayed totals.

### Weight and boundary sensitivity

Alternative sets are deliberate priority tests, not estimated confidence intervals. They were not chosen to force preferred answers. For inflation, use the common input order; other rows follow their standalone order.

| Profile | Preferred weights first, followed by alternatives |
|---|---|
| CPI | 50/20/15/15; 45/20/20/15; 60/15/15/10; 50/30/10/10; 40/25/10/25 |
| PCE | 50/15/20/15; 50/20/15/15; 45/20/20/15; 50/25/15/10 |
| PPI | 40/15/30/15; 50/20/15/15; 35/15/35/15; 40/20/25/15 |
| Jobs | 60/30/10; 50/30/20; 50/40/10 |
| Claims | 70/30; 60/40; 80/20; 50/50 |
| ISM demand | 60/40; 50/50; 70/30; 40/60 |
| GDP / retail | One 100-weight input; weight variation has no effect |

CPI's 50/30/10/10 was previously considered but not chosen. The 40/25/10/25 variant deliberately reduces monthly priority to 50%; it tests whether the preference for recent momentum matters. Claims 50/50 and ISM 40/60 likewise test the chosen priority rather than masquerading as equivalent policies.

With deltas/bands fixed:

| Case | Net scores, in its profile's listed weight order | Finding |
|---|---|---|
| User March CPI | -35 / -25 / -45 / -40 / -30 | Weakening throughout |
| User June CPI | -50 / -45 / -90 / -50 / +10 | Flips when monthly priority is reduced |
| User July CPI | -280 / -290 / -265 / -270 / -295 | Weakening throughout |
| Public May 2022 CPI | +50 / +70 / +50 / 0 / +40 | Reaches an exact tie |
| Public June 2023 PPI | +15 / -40 / +30 / -10 | Flips under more core/annual emphasis |
| Public October 2026 claims | +40 / +20 / +60 / 0 | Reaches a tie at equal weights |
| Public June 2024 manufacturing demand | +100 / +50 / +150 / 0 | Reaches a tie at 40/60 |
| User March PCE, audit bands | -20 / -10 / -15 / 0 | Reaches a tie |
| User March PPI, audit bands | +10 / -15 / +25 / +15 | Flips |

For the 20 public non-Fed cases, 16 preserve direction across the listed weight sets; four reach zero or flip. This count describes only this selected sample, not a success rate.

Boundary test: for each series separately, multiply its three audit thresholds together by 0.9, 1.0 or 1.1. Enumerate all combinations (81 for a four-input inflation release), leaving delta, weight and the multiplier cap fixed. At preferred weights, none of the 20 public cases changes sign. Scores and strength can change: April 2024 CPI spans -205 to -120; July 2024 jobs spans -230 to -190. The user PCE/PPI March examples also keep their signs under this boundary-only test. This narrow result does not validate the user's different production bands.

Joint weight/boundary testing is more revealing. May 2022 CPI spans -30 to +85, June 2023 PPI -40 to +30, October 2026 claims 0 to +60 and June 2024 manufacturing 0 to +220. The user March PCE spans -55 to +25 and PPI -15 to +75. The other 16 public cases retain their directions in the tested joint alternatives. User CPI exemplars use their supplied signed magnitudes, so only their weights were varied; no unavailable original boundaries were guessed.

Relationship sensitivity, using the synthetic assembled example:

- Jobs share 60% / 80% / 90% gives labor -12.5 / -20 / -23.75: weakening throughout.
- GDP share 30% / 50% / 70%, distributing the remainder among retail/services/manufacturing in 2:2:1, gives activity +3 / -5 / -13: the activity direction changes.
- Overall budgets inflation/labor/activity/Fed of 35/30/15/20, 30/30/15/25 and 40/30/20/10 give -5.6 / -3.8 / -8.9 with category scores fixed: weakening throughout.
- For close category opposition I=+25, L=-25, G=0 and F=0, those same budgets give +1.25 / 0 / +2.5. Overall weighting can determine a close result even when every standalone result is unchanged.
- The historical April PCE/PPI relationship flips at the tested 20% PPI share, as shown above. A sensitivity warning must therefore propagate from a selected family or relationship into the aggregate when recalculating that aggregate actually changes its direction.

Use the preferred result for the primary direction. Keep one brief sensitivity flag when the registered alternatives change or erase that direction; detailed variants remain optional. A different policy direction is not missing evidence. The partial-data interval and weighting-sensitivity flag answer separate questions.

### Scenario and mathematical checks

In-memory calculations enumerated 20,592 signed-magnitude states across the eight fixed-weight arithmetic profiles, including both ISM sectors through their shared profile. They verified supportive plus negative equals net, sign symmetry and raw/normalized bounds. Boundary equality and the next precision increment were checked for each registered audit threshold. The 22 non-Fed public/user-example outputs were reconciled with independently specified expected totals; Fed zero, positive, negative, capped and unusual increments were also checked. These are design-arithmetic checks, not application tests.

| Required scenario | Expected result / reason |
|---|---|
| All inputs support / all oppose, at Extreme | Raw +400 / -400; normalized +100 / -100. Overall nonnegative coefficients preserve the sign. |
| Very large versus even larger outlier | Both contribute weight x 4 once Extreme. The existing cap prevents unbounded dominance; no extra outlier treatment. |
| Higher initial claims or unemployment | Their contributions become more negative. Lower values reverse the contribution sign. |
| Supportive direction increases while others are fixed | Its contribution cannot decrease; it changes monotonically through 0/1/2/3/4 and then stays capped. |
| High inflation unchanged | Zero momentum vote, even if the level remains above target. |
| Inflation falls from +0.4% to +0.2% | Slower price increases, not falling consumer prices. |
| NFP rises from -200k to -100k | Positive hiring-momentum contribution: smaller job losses, not 100k jobs created. |
| New Orders rises from 45 to 48 | Positive momentum: contraction becomes less widespread; not expansion above 50. |
| Falling payroll growth and rising unemployment, both Small; wages Extreme higher | Jobs -60 -30 +40 = -50. Composition-sensitive wages cannot overturn both direct labor signals. |
| Unemployment falls while participation falls | Score the measured rate decrease at its assigned weight, combine payroll evidence, and explain participation when material. No unverified inference that everyone found work and no discretionary sign override. |
| Supplier-delivery delays rise while demand/activity fall | Preferred ISM score uses demand/activity only; delivery delays do not add a positive vote. |
| GDP estimate raised 1.3% to 1.6%, prior quarter 3.0% | Standalone revision +0.3 pp gives +100; overall momentum -1.4 pp gives -300. Replacement can preserve an overall negative direction despite a positive revision. |
| CPI known core contributions -280; both headline inputs missing | Raw uncertainty 120; interval [-400,-160]. Weakening survives every allowed completion. |
| CPI core m/m missing; known other contributions -70 | Raw uncertainty 200; interval [-270,+130]. Insufficient evidence, not weakening by pretending core is zero. |
| Fully observed exact cancellation | Evidence balanced; no fabricated tie-break. |
| Add excluded index/NSA representations | No new registered scored input or budget. Scores are invariant by the identity/deduplication contract. Feed-level identity mapping is still unverified. |
| New weekly claims / GDP revised estimate | Replace the existing family slot; do not add an extra weekly/revision vote. |
| H=-10/0/+10 against cut25/hold/hike25 | Negative H stays weakening, zero H follows action or balances on hold, positive H stays strengthening. Near-opposition H=+4 with cut25 is -1; H=-4 with hike25 is +1; H=+5 with cut25 or H=-5 with hike25 balances. |
| Earlier hike followed by hold | Latest action becomes zero; macro evidence still supplies its own direction. |
| Newer incomplete consumer report | Keep the newer-period slot and its uncertainty; do not silently prefer older complete evidence. |
| Published after selected as-of time | Excluded, even if now present in an archive. |
| Correction arrives later | Update current vintage after that time; preserve earlier snapshot if recoverable. |
| Publisher postpones next release | Use the revised announced schedule available then, not the abandoned due date. |
| Missed update and grace 0/24/72 hours | During the added grace the previous slot may remain eligible. After expiry it is unavailable, so a result can change to insufficient evidence instead of inheriting stale certainty. Unknown schedules cannot support a current freshness claim. |
| Intentionally unselected category versus selected missing category | First changes the scope and normalizes chosen budgets; second retains its budget as uncertainty. |

Missing-input interval containment was checked against every permitted -4 through +4 completion for the varied missing weight. Leaf-weighted supportive/negative totals matched the assembled category calculation. Period-order fixtures checked newer CPI, same-month PCE preference and mismatched PPI. Timing/replacement rows above are explicit scenario requirements; no application's scheduler, feed, history store or deduplication code was inspected or tested.

### Recommendation and remaining evidence gaps

Recommend R1 as the **complete reviewable candidate**, preserving CPI V5 and the existing magnitude cap. It supplies a deterministic standalone direction for every included family and an explicit relationship rule for the USD aggregate. Exact ties and genuinely unavailable evidence remain explicit exceptions; ordinary disagreement produces the larger-evidence direction.

The source-supported parts are measurement definitions, core/target distinctions, adjusted short-term comparisons, shared inflation inputs, labor composition, policy transmission and the need to respect periods/vintages. The exact weights, PPI modifier, category shares, Fed scale, strength labels, audit boundaries and freshness grace remain numerical/operational policies. The targeted evaluation identifies their consequences; it does not establish their optimality.

Completed design deliverables: standalone formulas; source rationale; current selection/replacement rules; hold/hike/cut opposition; shared-input budgeting; missing-data intervals; worked release/category/overall outputs; public-case audit; parameter sensitivity; data requirements and concise output contract. Application implementation remains deferred.

Remaining empirical/implementation work, outside this document-only goal:

1. Evaluate the actual user magnitude configurations on a representative chronological dataset with original vintages. No repository or private history was accessed.
2. Freeze candidate rules before a later-release evaluation; obtain independent economic labels for a meaningful benchmark. The selected public audit and broader Fed cross-check cannot supply a numerical USD-interpretation accuracy claim.
3. Confirm feed availability and identities, especially ISM subindexes, revised Previous, GDP periods, schedules and correction timestamps. This can require feed additions; missing data must use the specified unavailable treatment.
4. Review weighting-sensitive cases before adopting R1 as an implementation default. Future currencies require their own sources/profiles and central-bank relationships; this USD design is not automatically transferable.

The end product can accomplish the user's stated task: read a selected release or the selected current USD evidence without personally comparing the raw numbers, see strengthening/weakening plus both evidence totals, and read one short reason. Its defensibility comes from clear supported measurement/interpretation rules, explicit numerical policies and visible evaluation—not from pretending sources endorse every coefficient.

## Repository implementation recommendation — 2026-10-09

Repository inspection is now authorized. No application code or Git branch was changed in this review. R1 is ready to begin as a separate model in the existing terminal; a complete default replacement remains conditional on feed-fit checks and stored-history replay.

Recommended route: a new branch, proposed name **codex/usd-scoring-r1**, plus a parallel R1 view in the existing app. A branch isolates development history; a separate model/view isolates formulas and saved settings. Preserve the existing models for comparison during development. Retirement is a later migration decision, not a prerequisite for building R1.

### Surfaces and ownership

| Area | Recommended change |
|---|---|
| Shared calculations | Add versioned R1 USD profiles, arithmetic, eligibility and relationships inside the existing scoring-system module. Reuse suitable input/history/worker infrastructure, not older interpretation formulas. |
| Inspector selector | Table only; Scoring system — existing family/version; Scoring system — R1; Scatter Plot. Extend the current selector and saved-view normalization rather than creating another dock. Preserve EUR behavior; R1 excludes speeches. |
| R1 result | Lead with this release's direction, strength, two evidence totals and one reason. A separately labeled expandable relationship section shows USD evidence as of this publication, using the same R1 engine. |
| Scatter | Keep Raw A-P and existing Scorer comparison. Add R1 comparison, whose deltas and contributions come from the exact R1 assessment. If an R1 net-score plot is added, label evidence-point units; do not classify the already-weighted net with raw-input bands or add it as another vote. |
| Magnitudes/settings | Read compatible saved raw A-P bands for the corresponding R1 comparison and retain the Extreme x4 cap. Keep legacy derived-signal calibration independent. R1 profile/settings versions must be workspace-portable. |
| Roofs | Preserve existing chart relationships and View Details initially. Implement R1 relationships inside R1 first; later Roofs can render the same versioned R1 snapshots instead of introducing another relationship formula. |
| Raycaster/Candy | Keep existing experimental outputs separate from R1. Candy remains a visualization, not another vote. A future migration must consume R1 snapshots consistently across both surfaces. |

### Repository findings that affect implementation

- Calculations are already centralized in frontend/src/scoring-system/; Inspector bindings, Scatter bindings and settings are explicit integration points. A new app or broad folder rewrite is unnecessary.
- The current CPI engine compares monthly rates with recent three-month averages and also scores a moving trend. It is not CPI V5's four literal A-P inputs. Current Claims v3 likewise has its own weekly/trend assessments and settings. R1 requires separate profiles, not renamed legacy results.
- Raw A-P bands and legacy scoring-signal bands are different stores. Some raw bands can be Undefined; browser-local saved values were not read. Undefined nonzero R1 magnitudes must remain unavailable until a versioned configuration is supplied. The illustrative AUDIT-BANDS-R1 must not become production defaults.
- Revised Previous, reference periods, release clocks, revision numbers and optional exact scaled values exist in the numerical event contract. Map them carefully; a legacy raw plot's supplied Previous can differ from R1's revised-prior comparison. Scatter parity must include that distinction.
- Services New Orders and Business Activity are mapped. Manufacturing New Orders is mapped, but Manufacturing Production is absent from the inspected event catalog/family mapping; the existing documentation also records it as unavailable. Implement the specified partial-data treatment unless a real Production source is added. Do not substitute employment/prices or silently make New Orders weight 100.
- Existing upcoming-calendar infrastructure needs to be checked against R1's verified schedule/as-of requirements. The numeric event contract alone does not establish publisher-schedule provenance or recover overwritten original correction vintages. Current aggregate readiness depends on those adapters.
- Existing Roofs/Raycaster use older publication assessments, including Claims v2 while Inspector uses Claims v3. Switching a global scorer binding would therefore change several surfaces unintentionally.
- Inspector preferences currently normalize multiple historical scoring choices into one scoring view; adding R1 requires explicit persistence and workspace-import/export support.

### Build order and acceptance

1. Implement R1's pure engine and data/settings contracts, then CPI end to end in Inspector and Scatter. Verify the agreed three exemplars, exact boundaries/zero, revised Previous, duplicate exclusions, missing-input intervals and worker/Scatter parity.
2. Extend the same engine to PCE/PPI, jobs/claims, GDP/retail/ISM and numerical Fed actions. Replay stored publications with the actual versioned magnitude settings, documenting unavailable inputs and original-vintage limitations.
3. Implement category relationships and the overall USD view at explicit as-of clocks, including reference-month selection, replacement, freshness and all hold/hike/cut opposition cases. Preserve signed leaves through every layer.
4. Run affected frontend suites sequentially, lint/build and assembled-terminal checks. Keep historical calculations in background/cached work; viewport interactions must not trigger rescoring. Visual review remains with the user.
5. Decide whether to make R1 the default and whether to migrate or retire older UI only after parity, replay and integration checks. R1's clearer fit to the requested A-P interpretation does not itself prove superior empirical accuracy.

The older active objective/temporary implementation plan describe the preceding standalone-development scope. Update that active handoff when R1 implementation starts, retaining the historical reports and documenting the new version boundaries. The subsequent user clarification below supersedes preservation-only restrictions on existing application components for the USD overhaul.

## User clarification and pre-overhaul baseline — 2026-10-09

- The user grants implementation discretion across the repository for the USD overhaul: reuse, redesign, invent or remove existing application components as appropriate. Preserving all older scoring surfaces is an initial migration recommendation, not a user-imposed requirement. USD remains the scoring scope.
- ISM services and manufacturing may be ungrouped into separate releases/selections and standalone assessments. Their relationship is then determined by R1's explicit activity budgets rather than compulsory grouping in the existing interface.
- The user's word measure refers to Scatter Plot's **Calculation** selector. Add or redesign calculation choices there as needed, including CPI/R1 comparisons; no separate Measure selector is required.
- Existing magnitude bands and the Extreme x4 cap remain established inputs. Changes must have a documented reason rather than treating outliers as an unsolved problem.
- The assistant has no outstanding clarification questions before starting staged implementation. Feed-fit checks and stored-history verification are implementation responsibilities, not a request for the user to design the formulas.
- Current instruction: commit the existing repository state and this design note as a baseline, then stop. Do not ungroup ISM, change calculations or start the overhaul in this turn. The user will provide the implementation goal separately.
- The proposed implementation branch remains **codex/usd-scoring-r1**; create it when implementation starts. This baseline is committed on the current branch before overhaul work.

## USD R1 implementation record — 10 October 2026

The user resumed autonomous implementation. Baseline `93a6ecd` is preserved;
work is on `codex/usd-scoring-r1`. Implementation and terminal verification are
complete; visual/browser performance review remains with the user.

- `frontend/src/scoring-system/r1/` now owns all ten standalone profiles,
  category/overall relationships, signed evidence leaves, uncertainty intervals,
  weight/boundary sensitivity, separate 0/24/72-hour timing sensitivity, settings
  and background history/publication workers. Inspector and Scatter consume the
  same extractor and assessor.
- Inspector has a separate USD R1 choice, raw release evidence totals and an
  fully visible normalized relationship result. Settings have an R1 model choice;
  calibration overrides and selected relationship families are workspace-portable.
  Inspector filters further restrict relationship scope. Scatter's Calculation
  selector adds USD R1 comparison. Manufacturing/services display separately.
- Compatible saved raw A−P bands are inherited without mutation. Separately
  versioned R1 automatic fallback uses earlier absolute nonzero delta quantiles
  50/80/95%, requiring 60 earlier usable comparisons; ties coalesce. Manual R1
  overrides take priority. GDP revisions have separate bands. Existing legacy
  automatic policies and the user's Extreme x4 cap remain unchanged.
- The Fed feed supplies one target-rate quote, not verified lower/upper bounds.
  Score that quote's change; do not fabricate a range midpoint. The same bounded
  25 bp step formula applies. Range-bound adapters require explicit provenance.
- Storage exposes only planned dates actually captured before the chosen clock.
  Known postponements supersede prior dates; actual publications never fabricate
  earlier schedule announcements. New planned observations invalidate storage
  revision caches even if a higher-priority current payload is retained. A stale
  service explicitly requests a restart instead of silently dropping provenance.
- The [stored-history audit](reports/USD-R1-stored-history-audit.md) replays 1,828
  publications under the versioned automatic fallback. Component outputs match
  Inspector arithmetic and the production-built history worker. This is a
  stored-inventory arithmetic/sensitivity audit, not original-vintage or FX-price
  accuracy validation. The current feed lacks manufacturing Production; its 40%
  uncertainty remains visible rather than being filled with another index.
- Golden tests reconcile March/June/July CPI, the full signed-leaf relationship
  example (+14.05625 / -19.65625 / -5.6), Fed opposition and cancellation
  thresholds, quarterly revisions, inverse claims direction, million/thousand
  conversion, exact decimal boundaries, missing coverage and the magnitude cap.
  Mounted tests cover corrected readings, stable polling, hidden-worker cleanup,
  settings portability and Scatter parity. The assembled terminal verifies R1
  does no new scoring work on pan/hover/clock updates.
- Storage's 29 tests and all 69 sequential frontend suites pass; lint and
  production build pass. Existing menu/grouping assertions reflect the authorized
  R1 option and separate ISM publications. A final large-finite-delta regression
  confirms that decimal conversion cannot turn an Extreme change into zero.
  The existing bundle-size warning remains. No automated visual audit was used.
- A read-only local provenance check found 42,738 USD observations, including
  3,773 planned observations. It found no value IDs with differing nonnull Actual,
  Previous or Revised Previous values in the present archive. This does not prove
  original publication availability. Synthetic/versioned source tests cover
  correction timing and preservation. The local storage HTTP service was not
  running during this check; integration verification used isolated test services.
- An existing activity work-count test intermittently counted Vite's own
  asynchronous timestamp logger. Its instrumentation now isolates the application's
  UTC formatter, with an explicit unrelated-logger regression; production Activity
  code is unchanged.

The source adapter now exposes captured observation versions only on R1 queries,
with an explicit adapter version and stable serialized metadata across polls.
R1 preserves the earliest recoverable release snapshot. Later corrected values
replace current family slots only at their capture clock; capture time is not
claimed to be the publisher's correction timestamp. Late first captures remain
retrospective/unverified, rather than manufactured original-time proof. Automatic
historical calibration uses the preserved release comparisons so later corrections
do not rewrite old release scores.

The read-only SQLite replay includes 59 mapped planned observations. Three real
aggregate snapshots match future-removal and the production R1 worker. On October
8 at 12:30 UTC, the default automatic profile gives +16.7 supportive / -11.45
negative / +5.25 normalized net: slight USD-strengthening evidence, with 99.4%
coverage. October 1 remains insufficient because no then-known schedule was
captured. These are stored-information results, not original-vintage validation.
Scatter calculation switches preserve selection, history mode and axis viewport
while inactive calculation panels unmount and stop expensive work.

Remaining manual review: Inspector result/relationship layout, R1 settings,
Scatter controls/appearance and browser interaction performance. Start/restart
calendar storage to load the versioned R1 adapter. Roofs/Raycaster/Candy remain
separate legacy models for this migration. Missing manufacturing Production and
original vintages absent from the archive remain data limitations, with the
specified uncertainty/audit treatment implemented.

User UI refinement, 10 October 2026: R1 no longer uses expandable sections.
Direction leads, followed by an EVIDENCE / strength box; totals and the short
reason share the next row. Input weights are visible in the release table.
Release evidence, input audit, relationships and relationship audit use one
scrolling panel. The static "This release" heading is removed; Scoring settings
sits immediately left of the Inspector view selector. Scoring rules are unchanged.

Scatter magnitude editing, 10 October 2026: USD R1 comparison now provides
chart-only boundary previews, Apply and Reset to inherited calibration. Apply
updates the shared R1 override used by Inspector and Fundamental Settings;
Reset removes only that override, preserving compatible saved raw A−P bands.
GDP revision and quarter-momentum calibration remain separate. Fed actions keep
their fixed 25 bp rule. Preview edits do not launch history workers. Freshness
rules are unchanged; browser layout/interaction review remains with the user.
Verification: all 69 frontend suites, lint and production build pass, including
mounted preview/Apply/Reset propagation, preservation of inherited raw settings,
revision-stage isolation and zero worker launches during boundary previews.

## Accepted freshness refinement, 10 October 2026

Policy `r1-scheduled-or-age-v1` supersedes the original strict-schedule gate.
If the next comparable release schedule was captured by the selected clock,
expiry is that date plus the configured allowance (default 24 hours). Known
postponements supersede earlier dates. Otherwise use publication time plus a
bounded family age: Claims 10 days; CPI, PCE, PPI, Jobs, GDP, Retail and both ISMs
45 days; Fed action 70 days. The fallback is an expiry limit, never a guessed
publisher release date. Known schedules take priority even when that means
earlier expiry. At expiry the report remains current; after it, the assigned
uncertainty returns. A new report replaces the old slot, including an incomplete
new report. Storage corrections do not restart publication age. Standalone
publication scoring and the inflation reference-month/overlap rules are unchanged.

The read-only archive has Claims P99 gaps of 8 days, monthly/GDP-estimate P95
gaps up to 39, and Fed P95/P99 gaps of 56. The selected defaults allow bounded
delay rather than stretching to the largest missing-history gaps. They are
fixed operational policies, not uniquely optimal limits or runtime predictions;
GDP has repeated estimates within a quarter. See the
[freshness replay](reports/USD-R1-freshness-audit.md) for counts, September CPI
capture evidence, sensitivity and production-worker parity. The original strict
schedule replay remains historical evidence.

Fundamental Settings exposes all family age limits and the shared scheduled
allowance, with draft/Apply/Reset. Old version-1 settings inherit these defaults
without losing magnitude overrides or selected families; new fields are workspace
portable. Relationship audit plainly shows Current/Expired/Unavailable, the
applied rule, publication date, next due date when known and expiry, formatted in
the selected display timezone. Separate columns show age in completed 24-hour
days at the selected publication clock and each family's configured fallback
limit, including when a known schedule takes priority; Status follows the dates.
Timing sensitivity tests scheduled grace at 0/72
hours and fallback ages at 80%/120% of the configured windows; results never
silently replace the preferred settings. Pan, hover and display clocks do not
recalculate evidence.

Verification: all 69 frontend suites, lint and build pass. The read-only replay
checks four aggregate clocks, all 1,828 publication expiry boundaries, removal
of future inputs and production-worker parity. Mounted checks cover rule/expiry
display, timezone changes without jobs, old settings compatibility, validated
Apply/Reset, workspace portability and then-known schedule updates. Browser
layout and interaction review remain with the user.


## Accepted Claims fractional refinement — R1.1

The user accepted fractional magnitude after reviewing the October 8 Claims conflict. This supersedes Claims' integer-only multiplier policy above; CPI V5 and other families remain unchanged.

- Retain initial/continuing weights **70/30** provisionally; keep **60/40** as a separately evaluated challenger.
- Retain each series' existing boundary precedence, automatic calibration, revised-prior comparison and native-unit conversion.
- Let x = absolute A−P. Interpolate points linearly through **(0,0), (Small boundary,1), (Medium boundary,2), (Large boundary,4)**; larger values stay at **4**. This removes the one-point floor and preserves differences within bands.
- Keep Small/Medium/Large/Extreme labels based on the existing intervals. Show fractional points with the size in Inspector and Scatter. Tied automatic limits skip zero-width spans with lower-band equality; continuity applies to strictly increasing boundaries.
- Contribution remains weight × polarity × sign(A−P) × points. Keep points unrounded until weighting, then use existing contribution/balance precision so mathematical cancellation cannot become a false lead. Relationships divide by four and consume one Claims slot; four-week trends never add another vote. Missing inputs retain their full uncertainty budget.
- October 8 with automatic limits: initial −2k / Small 10k gives +0.20 points ×70 = **+14**; continuing +17k / Small 26k gives −0.653846… ×30 = **−19.62**; net **−5.62**, USD Weakening with slight evidence. Both remain labelled Small.

The [DOL technical notes](https://www.dol.gov/sites/dolgov/files/OPA/newsreleases/ui-claims/20222224b.pdf) support the separate economic roles and initial claims as an emerging-conditions indicator. They do not prescribe the exact weights or interpolation. These are explicit design policies. The refinement is justified by preserving relative size rather than fitting the October price move.

The reproducible [Claims fractional review](reports/Claims-R1-fractional-audit.md) records the full replay, every changed complete direction, 60/40 sensitivity and worker/Scatter parity. Earlier integer-band and V3 reports remain historical evidence.

## Accepted Manufacturing New Orders refinement — R1.1

The user authorized resolving Production, evaluating fractional magnitude and retaining a clearly named Orders-only alternative if the current feed could not supply reliable Production history. This section supersedes the implemented 60/40 missing-Production profile and earlier prohibition against making Orders weight 100 silently. The replacement is explicit, versioned and narrower.

- **Profile:** `USD-ISM-MANUFACTURING-ORDERS-R1.1`, labeled **Manufacturing new orders**; New Orders **100%**. The stored inventory and [provider catalog](https://www.mql5.com/en/economic-calendar/united-states) have no ISM Manufacturing Production series. A verified official report supplies a reading, not a connected historical feed. No new live source or inferred proxy was added. Production 40% is removed by the declared model change, never converted into measured zero or silently redistributed at runtime. Model coverage refers to Orders only.
- **Magnitude:** use the accepted Claims interpolation through (0,0), (Small,1), (Medium,2), (Large,4), capped at four. Retain Orders' saved/manual/earlier-history calibration precedence and independent band labels. Inspector, history, Scatter previews and sensitivity share the arithmetic. This fractional rule remains limited to Claims and Manufacturing New Orders.
- **Direction versus state:** A−P positive/negative supplies supportive/negative evidence. Above/below 50 supplies expansion/contraction context, not another vote. Thus improving contraction remains supportive change evidence, while softening expansion remains negative change evidence. Threshold crossings receive concise wording without a bonus or direction override. Zero change is balanced and needs no magnitude boundaries.
- **Relationships:** one normalized Orders result replaces the former incomplete manufacturing slot at the existing 10% full activity allocation. Headline PMI already contains Orders and Production; it is not added independently. It supplies publication/reference/schedule metadata only, preventing a newer report with missing Orders from reusing older Orders evidence. Employment/Prices Paid and Fed Manufacturing Production are not substitutes or additional votes. ISM Services, other family policies, freshness and legacy context remain unchanged.
- **Settings/UI:** retain the familiar Inspector/Scatter workflow and show fractional points next to band labels. Retired Production selections resolve to Orders. Existing Orders and unrelated settings survive; old Production overrides remain portable but inert. The release explanation, model version, settings and relationship audit identify the narrower scope.
- **Deferred two-input design:** the proposed 60/40, 50/50 and 70/30 Orders/Production candidates cannot be evaluated against complete eligible history while Production is absent. They remain future candidates, not failed tests. A later two-input model requires a separate source/history review and version; it must not silently expand this Orders-only profile.

[ISM's calculation methodology](https://www.ismworld.org/supply-management-news-and-reports/reports/seasonal-adjustment-factors/) supports the survey interpretation and explains headline overlap. [ISM's March 2020 discussion](https://www.ismworld.org/supply-management-news-and-reports/news-publications/inside-supply-management-magazine/blog/2020-04/rob-roundup-march-pmi/) documents supply delays cushioning the headline despite worsening activity. The [September 2026 report](https://www.ismworld.org/supply-management-news-and-reports/reports/ism-pmi-reports/pmi/september/) verifies Orders 55.3 versus 53.7 and opposing Production 56.7 versus 58.3 for the user's October 1 example. These sources justify the economic definitions and scope distinction; they do not establish optimal currency weights or interpolation.

The [manufacturing review](reports/Manufacturing-orders-R1-audit.md) records the source decision, full stored replay, isolated integer/fractional comparison, aggregate consequences, future-inventory removal and production-worker/Scatter parity. Price comparison remains user review, not a calibration objective.
