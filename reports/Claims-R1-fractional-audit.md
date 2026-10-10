# Claims R1.1 fractional-magnitude review

Read-only Elev8-Demo2 inventory captured through 10 October 2026; publications through 2026-10-08T12:30:00.000Z. Automatic earlier-history bands; browser overrides were not read or changed. Earlier R1 and V3 audits remain historical evidence.

## Accepted rule

Claims retain initial/continuing weights 70/30, native-unit conversion, revised-prior comparisons and per-series boundaries. Interpolate magnitude through (0,0), (Small,1), (Medium,2), (Large,4), then cap at 4. Band names describe the original intervals independently of fractional points. Equal automatic thresholds skip zero-width spans and retain lower-band equality; continuity is asserted for strictly increasing boundaries. Keep fractional points unrounded until weighting; round contributions and balances at the existing calculation precision. Other R1 families and legacy Claims v3 keep their existing magnitude policies. Relationships consume the refined Claims leaves once, retaining their existing budgets and freshness.

The [DOL technical notes](https://www.dol.gov/sites/dolgov/files/OPA/newsreleases/ui-claims/20222224b.pdf) support the separate initial/continuing roles and priority for emerging conditions. Exact weights and interpolation are design policies, not published currency-impact coefficients.

## Replay

607 publications; 547 complete and 60 with unavailable evidence. Of 234 complete opposing-input cases, 89 placed both inputs in Small. Fractional scoring changes 40 complete directions and 0 partial directions versus R1 integer magnitude at the same weights/bands. Every changed complete case has opposing input signs; available same-direction inputs preserve direction. Missing component budgets remain intact.

| Initial / continuing | USD-positive | USD-negative | Balanced | Direction sensitive to ±5 weight points | Direction sensitive to independent ±10% boundaries | Oct 8 raw net |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 60/40 | 309 | 236 | 2 | 27 | 22 | -14.15 |
| 70/30 | 313 | 233 | 1 | 24 | 23 | -5.62 |

Weight/boundary sensitivities count changes including exact cancellation. They measure policy dependence, not accuracy against prices. October 8 remains USD-negative at all weights 55/60/65/70 and all independent boundary factors 0.9/1/1.1 tested.

| October 8 input | A-P (k) | Limits (k) | Band | Signed points | Raw evidence |
| --- | ---: | --- | --- | ---: | ---: |
| Initial claims | -2 | 10 / 20 / 67 | Small | 0.20 | 14.00 |
| Continuing claims | 17 | 26 / 58 / 366 | Small | -0.65 | -19.62 |

Result: USD Weakening, slight evidence; supportive 14.00, negative -19.62, net -5.62.

## Changed complete cases

Each case was reviewed using unchanged weights/bands, opposing input signs and reconciled fractional contributions. This list records both directions of change rather than selecting only favorable examples. All cases reproduce after removing later publications.

| Publication UTC | Initial delta (k) | Continuing delta (k) | Old raw net | New initial evidence | New continuing evidence | New raw net | 60/40 challenger net |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 2016-03-24 | 6 | -39 | -10.00 | -42.00 | 47.31 | 5.31 | 27.08 |
| 2016-06-02 | -1 | 10 | 40.00 | 7.00 | -14.29 | -7.29 | -13.05 |
| 2016-08-11 | -1 | 15 | 40.00 | 7.00 | -21.43 | -14.43 | -22.57 |
| 2016-09-29 | 3 | -46 | -10.00 | -23.33 | 60.00 | 36.67 | 60.00 |
| 2017-04-20 | 10 | -49 | 20.00 | -70.00 | 64.29 | -5.71 | 25.71 |
| 2017-08-10 | 3 | -16 | -40.00 | -21.00 | 24.00 | 3.00 | 14.00 |
| 2017-08-31 | 1 | -12 | -40.00 | -7.00 | 18.00 | 11.00 | 18.00 |
| 2017-11-30 | -2 | 42 | 10.00 | 14.00 | -56.54 | -42.54 | -63.38 |
| 2018-01-04 | 3 | -37 | -10.00 | -21.00 | 50.40 | 29.40 | 49.20 |
| 2018-02-01 | -1 | 13 | 40.00 | 7.00 | -19.50 | -12.50 | -20.00 |
| 2018-05-17 | 11 | -87 | -20.00 | -81.67 | 120.00 | 38.33 | 90.00 |
| 2018-06-07 | -1 | 21 | 40.00 | 7.00 | -30.00 | -23.00 | -34.00 |
| 2018-06-21 | -3 | 22 | 10.00 | 21.00 | -31.15 | -10.15 | -23.54 |
| 2018-08-02 | 1 | -23 | -10.00 | -7.00 | 32.31 | 25.31 | 37.08 |
| 2018-08-30 | 3 | -20 | -40.00 | -21.00 | 28.57 | 7.57 | 20.10 |
| 2019-01-17 | -3 | 18 | 40.00 | 23.33 | -25.71 | -2.38 | -14.29 |
| 2019-05-09 | -2 | 13 | 40.00 | 15.56 | -18.57 | -3.02 | -11.43 |
| 2019-05-23 | -1 | 12 | 40.00 | 7.78 | -17.14 | -9.37 | -16.19 |
| 2019-05-30 | 3 | -26 | -10.00 | -23.33 | 36.00 | 12.67 | 28.00 |
| 2019-09-05 | 1 | -39 | -10.00 | -7.78 | 51.25 | 43.47 | 61.67 |
| 2019-09-19 | 2 | -13 | -40.00 | -15.56 | 17.73 | 2.17 | 10.30 |
| 2020-01-23 | 6 | -37 | -10.00 | -46.67 | 49.20 | 2.53 | 25.60 |
| 2021-11-10 | -4 | 59 | 10.00 | 28.00 | -48.00 | -20.00 | -40.00 |
| 2022-05-12 | 1 | -44 | -10.00 | -7.00 | 37.78 | 30.78 | 44.37 |
| 2022-11-03 | -1 | 47 | 10.00 | 7.00 | -40.80 | -33.80 | -48.40 |
| 2023-02-16 | -1 | 16 | 40.00 | 7.00 | -16.55 | -9.55 | -16.07 |
| 2023-03-23 | -1 | 14 | 40.00 | 7.00 | -14.48 | -7.48 | -13.31 |
| 2023-08-31 | -4 | 28 | 40.00 | 28.00 | -28.97 | -0.97 | -14.62 |
| 2023-11-09 | -3 | 22 | 40.00 | 21.00 | -22.76 | -1.76 | -12.34 |
| 2023-12-07 | 1 | -64 | -10.00 | -7.00 | 56.25 | 49.25 | 69.00 |
| 2024-03-14 | -1 | 17 | 40.00 | 7.00 | -17.59 | -10.59 | -17.45 |
| 2024-03-28 | -2 | 24 | 40.00 | 14.00 | -24.83 | -10.83 | -21.10 |
| 2024-08-29 | -2 | 13 | 40.00 | 14.00 | -14.44 | -0.44 | -7.26 |
| 2024-12-26 | -1 | 46 | 10.00 | 7.00 | -45.83 | -38.83 | -55.11 |
| 2025-04-03 | -6 | 56 | 10.00 | 42.00 | -54.17 | -12.17 | -36.22 |
| 2025-04-10 | 4 | -43 | -10.00 | -28.00 | 43.71 | 15.71 | 34.29 |
| 2025-05-22 | -2 | 36 | 10.00 | 14.00 | -37.71 | -23.71 | -38.29 |
| 2026-01-22 | 1 | -26 | -40.00 | -7.00 | 28.89 | 21.89 | 32.52 |
| 2026-02-26 | 4 | -31 | -10.00 | -28.00 | 33.53 | 5.53 | 20.71 |
| 2026-10-08 | -2 | 17 | 40.00 | 14.00 | -19.62 | -5.62 | -14.15 |

## Verification and limits

All 607 assessments reconcile signed leaves and respect the cap. Every plotted component matches the assessor and magnitude labels; preview endpoints use shared fractional arithmetic. The production-built history worker matches the complete replay; the source worker matches the original release and Claims-only relationship snapshot. Changed cases and October 8 match after future-inventory removal. Unit and mounted integration tests cover zero, continuity, extreme values, tied limits, missing inputs, unchanged other families and display-clock stability.

Stored vintages are not proof of original publication availability. No market prices, forecasts, speeches or four-week trend vote entered this review. This supports preserving relative size and bounded arithmetic; it does not establish uniquely optimal weights or price prediction. Browser appearance/performance remains for manual review.

Reproduce after building: node frontend/scripts/audit-r1-claims-fractional.mjs.
