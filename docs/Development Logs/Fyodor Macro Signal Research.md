# Fyodor Macro Signal Research

**Date:** 2026-08-26
**Status:** Source models remain immutable research inputs. Charts and global Shadow Trader use `FMS-REGISTERED-REACTION-H4-v4`: 47 reconciled recipes across seven major pairs, with frozen scoring, case filter, continuation/rejection mapping, and execution contract. Historical arrows remain hindsight replay; current monitoring uses immutable first-seen observations only. Eleven marginal positive histories are explicitly labelled fragile. Nothing is an automatic order or guaranteed edge.

**AI working-memory rule:** This is the single canonical FMS research record for future AI sessions. Preserve decisions, failed trials, candidate diagnoses, and unresolved ideas here so research is not reconstructed from chat memory. Do not create a second FMS roadmap unless the user explicitly changes this rule.

## Experiment Workbench Namespace (2026-08-26)

FMS Experiment Workbench is the guarded no-code research surface. It automates repeatable calculations while leaving interpretation and Charts promotion to explicit human/AI review.

As of 2026-08-27, matching Long and Short signatures share one setup entry with separate Long, Short, and Both-direction case counts. New experiments freeze the selected underlying signatures while legacy single-signature E/C records remain readable. The builder uses `SL (ATR)`, `TP (R + ATR)`, `Maximum trade duration (H4 candles)`, `Cases included`, and `Single/Combined Contracts`; Combined Contracts are independent full-position simulations, not partial exits. Completed experiments retain a durable, paginated raw audit of included/excluded packages, A/F/P/S/M source values and score votes, Forecast Guard flags, and contract-specific price outcomes.

- `FMS-EURUSD-H4-E001`: immutable recorded experiment. Every official button-triggered run receives a new E identifier, including failures.
- `FMS-EURUSD-H4-C001`: immutable frozen review candidate referencing exactly one E record. Failed gates require explicit acknowledgement and remain visible.
- `FMS-EURUSD-H4-M001`: reserved for a future reviewed Charts model. The Lab has no promotion endpoint or control.
- Existing v1-v13 identifiers are immutable history and remain reproducible in the collapsed Research Archive.
- The current Charts model remains `FMS-EURUSD-FORECAST-GUARD-H4-v13`, displayed as `Forecast Guard · Legacy v13`, until a reviewed M model replaces it.

The first builder is deliberately guarded: one detected EURUSD directional signature, one scoring policy (Baseline, Momentum-only, or Forecast Guard), one supported cohort, and either continuation or rejection. It rejects arbitrary title expressions and unrestricted intersections. Entry and historical partitions remain fixed. A single-contract run tests one declared stop/target/expiry; a controlled matrix tests selected values from the existing fixed grids and selects only with development lower-95 expectancy followed by development average. Holdout and recent data remain audits.

Experiment and candidate rows persist configuration/catalog snapshots, hashes, dataset fingerprints, status, results or errors, and parent references in SQLite. Opening the Lab uses durable catalog/cache artifacts and does not launch the expensive expansion scan. Account balance and risk are presentation-only; all research remains gross with spread, commission, slippage, and swap excluded.

## Purpose

Fyodor Macro Signal is a local, research-first attempt to answer a narrow question:

> When a registered EUR or USD economic-release package produced a particular directional evidence pattern, how did EURUSD subsequently behave under one frozen H4 trade simulation?

The active research surface is named **FMS Experiment Workbench** and retains the stable internal route id `macro-signal-lab`. Its first historical version remains **FMS-EURUSD-ECO-H4-v1**.

The feature is intended to reduce manual economic-data reading and make historical behavior auditable. It is not an automatic order system, a guarantee of profit, or proof that an economic release caused a price move.

## Registered Versions

- `FMS-EURUSD-ECO-H4-v1` is the immutable Economy baseline. It uses the legacy `currency + normalized title` series identity and is permanently recorded as **No validated edge**.
- `FMS-EURUSD-LABOR-H4-v2` is the active exploratory version. It retains only registered Labor rules, identifies an exact series with `currency + country/region code + normalized title`, and initially scopes EUR to aggregate `EU` rows and USD to `US` rows.
- `FMS-EURUSD-SENTIMENT-H4-v3` is the country-aware Sentiment source model. Its full backtest is durable, but its history was inspected during model discovery and is not untouched validation evidence.
- `FMS-EURUSD-MULTI-H4-CQ-v4` is the immutable Charts qualification registry. It does not rescore releases; it admits only explicitly frozen signatures from the registered source versions.
- `FMS-EURUSD-POLICY-INFL-H4-v5` is a country-aware Policy/Inflation source model. It deduplicates exact series at exact timestamps, scores only canonical numeric Fed/ECB decisions and strict consumer/producer inflation families, and excludes qualitative policy communications from arithmetic.
- `FMS-EURUSD-MULTI-H4-CQ-v6` preserves both v4 current patterns, adds factual policy/inflation context, and exposes one failed-gate producer-inflation candidate only in hindsight Research Replay.
- `FMS-EURUSD-GROWTH-H4-v7` is a country-aware Growth source frozen before its results were inspected. It accepts aggregate EU/US GDP/output, strict PMI/ISM, industrial production, retail demand, trade balance, and current-account rows while excluding price indexes, generic regional surveys, terms of trade, duplicates, and EUR member-country rows.
- `FMS-EURUSD-MULTI-H4-CQ-v8` is an immutable interim registry created when the US-industrial-output pattern first passed the existing gates. It observed zero Current Model signals before being superseded.
- `FMS-EURUSD-MULTI-H4-CQ-v9` is the current Charts registry. It preserves v8, explicitly requires positive stressed 1R, 1.5R, and 2R target sensitivity, and begins a new Current Model boundary after that stronger gate was frozen.
- `FMS-EURUSD-MULTI-H4-CQ-v10` froze the setup registry inherited by current v13: directional Euro-area consumer sentiment, aggregate-US industrial output, exact three-group US payroll Short with `2 ATR / 1R / 6 H4`, and the complete same-time four-series US Core PPI/PPI m/m+y/y cooling package as Long with `2 ATR / 1.25R / 18 H4`.

V2 was chosen after v1's complete history and holdout were inspected. Therefore, no pre-registration v2 history is untouched validation evidence, regardless of how attractive its historical result appears.

Member-country EUR releases are not assumed irrelevant. They are excluded from v2 because mixing Euro-area, German, French, Italian, and other releases as equal EUR votes would introduce an arbitrary quantity weighting. A member-country or explicitly weighted regional model requires its own future version and validation record.

## Locked Product Decisions

- Version 1 supports EURUSD only.
- Candidates are created by economic releases, not repeatedly on every H4 candle.
- The first model uses registered **Economy** evidence only.
- Inflation and Policy remain visible research context and will be investigated as separate future models before any combined model is considered.
- Directional outputs are **Long bias**, **Short bias**, and **No direction**. They are research classifications, not executable orders.
- FMS Experiment Workbench remains the full research surface. Charts may show historically recurring v2 patterns immediately when they pass fixed development-and-holdout gates, but they must be labeled experimental and expose their audit. Forward paper results determine whether those patterns can later be called validated.
- The initial Lab will be a fixed case explorer, not an optimizer, recipe builder, or automatic leaderboard.
- Existing Pair Matrix raw data remains the audit source.

## Frozen Economy Signal Rule

One candidate is formed from each exact release-time package containing registered EUR or USD Economy events.

1. Each exact series retains the existing deterministic score from `-3` through `+3`:
   - Actual versus Forecast contributes `-1`, `0`, or `+1`.
   - Actual versus Previous contributes `-1`, `0`, or `+1`.
   - Matching nonzero directions contribute an agreement bonus of `-1` or `+1`.
2. Comparisons occur only within the same normalized exact series. Missing inputs contribute nothing and are never substituted.
3. Related exact series remain grouped and capped by the existing exclusive Pair Matrix registry.
4. Each Economy factor contributes at most one equal directional vote, preventing release quantity inside one factor from dominating the package.
5. EUR improvement points toward Long EURUSD; EUR weakening points toward Short EURUSD.
6. USD improvement points toward Short EURUSD; USD weakening points toward Long EURUSD.
7. A nonzero package majority produces a directional candidate.
8. A package containing opposing votes is labeled **Conflicted / weak** when one direction still has a majority.
9. An exact tie is **No direction**. It remains available for unsigned volatility research rather than being discarded.

Broker impact, exact title, registered family, score pattern, and Before-state alignment are analysis dimensions. They are not fitted trading weights in v1. This allows the Lab to measure which cohorts appear more consequential without feeding hindsight-derived weights back into the same test.

The **Before** economy state is recorded for aligned-versus-conflicted cohort analysis but does not filter the baseline candidate.

## Frozen Backtest Contract

- **Signal time:** exact broker release timestamp.
- **Entry:** the first EURUSD H4 candle open strictly after the release timestamp.
- **Risk distance:** one raw-price H4 ATR(14), calculated with Wilder/RMA using only candles completed before entry.
- **Targets:** separate hypothetical tracks at `1R`, `1.5R`, and `2R`; the Lab highlights `2R` without hiding the others.
- **Maximum duration:** 30 completed H4 candles, representing approximately five trading days rather than 120 wall-clock hours.
- **Overlap:** every candidate is evaluated independently, even if another hypothetical trade is still active. Overlap counts must be disclosed.
- **Intrabar ordering:** M1 candles determine whether the stop or target was reached first inside an H4 candle.
- **Unresolvable ordering:** if stop and target are both reached within the same M1 candle, the result is **Both touched — order unknown** and is not silently counted as a win or loss.
- **Expiry:** if neither boundary is reached, the trade expires at the close of its thirtieth H4 candle and retains its marked-to-market result in R.
- **Costs:** results are gross. Spread, slippage, swap, and commission are excluded and must be stated prominently wherever results appear.
- **No lookahead:** signal inputs, ATR, entry, and outcome calculations may use only information available at their respective historical timestamps.

The result contract will report:

- eligible and unevaluable sample counts;
- TP-first, SL-first, expired, and ambiguous rates;
- average and median result in R;
- uncertainty around headline rates and expectancy;
- Long- and Short-bias breakdowns;
- calendar-year and fixed-period stability;
- exact-title, family, broker-impact, score-pattern, conflict, and background-alignment cohorts;
- underlying release, candle, entry, stop, target, and outcome audit rows.

## Data and Validation Policy

- Preserve all practical broker history in durable local bridge storage.
- Treat broker-provided coverage as the boundary. Missing history must be shown honestly rather than inferred.
- Use the latest fixed ten years as the primary research window when that much coverage exists.
- Also show the latest five years, earlier five years, calendar-year slices, and full available history as robustness views.
- Never select whichever historical horizon happens to produce the most attractive result.
- Freeze `FMS-EURUSD-ECO-H4-v1` before inspecting its backtest result.
- Use a chronological development/holdout partition and store its boundary with the version.
- Give every formula revision an immutable version identifier, configuration snapshot, creation time, and dataset fingerprint.
- Record every evaluated version. Do not retain only successful experiments.
- Once a holdout has influenced a later formula, it is reused research data and must not be described as untouched.
- Later versions require forward paper validation before being described as validated. An explicitly experimental, opt-in Charts research layer may display predeclared historically qualified patterns without implying validation.

The intended status progression is:

`Research` → `Eligible for paper validation` → `Paper validated`

The paper-eligibility threshold was frozen before the first result:

- at least five years of stored EUR/USD calendar coverage;
- cached H4 prices covering the complete primary research window and ATR warm-up;
- at least 30 evaluable 2R holdout cases;
- positive 2R development expectancy;
- an approximate 95% lower confidence bound above zero for 2R holdout expectancy;
- no more than 5% ambiguous holdout outcomes.

Passing means only **Eligible for paper validation**. The forward-paper sample requirement must still be frozen before paper validation begins.

Historical MT5 calendar rows are not guaranteed vintage datasets. Broker `Previous` values may already contain revisions, and forecast availability can vary over time. These limitations must remain visible in the Lab.

## Implementation Milestones

1. **Implemented:** durable local bridge calendar storage and explicit earliest/latest coverage reporting.
2. **Implemented:** versioned backend backtest engine and reusable EURUSD H4/M1 candle cache so heavy research does not run in the Charts render path.
3. **Implemented:** separate Specialist Tools **Macro Signal Lab** with an overall model result followed by family, title, and individual-case drilldowns.
4. **Implemented:** run and audit the frozen Economy baseline without changing its formula in response to the result.
5. **Implemented:** automatic v2 forward paper-signal tracking with immutable first-seen release values, complete-cycle EA acknowledgement, late-entry exclusion, and live 1R/1.5R/2R monitoring.
6. **Implemented:** opt-in EURUSD/H4 Charts v3 with separate current/replay modes, immutable post-activation inputs, first-later-H4 activation arrows, 30-candle active state, three-pip stress, recent and year-stability gates, past-only qualification replay, and clickable source/model/data audits.
7. Research Policy, Inflation, combined pillars, D1 variants, and learned weights only as separately versioned later work.

## First Frozen Result

The first `FMS-EURUSD-ECO-H4-v1` run used durable broker coverage beginning in 2007 and produced 5,666 evaluable primary-window 2R cases across the chronological split.

- Development: 3,961 evaluable cases, `+0.024R` average.
- Holdout: 1,705 evaluable cases, `-0.036R` average and `31.7%` target-first.
- Approximate holdout expectancy interval: `-0.102R` through `+0.030R`.
- Decision: **No validated edge in frozen v1. Do not place it on Charts.**

