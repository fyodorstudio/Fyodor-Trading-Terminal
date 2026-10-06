# Scoring system library

Updated: 6 October 2026. Scope: EURUSD, starting with USD event families.

## Purpose and output

Interpret what each economic release says without requiring the user to read its
numbers. A usable release produces **EURUSD Long or Short**, an evidence grade,
and a plain-language explanation. These are interpretations under explicit rules,
not promises about the release candle or a future price move.

- No survey forecasts enter scoring.
- Unequal family-specific priorities resolve conflicting readings into one bias.
- Exact cancellation uses a documented priority; no Mixed/Neutral label.
- Missing data, insufficient calibration or no directional change can produce
  **Uncomputed**, with a reason. A direction is never fabricated to fill a label.
- Evidence strength describes agreement, not probability. Change size is separate.
- Original scorers remain available for comparison. Magnitude settings and stored
  preferences remain compatible.
- Visual UI verification belongs to the user; terminal tests, lint and builds
  verify implementation.

## Existing systems

| System | Inspector menu | Policy and status |
| --- | --- | --- |
| USD CPI original | Scoring system | Signed Actual minus supplied Previous magnitudes; separate rate/index matrices; uses original configured boundaries. Implemented. |
| USD CPI v2 | Scoring system v2 | Three-month core pace relative to a 0.20% prototype reference, overlapping core trend, annual core change and headline context. Implemented; comparison baseline. |
| USD CPI v3, refined | Scoring system v3 | Latest core pace versus preceding three months; weights 35/35/20/10. Related core monthly signals share an evidence group; separate strength, change size and limitations. Implemented, policy v3.1. |
| USD NFP original | Scoring system | Payrolls, inverse unemployment change and monthly wage change each have weight 1; seven supporting readings excluded from the USD total. Implemented. |
| USD NFP v2 | Scoring system v2 | Hiring pace, unemployment with participation context, wage pace, preceding-month payroll revision and working hours. Weights 40/30/15/10/5; earlier-history calibration and grouped evidence. Implemented. |
| USD Retail Sales v1 | Scoring system | Control-group pace 60%, ex-autos-and-gas pace 25%, headline pace 15%; revision-aware preceding three-month benchmarks floored at zero, grouped evidence and visible magnitudes. Implemented; manual audit next. |
| USD PCE v1 | Scoring system | Core monthly pace, annual core change, headline monthly pace and annual headline change. Weights 45/30/15/10; revision-aware comparisons, grouped evidence and visible magnitudes. Implemented. |
| USD ISM Services v1 | Retired standalone screen | Original 35/25/25/15 sector policy is documented and retained internally for v2/v3 and audit reproduction. |
| USD ISM monthly context v2 | Scoring system v2 on either ISM family | Services 70% plus Manufacturing 30%, same reference month, publication-time reconstruction, one bias and grouped evidence. Implemented; user audit next. |
| USD ISM monthly resolution v3 | Scoring system v3 on either ISM family | One latest available monthly bias, weighted sector contributions and a plain explanation of which evidence wins. V2 component math and evidence policy are preserved. |
| USD context memory v2 / Raycaster | Chart header → Raycaster | CPI/NFP/ISM/Retail weights 40/40/10/10; independent portable filters, source biases and contributions, one USD-side bias at the hovered candle end. Implemented prototype; v1 archived below. |

Inspector's other families have release tables and descriptive magnitude tools;
that does not mean they already have directional scorers. FOMC/ECB episode
grouping and rate-change grading exist, but are not full policy interpretations.

## Completed refinement and NFP v2 policies

**CPI v3.1:** bias calculations are unchanged. Fresh core and rolling core trend
share one evidence group; annual core and headline are the other groups. A group
must support the winning direction to confirm it. Strong evidence requires at
least two supporting groups and weighted net/gross agreement of at least 2/3.
Agreement below 1/3, missing scoring data or a tie-break gives weak evidence;
other directional cases give moderate evidence. Related groups are conceptual
confirmation, not statistically independent evidence.

**Change size:** the weighted average absolute 0–4 magnitude points of usable
components, including usable zeros. Greater than zero to 1 = Modest, >1 to 2 =
Noticeable, >2 to 3 = Large, >3 = Extreme. Size is separate from agreement and
does not describe a price move. Evidence explanations distinguish missing data,
conflicting signals and a direction supported by one group.

**NFP v2:**

| Component | Calculation | Weight |
| --- | --- | --- |
| Hiring pace | Latest payroll job change minus max(0, preceding three-month mean job change) | 40% |
| Unemployment | Negative of Actual minus supplied Previous | 30% |
| Wage pace | Latest Earnings m/m minus preceding three-month mean | 15% |
| Payroll revision | Supplied Revised Previous minus Previous payrolls | 10% |
| Working hours | Actual minus supplied Previous weekly hours | 5% |

Hiring and wages need consecutive reference-month history. The hiring benchmark
is floored at zero so smaller job losses after bigger losses still count as job
losses, without claiming a population-adjusted break-even hiring level.

When unemployment and participation both fall, unemployment's positive weight
halves to 15%; a caution prevents strong evidence. This is a policy qualifier,
not proof of why unemployment fell. Missing participation does not invent an
adjustment: weight stays 30%, with a caution and strength capped at moderate.
Participation never votes on its own. Annual wages, U6 and payroll subcomponents
provide context without being added to the total. The revision component covers
the preceding month only; the provider does not expose the full two-month BLS
revision total in this field.

NFP evidence groups are employment (hiring, revision, hours), unemployment and
wages. The CPI strength/change-size rules also apply; weights are not
redistributed for missing data. At least one calibrated hiring or unemployment
component must be usable. Exact cancellation follows hiring, unemployment,
wages, revision and hours. The original NFP scorer remains available.

