# ISM Manufacturing R1.2 review

Read-only Elev8-Demo2 inventory through 2026-10-10T12:00:00.000Z; browser overrides were not read. This supersedes the Orders-only model. Stored snapshots are not proof of original publication-time availability.

## Accepted policy

MT5 supplies New Orders 45%, PMI 30%, Employment 15%, Prices Paid 10%. Each uses its own Actual minus revised/supplied prior and compatible per-series calibration. Fractional magnitude interpolates through (0,0), (Small,1), (Medium,2), (Large,4), capped at four. No forecasts, standalone Production proxy or external scoring feed. Missing/invalid inputs retain their nominal budgets; a newer partial publication replaces the prior slot. Above/below 50 is state context, never an additional directional vote.

[ISM methodology](https://www.ismworld.org/supply-management-news-and-reports/reports/seasonal-adjustment-factors/) explains the headline's five equal components, including Orders, Employment and Production. This deliberately overlapping model emphasizes demand while retaining the composite. [ISM's March 2020 discussion](https://www.ismworld.org/supply-management-news-and-reports/news-publications/inside-supply-management-magazine/blog/2020-04/rob-roundup-march-pmi/) shows why delivery delays can cushion PMI during deteriorating activity. Prices Paid measures input-price conditions, not a percent consumer-inflation rate or stronger output. Its positive mapping is an explicit inflation-pressure policy; [the Fed](https://www.federalreserve.gov/faqs/economy_14419.htm) targets consumer PCE inflation. These sources justify roles, not uniquely optimal numerical weights.

Relationships allocate the existing manufacturing budget first, then route Orders/PMI to Activity, Employment to Labor and Prices Paid to Inflation. Baseline shares are 75/15/10 within that budget. No aggregate manufacturing vote is added on top. Full-scope manufacturing remains 1.5% overall (former Activity 15% × Manufacturing 10%). Effective category budgets become Inflation 35.15%, Labor 30.225%, Activity 14.625%, Fed 20%. Other families retain their assigned global budgets. Selected-subset normalization occurs before routing; manufacturing alone remains one 100% budget. Unknown/stale inputs retain the same role budgets. Category scores normalize within their routed allowance, and Inspector exposes each actual overall share. Consumer CPI/PCE replacement and matching-month PPI still operate within their original consumer/producer allowance. The signed sum resolves before side rounding; intermediate allocations do not round individual values, preventing a false lead from fractional cancellation.

## Replay and sensitivity

142 publications; 82 fully scorable and 60 partial/unavailable under earlier-history automatic boundaries (minimum 60 prior usable observations). 59 complete releases contain both signs.

| Model | Strengthening | Weakening | Balanced | Insufficient |
| --- | ---: | ---: | ---: | ---: |
| Orders-only fractional comparator | 41 | 40 | 2 | 59 |
| Four-input R1.2 | 39 | 43 | 0 | 60 |

5 complete directions change under the four nearby weight alternatives 40/35/15/10, 50/25/15/10, 40/30/20/10, 40/30/15/15. 8 change under the joint weight and independent ±10% boundary variants. Sensitive dates (weights): 2021-06-01, 2023-07-03, 2023-08-01, 2024-01-03, 2026-04-01. 8 complete directions differ from Orders-only. These tests describe robustness to specified alternatives, not measured currency accuracy. No price fitting was performed.

## October 1 example

| Input | Weight | Actual | Previous | A−P | Automatic limits | Signed points | Raw evidence |
| --- | ---: | ---: | ---: | ---: | --- | ---: | ---: |
| New orders | 45% | 55.3 | 53.7 | 1.6 | 2.6 / 4.7 / 7.8 | 0.62 | 27.69 |
| Manufacturing PMI | 30% | 54.5 | 54.6 | -0.1 | 1.3 / 2.1 / 3.9 | -0.08 | -2.31 |
| Employment | 15% | 52.7 | 51.2 | 1.5 | 2.1 / 3.6 / 5.2 | 0.71 | 10.71 |
| Prices paid | 10% | 77.9 | 71.1 | 6.8 | 3.9 / 6.4 / 11 | 2.17 | 21.74 |

strengthening, moderate evidence: supportive 60.15, negative -2.31, net 57.84. Improving orders outweighs softer manufacturing conditions. Direction stays positive in the tested alternatives. These automatic replay bands can differ from the user's manual bands.

## Full-scope snapshots

| Publication UTC | Orders-only overall net | Four-input overall net | Known coverage | Four-input direction |
| --- | ---: | ---: | ---: | --- |
| 2026-08-03 | -26.51 | -26.24 | 100.00% | weakening |
| 2026-09-01 | 2.64 | 2.76 | 100.00% | strengthening |
| 2026-10-01 | 24.60 | 24.59 | 100.00% | strengthening |

## Verification

All 142 publications reconcile contributions, retain bounded scores and nominal uncertainty, and reproduce after removing future inventory. Each single-family relationship counts exactly four routed leaves with the same net as standalone. Category shares reconcile to overall evidence. Both production-built workers match the shared engine; all four Scatter inputs and previews match their Inspector contributions. Mounted regressions cover per-input controls, Apply/Reset, incoming Prices Paid changes, settings portability, fixed role budgets, clocks and local previews. Frontend suites, lint and build are recorded in the active objective after completion. Browser appearance/performance and comparison against price remain user review.

Reproduce after building: node frontend/scripts/audit-r1-manufacturing.mjs.