The result is useful because it rejected the broad Economy-only hypothesis without changing the formula after seeing history. Factor behavior was unstable between development and holdout. Labor was positive in both partitions, but that observation was discovered after inspecting v1 and is therefore only an exploratory lead. It is not untouched validation evidence.

The data-quality audit also found 498 legacy `currency + title + timestamp` collisions. These were not duplicate database ingests. They were primarily EUR-denominated releases with identical titles from multiple regions—for example Euro area, Germany, France, and Italy Construction PMI rows at the same timestamp. This proves that currency and title alone are not a complete exact-series identity for a shared currency. V1 remains unchanged for reproducibility; v2 corrects the identity with `countryCode`.

The Lab's diagnostic schema now reports development and holdout separately for every cohort, records missing/unparseable source values and country/title collisions, and states the model decision in plain language. These reporting additions do not alter the immutable v1 signal or simulation.

## V2 Forward-Paper Boundary

`FMS-EURUSD-LABOR-H4-v2` was registered at `2026-08-18 09:27:32 UTC`, but the trustworthy automatic ledger begins at `2026-08-18 09:57:48 UTC`, when immutable first-seen storage and complete EA-cycle acknowledgement became available. Historical results before the ledger activation remain exploratory reused data. Only broker releases first observed by the upgraded ledger after activation can accumulate forward-paper evidence.

The ledger freezes Actual, Forecast, Previous, title, currency, country/region, impact, release timestamp, and signal package at first successful observation. Later broker revisions cannot rewrite a paper case. A failed or incomplete EA upload cycle creates no candidate. If Fyodor first observes a directional release only after its contractually required H4 entry candle has already opened, the case is retained as `late for contract` but excluded from validation rather than backdated.

The forward gate was frozen before observing any post-registration v2 outcomes:

- at least 365 elapsed calendar days;
- at least 100 evaluable forward 2R observations;
- an approximate 95% lower expectancy bound above zero;
- no more than 5% ambiguous outcomes;
- an approved transaction-cost model before any Charts promotion.

The historical Charts layer does not wait for this gate because it is explicitly an experimental research display. Passing the forward gate would permit a later product and cost-model review and is required before describing any pattern as forward validated.

## Charts Current-Qualification V3

`FMS-EURUSD-LABOR-H4-CQ-v3` was frozen on 2026-08-20. It does not rewrite Labor v2 scoring or its 2R simulation. It controls which already-defined v2 conditions may appear in Charts and when an arrow becomes active.

- The gray release dot belongs to the H4 candle containing the broker release.
- The directional arrow belongs to the first loaded H4 open strictly after that release, matching the frozen backtest entry contract.
- A current bias remains active for 30 loaded H4 candles unless a later eligible signal replaces it.
- `Research replay` retains both historically selected patterns and states that old arrows use hindsight.
- `Current model` accepts only immutable first-seen releases observed after v3 activation.
- Every current pattern must pass the original full/development/holdout gate, remain positive after subtracting a three-pip result stress in all three partitions, have at least ten recent three-year cases with positive stressed expectancy, have at least eight evaluable calendar years with at least 60% positive, and have positive stressed results among cases that would have qualified using only prior outcomes.
- Three-pip stress is a deterministic robustness scenario, not reconstructed execution. Exact historical spread, slippage, swap, and commission remain unavailable.
- A resolved target, stop, or expiry ends the current active-bias state; historical arrows remain visible for audit.
- The arrow audit exposes 1R, 1.5R, and 2R sensitivity, the gross and stressed expectancy, the simulated outcome known only afterward, and the approximate linear cost stress that would reduce historical average R to zero.

At freeze time:

- `US payroll package -> Short EURUSD` remains in the Current Model: 54 gross evaluable cases, `38.9%` gross 2R target-first, `+0.087R` overall after three-pip stress, `+0.351R` in the recent stressed window, 7 of 11 positive stressed years, and two past-only-qualified cases averaging approximately `+0.381R` after stress.
- `Euro-area unemployment -> Long EURUSD` remains visible in Research Replay but is excluded from Current Model: although its full/development/holdout stressed averages stay positive, its recent three-year stressed average is approximately `-0.037R` and its five past-only-qualified cases average approximately `-0.504R` after stress.

The payroll pattern is target-sensitive: after the same three-pip result stress its full-history average is approximately `-0.171R` at 1R, `-0.032R` at 1.5R, and `+0.087R` at 2R. Its linear historical result-stress break-even is approximately 5.7 pips per case, and its stressed 95% expectancy interval still contains zero. It must therefore be presented as a frozen 2R research hypothesis undergoing forward observation—not as a generally proven directional edge.

This v3 choice was made after examining historical results and is therefore still research, not untouched proof. The model hash freezes the gate and signature configuration; the dataset fingerprint identifies the source run used by each audit.

## Multi-Source Current Qualification V4

`FMS-EURUSD-MULTI-H4-CQ-v4` was frozen on 2026-08-20 after a fixed-factor scan of the available country-aware Economy families. The scan compared full history, chronological development/holdout, the recent three-year window, calendar-year stability, target sensitivity, three-pip result stress, and a past-only qualification audit. Activity, trade/current-account, and retail candidates were not promoted because their direction or partition behavior was unstable. Inflation and Policy were not silently forced into the Economy formula; they still require separately declared interpretations.

V4 has two Current Model patterns and one replay-only pattern:

- `US payroll package -> Short EURUSD`: 54 evaluable 2R cases, 21 target-first, 32 stop-first, one expiry, one ambiguous case, and `+0.087R` average after three-pip stress. Recent stressed average is `+0.351R`; past-only qualification has 2 cases at `+0.381R`.
- `Euro-area consumer sentiment -> directional`: Long when the exact Euro-area consumer-sentiment package scores improving and Short when it scores weakening. The combined, symmetric rule has 99 evaluable 2R cases, 40 target-first, 57 stop-first, two expiries, and `+0.133R` average after three-pip stress. Development is `+0.068R`, holdout `+0.327R`, recent `+0.523R`, 8 of 11 years are positive, and 31 past-only-qualified cases average `+0.226R` after stress.
- `Euro-area unemployment -> Long EURUSD` remains replay-only because its recent and past-only evidence weakened.

The directional sentiment rule is one family rule, not two independently selected winners: the sign of the same exact-series score determines Long or Short, and a zero score produces no direction. Forecast and Previous retain equal weight through the frozen source formula.

The Charts product introduced:

- `Long bias`, `Short bias`, or the explicit safe state `No qualified bias`.
- A current card that explains the active frozen condition, its remaining H4 model lifetime, and the matching pattern's historical 2R target-first, stop-first, and stressed-average record.
- The next loaded EUR/USD event and the next scheduled package whose titles/country scope could structurally match a frozen pattern. A scheduled package is only a **possible setup**; no direction is inferred until Actual values arrive.
- The same frozen H4 model on H1 for visual inspection. Activation stays anchored to the backtest's first strictly later H4 open, and 30 H4 candles equal 120 H1 candles. This is not an H1-native backtest because no durable H1 research cache currently exists.
- Current signals sourced only from immutable first-seen observations after the active Charts-model boundary; Research Replay remains explicitly hindsight-selected.

Both current patterns still have stressed 95% expectancy intervals that include zero, and the sentiment rule was selected after inspecting archived results. V4 is therefore an auditable research bias layer, not a validated edge, automatic order, or promise that a future case will resemble its sample.

## Policy/Inflation V5 and Charts V6

`FMS-EURUSD-POLICY-INFL-H4-v5` was frozen and run on 2026-08-20 against the durable archive. Its dataset fingerprint is `dd97595c2255d94147f6f9d7dbe353a587169f98bb069465fe60236a5c302ecd`.

The primary-window result demonstrates why Policy and Inflation cannot simply be colored and promoted:

- Direct canonical Fed/ECB decision direction was negative: 47 evaluable 2R cases averaged approximately `-0.362R`. It is rejected as an arrow rule. An unchanged rate is still displayed as Holding context, while statements, minutes, conferences, testimony, and speeches remain unscored.
- All registered Inflation packages had 784 evaluable 2R cases at approximately `+0.086R` gross, but that broad result is not a qualified pattern and would weaken after execution stress.
- USD consumer-inflation packages showed interesting gross behavior, but exact signatures failed recent or stressed-holdout checks. They are retained as research evidence rather than promoted.
- `Euro-area producer inflation heat -> Long EURUSD` had 51 evaluable cases and approximately `+0.193R` after three-pip result stress, positive development/holdout/recent stress, and nine past-only-qualified cases at approximately `+0.232R`. Only 6 of 11 evaluable years were positive, below the frozen 60% year-stability gate, so it is replay-only.

`FMS-EURUSD-MULTI-H4-CQ-v6` consequently keeps the two v4 Current Model patterns unchanged. It adds the v5 producer-inflation candidate to Research Replay with an explicit failed-gate explanation. The current card now shows the latest canonical policy action and latest inflation heating/cooling group count for EUR and USD, but this context does not filter, reverse, or strengthen an arrow.

### Post-July 2026 v6 replay-gap audit

The absence of arrows after the 6 July producer-inflation release is an honest signature result, not missing calendar data. In the 1 June through 20 August 2026 audit window, 60 scored source-model packages were evaluated, four matched the frozen replay registry, and 31 later scored packages occurred after the final matching release without matching a frozen pattern. The final matching release activated its H4 arrow on 7 July.

Later packages included weekly US claims, US and EUR consumer/producer inflation, Fed/ECB holds, payroll, employment, and sentiment. They were not converted into arrows merely to fill empty chart space. Notable examples include a 30 July mixed EUR business-plus-consumer-sentiment signature rather than the registered exact consumer-sentiment signature, and a 7 August US payroll package pointing Long rather than the qualified US-payroll Short signature.

One additional candidate was examined closely: `Long EURUSD from improving USD producer-inflation evidence`. At 2R it had 46 candidates, 45 evaluable cases, approximately `+0.106R` after three-pip stress, positive development/holdout/recent partitions, and 7 of 11 positive years. It was not registered because stressed 1R expectancy was approximately `-0.072R`, its stressed uncertainty still included no edge, and the past-only qualification audit found zero eligible observations. This is useful research evidence, but not a responsible current or replay arrow yet.

An exact-package relaxation was also tested for the qualified EUR consumer-sentiment rule: retain the consumer component when additional same-time sentiment groups are neutral or agree. It expanded the sample from 99 to 120 cases and remained positive after stress in the ordinary development, holdout, recent, 1R, 1.5R, and 2R summaries. It was rejected because the past-only stressed audit fell to approximately `-0.062R`, weaker than the exact consumer-only rule. The 30 July 2026 mixed EUR package would not qualify under this relaxation regardless: its consumer-sentiment group scored zero while only business sentiment improved.

Charts now reports the latest replay arrow and how many later scored packages failed to match the frozen registry. This makes sparse arrows auditable without weakening the rules. Release rings and connectors render as a native Lightweight Charts pane primitive so they share the candle render cycle while the chart is dragged or zoomed; both current/audit cards use a toolbar-safe vertical inset.

## Country-aware Growth V7 and Charts V9

`FMS-EURUSD-GROWTH-H4-v7` was frozen before its result was inspected. Its completed dataset fingerprint is `2e6c510fb23ce09272e398776c666120fc85ab908adf056fc2916575596b4d50`. The broad Growth baseline was rejected: 1,697 evaluable primary-window 2R cases averaged approximately `-0.011R`, with development near `-0.013R` and holdout near `-0.006R`.

The exact recurring-signature audit rejected unstable GDP, PMI, retail, and trade patterns. One signature passed every existing frozen Charts gate:

- `Improving aggregate-US industrial production/output -> Short EURUSD`.
- 55 candidates and 54 evaluable 2R cases.
- Three-pip stressed averages: overall `+0.229R`, development `+0.153R`, holdout `+0.381R`, and recent three years `+0.380R` across 16 evaluable recent cases.
- 7 of 11 evaluable years were positive.
- The past-only audit retained five evaluable cases at approximately `+0.657R` after stress.
- Stressed target sensitivity stayed positive at 1R (`+0.007R`), 1.5R (`+0.100R`), and 2R (`+0.229R`). The 1R margin is thin and the 2R stressed confidence interval still includes no edge.

The industrial-output signature initially produced immutable interim Charts v8. During its immediate audit, the target-sensitivity evidence was promoted from an audit field into an explicit model gate. The immutability guard correctly refused to alter v8, so `FMS-EURUSD-MULTI-H4-CQ-v9` was frozen with positive stressed 1R, 1.5R, and 2R required for every Current Model pattern. No Current Model signal occurred during the v8 interval.

V9 admits US-industrial-output Short and directional Euro-area consumer sentiment as its two Current Model patterns. The strengthened target-sensitivity gate moves US-payroll Short to Research Replay because its stressed 1R and 1.5R averages are negative even though its 2R result remains positive. The 18 August 2026 industrial-production release remains a hindsight Research Replay case and was historically unevaluable when frozen; it cannot be retroactively presented as a Current Model signal. Only immutable first-seen matching releases after v9 activation are Current Model eligible.

The release visualization now uses a small ring at the actual release candle plus a curved dotted connector into the first strictly later H4 activation arrow. This preserves the frozen timing contract while making the two timestamps read as one sequence.

## FMS Shadow Trader

Charts now places `FMS Shadow Trader` in the former Current Model card position. It is a decision-and-audit simulator, not an execution system:

