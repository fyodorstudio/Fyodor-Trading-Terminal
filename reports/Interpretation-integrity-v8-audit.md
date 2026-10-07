# Numerical interpretation integrity audit — 7 October 2026

Completed for USD memory v8, EURUSD relative v3, relationships v3, CPI v4.1 / standalone v3.2, NFP v2.2 and EUR numerical v1.1. This audit accepts faithfully reproduced numerical interpretations, not successful price forecasts. No price series was loaded.

## Dataset and method

Calendar revision 78619, source Elev8-Demo2. The normal chart query was run against a read-only SQLite transaction because the local storage service was unavailable. The frozen input contains 76,971 rows (41,559 USD; 35,412 EUR). Canonical availability, actual, reference and publication-time gates still apply. Numerical USD publications span 1 January 2015 through 5 October 2026.

The audit uses explicit automatic magnitude settings from the prior input snapshot. Browser-local manual preferences were not read or changed. A separate manual CPI override proves numerical features stay identical while their interpretation points can change; all-signal manual calibration parity is also covered in frontend regression suites.

## Repairs tested

- Invalid supplied raw NFP revisions cannot restore a stale comparison. A valid revised-only prior requires an independently established preceding reference. Unsafe CPI rates and non-finite derived features are unavailable, not zero or Extreme.
- Each missing component retains its allocated weight once. USD and normalized EUR context no longer multiply component coverage into the already-partial score again. Overall 60% usable configured coverage and one-third net/gross agreement qualify available evidence; individual missing CPI/NFP do not veto otherwise sufficient evidence. Incomplete directional context is Weak and disclosed.
- Fresh Roofs compare both derived features under limits known at the latest release. Calibration drift, memory renewal and availability changes are separated and cannot vote as fresh news. Stage/component/provenance mismatches block the comparison.
- Zero/cancelling standalone priority is not treated as a nonzero opposing context vote. CPI publication-change arithmetic and update explanations match the canonical context calculation.
- EUR PMI chooses one calibrated Composite / Services / Manufacturing reading. Country proxies and aggregates remain inside one slot budget.

## Historical replay evidence

- 5,696 USD snapshots and 8,299 EUR snapshots; daily aging and deterministic expiry stages are included.
- 15,484 Candy/lookup comparisons across USD-only and EUR-vs-USD modes.
- 15,491 four-part replacement decompositions. Each equals support change + calibration effect + memory renewal + availability/non-comparable residual.
- Nine future-removal assertions at three separated cutoffs: USD snapshot, EUR snapshot and available Roof membership. Removing later observations does not change the earlier output.
- Forecast field perturbation leaves the complete USD timeline and relationships unchanged.
- 140 CPI publications retain identical derived features under an isolated manual magnitude override; 84 scores change as expected.
- No timing exclusions among selected numerical publications. This does not certify original publication vintages.

| USD family | Publications | Computed | Incomplete component coverage |
| --- | ---: | ---: | ---: |
| claims | 606 | 574 | 38 |
| cpi | 140 | 116 | 31 |
| gdp | 137 | 85 | 106 |
| ism | 284 | 230 | 171 |
| nfp | 141 | 115 | 32 |
| pce | 139 | 114 | 31 |
| ppi | 140 | 116 | 30 |
| retail | 144 | 114 | 30 |

Computed and incomplete are overlapping categories. Early missing calibration/history is retained as unavailable rather than filled.

| Available relationship annotations | Count |
| --- | ---: |
| weekly-labor | 30 |
| ism-sectors | 113 |
| fresh-news | 557 |
| labor-inflation | 11 |

These are update annotations and can overlap. Counts are not independent observations, market alignment rates or proof that a relationship is economically optimal.

## Outlier inspection

The fifteen largest feature-to-Extreme-boundary ratios come from 2020 labor publications. The largest is the April 16 Claims four-week comparison: −5,276.25 thousand against a previously known Extreme boundary of 18 thousand. Magnitude remains capped at −4 policy points; a huge native feature cannot expand its budget.

The stored April 16 readings are initial claims 5,245 thousand, four-week initial average 5,508.5 thousand, and continuing claims 11.976 million. Their scale matches the [official DOL release](https://oui.doleta.gov/press/2020/041620.pdf). The app feature compares two non-overlapping four-week points, so it is deliberately different from the release's week-to-week average change. The May 8 payroll feature of −20,500 thousand is consistent with the employment loss scale in the [BLS April 2020 release](https://www.bls.gov/news.release/archives/empsit_05082020.htm). BLS identifies that archived release as reissued; this check does not reconstruct a perfect original vintage.

These spot checks support retaining the extremes, not treating every stored field as officially certified. No observations, magnitude settings, quantile boundaries or economic thresholds were changed to eliminate these outliers.

## Reproduction

From repository root, capture a new file (existing snapshots cannot be overwritten):

```powershell
python frontend/scripts/usd-context/capture-integrity-input.py storage/data/context-v7-baseline.json storage/data/new-integrity-input.json
node frontend/scripts/usd-context/audit-interpretation-integrity.mjs storage/data/new-integrity-input.json storage/data/new-integrity-results.json
```

Inputs/results are local ignored audit artifacts. The committed-facing report records their revision, settings, scope and result counts. Older v7 price-comparison reports remain historical and are not acceptance tests for v8.

## Final regression commands

- `pnpm --dir frontend test`: all 53 registered suites passed in one uninterrupted run.
- `pnpm --dir frontend build`: TypeScript and production Vite build passed.
- `pnpm --dir frontend lint`: clean.
- `git diff --check`: no whitespace errors.

Headless tests include publication cutoffs, invalid/revised/duplicate observations,
simultaneous updates, slot overlap, mode parity, saved settings, shared jobs,
no repeated scoring on hover, pan coalescing and Notebook/workspace snapshots.
They do not replace the user's visual or live performance audit.

## Practical limits and user audit

Formula correctness does not validate weights as measured currency elasticities. Magnitude points are ordinal, evidence grades are not market probabilities, retention/thresholds/policy transfers remain declared prototypes, and stored current vintage cannot certify every original release. Forecast surprise and guidance content are outside these numerical interpreters. Gray manual Outside events never vote.

The user should check selected scope/version, publication versus candle-end timing, amber/gray meanings, qualified Weak partial context, and the distinct meaning of a fresh Roof versus accumulated Candy. Visual/performance audits remain with the user; see `docs/manual edit.md` and `docs/trading workflow.md`.
