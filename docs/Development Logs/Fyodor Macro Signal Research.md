# Fyodor Macro Signal Research

**Date:** 2026-08-18
**Status:** Frozen v1 baseline completed and rejected for Charts. Country-aware labor v2 is registered as an exploratory model and awaits its first run plus genuinely post-registration forward evidence.

## Purpose

Fyodor Macro Signal is a local, research-first attempt to answer a narrow question:

> When a registered EUR or USD economic-release package produced a particular directional evidence pattern, how did EURUSD subsequently behave under one frozen H4 trade simulation?

The research surface will be named **Macro Signal Lab**. Its first version will be **FMS-EURUSD-ECO-H4-v1**.

The feature is intended to reduce manual economic-data reading and make historical behavior auditable. It is not an automatic order system, a guarantee of profit, or proof that an economic release caused a price move.

## Registered Versions

- `FMS-EURUSD-ECO-H4-v1` is the immutable Economy baseline. It uses the legacy `currency + normalized title` series identity and is permanently recorded as **No validated edge**.
- `FMS-EURUSD-LABOR-H4-v2` is the active exploratory version. It retains only registered Labor rules, identifies an exact series with `currency + country/region code + normalized title`, and initially scopes EUR to aggregate `EU` rows and USD to `US` rows.

V2 was chosen after v1's complete history and holdout were inspected. Therefore, no pre-registration v2 history is untouched validation evidence, regardless of how attractive its historical result appears.

Member-country EUR releases are not assumed irrelevant. They are excluded from v2 because mixing Euro-area, German, French, Italian, and other releases as equal EUR votes would introduce an arbitrary quantity weighting. A member-country or explicitly weighted regional model requires its own future version and validation record.

## Locked Product Decisions

- Version 1 supports EURUSD only.
- Candidates are created by economic releases, not repeatedly on every H4 candle.
- The first model uses registered **Economy** evidence only.
- Inflation and Policy remain visible research context and will be investigated as separate future models before any combined model is considered.
- Directional outputs are **Long bias**, **Short bias**, and **No direction**. They are research classifications, not executable orders.
- The Macro Signal Lab lives as a separate Specialist Tools surface. Charts integration is deferred until a frozen version has credible holdout evidence and forward paper results.
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
- Later versions require forward paper validation before Charts promotion.

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
5. Add forward paper-signal tracking for any version that meets the predeclared research gate.
6. Consider Charts arrows only after holdout review and forward paper validation.
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

`FMS-EURUSD-LABOR-H4-v2` was registered at `2026-08-18 09:27:32 UTC`. Historical results before that timestamp are exploratory reused data. Only subsequently released broker rows can accumulate forward-paper evidence.

The forward gate was frozen before observing any post-registration v2 outcomes:

- at least 365 elapsed calendar days;
- at least 100 evaluable forward 2R observations;
- an approximate 95% lower expectancy bound above zero;
- no more than 5% ambiguous outcomes;
- an approved transaction-cost model before any Charts promotion.

Even passing this gate does not automatically add an indicator. It permits a separate product and cost-model review.

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

## Research Warnings and References

Hypothetical results do not represent executed trades and can overstate or understate real performance. The Lab must identify all results as simulated, disclose excluded costs, and avoid claims that similar live profits are likely. See the [CFTC guidance on hypothetical trading-system results](https://www.cftc.gov/LearnAndProtect/AdvisoriesAndArticles/fraudadv_tradingsystem.html).

Trying many configurations and selecting the historical winner can produce a strategy that fails out of sample. The immutable version and trial registry exists specifically to limit this problem. See [The Probability of Backtest Overfitting](https://papers.ssrn.com/sol3/Papers.cfm?abstract_id=2326253).