The saved Scoring system v2 preference selects CPI v2 on CPI releases and NFP v2
on jobs releases and monthly ISM context v2 on either ISM family. V3 is available
for CPI and both ISM families; unimplemented families fall back to Table.

These weights, confirmation groups, thresholds and participation adjustment are
explicit prototype policies; they are not fitted estimates or validated market
probabilities. Monthly ISM v2 is the first implemented context combination; the
USD context memory v1 now combines CPI, NFP and ISM; expansion to the remaining
USD inputs remains planned.

Terminal validation and manual review status are recorded below.

## Planned development order

The user accepted CPI/NFP signal visibility and its automatic magnitudes.
Expansion has added USD PCE, ISM Services, the monthly ISM combination and Retail Sales v1.
Build the remaining inflation, labor and activity inputs before FOMC. The user's
Raycaster request brought forward a context pilot for the three mature families;
broader context expansion will follow the remaining inputs.

### Implemented: visible CPI/NFP component magnitudes

- Scatter Plot now has **Measure → Actual − Previous / Scoring signal** for
  USD CPI v3 and USD NFP v2. The Signal selector exposes each existing voting
  component, including latest-reading versus prior three-month average signals.
- Source/comparison values, exact signal, formula, size, calibration N and
  missing-data reasons are visible. Automatic bands use strictly earlier
  publications; each tooltip uses its own release's history. Later dots are
  context, missing inputs leave gaps and early uncalibrated values remain visible.
- Automatic 1/3 / 2/3 / .90 quantiles retain ties. **Manual override** previews
  on the chart, **Apply to scorer** updates Inspector, and **Use automatic**
  restores earlier-history cutoffs. Overrides are independent per component,
  apply across history, retain the 24-observation gate, and travel with workspace
  export/import. Original A−P settings and scoring weights remain separate.
- Manual UI review: switch both measures/components, inspect older dates, resize
  the dock, and compare preview versus saved Inspector scores. No automated visual
  audit was performed, following the user's preference.
- Verification on 6 October 2026: full frontend suite, lint and production build
  passed. The stored snapshots' 140 CPI and 141 NFP releases retain automatic
  bias, totals, evidence strength and change size; plotted component values,
  magnitude points, thresholds, calibration N and reasons match the scorers.

| Order | Family or stage | Intended contribution | Status |
| --- | --- | --- | --- |
| 1 | NFP v2 | Employment strength, wage pressure and payroll revisions | Implemented |
| 2 | PCE inflation | Core/headline inflation change, including revised prior comparisons | Implemented |
| 3 | ISM Services v1 | Services activity, employment and price-pressure context | Implemented; first user development audit recorded below |
| 3a | ISM Manufacturing + monthly ISM v2 | Same-month goods/services context, preserved publication times | Implemented; user audit next |
| 4 | Retail Sales | Consumer-demand context | Implemented v1; user audit next |
| 5 | Jobless Claims | Employment updates between monthly reports | Proposed |
| 6 | GDP | Broad growth, expenditure components and revision context | Proposed; before FOMC |
| Initial pilot now; expand after surrounding inputs | USD context engine | Update inflation, labor and growth assessments using latest known information | V2 implemented for CPI/NFP/ISM/Retail with independent Raycaster filters; remaining families planned |
| After the surrounding inputs | FOMC | Rate action plus changes in statement, projections and press-conference guidance | Proposed; requires source text, not merely a rate number |
| Later | PPI, Fed Chair speeches | Additional context after the core families are useful | Proposed; order revisable |
| After FOMC | Broader USD context | Add policy guidance to inflation, employment and growth context | Planned |
| Later | ECB and euro-area families | Relative EUR versus USD context for EURUSD | Proposed |
| Later | Other currencies | Reuse infrastructure with explicit currency-specific policies | Proposed |

### Implemented: USD Retail Sales v1

Select a USD Retail Sales release on EURUSD, then **Scoring system**. The flat
Inspector view presents one bias, Weak/Moderate/Strong evidence, change size and
a plain explanation. Scatter Plot → **Scoring signal** exposes all three voting
components, exact source/benchmark, earlier-history N, boundaries and gaps.
Original Actual − Previous magnitudes remain separate. Applied overrides update
the scorer and travel with workspace export/import; preview edits do not.

| Component | Calculation | Weight / group |
| --- | --- | --- |
| Control-group pace | Actual Retail Control m/m minus max(0, preceding three-month mean) | 60% / underlying demand |
| Ex-autos-and-gas pace | Actual Retail Sales excluding Autos and Gas m/m minus max(0, preceding three-month mean) | 25% / spending breadth |
| Headline pace | Actual Retail Sales m/m minus max(0, preceding three-month mean) | 15% / spending breadth |

Each comparison requires the preceding three consecutive reference months. The
release's supplied Revised Previous replaces the nearest actual in that mean,
including an explicit zero. Invalid supplied revisions make that component
unavailable. Missing months cannot be filled from Previous or skipped. Revisions
have no separate vote. A negative recent average is floored at zero: a smaller
contraction still signals falling nominal spending. Positive sales growth below
its recent pace can support EURUSD Long; positive above-benchmark pace supports
EURUSD Short. This interprets changes in demand pace, not survey surprises.

Control-group pace receives the largest vote. Core retail (ex autos) and annual
headline sales remain supporting context to avoid adding redundant votes.
Ex-autos-and-gas and headline share a breadth evidence group; control is another.
These nested sales measures overlap and are not independent statistical evidence.
Strong requires both groups supporting the direction with net/gross agreement
at least 2/3 and no missing component. Missing data, exact cancellation or an
agreement below 1/3 yields Weak; other directional cases are Moderate. Change
size is the weighted average absolute magnitude points, separate from evidence.

