# US CPI / core CPI


The existing four-rate direction and separate index matrix are the agreed scoring
baseline. The NFP scoring revision does not change CPI series, signs, coefficients,
cancellation priority, or saved per-series magnitude configuration. Changes to
this contract require a new score version and regression coverage.
Rule version: `usd-cpi-vs-previous-v1`. Scope: US / USD, Inspector family `us-cpi`
under Inflation; Scatter Plot EURUSD → USD / Quote → CPI.

## Comparator and colors

Use signed **Actual − supplied Previous**, never Forecast or revised Previous.
Positive delta = **Good/green for USD pressure** under the chosen higher-inflation
convention; negative = **Bad/red**; zero = **Unchanged/gray**. Missing/nonfinite
Actual or Previous, or malformed raw source integers, means Missing/gray.
Unknown series are Unrated. Family/country/currency must match explicitly.

This is a trading convention, not “good for consumers” or an objective FX
prediction. The Fed's policy principles describe raising rates as inflation
rises; this motivates the convention but does not guarantee a currency move.
Price-index changes and inflation-rate changes have different meanings, and
different headline/core/monthly/annual readings overlap. The four-reading score
below is a chosen application rule; equal series weights do not establish equal
economic influence or a calibrated FX prediction.

## Four-reading direction score

Score version: `cpi-eurusd-signed-magnitude-v1`. The Inspector summary contains
Headline m/m, Core m/m, Headline y/y and Core y/y, in that order. Each series has
weight **1**. Its configured magnitude supplies **Unchanged = 0, Small = 1,
Medium = 2, Large = 3, Extreme = 4** points. Apply the sign of Actual minus
supplied Previous: positive points are green bullish USD contributions;
negative points are red bearish USD contributions; exact zero is gray.
The active category cell displays the signed points, not a reading count.

Monthly and Annual subtotals are shown separately, followed by their Total.
Positive Total → **EURUSD Short**; negative Total → **EURUSD Long**. Exact
cancellation uses the first nonzero contribution in this priority order:
Core m/m, Headline m/m, Core y/y, Headline y/y. The table identifies the tie-break.
All four unchanged → **Uncomputed**, with no prior direction carried forward.
There is no Neutral/Mixed output. Monthly and Annual label the source readings,
not short and long holding periods.

All four primary readings must have usable scores before Total/direction is
computed. Undefined magnitude, missing Actual/Previous, duplicate readings,
incompatible units remain explicit unresolved states;
they never become zero or Small. Each subtotal also requires both of its readings.
Custom cutoffs can classify without historical samples. Configured exact-zero
readings need no historical threshold, while Undefined stays Undefined.

Index levels and unadjusted monthly rates remain in the source table and Scatter
Plot but do not contribute to this primary score.
Calculation lives in `grading/cpi-magnitude-score.ts`; presentation lives in
`magnitude/CpiMagnitudeScoreTable.tsx`. NFP's existing direction rule is unchanged.

## Separate price-index matrix

Index score version: `cpi-index-signed-magnitude-v1`. To the left of the primary
rate matrix, **Price indexes** contains Headline adjusted (840030035), Core
adjusted (840030010), Headline n.s.a. (840030009), Core n.s.a. (840030036).
It uses the same 0–4 columns and signed cells, with each index's independently
saved native-point magnitude limits. Positive/green means the price level rose;
negative/red means it fell; zero/gray means unchanged. These are movement points,
not evidence that the inflation rate accelerated or slowed.

Adjusted and n.s.a. subtotals require both readings in their respective group.
Undefined, missing, duplicate or incompatible readings remain unresolved. The
same shared classifier handles frozen manual limits. No index points enter
the rate Total or EURUSD direction, and the index matrix has no FX direction
badge. The two unadjusted monthly percentage rates are not index levels and
remain outside both matrices. No source readings or series are removed.

`grading/signed-magnitude-score.ts` and `magnitude/SignedMagnitudeMatrix.tsx`
share classification, validation and matrix rendering. Index-specific series
and subtotals live in `grading/cpi-index-magnitude-score.ts`; its table wrapper
is `magnitude/CpiIndexMagnitudeTable.tsx`.

The selected release title, display/broker clocks and shared period now occupy
the main Inspector toolbar beside release-list controls and calendar status.
The summary row contains only the matrices and wraps when the dock is narrow.

## Stable inventory catalog

| Event ID | Series | Native A−P | Positive delta interpretation |
| --- | --- | --- | --- |
| 840030005 | CPI m/m | pp | Monthly headline inflation rate increased |
| 840030006 | Core CPI m/m | pp | Monthly inflation excluding food/energy increased |
| 840030007 | CPI y/y | pp | Annual headline inflation rate increased |
| 840030008 | Core CPI y/y | pp | Annual core inflation rate increased |
| 840030009 | CPI n.s.a. | pts | Unadjusted headline price index increased |
| 840030010 | Core CPI | pts | Adjusted core price index increased |
| 840030033 | CPI n.s.a. m/m | pp | Unadjusted monthly headline inflation increased |
| 840030034 | Core CPI n.s.a. m/m | pp | Unadjusted monthly core inflation increased |
| 840030035 | CPI | pts | Adjusted headline price index increased |
| 840030036 | Core CPI n.s.a. | pts | Unadjusted core price index increased |

Catalog labels/units were checked against the selected broker's inventory.
The formatter uses the reading's source metadata; definitions do not overwrite
source units. Rates compare percentage values in percentage points; index
levels compare in index points. For example .4% versus .1% = +.3 pp; index
334.98 versus 333.918 = +1.062 pts. A positive index delta is not an acceleration
of inflation. Adjusted and unadjusted series keep their own histories.

## Magnitude and history

Each series independently selects **Undefined** or **Manual boundaries**.
Undefined is the default: empty Inspector histogram/size and no scatter guides,
with raw dots and delta colors retained. Enter `0 < Small < Medium < Large` in
native units and Freeze. Both signs mirror limits; ties stay in the lower size,
above Large is Extreme. Unfreeze opens a draft while saved limits stay active.
Appearance changes remain separate. Legacy P95 markers become Undefined; existing
manual tuples survive. The score matrix marks unconfigured readings Undefined.

History uses all compatible, usable released readings from January 2015 through
now, selected broker only, including selected and newer readings. Frequencies grow
with N; limits stay fixed. Missing/duplicate/uncertain/withdrawn/future publications
stay outside N. Corrections replace samples. Latest completed requires exactly
one usable reading per ten-series ID. Settings persist independently of NFP and
selected date under `fyodor.scatter-plot.EURUSD.USD.QUOTE.CPI.magnitude.v1`.
Workspace export/import transfers saved tuples; reopening shows them frozen.

## Sources

- [Federal Reserve policy principles](https://www.federalreserve.gov/monetarypolicy/principles-for-the-conduct-of-monetary-policy.htm)
- [BLS CPI release tables and definitions](https://www.bls.gov/news.release/cpi.htm)
- [BLS seasonal adjustment](https://www.bls.gov/cpi/seasonal-adjustment/)

The sources explain the economic terminology and policy motivation. The
higher/lower USD-pressure grading and manual cutoffs are application conventions.
