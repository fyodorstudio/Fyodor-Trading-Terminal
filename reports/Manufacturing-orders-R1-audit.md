# Manufacturing New Orders R1.1 review

Read-only Elev8-Demo2 inventory captured through 2026-10-10T12:00:00.000Z; browser settings were not read or changed. This supersedes the implemented incomplete manufacturing demand model, not historical reports.

## Source decision and scope

The stored MT5 inventory and [provider catalog](https://www.mql5.com/en/economic-calendar/united-states) contain Manufacturing PMI, Prices Paid, Employment and New Orders, but no ISM Production series. [ISM's September 2026 report](https://www.ismworld.org/supply-management-news-and-reports/reports/ism-pmi-reports/pmi/september/) does publish Production 56.7 versus 58.3 alongside New Orders 55.3 versus 53.7. Verification of one official report is not a connected, versioned Production history. No external live feed, scraping, reconstructed proxy or database rewrite was introduced.

The user authorized the explicit feed-compatible alternative: **USD-ISM-MANUFACTURING-ORDERS-R1.1**, New Orders 100%, labeled Manufacturing new orders. This is a narrower economic question, not automatic renormalization of missing data. Coverage means completeness of this one-input model, not the full ISM report. Missing/invalid Orders or unavailable nonzero calibration still retain a 100% unknown budget. The 60/40, 50/50 and 70/30 Orders/Production candidates remain unvalidated without eligible Production history; none are represented as tested or disproved.

[ISM methodology](https://www.ismworld.org/supply-management-news-and-reports/reports/seasonal-adjustment-factors/) supports diffusion-index interpretation and confirms headline overlap with components. [ISM's March 2020 explanation](https://www.ismworld.org/supply-management-news-and-reports/news-publications/inside-supply-management-magazine/blog/2020-04/rob-roundup-march-pmi/) documents supply delays cushioning the headline during deteriorating activity. These support the selected economic question; neither source prescribes currency coefficients or fractional magnitude.

## Arithmetic and interpretation

Interpolate magnitude through (0,0), (Small,1), (Medium,2), (Large,4), capped at four, using unchanged per-series boundary precedence and earlier-history calibration. Keep band labels independent of fractional points and round only after weighting. Positive A−P supports USD; negative A−P weakens it; zero is unchanged. Above/below 50 describes expansion/contraction separately and never flips A−P direction. Crossing 50 receives concise context, not an extra vote.

Relationships receive one normalized Orders leaf at the existing manufacturing allocation: 10% of the full activity category, itself 15% of full overall USD evidence. Freshness and user-selected category normalization remain unchanged. PMI supplies publication/reference/schedule metadata only: a newer report with missing Orders replaces the old slot with unavailable evidence. PMI, Employment, Prices Paid and Fed Manufacturing Production do not enter this score. Legacy scorers and ISM Services are unchanged. Existing Orders settings and unrelated overrides survive; retired Production overrides remain portable and inert. Retired Scatter input selections resolve to Orders.

## Stored replay

142 publications; 83 usable and 59 unavailable under automatic earlier-history calibration (minimum 60 earlier usable observations). Counts use original release snapshots, not proof of original publication-time availability.

| Model | Strengthening | Weakening | Balanced | Insufficient |
| --- | ---: | ---: | ---: | ---: |
| Prior incomplete 60/40 integer model | 6 | 8 | 0 | 128 |
| Orders-only integer comparator | 41 | 40 | 2 | 59 |
| Orders-only fractional R1.1 | 41 | 40 | 2 | 59 |

69 directions change versus the incomplete model; 24 usable evidence-strength labels differ versus Orders-only integer scoring. Fractional magnitude never flips a usable single-input direction. 0 usable directions change under ±10% boundary sensitivity; magnitude/strength can still change. No relative-weight sensitivity is claimed for a one-input model. The gain in coverage is the explicitly narrowed scope, not recovered Production data.

| October 1 input | Actual | Previous | A−P | Limits | Band | Signed points | Raw evidence |
| --- | ---: | ---: | ---: | --- | --- | ---: | ---: |
| New orders | 55.3 | 53.7 | 1.6 | 2.6 / 4.7 / 7.8 | Small | 0.62 | 61.54 |

Result: strengthening, moderate evidence. Manufacturing new orders improved and remain expanding, supporting USD strength. Automatic replay bands are not the user's browser overrides. The opposing Production reading remains outside this explicitly Orders-only result.

## Aggregate snapshots with all families selected

| Publication UTC | Prior overall net | Refined overall net | Prior known coverage | Refined known coverage | Refined overall direction |
| --- | ---: | ---: | ---: | ---: | --- |
| 2026-08-03 | -26.39 | -26.51 | 99.40% | 100.00% | weakening |
| 2026-09-01 | 2.65 | 2.64 | 99.40% | 100.00% | strengthening |
| 2026-10-01 | 24.60 | 24.60 | 99.40% | 100.00% | strengthening |

## Verification and remaining checks

All 142 publications reconcile contributions, retain the cap and reproduce after future-inventory removal. Both production-built workers match the shared engine. Scatter points and preview match Inspector; activity consumes exactly one normalized manufacturing vote. Unit/mounted tests cover level-versus-change cases, revised baselines, missing data, unrelated input exclusion, dormant settings portability, retired selections, preview/Apply/Reset and display-clock stability. Frontend suites, lint and build are recorded in the active objective after completion. Browser appearance/performance and comparison with price remain user review; no price fitting, forecasts or extra contextual votes entered the score.

Reproduce after building: node frontend/scripts/audit-r1-manufacturing-orders.mjs.