At least one calibrated control-group or ex-autos-and-gas component is required;
headline alone cannot establish a bias. Missing weights are not redistributed.
Exact cancellation follows control → ex-autos-and-gas → headline with Weak
evidence. All-zero or unusable readings remain Uncomputed. Each magnitude uses
its own strictly earlier usable history since January 2015 and retains the
24-observation gate, including with manual boundaries. Quantiles are 1/3, 2/3
and .90 of earlier nonzero absolute signals, retaining tied boundaries.

These priorities, grouping and the zero floor are prototype interpretation rules,
set before the stored-data audit; they were not fitted to price reactions.
[BEA's retail-control method](https://www.bea.gov/help/faq/519) explains its role
in estimating goods consumption. [Census retail data](https://www.census.gov/retail/marts/www/timeseries.html)
are adjusted for seasonal/calendar effects but not price changes. The scorer
therefore describes nominal spending rather than real purchasing volume or
all consumer services. It uses no forecasts, market prices, CPI or Fed decision.
Provider revisions can appear in stored history; replay is not an original-vintage
backtest. Raycaster v2 incorporates unchanged Retail v1 as a 10% spending vote,
with CPI/NFP at 40% each and ISM at 10%.

`PAIR/EURUSD/USD/RETAIL/{policy,assessment,runtime,ui}/` separates rules,
features, aggregation, worker lifecycle and display. Inspector scoring runs in a
background module worker; unchanged release/history/settings reuse its result.
Applied settings invalidate it, superseded replies are ignored, stale biases
are hidden while recalculating, worker failures are disclosed and unmount
terminates the worker. Scatter signal derivation uses the existing worker.

The stored audit covers **144 publication groups** through 16 September 2026:
**114 computed biases**, with **30 early/partial groups Uncomputed**. All **21**
publications from 2025 onward compute a bias (9 Long, 12 Short). Scorer/plot
values, points, sizes, boundaries, calibration N, input labels and missing-data
reasons match for every signal. Removing same-time and later inventory preserves
every assessment. This measures implementation and coverage, not price accuracy.
Both actual production worker bundles match pure calculations and keep the main
event loop active (one run: Inspector 57 ms, Scatter 71 ms, including startup).

- [Retail v1 local audit](storage/data/retail-v1-design-audit.md)
- Reproduce after a build: `node frontend/scripts/audit-retail-v1.mjs <calendar.json> <output-prefix>`.
- Tests: `frontend/tests/inspector/retail/` covers conflicts, ties, contractions,
  revisions, forecast/future exclusion, native/reference gates, plot parity,
  Inspector menu/full view, scoped fetching, live settings, workspace portability
  and worker lifecycle. Full frontend tests, lint and production build passed on
  6 October 2026. Visual review remains with the user.
- Next: manually review recent releases in H1, record bias/evidence and separate
  release reaction from later reversals. Continue with Jobless Claims after this.

### Implemented: USD context memory v2 and independent Raycaster controls

Retail Sales v1 now has a real **10% weighted vote**, not merely background text.
CPI and NFP retain 40% each; ISM gets 10%. The prior 20% activity budget is split
between surveyed activity and actual nominal spending. These are prototype
priorities, not statistically estimated coefficients or weights fitted to price
reactions. The four standalone scorers and their component magnitude settings
remain unchanged. PCE integration still needs an inflation-weight policy.

Raycaster starts with all four families enabled and owns its saved selection.
Click **Enabled / Off** in its gear table; Inspector choices do not change these
inputs. ISM controls both source sectors together. No setting is silently copied
from Inspector. The selection key `fyodor.raycaster.families.v1` accepts unique
CPI/NFP/ISM/Retail IDs, preserves an intentional all-off list, receives storage
updates, retains session changes through storage failures and is portable in
workspace export/import. Invalid imported IDs/duplicates are rejected.

The table shows each fixed scorer version, budget weight, toggle, latest eligible
pair bias/evidence/date, signed source score and weighted USD vote. The Total row
shows the same combined output as the collapsed box. The budget sums to 100%;
enabled and active weight are displayed separately. Off/missing/expired/uncomputed
votes contribute zero without redistribution. Opening the gear holds the last
inspected candle with an explicit label. Changing inputs rebuilds that candle in
the worker; stale totals are hidden while calculating. Closing restores the
hover prompt when the cursor is outside the chart. Broker, pair and timeframe
changes clear the held candle; pair inversion still reuses the USD timeline.
No scoring work runs on hover.

The v1 memory, expiry, source replacement, timing and evidence rules still apply.
Exact cancellation now follows CPI → NFP → ISM → Retail Sales with Weak evidence.
All unavailable inputs stay Uncomputed. Manufacturing and Services update one
ISM slot; their publication scores are not added together. Evidence describes
agreement within the chosen inputs, not expected price movement or duration.

Inspector Filters also has one **US ISM Manufacturing / Services** checkbox and
symbol selector. The underlying source IDs, original publication timestamps,
scoring signals and saved preference format stay intact. Legacy one-sector
selections are indeterminate and preserved by Cancel/unchanged Apply. Explicit
changes toggle or set the symbol for both sectors. Searches for either sector
find the grouped row; category controls still operate on all original IDs.

The stored v2 replay preserves **140 CPI, 141 NFP, 284 ISM and 144 Retail** source
assessments. Eight June/July/August/September snapshots preserve their full result
after future removal, and the actual production worker matches the pure engine.
The 703-snapshot timeline remains background work (one run: about 4.4 seconds
including worker startup; main event loop continues running).

[Context v2 audit](storage/data/usd-context-v2-design-audit.md). After building,
reproduce with `node frontend/scripts/audit-usd-context.mjs <cpi.json> <nfp.json> <ism.json> <retail.json> <output-prefix>`.
Mounted tests verify separate filters, source contributions, last-candle retention,
workspace roundtrip, all-off behavior, grouped ISM controls and worker reuse.
Full frontend regression tests, lint and production build passed on 6 October
2026; the final scope-clear refinement also passes mounted Raycaster tests.
Visual layout, compact-chart scrolling and panning remain user manual checks.

#### User's Retail v1 audit and interpretation

These are the user's chart observations, without a controlled fixed-window price
study or simultaneous audit of other release families. No weights were refitted.

| Release | Retail bias | Reported chart reaction |
| --- | --- | --- |
| 16 Sep 2026 | Short | Price fell dramatically |
| 14 Aug 2026 | Long | Rally through 20 August |
| 16 Jul 2026 | Long / Strong | Slow decline; rally only at 28 July support |
| 17 Jun 2026 | Short / Moderate | Very significant decline |
| 14 May 2026 | Long | Slow decline |
| 21 Apr 2026 | Short / Strong | Slow decline, no large rallies |
| 1 Apr 2026 | Short | Fell at release through 6 April, then significant rally |

June's Moderate grade is correct under the existing rule: only the control-group
pace contributes +0.6; ex-autos-and-gas and headline are unchanged versus their
benchmarks, so one evidence group supports the bias. July's Strong grade is also
correct: control −0.6, ex-autos-and-gas −0.25 and headline −0.45 all support
slower nominal spending pace, for a total of −1.3 and two agreeing groups.
Strong internal agreement does not imply a bigger or correctly directed price
move. Evidence grades never multiply source votes.

With all four automatic inputs enabled, v2 context is **Short / Moderate** at
17 June, **Long / Moderate** at 16 July, **Long / Moderate** at 14 August and
**Short / Strong** at 16 September. July therefore still disagrees with the
reported immediate price direction even after integration. This is not fixed
by forcing a Short label. Missing EUR/policy/market information and different
reaction windows remain possible explanations to investigate, not established
causes. Next development remains Jobless Claims, then GDP before FOMC.

### Archived: USD context memory v1 policy and initial audit

The following records the earlier three-input policy. Its 40/40/20 weights and
Inspector-linked controls are superseded by v2 above; standalone scorer math
remains unchanged. The old audit is preserved for comparison.

Press the wave button **Show Raycaster** beside the paintbrush toggle near the
timeframe selector. × or the same button hides it. Drawing-toolbar visibility is
independent. Drag the box by its header. Visibility and position are saved and
included in workspace transfer. The gear beside the draggable title opens a
calculation popover: current enabled/off CPI, NFP and ISM inputs, scorer versions,
40/40/20 weights, replacement/expiry, evidence, tie and timing rules. Escape,
its close button or clicking outside dismisses it. Input selection stays in
Inspector filters; the popover explains the current configuration without
introducing separate overrides.
Its scoring versions are fixed to CPI v3.1, NFP v2 and ISM v3, independently of the
Inspector detail-view selector, date range or symbol visibility.

The latest available assessment occupies each of three persistent slots. NFP
receives 40%, CPI 40%, ISM 20%, using signed source magnitude totals, without
multiplying by evidence grades. Manufacturing and Services update one ISM slot;
their publication scores are never summed. Turning a sector off removes its
vote from ISM as well. A new uncomputed assessment replaces the previous vote;
missing/disabled/expired weights are not redistributed. Each slot expires after
45 days on the broker chart clock. This is a prototype freshness rule, not a
measured duration of market influence.

No Mixed/Neutral output: exact cancellation follows CPI → NFP → ISM direction
priority with weak evidence. Completely unavailable/expired evidence stays
Uncomputed. Combined strong evidence requires strong supporting labor and CPI
assessments and broad weighted agreement. Missing data, cancellation and narrow
leads give weak evidence; other usable cases are moderate. These grades describe
agreement, not market probabilities or statistically independent sources.

The small box shows a pair direction, evidence, plain explanation and how the
latest update changes the previous context. It explicitly labels **USD side
only**. EURUSD, GBPUSD, AUDUSD, NZDUSD, USDJPY, USDCHF and USDCAD are supported,
including the supported broker suffix formats. USD quote maps weakness to Long;
USD base reverses that mapping. Other currencies' data are not yet included.
Existing USD component magnitude settings are shared across these pairs.

The cursor selects the exclusive end of its candle (current time for an unfinished
live candle). H1 includes a release halfway through that hour but excludes one at
the next hour's open. The displayed time is explicitly broker time. Recorded
historical publication chart coordinates are used instead of today's UTC offset
for historical lookup. Original UTC times are preserved for release metadata and
chronological scorer gates. Unknown/inconsistent timing is excluded or reported.
Later observations do not enter earlier snapshots. Provider revisions mean this
is reconstructed stored history, not certified original-release vintages.

`usd-context/core/` owns policy, currency-level adapters, memory, explanations and
binary lookup. `usd-context/runtime/` owns a separate worker and scoped inventory
from January 2015. `raycaster/{chart,ui,storage}/` owns hover, the box/drag lifecycle
and persistence. Mouse movement coalesces by animation frame and only does a
snapshot lookup; no fetching, full-history recalculation or shell state updates
occur on hover. Closing or hiding the tool terminates the worker and subscription.
CPI v3's reference lookups now reuse the same history index without changing math.

The initial stored audit preserves all 140 CPI, 141 NFP and 284 ISM totals,
directions, evidence and change-size labels. Four August snapshots match when
later observations are removed. The actual production worker matches the pure
engine and keeps the main event loop active. One run built 570 snapshots from
3,246 readings in about 3.4 seconds in the background; hover reuses that timeline.

The automatic-policy August replay is instructive:

| Update | EURUSD USD-side context | Evidence | Effect |
| --- | --- | --- | --- |
| Aug 03 Manufacturing | Long | Weak | July CPI/NFP still dominate; Manufacturing reduces Long support |
| Aug 05 Services | Long | Moderate | Stronger surveyed activity reduces Long support further |
| Aug 07 NFP | Long | Moderate | New labor weakness strengthens Long support |
| Aug 12 CPI | Long | Moderate | CPI remains individually Long, but replaces a larger July Long contribution and reduces net support |

This differs from treating August Manufacturing's standalone Short as the entire
context. No labels were fitted to reproduce the research report or chart moves.
Weights, expiry and evidence rules are explicit prototype policies to audit.

Tests are under `frontend/tests/usd-context/`. Reproduce with
`frontend/scripts/audit-usd-context.mjs` after a production build; see
[context policy and audit command](frontend/src/usd-context/README.md) and
[Raycaster controls and manual checks](frontend/src/raycaster/README.md).
The JSON/Markdown chronological report is stored locally as
`storage/data/usd-context-v1-design-audit.{json,md}`. User manual checks: hover
August updates, compare H1/M15, apply Inspector filters, switch USDJPY, pan with
the box active, drag it and resize the chart/dock. No visual automation was used.

### Implemented: USD PCE v1

| Component | Calculation | Weight |
| --- | --- | --- |
| Latest core pace | Actual core m/m minus preceding three-month average | 45% |
| Annual core change | Actual core y/y minus revised-or-original prior annual reading | 30% |
| Latest headline pace | Actual headline m/m minus preceding three-month average | 15% |
| Annual headline change | Actual headline y/y minus revised-or-original prior annual reading | 10% |

When supplied, Revised Previous replaces the nearest preceding month in the
monthly average and becomes the annual comparator. Malformed supplied revisions
disable their own components. Monthly history still requires three consecutive
earlier months. A revision field does not reconstruct the older two months or
original historical vintages. Source/baseline labels explain the choice in Scatter
Plot. There is no additional revision vote and no change to CPI/NFP policies.

Monthly core/headline form one evidence group; annual core/headline form another.
The shared weak/moderate/strong evidence and separate change-size labels apply.
At least one calibrated core component is required, missing weights are not
redistributed, and ties follow the table order. Magnitudes use each component's
own strictly earlier history with 24 usable observations. Annual headline PCE
relative to the Fed's 2% objective is non-voting context, not a hike prediction.

Inspector → US PCE inflation → **Scoring system** displays this first version.
Scatter Plot → PCE → **Scoring signal** exposes all four components with automatic
bands and independent manual overrides. Saved settings are workspace-portable;
original PCE A−P settings remain separate. The prototype's weights are explicit
judgment choices; this is an interpretation policy, not a validated price model.

The stored-data implementation audit covers **139 observed PCE publications**
since January 2015. All 20 publications in 2025–2026 produce a bias; 3 use reduced
data because monthly history is unavailable. All plotted values, points,
thresholds, calibration counts, reasons and comparison inputs match the scorer.
This measures implementation coverage, not price-direction success.

Validation on 6 October 2026: PCE model/UI/scatter/portability regressions, the
full frontend suite, lint and production build passed. Snapshot comparisons
confirm all 140 CPI and 141 NFP releases retain their prior automatic bias,
totals, evidence strength and change size. No automated visual audit was run.

- [PCE v1 local audit](storage/data/pce-v1-design-audit.md)
- Reproduce with `node frontend/scripts/audit-pce-v1.mjs <calendar.json> <output-prefix>`.
- Manual review belongs to the user: PCE release interpretations, flat dock layout,
  historical signal inspection and applied boundaries.

### Archived screen: USD ISM Services v1 sector policy

The standalone v1 screen and registry binding were removed during the responsiveness
refactor. Its feature and assessment rules remain under `ISM/sectors/services/`
because monthly v2/v3 depend on them. The explanation and audit below document how
v1 scored each release. Its saved magnitude key is retained to preserve existing
manual boundaries and workspace exports. Older ISM view selections saved as
**Scoring system** now display v3. Other active families' versions remain available.

The original Inspector → US ISM Services → **Scoring system** screen displayed a
single sector bias, weak/moderate/strong evidence, separate change size and a plain explanation.
Scatter Plot → ISM Services → **Scoring signal** shows its four components,
source/comparison values, earlier-only automatic bands and independent manual
overrides. Applied settings update Inspector and travel in workspace exports.
Original A−P limits, CPI, NFP and PCE settings remain separate.

| Component | Calculation | Weight | Evidence group |
| --- | --- | --- | --- |
| New orders | Actual index minus max(50, preceding three-month mean) | 35% | Demand |
| Business activity | Actual index minus max(50, preceding three-month mean) | 25% | Demand |
| Employment | Actual index minus max(50, preceding three-month mean) | 25% | Labor |
| Prices paid | Actual index minus max(50, preceding three-month mean) | 15% | Prices |

These are native diffusion indexes in **index points**, bounded from 0 to 100,
not percentage inflation rates. ISM uses 50 to distinguish increases from
decreases. Our comparison floor is a prototype interpretation rule: a rebound
that remains below 50 still counts as declining, while an above-50 reading below
its recent average describes cooling growth. UI states show the current level's
meaning separately from the comparison direction. Prices Paid describes surveyed
input-price pressure; its small USD-supportive positive vote is a policy-pressure
interpretation, not a measured CPI increase or a promise of a rate hike.

The composite PMI is **non-voting context** because it combines business activity,
orders, employment and supplier deliveries. Voting on it alongside its constituents
would duplicate information. Supplier Deliveries is unavailable in this family;
we do not infer it from the composite. Missing composite context does not reduce
evidence from four usable voting components.

The comparison needs three consecutive earlier reference months. Supplied Revised
Previous replaces only the nearest month in the mean; malformed or out-of-range
revisions disable that component. Older two-month revisions and original vintages
cannot be reconstructed. Magnitudes use each component's own strictly earlier
signals since January 2015 with the shared minimum of 24 observations. Manual
limits preserve that requirement. At least one calibrated orders or activity
component is required. Missing weights are not redistributed. Exact cancellation
follows orders, activity, employment, prices; ties carry weak evidence. All-zero
or insufficient data stays Uncomputed. Forecasts, prices and other families never
enter the calculation. Weights, groups and the floor are explicit judgment
policies; they were set before the stored audit, without fitting price reactions.

The chronological audit covers **142 observed publications**. All **22** in
2025–2026 provide a bias with all four components usable. The first 27 publications
remain Uncomputed during history accumulation. Every plotted component value,
point, cutoff, calibration count, reason and input label matches its scorer.
This is implementation coverage, not price-prediction accuracy.

Validation on 6 October 2026: the full frontend suite, lint and TypeScript/Vite
production build passed. Stored comparisons confirm the 140 CPI, 141 NFP and
139 PCE releases retain their automatic biases, totals, evidence grades and
change sizes. Visual UI verification remains with the user.

- [ISM Services v1 local audit](storage/data/ism-services-v1-design-audit.md)
- Reproduce with `node frontend/scripts/audit-ism-services-v1.mjs <calendar.json> <output-prefix>`.
- Manual review: interpretations across older/newer releases, reduced-height dock
  layout, signal selection and preview/apply/reset. Visual checks belong to the user.

### Implemented: ISM v3 single monthly resolution and responsiveness refactor

Select **Scoring system v3** on either ISM family. The view displays one final
EURUSD bias and its weak/moderate/strong evidence, with one component table split
into Manufacturing and Services. V2 retains its publication snapshots below the
same final headline. V3 explains the weighted sector contributions and which
one wins when they disagree. This is a resolution/presentation upgrade; it does
not change the original 70% Services / 30% Manufacturing policy or fit chart moves.

The latest elapsed publication determines the context timestamp. At Manufacturing,
Services stays pending. At Services, both eligible same-reference-month reports
can vote. V3 sums the original seven component votes once. It never adds the two
publication scores or chooses between their labels: the Services-time score
already contains Manufacturing, so doing that would double-count Manufacturing.
If opposing sector contributions differ, the larger weighted contribution wins.
Exact cancellation follows Services orders, activity, employment, prices, then
Manufacturing orders, employment, prices, with weak evidence. All-zero or invalid
inputs remain Uncomputed; unpublished context remains pending. Disagreement keeps
the existing evidence cap. No forecasts, market prices or other families enter.

Responsiveness changes:

- Full ISM analysis and Scatter scoring-signal derivation run in separate workers.
  A worker keeps one running job and only the latest pending input; obsolete
  results cannot replace the current broker/release. Closing the view terminates
  its worker. Worker errors are visible and leave the output Uncomputed.
- Clock/quote updates reuse the current calculation until another publication
  becomes available. Inspector flattens source inventory once per real change;
  identical calendar rows reuse their array even if an unrelated storage revision
  changes. Raw magnitude history is not fetched for closed Inspector or ISM derived-scoring views.
- Indexed reference-month lookups replace repeated scans across the full history,
  preserving latest-duplicate rejection, revisions and all native/reference gates.
- Candle chart rendering has a memo boundary and stable overlay callbacks.
  Event-marker placement depends on candle timestamps, independently of OHLC
  price updates. Pan geometry, drawings, price updates and navigation remain active.
- ISM features/assessments live in sector folders; worker lifecycle, orchestration,
  summaries, table, publication snapshots and notes have separate small modules.
  Inspector's raw reading table moved to `inspector/readings/`. The unused
  standalone Services v1 UI, registry binding and CSS were removed. The calculation
  and persistence key remain because current versions use them.

A terminal benchmark of 1,278 stored readings measured three assessments at
411 ms before indexing and approximately 93–100 ms after indexing. Both built
production workers returned identical results while the main event loop kept
running (ISM 102 ms and Scatter 71 ms roundtrip including startup in the final run). These are machine-specific
measurements, not a guarantee of a particular pan frame rate. Reproduce after a
frontend build with `node frontend/scripts/benchmark-ism-runtime.mjs <calendar.json>`.
Workers run in supported browsers; headless/non-worker environments use the same
pure calculation. Visual/panning verification remains with the user.

The 284-update ISM audit after refactoring exactly matches the previous v2 JSON
report, including labels, totals, component magnitudes and evidence. Future-removal
and source-chart parity checks pass. Tests cover one v3 output, dominance/ties,
pending inputs, no extra jobs on clock ticks, obsolete-result rejection, worker
errors and termination. Manual next check: pan the chart with v2/v3 open, inspect
a disagreeing month, and check Scatter previews, navigation and dock resizing.

### Implemented: monthly ISM context v2

Open either US ISM Services or US ISM Manufacturing in Inspector and select
**Scoring system v2**. One monthly group shows two publication-time outputs side
by side: **At Manufacturing release** and **At Services release**, each retaining
its original timestamp, EURUSD bias, evidence grade, change size and explanation.
The earlier output uses Manufacturing-time context; the later output combines
same-month Manufacturing and Services. These are chronological snapshots of the
context, rather than two standalone sector scores. Unpublished outputs stay pending.
V2 now also shows the latest monthly bias above those snapshots; this is the same
resolution as v3, with the publication history retained for comparison.
An update message states whether the newest publication established, changed,
strengthened or weakened weighted support for the monthly bias. One chart symbol
and one Inspector list entry now group the month's two publications, anchored at
the first publication. The table shows Manufacturing and Services as separate
series with their actual publication timestamps and labeled sector sections.
The scoring components likewise share one table with Manufacturing and Services
sections; each section shows its own release-time inputs. Both outputs remain
visible with no publication dropdown or collapsible details. Narrow screens stack
the output cards. The original scoring weights and timestamp gates are unchanged.
Raw release IDs, filter families and source inventory remain separate for
calculations and Scatter navigation; each section keeps its own Scatter button.

Display pairing requires a single valid reference month, verified source/chart
times, at most one publication per sector, Manufacturing before Services, and
no more than ten days between them. Ambiguous, mixed-reference or unverified
publications remain separate rather than being guessed into a group. A lone
verified sector retains the monthly display ID when its companion arrives.
The Inspector requests ten neighboring days on either side of its visible range
to assemble companions. Either enabled family and either publication inside the
selected range can retain the shared entry; its symbol stays at the first report.
This display grouping does not change scoring weights or release-time admission.

Display integration verification: the stored snapshot's 284 publications now
produce 142 monthly symbols, preserving all 1,278 source readings and clocks.
Mounted terminal checks cover one marker/list entry, nine separately timed rows,
stable selection as Services arrives, source Scatter navigation and simultaneous
publication snapshots without future leakage. Full frontend tests,
production build and lint pass. Visual chart/dock review remains with the user.
Next refinement should follow a user audit recording each publication's bias,
evidence and first H1 reaction separately, even though the symbol is shared.

The group's identity is **ISM/reference-year-month**, not proximity on the chart.
At a Manufacturing publication, the later Services section is pending. At the
Services publication, same-month earlier Manufacturing can participate. Only
observed publications at or before the selected timestamp are admitted; the
latest matching publication replaces an older one. Different reference months
are never carried into the group. Duplicate/mixed reference data, missing demand
and invalid latest readings cannot silently fall back to a clean older report.

| Sector | Context weight | Component weights |
| --- | --- | --- |
| Services | 70% | Orders 35%, activity 25%, employment 25%, prices 15% (unchanged v1) |
| Manufacturing | 30% | Orders 50%, employment 35%, prices 15% |

Each component compares its native index with max(50, preceding three-month
average), with supplied Revised Previous replacing only the nearest month.
The shared native-domain, continuity and 24-earlier-observation calibration gates
apply. Manufacturing headline PMI is non-voting context. Production, inventories
and supplier deliveries are absent from this repository family and are not
inferred. Services also keeps its headline composite non-voting. Weights and the
50 floor are fixed prototype judgments, set before the audit, not GDP-share
estimates, fitted market weights or validated probabilities.

Missing/excluded sector and component weights are not redistributed. A sector
needs calibrated demand before any of its components contribute. Totals use
integer weight units, with 10000 representing 100%, to avoid floating-point tie
ambiguity. Exact cancellation follows Services orders/activity/employment/prices,
then Manufacturing orders/employment/prices. Ties carry weak evidence; all-zero
and insufficient evidence remain Uncomputed.

Both sectors share three conceptual evidence groups: demand, labor and prices.
Adding another demand row cannot manufacture another independent confirmation.
Opposing sector totals or opposing aggregate demand/employment votes cap strength
at moderate. Missing components, a narrow lead or a tie give weak evidence.
Explanations show opposition rather than naming only the winning row.

Scatter Plot → Manufacturing → **Scoring signal** exposes its three components,
source/baseline values, formulas, calibration N, automatic bands and independent
manual overrides. Services uses its existing signal store shared by v1/v2; that
makes applied component changes visible in both. Manufacturing uses the separate
**ISM-MANUFACTURING-V2-SIGNALS** store. Previews are chart-only until applied;
workspace export/import carries both stores. Context-section buttons open the
exact source report in Scatter Plot. No aggregate total is plotted as a native
index-point signal.

**Timing verification:** the official 2026 calendar was checked on 6 October 2026.
Known date mismatches and weekend publications exclude that sector from v2, show
the reason and preserve all broker dates. January–December 2026 schedule dates
are a versioned source check, not an extrapolated holiday algorithm. Known official
10:00 US Eastern availability is an additional lower bound, alongside the stored
publication time. Later comparisons can use stored earlier readings once both
bounds have passed. The checks do not verify every historical timestamp or
reconstruct original vintages; source values can contain provider revisions.

The April 2026 Services row is stored on **April 3**, while the official release
calendar says **April 6**; that sector is excluded, leaving Manufacturing-only
context with weak evidence. The stored **October 5, 2025** Services publication
is on a Sunday and is likewise excluded. These are timing-quality findings;
no source inventory was rewritten. The user's February 5 observation should be
aligned with the stored/official **February 4, 2026** publication before judging
its release candle.

The implementation audit covers **284 updates across 142 reference months**.
All **44** updates in 2025–2026 produce a bias; **24** have incomplete context
(the 22 earlier Manufacturing updates plus the two timing exclusions). Removing
all future publications leaves every selected context unchanged. Every assessed
source component matches the source Scatter Plot value, points, boundaries,
calibration count, reason and input labels. Integer combined totals agree.
This is coverage and chronology verification, not price-prediction accuracy.

Validation on 6 October 2026: full frontend tests, lint and the TypeScript/Vite
production build passed. Stored comparisons preserve automatic bias, totals,
evidence and change size for all 140 CPI, 141 NFP, 139 PCE and 142 Services v1
publications. No visual/browser audit was performed; layout review remains with
the user.

| User development case | Services v1 | Monthly v2 | Evidence / qualification |
| --- | --- | --- | --- |
| September 3, 2026 | Short | Short | Moderate |
| August 5, 2026 | Short | Short | Moderate; grouping does not resolve the observed rally |
| July 6, 2026 | Long | Long | Moderate; July 30 movement is a separate context update |
| June 3, 2026 | Long | Short | Weak |
| May 5, 2026 | Long | Long | Moderate |
| April 3 stored row | Short | Long | Weak; Services excluded for date mismatch, not a validated directional improvement |
| March 4, 2026 | Short | Short | Strong |
| February 4, 2026 | Long | Short | Weak; user listed February 5 |
| January 7, 2026 | Short | Short | Weak |
| December 3, 2025 | Long | Long | Strong |
| November 5, 2025 | Short | Short | Weak; Manufacturing opposition reduces support without reversing direction |

These cases were supplied by the user as development observations with differing
price horizons. They are not an untouched test set. January's corrected narrative
is: initial ranging/fall, January 12 rally to **resistance**, then decline to
January 19 support. Subsequent NFP/CPI/policy releases do not enter this ISM-only
model, so extended rallies cannot be attributed solely to one ISM publication.

- [Monthly ISM v2 local audit](storage/data/ism-v2-design-audit.md)
- Reproduce with `node frontend/scripts/audit-ism-v2.mjs <calendar.json> <output-prefix>`.
- Manual review: both source dates, pending versus completed sections, explanations,
  v1/v2 selection, flat dock resizing, source Scatter navigation and applied limits.

## Future combination design

Monthly ISM v2 is the first narrow context implementation. The shared
`publication-context.ts` helper admits observations by timestamp and selects
latest same-reference-period publications. USD context memory v1 now retains
CPI/NFP/ISM state with fixed weights and expiry; broader family coverage,
context-sensitive weighting and policy interpretation remain future work.

Each release first has its own interpretation. A separate context layer can then
produce one bias using the newest known inflation, employment, activity and policy
information. It must retain publication timestamps and reference periods, replace
older readings of the same series, disclose missing context and reduce the influence
of stale information. It must never use a later release to explain an earlier one.

CPI and PCE can describe overlapping inflation developments; payroll subcomponents
overlap with total payrolls. More rows must not automatically mean more independent
evidence. Opposing families reduce evidence strength even when a weighted bias wins.
Context-sensitive priorities will need their own documented tests before use.

## Validation and limits

Historical magnitudes start in January 2015. Derived scorers require at least 24
earlier usable observations per component and calibrate strictly before the selected
publication. Stored provider revisions can overwrite old readings; filtering dates
alone cannot reconstruct original data vintages.

For separate price diagnostics, use a pre-release baseline to +60 minutes as the
primary H1-related window, with +15/+240 minutes secondary. The containing H1
candle can include pre-release time. Manually selected examples are development
observations, not an untouched accuracy test. Evaluate coverage, Long/Short results,
evidence behavior and data gaps before claiming predictive performance.

The stored-data audit assessed 141 NFP releases from 2015 through 2 October 2026.
All 21 releases in 2025–2026 produced a bias; 3 used reduced data. August 1, 2025
was Long with strong evidence; August 7, 2026 was Long with moderate evidence.
Those are implementation outputs, not verified price-direction successes.
The refined CPI audit preserves the directional outputs and totals across all
140 stored CPI releases, while some evidence labels change after grouping.

- [Refined CPI audit](storage/data/cpi-v3-refined-audit.md)
- [NFP v2 audit](storage/data/nfp-v2-design-audit.md)
- Audit snapshots/reports are local ignored artifacts in `storage/data`; the
  tracked CLI scripts in `frontend/scripts` can regenerate them from snapshots.
- Targeted CPI/NFP regressions, the full frontend suite, lint and the TypeScript/
  Vite production build passed on 6 October 2026. Existing scorers, navigation,
  magnitude settings and workspace portability regressions also passed.
- Remaining manual review: Inspector dock layout/resizing, version switching,
  explanation clarity and user audit against other releases.

## Sources and code

- [Scoring implementation documentation](frontend/src/inspector/scoring/README.md)
- [BLS Employment Situation definitions and revision methodology](https://www.bls.gov/news.release/empsit.tn.htm)
- [BLS August 2025 release: example of two-month payroll revisions](https://www.bls.gov/news.release/archives/empsit_08012025.htm)
- [Federal Reserve inflation objective](https://www.federalreserve.gov/faqs/economy_14400.htm)
- [BEA: differences between CPI and PCE](https://www.bea.gov/help/faq/555)
- [BEA: core PCE definition](https://www.bea.gov/help/faq/518)
- [BEA: August 2026 release and annual revisions](https://www.bea.gov/news/2026/personal-income-and-outlays-august-2026)
- [Federal Reserve: annual PCE inflation objective](https://www.federalreserve.gov/economy-at-a-glance-inflation-pce.htm)
- [ISM Services methodology and composite construction](https://www.ismworld.org/supply-management-news-and-reports/reports/ism-pmi-reports/services/april/)
- [ISM official release calendar](https://www.ismworld.org/supply-management-news-and-reports/reports/rob-report-calendar/)
- [ISM seasonal adjustment methodology](https://www.ismworld.org/supply-management-news-and-reports/reports/seasonal-adjustment-factors/)
- [FOMC policy materials](https://www.federalreserve.gov/monetarypolicy/fomc.htm)
