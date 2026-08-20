# Fyodor Macro Signal Research

**Date:** 2026-08-20
**Status:** Economy v1 was rejected. Country-aware Labor v2, Sentiment v3, Policy/Inflation v5, and Growth v7 remain exploratory source models with immutable forward ledgers. Charts uses frozen multi-source `FMS-EURUSD-MULTI-H4-CQ-v9`, with post-activation Current Model signals strictly separated from hindsight Research Replay.

## Purpose

Fyodor Macro Signal is a local, research-first attempt to answer a narrow question:

> When a registered EUR or USD economic-release package produced a particular directional evidence pattern, how did EURUSD subsequently behave under one frozen H4 trade simulation?

The research surface will be named **Macro Signal Lab**. Its first version will be **FMS-EURUSD-ECO-H4-v1**.

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

V2 was chosen after v1's complete history and holdout were inspected. Therefore, no pre-registration v2 history is untouched validation evidence, regardless of how attractive its historical result appears.

Member-country EUR releases are not assumed irrelevant. They are excluded from v2 because mixing Euro-area, German, French, Italian, and other releases as equal EUR votes would introduce an arbitrary quantity weighting. A member-country or explicitly weighted regional model requires its own future version and validation record.

## Locked Product Decisions

- Version 1 supports EURUSD only.
- Candidates are created by economic releases, not repeatedly on every H4 candle.
- The first model uses registered **Economy** evidence only.
- Inflation and Policy remain visible research context and will be investigated as separate future models before any combined model is considered.
- Directional outputs are **Long bias**, **Short bias**, and **No direction**. They are research classifications, not executable orders.
- The Macro Signal Lab remains the full research surface. Charts may show historically recurring v2 patterns immediately when they pass fixed development-and-holdout gates, but they must be labeled experimental and expose their audit. Forward paper results determine whether those patterns can later be called validated.
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
- The replay allows one position at a time, uses the frozen first strictly later H4 entry, 1x H4 ATR(14) stop, current 2R target, 30-H4 expiry, and sequential balance compounding. Later overlapping signals are skipped until the open simulation resolves.
- The bridge exposes each signal's frozen entry, ATR, stop, and target so the card can show the hypothetical risk amount, stop distance, and EURUSD lot calculation without reconstructing execution geometry in React.
- The historical account uses only patterns eligible for the current v9 registry, but it remains explicitly labeled hindsight Research Replay. It does not leak historical arrows into Current Model.
- Results are gross. Spread, commission, slippage, and swap are excluded and are not estimated. No order is sent to MT5.

The Research Replay audit is vertically inset below the Pair Matrix chart dock so both controls remain usable when the replay card is open.

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

## Research Warnings and References

Hypothetical results do not represent executed trades and can overstate or understate real performance. The Lab must identify all results as simulated, disclose excluded costs, and avoid claims that similar live profits are likely. See the [CFTC guidance on hypothetical trading-system results](https://www.cftc.gov/LearnAndProtect/AdvisoriesAndArticles/fraudadv_tradingsystem.html).

Trying many configurations and selecting the historical winner can produce a strategy that fails out of sample. The immutable version and trial registry exists specifically to limit this problem. See [The Probability of Backtest Overfitting](https://papers.ssrn.com/sol3/Papers.cfm?abstract_id=2326253).