- Current Model alone determines whether the card says hypothetical Long EURUSD, hypothetical Short EURUSD, or No trade.
- The idle state says that it is waiting for a frozen setup and shows the next scheduled registered setup when one is available. Direction is withheld until Actual arrives; missing, zero, or nonmatching evidence remains No trade.
- The default hypothetical account is `$1,000` risking `0.5%` of current balance per accepted setup. Both values are user-configurable and local to Charts.
- Starting balance accepts `$1` or more and risk accepts `0.01%` through `100%`; these wider controls are for hypothetical stress testing, not a risk recommendation.
- The replay allows one position at a time, uses the frozen first strictly later H4 entry, 1x H4 ATR(14) stop, current 2R target, 30-H4 expiry, and sequential balance compounding. Later overlapping signals are skipped until the open simulation resolves.
- The bridge exposes each signal's frozen entry, ATR, stop, and target so the card can show the hypothetical risk amount, stop distance, and EURUSD lot calculation without reconstructing execution geometry in React.
- The historical account uses only patterns eligible for the current v9 registry, but it remains explicitly labeled hindsight Research Replay. It does not leak historical arrows into Current Model.
- Results are gross. Spread, commission, slippage, and swap are excluded and are not estimated. No order is sent to MT5.
- The next-setup block uses the bridge/MT5 `asOf` clock for a live countdown and displays the frozen if/then Long, Short, No-trade, or Wait outcomes before Actual is available.
- Every Current Model-eligible pattern appears in an expandable registry benchmark showing gross sample size, 2R target-first and stop-first counts/rates, gross average R, recent window, positive years, development, holdout, past-only audit, and 1R/1.5R/2R sensitivity. This is an audit catalog, not a model selector.
- Current Model requests are independent of the visible chart window and reuse the same frozen H4 response on H4 and H1. Policy/inflation context is cached by durable calendar revision, normalized-title parsing is cached, and only a 400-day current-context window is scanned. Measured local endpoint latency fell from roughly 11.7 seconds per request to roughly 0.54 seconds cold and 0.27–0.35 seconds warm.

The Research Replay audit is vertically inset below the Pair Matrix chart dock so both controls remain usable when the replay card is open.

## 2026-08-21 Expansion Candidate Audit

An exhaustive scan of the registered Labor, Sentiment, Policy/Inflation, and Growth source outcomes was rerun with the current three-pip research stress, chronological development/holdout, recent-three-year sample, year stability, past-only qualification, and 1R/1.5R/2R checks. This did not register new arrows.

The two current v9 setups remain the only complete passes:

- Aggregate-US industrial production/output improving -> Short EURUSD: 54 evaluable gross cases, 44.4% 2R target-first, `+0.33R` gross average; its stressed result remains positive at 1R, 1.5R, and 2R.
- Directional aggregate-Euro-area consumer sentiment: 99 evaluable gross cases, 40.4% 2R target-first, `+0.24R` gross average, and 8/11 positive stressed years.

The nearest archive-mined candidates are research leads, not current setups:

- Euro-area producer inflation hotter -> Long EURUSD: 51 evaluable cases and approximately `+0.19R` after the existing three-pip stress; it passed the other scanned checks but only 6/11 years were positive, below the frozen year-share gate.
- Improving US payroll package -> Short EURUSD: 54 evaluable cases and approximately `+0.09R` stressed at 2R, but stressed 1R and 1.5R remained negative.
- Improving US core/headline retail package -> Short EURUSD: 57 evaluable cases and approximately `+0.16R` stressed, but only 6/11 positive years and approximately `-0.40R` in the past-only audit.
- EUR wage weakness -> Short, US current-account improvement -> Short, and US wage improvement -> Short each showed attractive averages but only 14–15 cases, inadequate recent/year coverage, and no past-only qualifying sample.
- EUR GDP weakness -> Short showed approximately `+0.33R` stressed across 25 cases, but had only six recent cases, 5/9 positive years, no past-only sample, and negative stressed 1R.

The next responsible expansion is therefore a separately versioned producer-inflation experiment, followed by predeclared retail and small-sample accumulation studies. The scan must not silently weaken v9 merely to create more arrows: historical trade selection can manufacture impressive-looking results, and every examined lead is now reused-history evidence.

## Deferred and Open Research Questions

- The number and duration of forward paper observations required for **Paper validated**.
- Whether broker-impact cohorts demonstrate stable enough differences to justify a future predeclared weight model.
- Whether Before-state alignment improves out-of-sample results enough to become a future filter.
- Whether conflicted-majority packages retain useful directional expectancy or mainly predict volatility.
- Separate deterministic Policy rules, including rate surprises versus unchanged decisions and unscored communications.
- Inflation interpretation across tightening, easing, and growth regimes.
- Whether a later combined-pillar model improves untouched results rather than merely increasing complexity.
- Event-response views such as ATR-normalized 30-minute, H4, D1, MFE, and MAE behavior.
- Event-package attribution when multiple releases share the same timestamp.
- Eventual manual chart integration beside the user's independent technical support/resistance process.

## Completed MT5 Backfill and Ongoing Settings

The controlled historical import was completed on 2026-08-18. The durable SQLite archive survives bridge and app restarts. The EA should now remain on its normal update settings:

- `CurrenciesList = "USD,EUR,GBP,JPY,AUD,CAD,NZD,CHF"`
- `LookBackDays = 400`
- `MaxEventsPerCur = 1000`
- `MaxRowsPerPost = 120`

These smaller recurring ingests update recent and newly released rows without deleting the older archive. The 10,000-day configuration should not remain active during normal operation.

The upgraded EA also posts a completion acknowledgement after every timer cycle. This is required for automatic forward tracking because the bridge must know that all upload batches arrived before freezing a same-time release package. The normal settings above remain unchanged.

## Expansion Research Program (2026-08-21)

This section supersedes the separate `Fyodor Macro Signal Expansion Roadmap.md`. It records research directions, not registered Current Model rules. No item below creates an arrow until its definition is frozen, tested under the declared protocol, and versioned.

### What `Historical N` Means

`Historical N` is the number of evaluable occurrences of the exact registered release-package signature inside the fixed latest-ten-year primary window. It is not the number of broker rows in the full archive. A case needs a directional signature, a strictly later H4 entry, completed pre-entry ATR data, and sufficient later price coverage. Ambiguous and unevaluable cases remain separate.

The ten-year window was selected before the v1 result as a fixed compromise between current relevance and sample size, not because pre-2016 data is presumed invalid. The archive beginning in 2007 remains valuable. Future work must compare rolling three-, five-, and ten-year windows, calendar eras, and the full archive rather than assuming either the newest or oldest period is universally representative.

### Registered Setups and Nearest Leads

Current v13 setup identities inherited from `FMS-EURUSD-MULTI-H4-CQ-v10`:

| Setup | Frozen direction | Historical N | Gross 2R target first | Gross average R |
|---|---|---:|---:|---:|
| Aggregate-US industrial production/output | Improving USD package -> Short EURUSD | 54 | 44.4% | +0.33R |
| Aggregate-Euro-area consumer sentiment | Improving -> Long; weakening -> Short | 99 | 40.4% | +0.24R |
| Aggregate-US payroll package | Improving USD employment+wages+unemployment -> Short EURUSD | 55 | Flexible path contract | 2 ATR / 1R / 6 H4 |
| Complete US producer-inflation cooling package | Cooling Core PPI/PPI m/m+y/y -> Long EURUSD | 46 | Flexible path contract | 2 ATR / 1.25R / 18 H4 |

Nearest reused-history leads remain producer inflation, payroll with an alternative exit study, core/headline retail, EUR GDP weakness, and the small-sample wage/current-account cohorts documented above. A failed gate is diagnostic evidence, not a defect to bypass. It may indicate unstable years, the wrong directional treatment, family over-breadth, package conflict, entry mismatch, exit mismatch, insufficient observations, revisions, or outlier dependence.

### Flexible Path Research: MFE, MAE, and Threshold Curves

The next outcome engine should retain the fixed 1R/1.5R/2R simulations for comparability but also record the complete post-entry path over the frozen observation horizon:

- maximum favorable excursion (`MFE`) in R;
- maximum adverse excursion (`MAE`) in R;
- H4 candle/time to MFE and MAE;
- whether adverse excursion occurred before favorable excursion;
- probability of reaching at least `0.5R, 0.75R, 1R, 1.25R, 1.5R, 2R, 2.5R, 3R, 4R`, and higher observed thresholds;
- first-touch results for every predeclared stop/target pair;
- mean, median, minimum, maximum, quartiles, and upper/lower percentiles of MFE and MAE.

Maximum alone must never define the recommended target because it is dominated by outliers and uses information unavailable at entry. Historical path distributions may propose a rule; that rule must then be frozen and evaluated on later or otherwise unselected data.

Keep 30 completed H4 candles as the primary horizon initially so new results remain comparable. Add `6, 12, 18, 42, 60`-candle sensitivity as separately reported experiments. Do not silently replace the primary horizon after seeing which duration wins.

### Candidate Stress Lab

Every expansion candidate should run through the same versioned matrix and every attempted configuration must enter a trial registry:

- targets/thresholds: `0.5R` through at least `4R`;
- ATR stop widths: `0.5, 0.75, 1, 1.25, 1.5, 2 x H4 ATR(14)`;
- horizons: `6, 12, 18, 30, 42, 60` completed H4 candles;
- baseline entry: first strictly later H4 open;
- separate entry experiments: first-H4-close confirmation and other rules using only data known then;
- separate exit experiments: fixed target, trailing stop, and break-even movement;
- chronological development/holdout, rolling/year stability, recent window, past-only/prequential qualification, sample/coverage checks, and uncertainty;
- explicit disclosure of the number of families, directions, filters, entries, stops, targets, and horizons inspected.

Trailing, break-even, alternative stops, and confirmation rules are update-bucket experiments. They must not be mixed into v9 or selected per trade after the fact.

### Completed Path and Exit Matrix - 2026-08-21

The first fixed path/exit matrix is now implemented and exposed in Macro Signal Lab. Protocol hash: `eb517c8f7c2837858336b99a7e3834680828883afe1fa4b3f1cf99a593ec0c43`.

- Durable EURUSD coverage: 30,710 H4 candles from 2006-12-25 00:00 UTC through 2026-08-20 16:00 UTC.
- Exact direction signatures entering the matrix: 71; 64 had enough development data to produce a reportable selected configuration.
- Declared configurations evaluated: 23,004.
- Stops: `0.5, 0.75, 1, 1.25, 1.5, 2 x ATR`.
- Targets: `0.5R, 0.75R, 1R, 1.25R, 1.5R, 2R, 2.5R, 3R, 4R`.
- Holding periods: `6, 12, 18, 30, 42, 60` completed H4 candles.
- Each signature's configuration was selected using the older development partition only: highest development lower-95 expectancy, then development average. Holdout never entered configuration selection.
- The exploratory screen requires the fixed sample thresholds, at least `+0.10R` after the existing three-pip result stress in overall/development/holdout/recent partitions, at least eight evaluable years, at least 60% positive years, and bounded ambiguity.
- Nearby-configuration stability reports the selected grid point plus immediately adjacent stop, target, and holding values. It is diagnostic and never enters selection.
- The complete report is cached durably by source-run IDs, H4 candle revision, Charts-model hash, and report-schema version. The measured first calculation took about 35 seconds; the verified durable/in-memory reuse path returned in about 0.45 seconds and does not block the ordinary version result while loading.

Current v9 direction variants under this new and deliberately different flexible-exit screen:

| Current direction variant | N | Development | Holdout | Recent | Selected exit | Positive years | Nearby holdout positive |
|---|---:|---:|---:|---:|---|---:|---:|
| EUR consumer sentiment weakening -> Short EURUSD | 44 | +0.16R | +0.36R | +0.36R | 2 ATR / 1R / 30 H4 | 7/11 | 18/18 |
| Aggregate-US industrial output improving -> Short EURUSD | 54 | +0.02R | +0.03R | -0.00R | 2 ATR / 0.5R / 6 H4 | 7/11 | 6/8 |
| EUR consumer sentiment improving -> Long EURUSD | 55 | -0.03R | -0.02R | +0.16R | 2 ATR / 0.5R / 6 H4 | 5/11 | 2/8 |

This does not rewrite v9. The existing current patterns were admitted under v9's frozen fixed-target, target-sensitivity, past-only, and other gates. The flexible matrix is a new diagnostic that reveals directional and exit asymmetry; it cannot retroactively remove or promote an arrow.

Three unregistered direction signatures cleared the exploratory screen:

| Research candidate | N | Overall | Development | Holdout | Recent | Selected exit | Positive years | Nearby holdout positive |
|---|---:|---:|---:|---:|---:|---|---:|---:|
| US producer inflation cooling -> Long EURUSD | 46 | +0.36R | +0.30R | +0.52R | +0.52R | 2 ATR / 1.25R / 18 H4 | 9/11 | 18/18 |
| US payroll package improving -> Short EURUSD | 55 | +0.14R | +0.11R | +0.25R | +0.28R | 2 ATR / 1R / 6 H4 | 8/11 | 12/12 |
| US core/headline CPI cooling -> Long EURUSD | 107 | +0.35R | +0.47R | +0.11R | +0.18R | 2 ATR / 4R / 60 H4 | 9/11 | 7/8 |

Thirty-H4 path medians further distinguish the candidates: producer-inflation Long had approximately `2.73R` MFE versus `1.53R` MAE; payroll Short had `2.47R` MFE versus `2.15R` MAE; CPI-cooling Long had `2.82R` MFE versus `2.01R` MAE. MFE and MAE are look-after diagnostics, not live inputs.

