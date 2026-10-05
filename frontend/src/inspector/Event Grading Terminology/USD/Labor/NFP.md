# USD · Labor / wages · Jobs report / NFP

Rule version: **`nfp-vs-previous-v1`**

Experimental direction rule version: **`nfp-eurusd-majority-v1`**

## Purpose and scope

Give the user an immediate count of Good, Bad and Unchanged readings across the selected US Jobs report / NFP release. Missing readings are counted separately. The user-authorized experimental majority rule maps those counts to an EURUSD direction. These are agreed conventions versus Previous, rather than a weighted economic model, a forecast comparison or an official BLS grading system. Direction is a rule output; profitability and predictive reliability have not been established.

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

Show Good and Bad as rows in the compact magnitude table. Aggregate Good, Bad, Unchanged and available reading totals remain in its accessible caption; include Missing/Unrated there when nonzero. Refresh the tally, colors and experimental direction whenever the selected release's accepted readings update. Show a per-row rule explanation on hover. No weighted score, delta sum, probability, entry/exit, target, stop or marker color is derived from the tally.

## Experimental EURUSD majority direction

Version `nfp-eurusd-majority-v1` uses the existing `nfp-vs-previous-v1` grades. All readings remain equally counted, including overlapping measures. Scope is the selected US/USD NFP release in the EURUSD-only Inspector.

| Condition | Label |
| --- | --- |
| Good > Bad | EURUSD Short |
| Bad > Good | EURUSD Long |
| Good = Bad | EURUSD Neutral |
| Incomplete required readings | Incomplete |

Unchanged does not vote. A complete ten-row release with all deltas zero gives Neutral. Direction requires exactly one row for each of the ten stable event IDs in the definitions table, each with a usable Actual/Previous delta. An absent series, missing delta, unknown rule or repeated series suppresses direction as Incomplete, even if the remaining rows have a majority. The actual displayed tally is retained; absent rows are not invented. The UI explains that ten usable series are needed. Upcoming releases stay Incomplete until those readings are available.

Display the direction badge in the top-left corner of the magnitude table, with no visible **NFP majority rule · Experimental**, **Compared with Previous** or **A−P magnitude** caption. Direction badge colors are **Short red, Long green, Neutral gray, Incomplete gray**, with the text labels retained in both light and dark themes. These direction colors are separate from the Good/Bad reading colors: a majority of green Good readings produces a red Short direction for EURUSD. Hover explains the mapping or incompleteness. Accepted publisher updates and corrections refresh the direction with the current displayed table. Other families receive no majority label. The existing chart symbols are unaffected.

User examples: January 10, 2025, **4 Good / 3 Bad / 3 Unchanged → EURUSD Short**; February 7, 2025, **5 Good / 4 Bad / 1 Unchanged → EURUSD Short**. These examples establish the requested mapping, not a verified trade outcome or backtest. A narrow majority has the same direction as a large majority; no confidence percentage is assigned.

Historical assessment should use values available at release time, every eligible release including failures, and consistent entry/exit/spread assumptions. Current stored values may incorporate subsequent corrections. Math Lab owns any such strategy research; this Terminal change only implements the requested live presentation rule.

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

Experimental majority direction: **EURUSD Long**, because 7 Bad > 2 Good and all ten required readings are usable.

NFP's −133k delta means fewer jobs added than the supplied previous month; Actual +29k still reports job growth. Its revised Previous of 133k remains separately visible, but does not change this version's comparison baseline.

## Interpretation limits

Participation's higher-is-Good rule is deliberately simplified: more participation can accompany higher unemployment. Faster wage growth is classified as Good under this chosen convention, without claiming that faster inflation or every wage-growth increase benefits the economy or USD.

Total, private, government and manufacturing payrolls overlap, as do monthly/annual wage measures. All are counted because the user requested a tally of every displayed reading; seven Bad rows are not seven independent confirmations. Classification ignores magnitude and the difference between Actual and Forecast. It describes the selected table under these rules, not the realized market reaction.

## Historical signed A−P distribution column

The NFP table now shows a miniature histogram for each series, independently of
the displayed chart range. The historical baseline starts January 1, 2015 and
ends strictly before the selected release. Seven signed A−P bands contain
three negative ranges, exact zero in the center, and three positive ranges.
Gray bar heights count earlier readings; the selected band uses its existing
Good/Bad/Unchanged color. An empty interval uses an outline, without adding a
historical reading. Negative/positive position does not determine the color.
The zero label stays centered beneath the exact-zero band, without a vertical guide.

Each series can use three independently configured Small/Medium/Large
boundaries from Scatter Plot, in its native k, pp or h units. They must satisfy
`0 < Small < Medium < Large`, mirror on both signs and stay fixed across dates.
The same saved boundaries control the scatter's blue guides, these seven bands,
size labels and the Good/Bad magnitude tally. Unconfigured series are Undefined,
with empty histogram cells. Explicit P95 mode uses historical P95 of |A−P|
and its thirds. Readings
strictly beyond it are hidden from the bars but still used to calculate the
automatic threshold and total history count. In custom mode the chosen
boundaries are not recomputed from history. Extreme selected readings show a colored
edge marker and an "Extreme" size label. All-zero history uses a zero
threshold, without padding; any nonzero selected change is then extreme.
Hover a bar or focus and use Left/Right arrows (Home/End for endpoints) for its
range, count and share of history. The selected size label beside the chart
reads Small, Medium, Large or Extreme; exact zero reads Unchanged and a missing
reading reads Unavailable. The tooltip shows selected A−P/size, inspected
band size/range/count, earlier-reading count, and true historical minimum and
maximum, including hidden extremes. It has no visible threshold row. The
distribution does not change the majority rule above.
Partial history and missing data are explicit. Stored corrections mean this
descriptive baseline is not a point-in-time backtest.

The release tally also shows the number of **Small, Medium, Large and Extreme**
readings as table columns, separately for Good and Bad rows, using exactly the
same selected sizes as the histograms. Zero counts display as **–**. Unchanged
readings stay separate in the accessible caption and their individual series rows;
a Good/Bad reading without a usable magnitude baseline is Unclassified. History
loading/errors suppress size counts, and partial coverage is marked. This adds
detail to the tally without weighting readings or altering the majority rule.

Threshold version `zero-centered-ap-configurable-v5` adds fixed custom
boundaries and retains P95/thirds as explicit opt-in. Unconfigured series are
Undefined, with empty histogram cells and an explicit undefined tally note, while
admitting exact decimal boundary equality despite floating-point rounding.
For the stored October 2, 2026 example with P95 settings, the breakdown is **Good: 1 Small,
1 Medium, 0 Large, 0 Extreme; Bad: 7 Small, 0 Medium, 0 Large, 0 Extreme**,
plus **1 Unchanged**. Participation's +0.2 pp equals its Medium ceiling;
earnings m/m's −0.2 pp equals its Small ceiling. Equality stays in the lower
inclusive size category.

See [the reusable component and history contract](../../../magnitude/README.md)
for the admission rules, arithmetic, module organization and verification.

## Extending or changing the rules

New NFP readings require explicit event-ID rules and tests. Changing the comparator, favorable directions or counting method requires a new grading rule version, an updated example and tests. Changing the direction mapping or completeness requirements requires a new majority rule version. Other currencies/categories/families need separate documents and implementation; their numbers must not inherit the higher-is-Good convention or NFP majority direction automatically.
