# PMI fallback and Raycaster tanks — 11 October 2026

Read-only replay: Elev8-Demo2, 8633 versioned rows, 7513 timeline clocks. Default calibration/settings; browser overrides were not read. Late-captured history remains retrospective.

## Availability correction

13 historical euro-area PMI publication clocks now use available same-month sectors when the composite is missing. Their original sector weights are retained; missing selected sectors remain unknown. Fully usable composites, measured zero changes, national overlap and all standalone formulas retain their rules. The replay compares old/new aggregators on identical assessments and conserves the full 100-point budget.

| UTC publication | Old known net | New known net | Old unknown budget | New unknown budget |
| --- | ---: | ---: | ---: | ---: |
| 2015-03-02T09:00:00.000Z | 0 | 0 | 100 | 96.4 |
| 2015-03-04T09:00:00.000Z | 0 | 0 | 83 | 79.4 |
| 2015-08-21T08:00:00.000Z | 0 | 0 | 44.6 | 41 |
| 2015-10-23T08:00:00.000Z | 0 | 0 | 55 | 51.4 |
| 2016-01-06T09:00:00.000Z | -2 | -2 | 63 | 54.6 |
| 2016-05-04T08:00:00.000Z | 0 | 0 | 66 | 57.6 |
| 2016-05-23T08:00:00.000Z | 0 | 0 | 67.6 | 59.2 |
| 2016-06-01T08:00:00.000Z | 0 | 0 | 55.6 | 47.2 |
| 2017-07-24T08:00:00.000Z | 0 | 0 | 61.6 | 53.2 |
| 2017-08-01T08:00:00.000Z | 0 | 0 | 56.6 | 48.2 |
| 2017-08-03T08:00:00.000Z | 0 | 0 | 56.6 | 48.2 |
| 2019-02-05T09:00:00.000Z | 0 | 0 | 61.6 | 53.2 |
| 2019-10-24T08:00:00.000Z | -2 | -2 | 72.4 | 68.8 |

## Named missing reports

The user confirmed blank Actuals in MT5. Stored backfill payloads from 11 October also contain null Actual/raw fields. The release exists; no web value, forecast or older-month reading was substituted.

- 2026-09-23T08:00:00.000Z: known 8.760114361, missing ±12, interval -3.239885639 to 20.760114361; EUR · Available evidence favors strength; Incomplete — PMI unavailable.
- 2026-10-01T08:00:00.000Z: known 8.760114361, missing ±12, interval -3.239885639 to 20.760114361; EUR · Available evidence favors strength; Incomplete — PMI unavailable.
- 2026-10-05T08:00:00.000Z: known 4.676781027, missing ±12, interval -7.323218973 to 16.676781027; EUR · Available evidence favors strength; Incomplete — PMI unavailable.

## Presentation and hygiene

Inspector and Raycaster show qualified available-evidence leads without changing the strict engine classification/interval. No usable inputs remain unavailable; partial zero does not invent a lead. Raycaster tanks use fixed ±100 scales, zero lines, previous-score markers and hatched missing ranges. Compact dated tables separate standalone points and overall changes and conserve displayed totals. Quiet candles retain the last update; hover does no scoring, fetching or worker dispatch.

Removed two unreachable workers (old R1 and Claims analysis); retained actual pair/history/timeline and Claims standalone workers and all retired views. The active objective is compacted with its full previous content archived, and navigation/settings descriptions name the current owners/rules.

## Verification

Built production timeline worker matches the pure timeline exactly, including missing-input metadata. Focused unit/mounted tests cover fallback availability, zero composite, stale/new-month/excluded sectors, missing-budget conservation, real corrections, signed tank positions/crossings, compact-row totals and deterministic zero hover work.

Repository verification on 11 October: all 73 sequential frontend suites passed, including the assembled terminal responsiveness suite; lint and TypeScript/Vite production build passed. The import/export/dynamic import/worker/CSS graph reaches all 463 source files from bootstrap, with no unresolved relative references or unreachable files. Active navigation links and git diff whitespace checks passed. These checks do not prove absence of every possible dead branch. Browser layout/performance and rapid-hover appearance remain user review.

Reproduce: pnpm --dir frontend exec node scripts/audit-r1-pmi-tanks.mjs.
