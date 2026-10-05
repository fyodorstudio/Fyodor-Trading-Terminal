# US CPI / core CPI

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
different headline/core/monthly/annual readings overlap. Counts do not establish
equal influence or sum into a weighted signal. CPI adds no Long/Short or
Neutral/Mixed decision.

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

Each series independently selects **Undefined**, **Custom boundaries**, or
explicit **P95**. Undefined is the default: empty Inspector histogram/size and
no scatter magnitude guides, with raw dots and Good/Bad counts retained. The
size table displays dashes and explicitly counts undefined Good/Bad readings.
Custom mode requires `0 < Small < Medium < Large` in that series' native units.
Both signs mirror the same limits; exact ties stay in the lower inclusive size;
anything beyond Large is Extreme. The seven bars remain three negative bands,
exact zero and three positive bands. Apply updates both views from one shared
snapshot. Appearance settings do not change boundaries.

History starts January 2015, uses the selected broker only, and excludes the
inspected publication and later readings. Missing/duplicate/incompatible-unit
publications are excluded. Latest completed means exactly one usable reading
for each of these ten IDs. Stored corrections are not historical data vintages.
Settings persist separately at
`fyodor.scatter-plot.EURUSD.USD.QUOTE.CPI.magnitude.v1`, independent of NFP and
independent of publication date. Clearing a series sets it to Undefined.

## Sources

- [Federal Reserve policy principles](https://www.federalreserve.gov/monetarypolicy/principles-for-the-conduct-of-monetary-policy.htm)
- [BLS CPI release tables and definitions](https://www.bls.gov/news.release/cpi.htm)
- [BLS seasonal adjustment](https://www.bls.gov/cpi/seasonal-adjustment/)

The sources explain the economic terminology and policy motivation. The
higher/lower USD-pressure grading and manual cutoffs are application conventions.