None of the 64 candidates passed the stricter requirement that the selected configuration's holdout expectancy lower-95 bound be above zero. The user explicitly chose a more direct research posture after reviewing this limitation. V10 therefore registers the two strongest non-boundary expansions as transparent reused-history hypotheses: the complete US producer-inflation-cooling Long package and the US payroll Short package, each with its independently frozen exit contract. CPI-cooling Long remains unregistered because its apparent edge sits on the matrix boundary of a 4R target and 60-H4 horizon.

### V10 Registry Decision - 2026-08-21

- Current directional variants: Euro-area consumer sentiment Long/Short, aggregate-US industrial-output Short, aggregate-US payroll Short, and complete-US-producer-inflation-cooling Long.
- Payroll identity remains exactly `USD:employment + USD:labor_wages + USD:unemployment` at one timestamp. Partial packages do not qualify.
- Producer-inflation identity requires all four titles at one timestamp: `Core PPI m/m`, `Core PPI y/y`, `PPI m/m`, and `PPI y/y`; the aggregate score must produce the existing USD-cooling/Long signature. A lone PPI row or partial package does not qualify.
- Existing v9 patterns retain `1 ATR / 2R / 30 H4`. Payroll uses `2 ATR / 1R / 6 H4`. Producer inflation uses `2 ATR / 1.25R / 18 H4`.
- Per-setup execution is part of the immutable registry and is exposed by Charts audits and Shadow Trader. Generic source-model 2R metrics remain explicitly labeled as source research when shown beside a different registered exit.
- Macro Signal Lab path/exit research is deliberately reduced to two functional tables: Registered setups and Potential setups not yet registered.

### V11 Numeric Robustness Research - 2026-08-21

`FMS-EURUSD-NUMERIC-ROBUST-H4-v11` is now implemented as a reused-history research layer over the immutable v10 Charts registry. It does not change, remove, or add Current Model arrows. Its purpose is to determine whether a numeric release pattern becomes more repeatable when the existing broker data is separated into honest known-at-release cohorts.

The v11 engine tests each eligible exact direction signature across:

- Surprise/Momentum agreement, conflict, surprise-only, momentum-only, and mixed/zero evidence;
- revision reliability by comparing the broker-supplied Previous momentum direction with the prior archived Actual from the same `currency + country/region + normalized exact title` series;
- full, partial, and single-series packages, with existing exact-package definitions preserved;
- aligned, conflicted, and neutral Before evidence;
- weak, moderate, and strong underlying event-score magnitude;
- evidence-direction continuation versus an explicitly inverted contrarian/rejection response;
- the existing stop grid `0.5–2 ATR`, target grid `0.5–4R`, and `6/12/18/30/42/60 H4` holding grid.

Configuration selection remains development-only. Holdout, recent, year stability, neighbouring configurations, and the strict lower-95 holdout check remain audits. The engine never replaces a missing value, and the archived-Actual comparison does not pretend to reconstruct unavailable original data vintages.

The completed durable archive run used 64 base signatures, tested 436 deduplicated numeric cohorts and 220,968 declared configuration/cohort combinations, and produced 12 deduplicated exploratory-screen leads. The measured cold schema-v6 calculation took approximately 77 seconds after path-reuse optimization; its durable and in-memory cache returns in roughly one second. Price coverage is frozen at the source backtests' generation cutoff, so ordinary new H4 candles cannot silently alter or repeatedly invalidate the report; rerunning a source backtest creates the next deliberate research revision. Macro Signal Lab owns this research job; Charts and the v10 signal endpoint do not execute it.

Most important v11 findings:

| Numeric cohort | N | Development | Holdout | Recent | Development-selected exit | Decision |
|---|---:|---:|---:|---:|---|---|
| EUR manufacturing PMI, S/M agreement -> Long EURUSD | 48 | +0.39R | +0.59R | +0.47R | 2 ATR / 3R / 60 H4 | Strongest new expansion lead; research only |
| USD manufacturing PMI weakness, S/M agreement -> Long EURUSD | 55 | +0.10R | +0.39R | +0.52R | 1.5 ATR / 1.5R / 60 H4 | New expansion lead; research only |
| USD manufacturing PMI weakness, strong numeric score -> Long EURUSD | 81 | +0.13R | +0.24R | +0.45R | 1.5 ATR / 1.5R / 60 H4 | Broader related lead; research only |
| EUR business-sentiment weakness, contrarian/rejection -> Long EURUSD | 96 | +0.23R | +0.19R | +0.13R | 1.25 ATR / 2R / 30 H4 | First explicit rejection-pattern lead; research only |
| USD consumer-confidence weakness with conflicted Before -> Long EURUSD | 40 | +0.59R | +0.23R | +0.35R | 1 ATR / 2R / 12 H4 | Conditional lead; research only |
| USD consumer-confidence weakness with S/M agreement -> Long EURUSD | 130 | +0.28R | +0.10R | +0.16R | 1.25 ATR / 1.5R / 18 H4 | Higher-N conditional lead; research only |
| Complete USD CPI-cooling package -> Long EURUSD | 107 | +0.47R | +0.11R | +0.18R | 2 ATR / 4R / 60 H4 | Still sits on the target/horizon boundary; unregistered |

Existing v10 producer-inflation Long, payroll Short, and EUR-sentiment-weakening Short remain positive under their corresponding v11 cohorts. Partial packages are now evaluated independently instead of being silently treated as complete, but no partial-package cohort cleared the current exploratory screen in this run.

The registered US-industrial-output Short pattern was specifically audited because of the 2026-08-18 failure. Revision-robust cases did not improve it: approximately `+0.02R` development, `+0.03R` holdout, and flat/slightly negative recent expectancy at the selected `2 ATR / 0.5R / 6 H4` research exit. Full packages and aligned/conflicted Before splits also failed to produce stable development/holdout/recent evidence. V11 therefore does not promote a refined industrial rule. V10 remains immutable, but a future Charts registry should reconsider carrying this setup rather than treating the single failed example as an isolated anomaly.

No v11 cohort passed the stricter positive holdout lower-95 expectancy requirement. These 12 rows are prioritized research leads, not validated arrows. The next version decision should freeze a small non-overlapping subset—starting with manufacturing-PMI agreement and the business-sentiment rejection rule—before any new Charts registry is created.

### Diagnosing Failed and High-N Families

Frequent releases are not automatically directional releases. When a high-N direct rule is weak, test these hypotheses separately rather than forcing the original mapping to pass:

- direct directional continuation;
- contrarian/rejection response;
- volatility-only behavior with no directional arrow;
- surprise/momentum magnitude bins defined within the same exact series;
- same-time package agreement versus conflict;
- pre-release displacement or evidence already priced before entry;
- Before-state alignment/conflict;
- policy, inflation, trend, and volatility regimes known at entry;
- delayed versus immediate response;
- first-candle confirmation versus unconditional entry.

Candidate identities must retain country/region, exact normalized title or declared same-time package, direction, missing-value policy, and broker revision handling. Do not merge unrelated titles merely to increase N.

Specific weak high-N observations already recorded:

- US claims Short: about 229 cases, negative/near-zero stressed and weak across holdout/recent/past-only partitions.
- USD consumer inflation Short: about 186 cases, small full-history positive result but negative recent/holdout behavior and failed stressed 1R.
- USD consumer sentiment: about 145-149 cases, weak or negative important partitions.
- EUR business sentiment: about 94-117 cases, negative recent/holdout behavior.

These may contain conditional volatility, rejection, or regime patterns; their unconditional direct mappings are not currently robust arrows.

### Regime Research

Use the entire retained archive to test whether event-family behavior changes across time. Report pre/post-2016 and rolling-window results instead of assuming that older data is unusable. Candidate regimes may include monetary-policy stance, inflation direction, growth cycle, realized volatility, and H4/D1 trend, but every regime label used in a simulation must be computable from information available at entry.

Also measure which registered families dominate signal frequency and realized excursion through time. Descriptive family dominance is not automatically a tradable regime; it becomes a model input only after a frozen definition and later evaluation.

### Charts Projection and Loading Contract

- The model remains H4: release classification, first-later-H4 activation, ATR, outcomes, and the 30-H4 horizon were researched on H4.
- Every EURUSD chart timeframe may display the same frozen H4 activation. Non-H4 views must explicitly say `H4 model` or `backtested on H4` and must not imply an M1/M15/D1/W1 backtest.
- Intraday views may show release-to-H4-activation geometry. On a coarse candle containing both timestamps, show the activation arrow without inventing a visible intrabar separation.
- Current Model data is viewport-independent and preloads at app startup, regardless of whether Charts or Macro Bias has been opened. Opening the control reveals cached data while Charts can refresh it silently against the current calendar revision.
- Research Replay remains a windowed historical view because it can contain hundreds of markers.
- A blank Current Model is honest when no immutable post-v10 release has qualified. Research Replay arrows must never be relabeled as live/post-activation Current Model evidence.

### Research Order

1. **Completed:** add path-level MFE/MAE and threshold/first-touch reporting without changing v9.
2. **Completed:** build the fixed Candidate Stress Lab matrix and record its protocol hash.
3. **Completed:** run the declared path/exit/stop/horizon matrix across 64 eligible exact direction signatures.
4. **Completed:** freeze v10 with exact-package US producer-inflation Long and US payroll Short, including per-setup exits.
5. Diagnose high-N families under direct, rejection, volatility-only, package-conflict, timing, and known-at-entry regime treatments.
6. Promote only separately versioned, auditable rules; leave v10 immutable otherwise.
7. Repeat with retail, small-sample accumulation, policy, inflation, and combined evidence only after earlier experiments are recorded.

### Deferred Forecast-Quality Experiment - 2026-08-22

The 2026-08-21 Euro-area Consumer Confidence release exposed a confirmed bad-source edge case in the MT5 calendar. MT5 froze `Actual -15.5`, `Forecast 0.1`, and `Previous -15.9`, while the external release table reported Forecast `-16.0`. The current equal-weight rule therefore produced Surprise `-1`, Momentum `+1`, agreement `0`, and total score `0`, even though Actual improved from Previous. Preserve this result as an honest failure of the current input policy; do not retroactively create a trade.

Before the next Charts registry, backtest three frozen alternatives side by side:

1. Existing baseline: always use numeric Forecast and Previous as currently supplied.
2. Momentum-only challenger: ignore Forecast for every eligible release and derive direction solely from Actual versus Previous; equal, missing, or nonnumeric momentum remains non-directional.
3. Forecast-quality challenger: retain Forecast normally, but mark it suspect when `|Forecast - Previous|` is anomalous relative to earlier releases of the same country/region plus normalized exact-title series. The detector must use only information known before that release and must never inspect later values.

For a suspect Forecast, preserve and display the raw broker value, contribute nothing from Surprise, compare Actual with Previous normally, and award no agreement bonus. In the confirmed Consumer Confidence example this would yield Momentum `+1` and a Long-qualifying direction under the challenger rather than silently replacing `0.1` with an external value.

The experiment must report average R, target/stop/expiry rates, maximum drawdown, development/holdout/recent performance, yearly stability, signal count, excluded-Forecast count, and representative exclusions. Prefer momentum-only if it performs comparably because it is simpler. Promote the quality gate only if its improvement survives chronological holdout and robustness checks. Any winning policy becomes a new immutable FMS version governing future releases; v10 and its already-observed decisions remain unchanged.

### V12 Forecast Robustness and Fixed-Challenger Run - 2026-08-26

The deferred three-policy experiment is implemented in the durable expansion report as `FMS-EURUSD-FORECAST-ROBUST-H4-v12` research. It preserves v10 and the 2026-08-21 Consumer Confidence No Trade. The quality detector uses only earlier exact-series releases, activates after 12 prior numeric Forecast/Previous gaps, and marks a Forecast suspect above the expanding median gap plus six MAD. Raw MT5 values are never replaced.

The initial detector over-flagged ordinary changes whenever MAD collapsed to zero. The corrected gate retains the median-plus-six-MAD threshold but also requires the Forecast/Previous gap to exceed four times the prior 90th-percentile movement scale built from both Forecast/Previous and Actual/Previous movements. On the frozen v10 setup portfolio, Forecast-quality remains selected. After the existing three-pip stress, its holdout/recent expectancy is approximately `+0.38R/+0.46R`, versus baseline `+0.36R/+0.44R` and Momentum-only `+0.29R/+0.37R`. Momentum-only remains outside the predeclared 0.03R simplicity allowance. Across all four source archives, exclusions fell from 1,084 to 140 while the confirmed Consumer Confidence errors remained detected.

Four fixed broad challengers were rescored under the selected baseline. None passed every practical check, so no v12 Charts registry was created and v10 remains current:

| Challenger | N | Selected exit | Development | Holdout | Recent | Decision |
|---|---:|---|---:|---:|---:|---|
| EUR business-sentiment weakness, contrarian Long | 96 | 1.25 ATR / 2R / 30 H4 | +0.23R | +0.19R | +0.14R | Failed neighbouring-configuration stability |
| EUR manufacturing-PMI improvement, Long | 56 | 2 ATR / 0.75R / 6 H4 | -0.04R | -0.05R | -0.08R | Failed expectancy, stability, boundary, year share, and prequential checks |
| USD manufacturing-PMI weakness, Long | 95 | 2 ATR / 1R / 60 H4 | -0.00R | +0.10R | +0.25R | Failed overall/development/holdout threshold, stability, boundary, year share, and prequential checks |
| USD consumer-confidence weakness, Long | 47 | 0.75 ATR / 1R / 30 H4 | +0.23R | -0.29R | -0.27R | Failed overall/holdout/recent expectancy, stability, year share, and prequential checks |

