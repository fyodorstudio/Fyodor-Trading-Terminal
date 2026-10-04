# USD · Labor / wages · Jobs report / NFP

Rule version: **`nfp-vs-previous-v1`**

## Purpose and scope

Give the user an immediate count of Good, Bad and Unchanged readings across the selected US Jobs report / NFP release. Missing readings are counted separately. This is an agreed simplified interpretation of changes versus Previous, rather than a weighted economic model, a forecast comparison, a USD price prediction or an official BLS grading system.

Scope requires Inspector family `jobs`, currency `USD`, country `US`, and the stable event IDs below. No other family receives NFP grades. All available displayed readings count equally. Currency identity colors on headings/symbols are separate from grading colors.

## Terminology and arithmetic

- **Actual (A):** the current published reading. For payroll rows it represents a net monthly job change, not the total number of jobs.
- **Previous (P):** the supplied prior reading used by Inspector's A−P column.
- **A−P:** Actual minus supplied Previous, using Inspector's existing exact raw-integer arithmetic where available.
- **Revised Previous:** a separately displayed correction; this version does not substitute it for Previous in grading.
- **Good (green):** the change has the favorable direction defined for that specific reading below.
- **Bad (red):** the change has the opposite direction.
- **Unchanged (gray):** the calculated delta equals zero, including zero Actual and zero Previous.
- **Missing (gray):** a usable delta cannot be established, including absent/nonfinite Actual or Previous. Missing never contributes to Good, Bad or Unchanged.
- **Unrated (gray):** a US jobs reading has no explicitly registered event rule. It remains visible and is counted separately.
- **k:** thousands of jobs. **pp:** percentage points, e.g. 4.2% − 4.1% = +0.1 pp. **h:** hours.

## Reading definitions and directions

These measurement definitions follow [BLS's Employment Situation technical notes](https://www.bls.gov/news.release/empsit.tn.htm) and [CPS labor-force definitions](https://www.bls.gov/cps/definitions.htm). The Good/Bad directions are the Terminal's chosen conventions.

| Event ID | Reading | Meaning | Good when Actual is… |
| --- | --- | --- | --- |
| `840030016` | Nonfarm Payrolls | Net change in nonfarm payroll employment. | Higher than Previous |
| `840030015` | Unemployment Rate | Unemployed people as a share of the labor force. | Lower than Previous |
| `840030017` | Participation Rate | Share of the civilian noninstitutional population aged 16+ working or seeking work. | Higher than Previous |
| `840030018` | Average Hourly Earnings m/m | Monthly percentage change in average hourly pay. | Higher than Previous |
| `840030019` | Average Hourly Earnings y/y | Annual percentage change in average hourly pay. | Higher than Previous |
| `840030020` | Average Weekly Hours | Average workweek of private-sector employees. | Higher than Previous |
| `840030023` | Private Nonfarm Payrolls | Net job change at private employers. | Higher than Previous |
| `840030022` | Government Payrolls | Net job change at government employers. | Higher than Previous |
| `840030032` | Manufacturing Payrolls | Net job change in manufacturing. | Higher than Previous |
| `840030024` | U6 Unemployment Rate | Broader labor underutilization, including marginal attachment and involuntary part-time work. | Lower than Previous |

For the eight higher-is-Good readings: positive delta = Good, negative delta = Bad. For Unemployment Rate and U6: negative delta = Good, positive delta = Bad. Zero/missing rules apply to every reading.

## Release tally

Count each displayed source reading once. Grouping already excludes duplicate value IDs. The denominator is the number of displayed readings, not an assumed fixed ten. If the source supplies eight rows, the tally says eight; it does not fabricate two absent rows. A provided row with missing values contributes one Missing reading. Unknown rules contribute Unrated.

Always show Good, Bad, Unchanged and the available reading total. Show Missing/Unrated when nonzero. Refresh the tally and colors whenever the selected release's accepted readings update. Show a per-row rule explanation on hover. Do not derive a majority verdict, weighted score, delta sum, probability, Long/Short direction or marker color from the tally.

## Agreed example: October 2, 2026 release

These values are the user's stored example; corrections can change them later.

| Reading | Actual | Previous | A−P | Grade |
| --- | ---: | ---: | ---: | --- |
| Nonfarm Payrolls | 29k | 162k | −133k | Bad |
| Unemployment Rate | 4.2% | 4.1% | +0.1 pp | Bad |
| Participation Rate | 61.8% | 61.6% | +0.2 pp | Good |
| Hourly Earnings m/m | 0.1% | 0.3% | −0.2 pp | Bad |
| Hourly Earnings y/y | 3.0% | 3.1% | −0.1 pp | Bad |
| Weekly Hours | 34.4 h | 34.4 h | 0 h | Unchanged |
| Private Payrolls | 46k | 127k | −81k | Bad |
| Government Payrolls | −17k | 35k | −52k | Bad |
| Manufacturing Payrolls | 9k | 16k | −7k | Bad |
| U6 Unemployment | 7.6% | 7.7% | −0.1 pp | Good |

Result: **2 Good · 7 Bad · 1 Unchanged · 10 readings**.

NFP's −133k delta means fewer jobs added than the supplied previous month; Actual +29k still reports job growth. Its revised Previous of 133k remains separately visible, but does not change this version's comparison baseline.

## Interpretation limits

Participation's higher-is-Good rule is deliberately simplified: more participation can accompany higher unemployment. Faster wage growth is classified as Good under this chosen convention, without claiming that faster inflation or every wage-growth increase benefits the economy or USD.

Total, private, government and manufacturing payrolls overlap, as do monthly/annual wage measures. All are counted because the user requested a tally of every displayed reading; seven Bad rows are not seven independent confirmations. Classification ignores magnitude and the difference between Actual and Forecast. It describes the selected table under these rules, not the realized market reaction.

## Extending or changing the rules

New NFP readings require explicit event-ID rules and tests. Changing the comparator, favorable directions or counting method requires a new rule version, an updated example and tests. Other currencies/categories/families need separate documents and implementation; their numbers must not inherit the higher-is-Good convention automatically.
