# Scoring system overhaul

Discussion record, updated 2026-10-09. No application implementation authorized yet.

## Objective and scope

- Interpret an event release as USD-supportive or USD-negative economic evidence; do not predict or explain the subsequent market price movement.
- Exclude forecast. Delta means Actual minus Previous (A-P).
- Keep the primary output simple: USD Strengthening / USD Weakening, with a short explanation and supportive/negative evidence totals.
- Respect the user's existing historical magnitude categories. A magnitude describes the size of a change, not a probability of USD movement.
- Define the family and relationship structure before implementing CPI as the first example, then expand incrementally.

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

- Standalone PCE, PPI, labor, growth and speech interpretation rules.
- Cross-family weighting, comparable scales, shared inflation inputs and overlapping evidence.
- How absolute levels and longer trends should contextualize A-P momentum.
- Freshness, reference-period alignment, revisions and missing inputs.
- Strength labels, magnitude-boundary sensitivity and exact ties.
- Validation benchmark: independent economic interpretation, weight sensitivity and later-release evaluation using data available at each release. Price-return accuracy is a separate objective.