The Shadow Trader now prefers completed-H4 expiry timestamps supplied by the bridge, skips simultaneous opposing setups deterministically, distinguishes conflicts from ordinary overlap, uses path MAE when available for drawdown, and labels EURUSD lot sizing as an indicative USD-account calculation without MT5 margin or broker-volume enforcement.

### Forecast Guard Charts Version - 2026-08-26

`FMS-EURUSD-FORECAST-GUARD-H4-v13` is the prospective Charts model activated at `2026-08-26 03:16:40 UTC`. It retains the v10 registered setup identities and their frozen execution contracts; no failed v12 expansion candidate was promoted. Its only signal-policy change is the corrected past-only Forecast-quality guard selected by the fixed policy comparison.

When a Forecast is suspect, FMS preserves and displays the raw MT5 value, excludes Surprise, continues to compare Actual with Previous, and awards no agreement bonus. The 2026-08-21 Euro-area Consumer Confidence row is therefore reclassified as Momentum `+1` / Long EURUSD under the guard: its raw `16.0` Forecast/Previous gap exceeded the `6.0` past-only threshold. Because this release occurred before v13 activation, it remains audit-only and no hypothetical trade is created after the fact. Releases observed after activation use the guard prospectively and enter only at the first strictly later H4 open when a retained setup qualifies.

### Workbench EURUSD Exhaustion Sweep - 2026-08-27

The first systematic Workbench sweep is recorded as experiments `E005-E159`. It covered every unregistered EURUSD catalog family with at least 40 historical cases, which is the minimum overall sample required by the current qualification contract. The sweep tested 25 new all-case Forecast Guard continuation baselines (Continuing Jobless Claims had already been recorded as `E003-E004`), followed by 128 consistent refinements across available direction splits, rejection direction, Momentum-only scoring, S/M agreement, Before alignment, and full-package treatments. Two final full-grid audits tested the only material near-candidate. In total, 134 experiments completed and 21 correctly failed because their requested guarded subset had no evaluable price path.

No new setup passed the frozen strict holdout checks. The qualification thresholds were not loosened after observing the results, and no new Charts arrow was registered.

The strongest near-candidate was Long EURUSD after improving Euro-area Retail Sales. The restricted matrix result `E107` had 47 cases and selected `1.5 ATR / 1.5R / 30 H4`, with approximately `+0.32R` overall, `+0.38R` development, `+0.17R` holdout, `+0.17R` recent, and 9/11 positive years. It was not promoted because the holdout lower-95 bound was approximately `-0.51R` and only half of adjacent holdout/recent contracts were positive. The full-grid audit `E158` exposed the selection instability: its development-selected `2 ATR / 2.5R / 30 H4` contract fell to approximately `-0.03R` in both holdout and recent data. The strong-vote refinement `E159` also produced negative holdout/recent expectancy.

The other notable regime-dependent result was aligned US manufacturing PMI (`E067`): 82 cases, approximately `+0.01R` development, `+0.53R` holdout, and `+0.61R` recent. It was rejected because the older development history showed no usable edge; the recent strength cannot justify rewriting the rule after inspecting it.

Operational conclusion: EURUSD is exhausted under the current catalog, current data, minimum-N boundary, and permitted single-treatment Workbench design. This does not prove that EURUSD contains no further edge; it means no additional rule can be promoted honestly from the currently declared search space. Arbitrary filter intersections and sub-40-case signatures remain excluded because they would increase selection risk and cannot satisfy the existing sample contract. `FMS-EURUSD-FORECAST-GUARD-H4-v13` therefore remains unchanged with its four registered setups. The next expansion should generalize the recorded E/C/M research pipeline to another major pair rather than weaken EURUSD qualification gates.

### GBPUSD Generalization Gate - 2026-08-27

Before creating a GBPUSD experiment, the live durable store was inspected. It contains 1,257 GBP calendar rows across 97 distinct titles, from `2025-07-15 23:00 UTC` to `2026-11-20 23:30 UTC`; the relevant USD archive remains long-lived, but this GBP history is only about 16 months and includes future scheduled rows. It cannot satisfy the existing multi-year development, chronological holdout, recent, year-stability, or lower-95 holdout qualification contract. The release-observation ledger contains only eight GBP observations, all from the recent live period.

The durable price cache contains **zero** GBPUSD H4 candles and **zero** GBPUSD M1 candles. By contrast, EURUSD coverage remains intact and is not reused for GBPUSD: 30,736 H4 candles span `2006-12-25` through `2026-08-27`, while the small M1 cache is only used for its existing path-resolution work. Therefore no GBPUSD backtest or E experiment was run, no result was viewed, and no qualification gate was changed.

The Workbench pipeline is now market-scoped. GBPUSD source definitions are separately labelled `FMS-GBPUSD-LABOR-H4-v2`, `FMS-GBPUSD-SENTIMENT-H4-v3`, `FMS-GBPUSD-POLICY-INFL-H4-v5`, and `FMS-GBPUSD-GROWTH-H4-v7`, with base/quote orientation GBP/USD and GB/US country scope. Catalog entries, configuration hashes, dataset fingerprints, cache keys, and new E/C identifiers include the market. EURUSD retains its original identifiers, sequence, catalog, cache namespace, four registered setups, Charts arrows, and Shadow Trader unchanged. A GBPUSD workbench request truthfully reports unavailable rather than borrowing EURUSD data; it creates no accidental GBPUSD Charts model.

Next reproducible GBPUSD sequence, without changing the frozen contract:

1. Backfill durable GBP calendar history to a period sufficient for the unchanged multi-year partitions, retaining raw broker rows and their country codes.
2. Backfill matching GBPUSD H4 candles across the same research interval, and M1 only where required to resolve intrabar stop/target order.
3. Run the four market-labelled source backtests, freeze their exact run IDs and the market-labelled dataset fingerprint, then generate the guarded catalog.
4. Record each declared experiment as `FMS-GBPUSD-H4-Exxx`; retain failures. Freeze only review-worthy E results into `C` identifiers. A separate reviewed `M` change is required before any Charts integration.
5. Add no GBPUSD arrow unless the unchanged development, holdout, recent, year-stability, uncertainty, and neighbouring-contract checks all pass. A positive full-history average alone remains insufficient.

### GBPUSD First Guarded Baseline - 2026-08-27

The requested calendar backfill completed successfully. Durable GBP rows now span `2007-01-11` through `2026-11-20` (17,215 rows, 115 distinct titles). H4 caching was then run separately for the available major-pair markets: EURUSD 30,939; GBPUSD 30,890; USDJPY 13,351; AUDUSD 13,402; USDCAD 13,452; NZDUSD 13,464; and USDCHF 13,455 candles. All begin at the broker-provided `2006-11-08` boundary; M1 remains lazy and is requested only for an H4 stop/target tie. These markets are selectable in the Workbench, but only GBPUSD was backtested in this pass.

The four separate GBPUSD source runs completed with immutable identifiers `FMS-GBPUSD-LABOR-H4-v2-1787786501-a2e4025b`, `FMS-GBPUSD-SENTIMENT-H4-v3-1787786505-d2ec45d5`, `FMS-GBPUSD-POLICY-INFL-H4-v5-1787786508-7c0fcb09`, and `FMS-GBPUSD-GROWTH-H4-v7-1787786511-699d492b`. The resulting guarded catalog contained 47 package families. Experiments `FMS-GBPUSD-H4-E001` through `E024` record the complete all-case Forecast Guard continuation baseline for every family with at least 40 catalog cases. Each uses the unchanged declared 6-stop × 9-target × 6-holding H4 matrix and development-only contract selection.

No baseline passed the strict holdout contract. The strongest apparent row, `E012` (USD producer inflation, 105 cases), selected `2 ATR / 4R / 60 H4` and measured approximately `+0.22R` development, `+0.31R` holdout, and `+0.41R` recent, but its holdout lower-95 bound was `-0.38R` and only 6/11 years were positive. It is rejected, not a near-promotion. Other positive-holdout rows either had negative development expectancy or also failed uncertainty and stability. No GBPUSD C candidate was frozen, no M model was created, and no GBPUSD arrow, Shadow Trader setup, or chart integration was added.

This pass does not justify a filter search selected after viewing the baseline. Any later GBPUSD refinements must be declared in advance from the existing single-treatment catalog, retain the 40-case boundary, and satisfy every unchanged strict gate.

### Qualification v2 and GBPUSD E012 Audit - 2026-08-27

`FMS-QUALIFICATION-v2` is an additive evaluation overlay: it does not rewrite an immutable E record, its stored fingerprint, its selected historical contract, or the legacy strict checks. It grades each completed experiment as **Rejected**, **Research candidate**, or **Statistically confirmed**. The current strict checks remain visible; positive strict holdout lower-95 is retained as a requirement only for the strongest grade.

V2 requires at least 80 evaluable cases, takes the earliest 50% as initial history, then performs five chronological outer folds of at least eight cases. A Combined Contract is selected inside each preceding history by the existing development lower-95, then development-average rule and applied only to the immediately next fold. The pooled report contains only those out-of-fold results. Research-candidate checks require positive overall/development/holdout/recent/pooled-walk-forward averages, 30 pooled cases, at least three positive folds, 50% positive years, <=5% ambiguity, concentration below 50% for both the best year and top three trades, a 90% lower bound >= -0.05R, and at least 70% positive results across adjacent SL/TP/duration contracts evaluated in the same outer folds. Statistical confirmation additionally requires positive 95% walk-forward and strict-holdout lower bounds, 60% positive years, and a family-wide Holm-adjusted confidence pass.

The selection-bias audit uses a deterministic configuration-hash-seeded calendar-year block bootstrap of pooled trade R. It reports percentile intervals and a centered-null one-sided p-value. Ordinary audits use 10,000 replications; extreme tails deterministically refine the p-value to 250,000 replications so a large frozen family does not make confirmation numerically impossible. Family-wide multiplicity is handled by Holm-Bonferroni across the complete immutable manifest, including insufficient and failed declarations as p=1. This is explicitly an audit, never a selector.

`FMS-GBPUSD-H4-E012` was separately audited under its predeclared fixed `2 ATR / 4R / 60 H4` contract, not relabelled as untouched holdout evidence. Its pooled five-fold out-of-fold result was `N=42`, approximately `+0.056R`, with two positive folds. It is **Rejected**: it misses the required three positive folds, 50% positive years, 90% lower-bound threshold, and its legacy strict holdout lower-95 remains negative. No C or M record was created and no GBPUSD arrow was added.

### Seven-Market Guarded Sweep - 2026-08-27

The frozen manifest `b8e529042ccf67ef631be8d850dae085799c7e7f304c274eb58f332e3bd2687f` declared 1,128 rule entries across EURUSD, GBPUSD, USDJPY, AUDUSD, USDCAD, NZDUSD, and USDCHF before family-wide results were finalized. It retained the full `0.5-2 ATR` stop, `0.5-4R` target, and `6/12/18/30/42/60 H4` duration matrix. Of those declarations, 381 completed historical simulations and Qualification-v2 audits; 747 were recorded as insufficient because the requested direction/treatment was unavailable, below the 80-case preflight boundary, or produced no evaluable path. There were no final runtime failures.

The sweep found 11 **Research candidates** and zero **Statistically confirmed** setups. Two candidates survived the family-wide Holm correction, but neither passed the unchanged positive strict-holdout lower-95 requirement, so neither becomes a C candidate, registered setup, Charts arrow, or Shadow Trader rule:

| Market | Pattern | Treatment | Pooled OOS | 90% lower | Folds | Years | Holm p | Decision |
|---|---|---|---:|---:|---:|---:|---:|---|
| USDCAD | USD composite + services PMI | Momentum-only, both directions | N 47, +0.215R | +0.117R | 4/5 | 6/6 | 0.0045 | Research candidate; strict holdout lower-95 failed |
| USDJPY | JPY labor wages | Forecast Guard, both directions | N 42, +0.548R | +0.489R | 5/5 | 6/6 | 0.0045 | Research candidate; strict holdout lower-95 failed |

The other nine v2 research candidates were USDCAD USD composite/services PMI baseline; USDJPY USD consumer sentiment Momentum-only; EURUSD US industrial production baseline; USDJPY short USD labor claims; USDCAD long USD labor claims; GBPUSD USD industrial output baseline; USDJPY JPY labor wages Momentum-only; USDJPY JPY headline/core inflation baseline; and USDJPY short JPY headline/core inflation. Their family-wide adjusted p-values did not pass.

Operational conclusion: the broader search produced promising research leads but no defensible new registered setup. Existing live FMS models remain unchanged. The two Holm-surviving candidates should be reviewed as fixed, named challengers against genuinely new forward observations or a new untouched broker/time period; their historical contracts and gates must not be retuned after seeing this sweep.

### Practical Historical Registry - 2026-08-27

The product objective was explicitly reset from academic confirmation to practical historical discovery. `FMS-HISTORICALLY-PROFITABLE-H4-v1` registers an event recipe when its identity, scoring treatment, entry, SL, TP, and expiry are frozen without lookahead; its pooled chronological walk-forward sample is usable (normally at least 30 cases); and its gross walk-forward average R is positive. Confidence intervals, fold consistency, year stability, concentration, and omitted costs remain visible risk diagnostics. They no longer erase a positive historical result merely because a lower confidence bound crosses zero. This is a historical-profitability registry, not proof of future profit.

Overlapping discoveries with the same event package are deduplicated to the strongest practical recipe rather than generating several arrows for the same release. The registry currently projects these new unique recipes in addition to the three preserved EURUSD rules:

