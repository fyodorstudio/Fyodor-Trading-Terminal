# Inspector daily grouping — 12 October 2026

Filters now save **By release / By day** separately for each canonical pair.
Existing settings default to By release. Daily selection uses one icon per day
and currency; its badge counts series rows, not publications. Each icon opens
one table with publication sections, original source names, native readings,
revised priors and period/revision details. Forecast has a shared column when
supplied. Ten CPI series remain ten rows in their publication section.

Daily grouping uses original publications before policy/PMI display episodes.
Known times follow the selected display timezone; unknown hours retain their
source date. Filtering precedes grouping. No daily scoring release is created;
relationship overlays keep original publication markers. Daily icons remain
selectable after midnight scrolls outside an intraday viewport. Projection moves
only their visual positions and batches viewport callbacks by animation frame.

## Real feed check

A read-only storage query returned 197 observations at revision 182975. Production
grouping, candle projection and table rendering retained all 37 applicable
EUR/USD series for October 13–14 in Asia/Jakarta, with zero omissions:

| Display day | Currency | Releases | Series rows | CPI rows |
| --- | --- | ---: | ---: | ---: |
| October 13 | EUR | 7 | 10 | 0 |
| October 13 | USD | 6 | 6 | 0 |
| October 14 | EUR | 7 | 7 | 0 |
| October 14 | USD | 5 | 14 | 10 |

All four daily icons projected into future chart space using 5,000 actual EURUSD
H1 candles from the read-only bridge. No price candles or source observations
were fabricated or changed. Counts are the captured feed snapshot.

## Regression coverage

All 1,051 catalog types survive daily grouping for each applicable pair across all
28 pairs. Tests cover separate currency buttons, all ten CPI rows, aligned shared
columns, date-only schedules, broker DST boundaries, original policy publications
across midnight, future placement, historical candle gaps, filter changes,
corrections, stable data/callback identities, preview/Save/Cancel, per-pair settings,
legacy defaults and workspace portability.

The assembled production terminal verifies direct icon-to-dock selection, row
count agreement, blank-chart dismissal and zero daily regrouping/scoring jobs
during pan batches. All 77 frontend suites passed. Focused daily, assembled
terminal and viewport responsiveness tests also passed after final edge padding.
Visual layout review remains with the user.
