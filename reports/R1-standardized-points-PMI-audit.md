# R1 standardized standalone points and PMI — 11 October 2026

All R1 standalone presentation uses normalized ±100 points. Combined arithmetic,
weights and boundaries are preserved. Raycaster publication summaries use the
shared assessor; quarterly revision scores remain distinct from retained momentum.
Only the background timeline builds these summaries. Cursor lookup does no scoring.

Read-only stored replay: Elev8-Demo2, 8633 rows,
7512 clocks. Every timeline standalone is bounded at ±100;
353 assessments from 2026 match Inspector net/direction, including sector
and national PMI assessments and quarterly revisions. Combined change parts
conserve the total. The built production timeline worker matches the pure output.
Informational timings: pure 2576 ms, worker 2538 ms;
these do not measure browser responsiveness.

August 19 Euro-area inflation: standalone +12.50, combined
17.597339708 → 12.639006374, overall change
-4.958333334. This separates a supportive new release from
replacement of a stronger existing contribution; it does not resolve the earlier
stored-value discrepancy or explain the exchange-rate rally.

## PMI diagnosis

The named dates lack MT5 Actual and its raw field. The app now identifies that
specific reason and retains independently dated prior-month values/calibration.
It does not substitute official values, forecasts, or old monthly Actual.

- 2026-09-23T08:00:00.000Z: euro-pmi; previous 52; 138 prior comparisons; MT5 Actual is unavailable.
- 2026-10-01T08:00:00.000Z: euro-manufacturing-pmi; previous 52.7; 138 prior comparisons; MT5 Actual is unavailable.
- 2026-10-05T08:00:00.000Z: euro-pmi; previous 52; 138 prior comparisons; MT5 Actual is unavailable.

PMI state at 50 is explained separately from A−P direction. Same-month flash
metadata no longer invalidates a comparison retrieved independently from dated
prior-month history. Composite/sector/national overlap rules remain unchanged.

Primary-source rationale is in the [canonical design](../docs/scoring%20system%20overhaul.md#standalone-point-standardization-and-pmi--11-october-2026).
Reproduce with: pnpm --dir frontend exec node scripts/audit-r1-standardized-pmi.mjs.
Visual review and comparison against price remain with the user.

## Verification

All 72 frontend suites pass sequentially, including the assembled terminal,
mounted USD/EUR Inspector and Scatter, correction/paging propagation and
Raycaster's zero-scoring-work hover regression. Lint and production build pass;
the existing bundle-size warning remains. A latest stored-data query without the
historical as-of limit also confirms the named PMI Actual/raw fields are null.

Manual checks: review the normalized standalone totals/table/Scatter; August 19
release +12.50 beside overall change −4.96; named PMI missing-Actual explanation;
and Raycaster text alignment while hovering. No visual/browser audit was run.