| Market | Registered setup | Scoring | Frozen contract | Walk-forward result |
|---|---|---|---|---|
| EURUSD | US industrial-production package, both directions | Forecast Guard | 1.5 ATR / 0.5R / 12 H4 | N 48, +0.138R |
| GBPUSD | US industrial-production package, both directions | Forecast Guard | 1 ATR / 0.5R / 6 H4 | N 48, +0.105R |
| USDCAD | US composite + services PMI, both directions | Momentum-only | 2 ATR / 0.5R / 12 H4 | N 47, +0.215R |
| USDCAD | US labor-claims improvement, Long only | Forecast Guard | 2 ATR / 0.5R / 42 H4 | N 67, +0.143R |
| USDJPY | US consumer sentiment, both directions | Momentum-only | 0.75 ATR / 0.5R / 30 H4 | N 159, +0.084R |
| USDJPY | US labor claims, Short only | Forecast Guard | 0.5 ATR / 0.75R / 30 H4 | N 96, +0.065R |
| USDJPY | Japan labor wages, both directions | Forecast Guard | 0.75 ATR / 4R / 6 H4 | N 42, +0.548R |
| USDJPY | Japan headline + core inflation, both directions | Forecast Guard | 2 ATR / 1R / 30 H4 | N 90, +0.123R |

Charts now exposes the registry for EURUSD, GBPUSD, USDCAD, and USDJPY through one FMS view. The current registered scanner is always authoritative; `Past arrows` is only an optional hindsight overlay of the same setups. The global FMS Shadow Trader sorts monitored rules by exact-setup average R, TP-before-SL rate, or pair/setup name and shows live state plus matching upcoming releases. AUDUSD, NZDUSD, and USDCHF remain unsupported in Charts because the completed sweep found no positive practical recipe meeting this registration standard.

### Global Shadow Trader and Negative Research Value - 2026-08-27

Shadow Trader is now a global registry monitor rather than a selected-pair-only list. It combines the current immutable state and upcoming registered releases for EURUSD, GBPUSD, USDCAD, and USDJPY while Charts arrows remain scoped to the selected symbol. Its setup list remains sortable by historical average R, target-first rate, or name.

Failed backtests are treated as useful evidence, not discarded noise. The UI distinguishes:

- **Registered:** a fixed no-lookahead directional recipe with positive practical walk-forward expectancy;
- **Contender:** an interesting reaction that was positive in some meaningful partitions but unstable or regime-dependent;
- **Avoid as standalone direction:** repeated tests did not support reliably mapping the release's economic direction directly to the pair's price direction.

“Avoid” never means the event is economically irrelevant. It means the tested direct arrow is unsupported; the release may still create volatility, interact with another event, or become useful under a separately frozen entry-known treatment. The initial intelligence registry records the unstable EURUSD retail-sales and aligned-US-manufacturing-PMI contenders, plus unsupported direct mappings for GBPUSD US producer inflation and EURUSD US labor claims, US consumer inflation, and US consumer sentiment. These labels must stay tied to recorded experiment evidence and must never be invented from one chart example.

## Registered-Recipe Integrity and Loss Review - 2026-08-28

FMS must never mix the performance of a broad source experiment with the performance of the exact registered arrow recipe. Charts therefore treats the immutable registered experiment and its frozen SL, TP, duration, scoring policy, direction, and walk-forward audit as the primary benchmark. Broader source 2R statistics and alternative-target diagnostics are a separately collapsed research reference. Eight practical-registry recipes currently reconcile exactly with their immutable Workbench experiment and latest Qualification-v2 walk-forward audit. The three preserved EURUSD v10 registrations remain explicitly labelled legacy snapshots until equivalent immutable experiment links are reconstructed; their broader source statistics must not be presented as exact registered-contract results.

An arrow is a finite hypothetical trade lifecycle, not a permanent directional forecast. Target first, stop first, expiry, ambiguity, or unavailable price coverage ends that lifecycle. Price reversing after a target was already reached does not convert the recorded win into a loss. A future persistent-macro-bias model would require its own separately frozen horizon and evaluation contract.

The next FMS refinement loop is loss review rather than ad-hoc rule loosening. Genuine stop-first and negative-expiry cases should be compared with winners using only entry-known fields: exact release package, Surprise/Momentum composition, Forecast Guard status, package completeness, Before alignment, broker impact, prior H4 trend/volatility, and release session. Any apparent separator becomes a named immutable challenger while the registered parent remains unchanged. Promotion requires positive gross walk-forward average R, a target-first rate above that contract's simple gross break-even threshold, usable temporal coverage, and transparent drawdown/streak diagnostics. One visually surprising chart case must never be used as a fitted exception.

## Pair-Orientation Integrity Rebuild and Registered Reaction v2 - 2026-08-28

The Workbench rescoring engine previously rebuilt factor votes with an implicit EURUSD orientation. That defect inverted USD evidence whenever USD was the base currency. Immutable old E records remain preserved, but they are no longer accepted as current registration evidence. New experiment configurations include `pair-orientation-v2`, so corrected calculations cannot reuse an old configuration hash.

The active Charts registry is now `FMS-REGISTERED-REACTION-H4-v2`. Every active row below reconciles with a newly computed immutable experiment and its fixed-contract Qualification-v2 audit:

| Market | Registered setup | Fixed contract | Later walk-forward result |
|---|---|---|---|
| EURUSD | US industrial-production package | 1.5 ATR SL / 0.5R TP / 12 H4 | E281: N 48, +0.138R |
| GBPUSD | US industrial-production package | 1 ATR SL / 0.5R TP / 6 H4 | E059: N 48, +0.105R |
| USDJPY | US consumer sentiment | 2 ATR SL / 1R TP / 60 H4 | E061: N 155, +0.040R |
| USDJPY | Japan labor wages | 0.75 ATR SL / 4R TP / 6 H4 | E062: N 42, +0.548R |
| USDJPY | Japan headline/core inflation | 2 ATR SL / 1R TP / 30 H4 | E063: N 90, +0.123R |

The corrected results removed USDCAD composite/services PMI, USDCAD labor claims, and USDJPY US labor claims from the live registry. The first became materially negative after correcting USD-base orientation; the other two failed the fixed later-period check. They remain visible as avoid-directional-use research rather than being erased.

The same rebuilt experiments store entry-known support/resistance diagnostics and unmanaged path results. Support/resistance uses only the prior 120 completed H4 candles, confirmed two-bar pivots, 0.25-ATR clustering, and at least two touches. Flexible path reporting shows MFE, MAE, time-to-extreme, final close R, and directional room at every declared H4 horizon. It does not call maximum future profit a tradable exit. The first audit demonstrates why: EURUSD and GBPUSD industrial-output recipes retained positive fixed-contract walk-forward averages while their unmanaged selected-horizon close averages were negative. Their small fixed targets are therefore part of the historical recipe, not an arbitrary limitation to remove.

Shadow Trader must always say `Can I follow this blindly? No.` A verified row means its immutable recipe produced a positive gross later-test historical average under the displayed contract. It does not include spread, commission, slippage, or swap and does not prove the next trade will profit.

### Assessment of the +1/+3 Evidence Score

The current event score is a useful transparent baseline, not a complete trading model. A directional comparison contributes `+1` or `-1` for Actual versus Forecast and another `+1` or `-1` for Actual versus Previous. Matching nonzero directions add one agreement point, producing `+3` or `-3`. This deliberately treats the result as ordinal evidence: it records direction and agreement but not how economically large or unusual the release was.

That simplicity is valuable for auditability, missing Forecasts, and small samples. It is insufficient by itself for an automated strategy because a tiny beat and an exceptional beat receive the same score; forecast reliability and revisions vary; simultaneous packages are not equally informative; inflation and policy can change meaning with the policy regime; and the same release can produce different reactions across pairs. The present score should remain the immutable baseline feature while challengers are tested against it, never be silently replaced after inspecting outcomes.

The recommended next FMS research architecture is:

1. Preserve the current sign/agreement score as the explainable baseline.
2. Add a past-only robust surprise magnitude for each exact series separately, such as `(Actual - Forecast) / rolling MAD or standard deviation`; never standardize unlike titles together.
3. Keep Actual-versus-Previous Momentum as a separate feature rather than pretending it is identical to market surprise.
4. Learn and freeze an event/pair reaction map: continuation, rejection, volatility-only, or insufficient evidence, measured independently at short impulse and longer follow-through horizons.
5. Cap simultaneous packages by family so release quantity cannot dominate.
6. Treat policy decisions, policy-path/guidance evidence, headline/core/producer inflation, and ordinary growth data as separate models before testing combinations.
7. Add only entry-known price context, including prior trend, volatility, session, and the confirmed support/resistance zones now stored by the Workbench.
8. Select all thresholds and exits on development history, freeze them, and judge them only on later walk-forward cases.

The current registered average R values do not by themselves prove that price respected the economic direction more often than not. A positive average can come from a lower win rate paired with a larger payoff, as demonstrated by Japan labor wages. FMS must therefore report two separate claims: `directional respect` (the sign and magnitude of price response at fixed horizons) and `trade expectancy` (the result of a declared entry/SL/TP/expiry contract). Neither is proof of causation.

This result cannot be copied unchanged to other pairs or methods. Pair orientation, relative policy expectations, liquidity, session timing, and event sensitivity differ. The same predeclared research protocol may be reused across pairs; the measured coefficients, direction map, and execution contract must be estimated and audited independently for each pair.

### Past-Only Exact-Series Relative Magnitude - 2026-08-28

The Workbench now measures the absolute size of `Actual - Forecast` and `Actual - Previous` against only earlier releases of the same `currency + country/region + normalized exact title`. It does not compare CPI with payrolls, m/m with y/y, or a national series with a Euro-area series. The first 12 earlier observations are treated as insufficient. Thereafter the raw audit reports a percentile, ordinary/large/exceptional class, prior N, typical absolute gap, robust distance, and an eight-bin historical distribution. The current row is never added to its own reference history.

Magnitude remains separate from the directional `-1/0/+1` vote. It does not turn an exceptional result into an arbitrary `+5`. Package-level relative magnitude is the median percentile of nonzero contributing Surprise/Momentum comparisons, preventing one extreme row or a larger package from automatically dominating. The predeclared upper-tail treatment means at least the 80th percentile; it is a filter for controlled experiments, not a live weight.

Five scoring recipes are now explicit: original Surprise + Momentum, Surprise only, Momentum only, Surprise + Momentum without the agreement bonus, and Forecast Guard. Their fixed-contract comparison on the active registered families produced a clear conclusion: **relative magnitude is useful, but not a universal monotonic rule**.

- EURUSD and GBPUSD US industrial output remained positive across older, later, and recent partitions when all releases were used. Their upper-tail subsets were too small and had no meaningful later sample. Filtering for only large surprises would weaken rather than improve these recipes.
- USDJPY US consumer sentiment remained strongest and most repeatable under Momentum-only. The ordinary-magnitude subset (`E065`) recorded N 260, development `+0.138R`, holdout `+0.121R` (N 91), recent `+0.176R`, and five-fold pooled OOS `+0.097R` (N 129). It missed only the neighbouring-contract stability check in Qualification v2; this does not replace the already registered all-case recipe.
- USDJPY headline/core inflation remained positive with or without the upper-tail filter. The upper-tail experiment (`E066`) had N 53 and positive development/holdout/recent averages, but only 14 holdout cases and insufficient coverage for the five-fold gate. Magnitude is informative here, not promotion evidence.
- USDJPY labor wages showed the strongest magnitude separation. The fixed registered `0.75 ATR SL / 4R TP / 6 H4` upper-tail experiment (`E064`) had N 29, development `+0.578R`, holdout `+1.350R` (N 11), recent `+1.154R`, and 7/10 positive years. This is a high-value challenger but is explicitly under-sampled; it must not replace the broader registered rule from this reused history alone.

The answer to the product question is therefore four-part: strength is the fixed-contract average and response size; stability is performance across years and nearby contracts; repeatability is later walk-forward and recent consistency; economic usability requires enough exact-series history and a rule that does not depend on one tiny subgroup. A high percentile can improve some families, be irrelevant to others, and remove the usable sample from others. FMS must show that difference rather than assume “bigger news always means better trade.”

### Seven-Pair Reaction Atlas and Registered Reaction v3 - 2026-08-29

The staged atlas is complete for EURUSD, GBPUSD, USDJPY, AUDUSD, USDCAD, NZDUSD, and USDCHF. It evaluated every sufficiently sampled exact package under five declared scoring policies, chose continuation or rejection and the 1/3/6/12/30-H4 response horizon on development history only, then selected a fixed contract from the declared coarse grid without consulting holdout or recent results. Ordinary and top-20% past-only exact-series magnitude were separate declared challengers rather than unrestricted intersections. Artifact `e20b9016d8be9ae8eee4608b5ab18f9adca8dd19e559dac83ea45a67b3095664` preserves the run.

`FMS-REGISTERED-REACTION-H4-v3` contains 16 practical recipes. Every row below now reconciles with an immutable experiment using the current `relative-magnitude-v3` scoring engine and its latest walk-forward audit:

| Market | Registered setup | Scoring | Cases | Reaction | Experiment | Later N | Later average |
|---|---|---|---|---|---|---:|---:|
| EURUSD | US industrial-production package | Forecast Guard | all | continuation | E282 | 52 | +0.170R |
| GBPUSD | US industrial-production package | Forecast Guard | all | continuation | E062 | 50 | +0.148R |
| GBPUSD | US labor claims | no agreement bonus | ordinary magnitude | continuation | E061 | 178 | +0.207R |
| AUDUSD | US producer inflation | Momentum only | all | continuation | E050 | 47 | +0.109R |
| AUDUSD | Australia business confidence | Momentum only | all | rejection | E051 | 63 | +0.040R |
| NZDUSD | US producer inflation | Momentum only | all | continuation | E044 | 47 | +0.159R |
| NZDUSD | US trade balance | Momentum only | all | continuation | E045 | 99 | +0.040R |
| USDCAD | US headline/core inflation | no agreement bonus | all | continuation | E043 | 132 | +0.208R |
| USDCAD | US producer inflation | Momentum only | all | continuation | E044 | 46 | +0.220R |
| USDCAD | Canada retail sales | Momentum only | all | continuation | E045 | 42 | +0.322R |
| USDJPY | US consumer sentiment | Momentum only | all | continuation | E073 | 176 | +0.090R |
| USDJPY | Japan labor wages | Forecast Guard | all | continuation | E074 | 49 | +0.429R |
| USDJPY | Japan headline/core inflation | Forecast Guard | all | continuation | E075 | 104 | +0.101R |
| USDJPY | US producer inflation | Surprise only | all | rejection | E067 | 51 | +0.101R |
| USDJPY | US manufacturing employment | Forecast Guard | all | continuation | E068 | 97 | +0.067R |
| USDJPY | US trade balance | Surprise only | ordinary magnitude | continuation | E070 | 55 | +0.172R |

The ordinary-magnitude GBPUSD labor-claims rule replaced its weaker all-case predecessor. USDJPY ordinary-magnitude trade balance was added because all five walk-forward folds were positive and its year-block-bootstrap 95% lower bound remained above zero. The ordinary-magnitude USD employment rejection remained a contender because it represented only four years and had mixed folds. Entry-known trend/volatility/session/room filters also remain named challengers: several looked strong, but they were selected after finalist inspection and are not silently used by the live scanner.

The atlas found no practical USDCHF registration. Upper-tail magnitude produced no broad improvement and often removed too much history. Policy decisions/guidance also produced no practical standalone directional recipe in this pass; policy remains context. Inflation did produce pair-specific recipes, but that does not justify a universal heating/cooling trade rule. The Workbench now exposes the complete pair atlas, while Shadow Trader exposes registered, contender, and avoid-directional-use evidence.

This completes the previously paused v3 implementation. Richer policy-language interpretation, volatility-only classification, combined macro/context models, and additional forward observations remain future research—not missing parts of the active v3 contract.

### Deferred Shadow Trader Watchlist and Reaction Review - 2026-08-29

The next Shadow Trader pass should use one stable vocabulary instead of overlapping terms:

- **TP-before-SL rate** is the trade hit rate for the row's exact frozen SL, TP, and expiry. This is the only user-facing name for that percentage. It is contract-dependent and must not be relabelled as proof that price respected the news.
- **Evidence reaction** has only two directional labels: `Followed evidence` when the tested price direction matches the economic score, and `Rejected evidence` when the repeatable rule trades opposite it. `No dependable reaction` remains research/avoid rather than a registered trade rule.
- **Average per trade (R)** remains the common profitability result. A low TP-before-SL rate must not automatically disqualify a large-TP setup when its later walk-forward average R is positive.

Deferred Shadow Trader UI work:

- Increase the registered-contract line (`SL 0.75 ATR · TP 4R · 6 H4`, etc.) by approximately 2px and strengthen its contrast without competing with the setup title.
- Add `Soonest registered release` sorting. Future registered releases sort by remaining countdown ascending; rows without a loaded future release appear last. Countdown sorting changes attention order only, never setup quality.
- Make `Highest TP-before-SL` the default at the user's explicit preference. Keep `Best average result` available and retain a short explanation that TP-before-SL percentages cannot be compared as if every row used the same target.
- Rename `Pair / setup` sorting to `Pair / setup (A–Z)`. It means alphabetical market symbol first and setup name second; it is not a performance grouping.
- Display the setup's Evidence reaction as `Followed evidence` or `Rejected evidence` so a successful contrarian rule is unmistakable.

The current Reaction v3 registry contains only one reconstructed EURUSD recipe: US industrial production. Older EURUSD registrations must not be silently discarded or silently restored. Rebuild Euro-area consumer sentiment, US payrolls, and US producer-inflation cooling as new immutable experiments under the current pair-orientation, Forecast Guard/relative-magnitude, exact-package, and later walk-forward engine. Compare each old fixed contract with a predeclared coarse contract matrix selected on development history only. Restore a recipe only when its exact current-engine later walk-forward average remains positive; otherwise classify it explicitly as a contender or avoid-directional-use result and preserve the reason.

Run a dedicated rejection-pattern review after the EURUSD reconstruction. The Reaction Atlas already tested both follow and reject directions, so this review must audit and surface its strongest non-duplicated rejection results rather than invent unrestricted filters. For every sufficiently sampled package, retain one of `Followed evidence`, `Rejected evidence`, or `No dependable reaction`, together with its fixed contract, later N, TP-before-SL rate, and average R. Rejection is a successful discovery when the opposite mapping remains historically positive under a frozen, no-lookahead walk-forward recipe.

#### Separate Evidence Reaction from Trade Execution

The GBPUSD US-labor-claims release at `15:30 · 23 Jul 2026 · UTC` is the canonical motivating case. The frozen Short entered at `1.33418`, initially moved approximately 69 pips in the expected direction to `1.32728` (about `+1.39R` maximum favourable excursion), but its `2 ATR SL / 4R TP` contract required a target near `1.31434`. Price later reversed and crossed the `1.33914` stop during the `12:00 · 30 Jul 2026 · UTC` H4 candle. The immutable trade result is correctly `SL reached · -1R`; the initial evidence reaction was nevertheless directionally correct. Later decline after the stop is outside that trade lifecycle.

FMS must therefore answer two separate questions for every registered recipe and historical case:

1. **Did price respond to the evidence?** Classify the frozen pair/event mapping as `Followed evidence`, `Rejected evidence`, or `No dependable reaction`, using direction-adjusted price response at predeclared `1/3/6/12/30 H4` horizons.
2. **Did the declared trade contract monetize that response?** Report TP-before-SL, SL-before-TP, expiry, result R, and average R for the exact SL/TP/duration contract.

Do not call a stopped trade a direction failure when it first produced meaningful favourable movement. Do not call favourable movement a profitable trade when the declared exit was never achieved. Shadow Trader and arrow audits should display both without allowing either to overwrite the other.

Use a four-outcome audit instead of one overloaded `win/loss` label:

| Evidence reaction | Frozen trade | Meaning |
| --- | --- | --- |
| Followed | Profitable | The directional rule and execution contract both worked. |
| Followed | Unprofitable | The direction had information, but the entry/SL/TP/expiry failed to monetize it. |
| Rejected | Profitable | The registered contrarian rule and its execution contract both worked. |
| Rejected or wrong | Unprofitable | The directional premise failed and execution did not rescue it. |

This table is descriptive, not a new scoring input. A case may move favourably first and still stop later; classification must therefore use predeclared horizons and thresholds, never the most flattering future point chosen after seeing the chart.

#### Two Independent Research Gates

Treat signal quality and trade quality as separate gates:

1. **Reaction gate:** determine whether the exact frozen evidence mapping has a repeatable direction at declared `1/3/6/12/30 H4` horizons. Report positive-response rate, median direction-adjusted return, distribution, MFE/MAE, and N. Do not use TP-before-SL as a synonym for direction accuracy.
2. **Execution gate:** determine whether a fully declared entry, SL, TP, expiry, and management rule produces positive later walk-forward average R. Report TP-before-SL, SL-before-TP, expiry, ambiguity, average R, drawdown, losing streak, and N.

A recipe may remain valuable reaction knowledge when it fails the execution gate. It may become a registered trade setup only when one immutable execution contract also survives its later walk-forward evaluation. This prevents FMS from discarding a useful directional event merely because its first tested target was too ambitious, while also preventing favourable hindsight movement from being sold as a tradable profit.

Add the following immutable path diagnostics to completed-case audits and aggregate recipe summaries:

- maximum favourable excursion (MFE) in R and pips before the trade closes;
- maximum adverse excursion (MAE) in R and pips;
- time/candle count to MFE and MAE;
- direction-adjusted return after `1/3/6/12/30 H4` candles;
- percentage of cases with positive direction-adjusted response at each horizon;
- median response and distribution, not only the average;
- how frequently price reached `+0.5R`, `+1R`, `+1.5R`, `+2R`, `+3R`, and `+4R` before the original stop;
- giveback from MFE to the final trade result.

Research execution as a separate challenger layer while preserving the registered parent signal:

- fixed TP challengers across the existing declared R grid;
- maximum-duration challengers across the existing H4 grid;
- break-even challengers activated only after predeclared favourable thresholds;
- ATR trailing-stop challengers with predeclared activation and distance;
- optional staged/partial-exit challengers only after single-exit results are understood;
- development-only contract selection followed by untouched later walk-forward evaluation;
- nearby-contract stability, drawdown, losing streak, and omitted-cost diagnostics remain visible.

Never retrofit a break-even or trailing rule because it rescues this one GBPUSD example. The case identifies the research question; historical development data selects a challenger; later walk-forward data judges it. A replacement execution contract may be promoted only as a new immutable recipe version, while the original result remains reproducible.

For each parent reaction recipe, use this controlled execution sequence:

1. reproduce the original frozen contract unchanged;
2. build one reusable path artifact from post-entry M1/H4 candles so challengers do not repeatedly rescan price history;
3. test only the predeclared coarse SL/TP/expiry matrix on development data;
4. allow at most a small declared set of break-even/trailing challengers after the fixed-exit comparison;
5. freeze the development-selected challenger before reading later walk-forward results;
6. retain both the original and challenger records, including failures;
7. promote the challenger only if its later average R is positive and the improvement is not explained by one year, one package, or a few extreme trades.

MFE is an audit measurement, not an exit price known in real time. `Best open profit` must never be counted as realized R unless a predeclared exit rule could actually have captured it. Same-candle SL/TP ordering must continue to use M1 when available and remain ambiguous when even M1 cannot establish order.

#### Planned Shadow Trader Presentation

Keep the watchlist compact, but let an opened setup audit state the complete result hierarchy in plain language:

- `Evidence reaction: Followed / Rejected / No dependable reaction`;
- `Best open profit before close: +x.xxR · x pips`;
- `Final trade result: TP / SL / Expired · x.xxR`;
- `Why they differ`, when meaningful favourable movement was later surrendered;
- exact entry, stop, target, expiry, and close timestamps;
- aggregate TP-before-SL, average R, reaction-follow/reject rate at the selected fixed horizon, and later N.

The watchlist remains action-oriented: countdown and current state first, setup identity and reaction type second, historical trade expectancy third. Detailed path diagnostics belong in the arrow audit or an expanded row, not squeezed into the fixed watchlist columns.

#### Grand Implementation Pass: More Registrations and Actionable Reaction Knowledge

The next implementation goal is not merely another UI pass. It must leave FMS with more honestly registered, non-duplicated setups where the available history supports them, and with a reusable explanation for cases where a correct initial reaction did not become a profitable frozen trade.

Execute this as one traceable pipeline:

1. **Freeze the discovery protocol before reviewing new winners.** Reuse the completed seven-pair Reaction Atlas and its declared scoring policies, magnitude treatments, follow/reject directions, response horizons, and coarse execution grid. Do not invent a title filter after seeing its result.
2. **Use a practical registration gate.** A recipe may enter the practical registry when its immutable current-engine experiment has enough usable history and positive gross average R in development, later walk-forward, recent, and overall partitions. Statistical intervals, year stability, neighbouring contracts, drawdown, sample size, and omitted costs remain visible risk diagnostics; an academic lower-bound test is not an automatic veto. Marginal positive results must be labelled as such rather than presented as equally strong.
3. **Prevent duplicate or contradictory registrations.** Deduplicate by market plus exact package identity. If follow and reject mappings compete for the same package, retain the development-selected mapping and show the losing alternative in research diagnostics; never emit simultaneous opposing arrows from the same release package.
4. **Materialize every surviving rule as immutable evidence.** Each registration must reference its experiment id, dataset fingerprint, scoring policy, magnitude treatment, direction mapping, entry rule, SL, TP, expiry, activation boundary, development result, later result, recent result, TP-before-SL rate, and average R. A setup does not become registered from an Atlas summary alone.
5. **Reconstruct the missing EURUSD legacy ideas under the current engine.** Re-audit Euro-area consumer sentiment, US payrolls, and the exact US producer-inflation cooling package. Preserve exact-title/package semantics. Compare the old declared contract with the predeclared coarse matrix, using development only for selection. Restore only positive current-engine survivors; otherwise preserve them as contender or avoid knowledge.
6. **Mine the remaining non-duplicated practical survivors across all seven pairs.** Prioritize candidates whose development, later, recent, and overall gross averages are all positive, including valid rejection mappings. Do not require a high TP-before-SL percentage when a larger target still gives positive later average R. Do not register a result merely because one partition or one historical year is spectacular.
7. **Reconcile the live product from immutable records.** Update the registered-reaction model, Charts arrows, signal audits, and global Shadow Trader from the exact same registry source. There must be no handwritten UI-only setup and no registered backend setup missing from the watchlist.
8. **Add the reaction-versus-execution audit.** For each historical signal, calculate MFE, MAE, time to each extreme, fixed-horizon direction-adjusted responses, threshold reaches, giveback, and final frozen-contract result. The GBPUSD labor-claims case must visibly read as an initially followed reaction that later stopped out, not as either an unqualified success or an unexplained contradiction.
9. **Keep execution research subordinate and reproducible.** Break-even, trailing, different expiry, and staged exits are challengers to an existing signal recipe. Select them on development history and audit them later; never rewrite the original trade result or retrofit the July GBPUSD case.
10. **Make Shadow Trader operationally scannable.** Default to `Highest TP-before-SL`; add `Soonest registered release`, `Best average result`, and `Pair / setup (A-Z)`. Enlarge contract text, show countdowns, display `Followed evidence` or `Rejected evidence`, and keep average R beside the exact TP/SL contract. Expanded audits carry path details; fixed watchlist rows remain compact.
11. **Publish a reaction/execution matrix for every recipe.** Aggregate the four outcomes above, show the declared reaction horizon, and let users distinguish `direction worked, trade failed` from `direction failed`. Never collapse these into one accuracy percentage.
12. **Use loss review to create hypotheses, not exceptions.** Cluster losses by failure mode: wrong direction immediately, adverse move before favourable move, favourable move then full giveback, target too distant, expiry too short, or unresolved intrabar order. Any proposed remedy must be tested across the complete parent recipe, not applied only to the chart that inspired it.
13. **Stop expanding a recipe honestly.** Mark execution research exhausted when the declared fixed matrix and small management challenger set fail later walk-forward profitability or produce unstable neighbouring results. Preserve the reaction finding and move to another family/pair instead of adding bespoke filters.

Registration strength should be communicated in plain language without changing whether the setup exists:

- **Stronger history:** positive development, later, recent, and overall averages with useful N and broad stability.
- **Positive but fragile:** positive required averages but small N, weak interval, concentrated years, unstable neighbours, or large drawdown.
- **Contender:** interesting reaction or expectancy that fails one required positive partition or lacks enough later history.
- **Avoid standalone direction:** repeated evidence that the economic sign by itself does not provide a dependable directional rule.

The pass is complete only when all of the following are proven from current artifacts, not inferred from code intent:

- every newly registered setup has a reproducible immutable experiment and later walk-forward result;
- no market/package has conflicting live directions or duplicate release-package arrows;
- the three legacy EURUSD recipes have an explicit reconstructed outcome;
- Charts and Shadow Trader expose the same expanded registry;
- the GBPUSD `23 Jul 2026` case shows both its favourable excursion and its eventual stop result;
- every registered row exposes separate reaction and execution gates, their horizons/contracts, and their four-outcome counts;
- no MFE or best-future-path value is presented as realized profit;
- sorting, countdown, reaction labels, and larger contract text work without clipped rows or whole-page overflow;
- targeted bridge/frontend tests, TypeScript typecheck, production build, and `git diff --check` pass;
- the user manually audits Charts and Shadow Trader at `1440x900`, `100%` Chrome zoom because automated browser auditing remains intentionally excluded.

This pass may discover that some markets genuinely have no additional practical survivor. That is still valuable knowledge, but it is not permission to stop after querying only the existing strict candidate list. The implementation must run the declared practical screen, reconstruct the missing EURUSD ideas, inspect rejection mappings, materialize all survivors, and preserve every rejected result with its exact reason before calling the dataset exhausted.

### Registered Reaction v4 Implementation Result - 2026-08-29

The declared practical screen and EURUSD reconstruction are complete. `FMS-REGISTERED-REACTION-H4-v4` contains 47 non-duplicated immutable registrations:

| Market | Registered setups |
| --- | ---: |
| EURUSD | 9 |
| GBPUSD | 5 |
| USDJPY | 13 |
| AUDUSD | 5 |
| USDCAD | 7 |
| NZDUSD | 5 |
| USDCHF | 3 |

All 47 rows reconcile with completed immutable experiments. No market/package identity has simultaneous continuation and rejection registrations. Thirty-six registrations are labelled `Stronger history`; eleven small, concentrated, or near-zero later-positive survivors remain available but visibly labelled `Positive but fragile` rather than being presented as equivalent evidence.

The missing EURUSD ideas were reconstructed under the current engine rather than copied from old summaries:

- US payroll: later `N 14`, approximately `+0.250R` under `2 ATR / 1R / 6 H4`;
- Euro-area consumer sentiment: later `N 26`, approximately `+0.385R` under `1 ATR / 2R / 30 H4`;
- exact four-title US producer-inflation cooling package: later `N 11`, approximately `+0.525R` under `2 ATR / 1.25R / 18 H4`.

The registered-reaction audit now freezes a separate six-H4 direction check over chronological later-test cases. This produced an important finding: **positive trade expectancy and short-horizon directional alignment are not interchangeable**. Several profitable frozen contracts have fewer than half of later cases positive at exactly six H4 candles, while their asymmetric targets, expiry results, or longer paths still produce positive average R. Conversely, a case can move correctly at six H4 and later stop. Therefore:

- TP-before-SL must not be renamed directional accuracy;
- a registered continuation/rejection mapping describes the frozen recipe, not a promise that every case follows it;
- Shadow Trader must show both the six-H4 reaction result and the final frozen trade result;
- the reaction horizon is a diagnostic and does not replace the registered execution contract;
- future execution tuning must optimize on development history and validate later, rather than choosing the most flattering horizon per setup after inspection.

The canonical GBPUSD labor-claims case reproduces this distinction exactly: the Short produced about `+1.39R` / `69 pips` MFE, remained positive after 1, 3, 6, and 12 H4 candles, then reversed and stopped at `-1R`; its 30-H4 direction-adjusted response was negative. FMS now retains the initial information and the failed trade without rewriting either.

### Grand Plan: Reaction-First FMS Refinement

The next goal is not to loosen every rule until more arrows appear, nor to treat the current `47` registrations as finished trading systems. It is to separate three questions that the earlier UI and research sometimes blended together:

1. **Was the economic interpretation correct?** The package produced a frozen Long or Short mapping from information available at release time.
2. **Did price respect that direction?** Direction-adjusted price response is measured independently at fixed horizons and through the complete post-entry path.
3. **Could a declared trade contract monetize it?** Entry, SL, TP, expiry, and optional management rules determine the realized simulated R result.

The GBPUSD labor-claims example is the reference case: the answer was `yes`, `yes initially`, and `no` respectively. This is valuable evidence, not a contradiction and not permission to rewrite the loss.

#### Phase 1 - Freeze truth before further tuning

- Preserve `FMS-REGISTERED-REACTION-H4-v4` and all 47 recipes as an immutable baseline. Any changed scoring, reaction horizon, or execution rule creates a new challenger; it never edits v4 history.
- Reconcile every arrow, Workbench experiment, Reaction Atlas row, and Shadow Trader row to one immutable experiment id, dataset fingerprint, exact package identity, pair orientation, direction mapping, and execution contract.
- Finish golden raw-row cases for each setup so Actual/Forecast/Previous values, score direction, entry candle, and outcome cannot silently disagree across surfaces.
- Treat gross historical expectancy as research evidence only. Spread, slippage, commission, swap, first-seen latency, and real fills remain unresolved until measured rather than guessed.

#### Phase 2 - Build a reaction curve for every recipe

- Calculate direction-adjusted returns at `1/3/6/12/18/30/42/60 H4` from the first strictly later H4 entry, using only candles after that entry.
- Retain positive-response rate, median and mean response R, distribution bands, MFE, MAE, time to MFE/MAE, and giveback for every horizon.
- Select at most one **declared reaction horizon** per recipe using development history only. Later walk-forward and recent periods judge that choice; they never select it.
- Classify the recipe in plain language:
  - `Usually followed` when the frozen evidence direction repeats sufficiently at its declared horizon;
  - `Usually rejected` when the opposite direction repeats sufficiently;
  - `Volatility response only` when movement is material but direction is unstable;
  - `No dependable reaction` when neither direction nor volatility behavior is stable.
- Never equate TP-before-SL with directional respect. Display both measurements side by side.

#### Phase 3 - Turn losing trades into aggregate research questions

- Classify every losing case, without changing its result, as one or more of:
  - `Wrong direction early`;
  - `Adverse move before favourable move`;
  - `Favourable move, then giveback`;
  - `Target exceeded the typical favourable path`;
  - `Expiry ended before the typical reaction matured`;
  - `Stop too close for the typical adverse path`;
  - `Both levels touched inside one M1 candle - order unknown`;
  - `No dependable path pattern`.
- Aggregate those labels per recipe and pair. One memorable chart may reveal a question, but only the complete parent sample may justify a challenger.
- Add path-efficiency diagnostics: percentage reaching `+0.25/+0.5/+1/+1.5/+2/+3/+4R`, percentage giving back half or all MFE, median favourable/adverse excursion, and time-to-threshold distributions.
- Do not present MFE, an ideal exit, or the best observed threshold as realized profit.

#### Phase 4 - Test a small predeclared execution challenger set

- Keep the economic direction and case membership frozen while testing execution. This prevents a better exit from being mistaken for a better signal.
- Use a bounded, declared grid rather than unrestricted optimization:
  - SL: `0.75/1/1.5/2 ATR`;
  - TP: `0.5/1/1.5/2/3/4R`;
  - maximum duration: `6/12/18/30/42/60 H4`.
- Add only a small management challenger set after the fixed grid is audited:
  - original fixed exit;
  - break-even after a declared favourable threshold;
  - one ATR-based trailing rule activated after a declared threshold;
  - time exit at the recipe's development-selected reaction horizon.
- Select one challenger on development history using average R, drawdown, neighbouring-contract stability, and adequate N. The untouched later walk-forward period determines whether it survives.
- Reject a challenger that merely rescues a single case, depends on a tiny subgroup, or improves average R by concentrating profit in one year.

#### Phase 5 - Maintain two honest knowledge layers

- **Reaction knowledge:** packages that show repeatable follow, rejection, or volatility behavior, even when no profitable execution contract survives.
- **Trade registry:** the non-duplicated subset whose frozen direction and one fixed execution contract retain positive later walk-forward expectancy.
- A reaction-qualified recipe is not automatically a trade. A trade-qualified recipe must always retain its parent reaction audit.
- Preserve negative results as `Avoid standalone direction` or `Execution exhausted`; they tell the user which releases should not be traded from their economic sign alone.

#### Phase 6 - Promote only reproducible improvements

- A new registered setup or replacement contract must have positive development, later walk-forward, recent, and overall gross average R under one immutable recipe.
- Small N, weak intervals, unstable years, concentrated profits, large drawdown, or fragile neighbouring parameters do not automatically erase positive history, but they must remain prominent strength labels.
- Deduplicate by pair plus exact release package. Competing follow/reject mappings cannot both produce a live arrow for the same package.
- Prefer a simpler neighbouring contract when performance is materially similar. Do not publish the single sharp historical maximum.
- Stop searching a parent recipe after the declared grid and management challengers are exhausted. Move to another family or pair instead of creating bespoke filters.

#### Phase 7 - Make Shadow Trader usable without hiding uncertainty

- The watchlist should answer, in order: `What is being hunted?`, `When is the next release?`, `What would open Long/Short/No trade?`, `What fixed contract would be used?`, and `How has this exact recipe behaved later in history?`.
- Each active or historical decision should show:
  - triggering package and frozen A/F/P evidence;
  - evidence direction and declared reaction horizon;
  - whether this case followed or rejected the evidence;
  - best/worst path and giveback;
  - final frozen trade result;
  - aggregate reaction rate, TP-before-SL, average R, later N, and strength label.
- The global setup table should support `Soonest release`, `Highest average R`, `Highest TP-before-SL`, and `Pair/setup A-Z`, while explaining that the first two performance statistics answer different questions.
- `No trade` must state the exact failed rule. Missing, zero, conflicting, partial, or Forecast-guarded evidence must never be collapsed into a vague status.

#### Completion gates for the next implementation pass

The next pass is complete only when:

- every v4 recipe has a reproducible reaction curve and aggregate loss-path classification;
- the four reaction/execution outcome cells reconcile exactly to the later-test N;
- the canonical GBPUSD case shows `direction followed initially`, `favourable then giveback`, and `SL reached -1R` simultaneously;
- the bounded execution challengers are selected on development history and evaluated on untouched later history;
- surviving challengers become new immutable experiments rather than rewritten v4 records;
- reaction-only findings and avoid-direction findings remain searchable even when they produce no arrow;
- Charts, Shadow Trader, Workbench, and the atlas use the same registry and terminology;
- no UI calls MFE realized profit, TP-before-SL directional accuracy, or historical expectancy a guaranteed future result;
- targeted bridge/frontend tests, typecheck, production build, and `git diff --check` pass;
- the user manually audits Charts and Shadow Trader at `1440x900`, `100%` Chrome zoom with no clipped text, overlap, accidental page scroll, or ambiguous state.

This plan deliberately seeks more useful setups, but the output may be more than new arrows: it may also prove that an event has a repeatable reaction but no robust execution, or that its economic sign should be avoided as a standalone direction. All three outcomes improve FMS.

## Research Warnings and References

Hypothetical results do not represent executed trades and can overstate or understate real performance. The Lab must identify all results as simulated, disclose excluded costs, and avoid claims that similar live profits are likely. See the [CFTC guidance on hypothetical trading-system results](https://www.cftc.gov/LearnAndProtect/AdvisoriesAndArticles/fraudadv_tradingsystem.html).

Trying many configurations and selecting the historical winner can produce a strategy that fails out of sample. The immutable version and trial registry exists specifically to limit this problem. See [The Probability of Backtest Overfitting](https://papers.ssrn.com/sol3/Papers.cfm?abstract_id=2326253).
