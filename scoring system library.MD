# Scoring system library

Updated: 6 October 2026. Scope: EURUSD, starting with USD event families.

## Accepted EUR roadmap — deferred implementation

The user accepted this sequence on 6 October 2026. It is planned work, not
implemented coverage. Investigate the current USD-context audit before expanding.

1. Euro-area inflation, with German CPI/HICP as supporting country context.
2. Euro-area PMIs, incorporating German and French publications at their actual
   release times within the same activity budget.
3. Euro-area employment/unemployment, wages/labor costs and GDP.
4. ECB policy: distinguish rate action from statement, projections, conference
   and speech guidance. Full guidance interpretation requires timestamped text;
   calendar labels and a rate hold cannot supply that content.
5. A relative EUR–USD context engine with visible contributions from both sides.

Euro-area aggregates anchor the EUR interpretation. Overlapping national and
regional readings must not receive independent full votes for the same evidence.
Country data can provide earlier updates; the later aggregate must resolve that
overlap explicitly. Preliminary/final publications and revisions need separate
update rules. All inputs retain publication-time chronology and visible
magnitudes. Comparable scales and declared budgets are prerequisites to combining
the two currency engines; simply subtracting their existing raw scores is not
an approved policy.

Audit standalone meaning, chronology and combination arithmetic now. Save the
larger EURUSD price-reaction audit for bilateral coverage, while retaining current
disagreements as open findings. Price agreement alone does not certify a rule or
prove the causal effect of a release.

References: [Eurostat HICP framework](https://webgate.ec.europa.eu/eurostat/cache/metadata/en/prc_hicp_esms.htm)
and [ECB monetary policy](https://www.ecb.europa.eu/mopo/intro/html/index.en.html).

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
| USD CPI v4 publication context | Scoring system v4 | Unchanged v3.1 standalone reading plus shared USD context before/after CPI, vote replacement and shared Raycaster input controls. Implemented. |
| USD CPI v3, refined | Scoring system v3 | Latest core pace versus preceding three months; weights 35/35/20/10. Related core monthly signals share an evidence group; separate strength, change size and limitations. Implemented, policy v3.1. |
| USD NFP original | Scoring system | Payrolls, inverse unemployment change and monthly wage change each have weight 1; seven supporting readings excluded from the USD total. Implemented. |
| USD NFP v2 | Scoring system v2 | Hiring pace, unemployment with participation context, wage pace, preceding-month payroll revision and working hours. Weights 40/30/15/10/5; earlier-history calibration and grouped evidence. Implemented. |
| USD Jobless Claims v1 | Scoring system | Smoothed initial claims 50%, continuing claims 30%, weekly initial claims 20%; inverse revision-aware weekly comparisons, grouped evidence and visible magnitudes. Implemented standalone and integrated as a 10% shared labor-context vote. |
| USD Retail Sales v1 | Scoring system | Control-group pace 60%, ex-autos-and-gas pace 25%, headline pace 15%; revision-aware preceding three-month benchmarks floored at zero, grouped evidence and visible magnitudes. Implemented; manual audit next. |
| USD PCE v1 | Scoring system | Core monthly pace, annual core change, headline monthly pace and annual headline change. Weights 45/30/15/10; revision-aware comparisons, grouped evidence and visible magnitudes. Implemented. |
| USD ISM Services v1 | Retired standalone screen | Original 35/25/25/15 sector policy is documented and retained internally for v2/v3 and audit reproduction. |
| USD ISM monthly context v2 | Scoring system v2 on either ISM family | Services 70% plus Manufacturing 30%, same reference month, publication-time reconstruction, one bias and grouped evidence. Implemented; user audit next. |
| USD ISM monthly resolution v3 | Scoring system v3 on either ISM family | One latest available monthly bias, weighted sector contributions and a plain explanation of which evidence wins. V2 component math and evidence policy are preserved. |
| USD GDP v1 | Scoring system | GDP/real consumption/final sales weights 50/30/20; first stored quarter estimate versus prior four quarters, or same-quarter estimate revision; separate calibration populations. Implemented. |
| USD PPI v1 | Scoring system | Core monthly/annual weights 50/30; headline monthly/annual 15/5. Earlier-history calibration and core gate. Implemented. |
| USD FOMC action v1 / Fed Chair coverage | Scoring system | Hike/cut action interpretation, hold without action direction, explicit unavailable statement/speech text, economic context shown separately. Partial policy coverage; guidance scorer pending a text source. |
| USD context memory v6 / Raycaster | Chart header → Raycaster; CPI v4 and registered publication panels | V5 source budgets plus cadence aging and explicit usable-component coverage; qualified opposing weekly Claims can receive 10 points from an aging Weak/incomplete NFP. Earlier labor–inflation rule retained, transfers do not stack. Visible factors and effective weights. Implemented; audit below. |

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
for CPI and both ISM families; V4 is available for CPI publication context.
Unimplemented families fall back to Table.

These weights, confirmation groups, thresholds and participation adjustment are
explicit prototype policies; they are not fitted estimates or validated market
probabilities. Monthly ISM v2 is the first implemented context combination; the
USD context memory v6 combines all numerical inflation, labor and activity menu families.
FOMC guidance and Fed Chair text interpretation remain data-source work.

Terminal validation and manual review status are recorded below.

## Development order and remaining work

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
| 5 | Jobless Claims | Employment updates between monthly reports | Standalone v1 and 10% labor-budget integration implemented |
| 6 | GDP | Broad growth, expenditure components and revision context | V1 implemented with separate first-estimate/revision populations |
| Initial pilot now; expand after surrounding inputs | USD context engine | Update inflation, labor and growth assessments using latest known information | V5 implemented for eight numerical families; shared controls and conditional labor–inflation priorities |
| After the surrounding inputs | FOMC | Rate action plus changes in statement, projections and press-conference guidance | Rate action v1 implemented; statement/projection/conference interpretation needs timestamped source text |
| Later | PPI, Fed Chair speeches | Additional context after the core families are useful | PPI v1 implemented and integrated; Fed Chair text coverage unavailable |
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

### Archived: USD context memory v2 and independent Raycaster controls

Superseded by v3 and CPI v4 below; these weights and audit results describe the previous implementation.

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
causes. At this earlier audit stage Claims was implemented and GDP was next; current GDP/PPI coverage is documented in the v5 section.

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


## USD Jobless Claims v1: standalone weekly pressure

Implemented 6 October 2026. Select a US Jobless Claims release in Inspector and
choose **Scoring system**. This produces one EURUSD Long/Short bias, evidence,
change size, a plain explanation and flat component details. Claims has its own
module worker and portable magnitude scope. The original standalone pass left
Raycaster unchanged; the later v3 integration is documented below.

The factual distinction matters: initial claims are new applications for benefits;
continuing claims concern insured workers continuing to claim. They do not cover
all unemployment or directly measure hiring. The official DOL release reports
continuing claims for a week earlier than initial claims, and supplies prior-week
revisions. The source provider in this workspace labels reference weeks on Friday;
we retain those dates instead of rewriting them to the official Saturday label.

| Component | USD-supportive signal, in thousands of claims | Weight | Evidence group |
| --- | --- | ---: | --- |
| Smoothed initial claims | Mean of four preceding reported weekly 4-week averages minus latest reported average | 50% | New claims |
| Continuing claims | Mean of four preceding weekly levels minus latest level, converting millions to thousands | 30% | Continued claims |
| Latest initial claims | Mean of four preceding weekly initial levels minus latest level | 20% | New claims |

All three benchmarks replace their nearest preceding actual with a supplied
Revised Previous, including explicit zero. An invalid supplied revision makes
that component unavailable. Revision effects enter the benchmark without a
separate revision vote. Missing reference weeks are not skipped or filled from
Previous. This policy interprets changing claims pressure relative to recent
levels; it does not assert that a falling but historically high level is healthy.
Weights are declared priorities, not fitted coefficients or measured FX impact.

Positive signal = fewer claims relative to comparison = USD support = EURUSD Short.
Negative signal = more claims pressure = EURUSD Long. Each component uses the
existing 24-earlier-usable-signal gate since January 2015 and nearest-rank 33⅓%,
66⅔%, 90% nonzero absolute magnitude boundaries. Tied cutoffs remain intact.
Signed 0–4 points multiply the component weight; missing weights are not
redistributed. One calibrated component may establish a reduced-data, Weak bias.
Exact cancellation follows smoothed → continuing → latest initial with Weak
evidence. All-zero/no usable evidence remains Uncomputed.

Initial and its overlapping average share one evidence group. Continuing is a
separate descriptive group, not statistically independent confirmation. Existing
grouped agreement rules determine Weak/Moderate/Strong evidence and separate
change size. Benefit eligibility and exhaustion can affect continuing claims;
it is not interchangeable with payroll hiring or the unemployment rate.

Source gates require observed US/USD readings at the selected verified publication,
expected native units, finite nonnegative count values, and recent reference dates.
Initial and its average must share a week; continuing must be one week earlier
when an initial anchor is usable. Each component requires its own four consecutive
prior reference weeks. The latest strictly earlier publication of a reference
week wins; duplicates or invalid latest readings do not silently fall back.
Forecasts, provider impact labels, market prices and other families do not vote.

**Visibility:** Scatter Plot → Measure → Scoring signal exposes these exact three
features. A positive plot value means less claims pressure; this is deliberately
inverted from original Actual − Previous. Actual and benchmark use thousands,
including continuing claims. `CLAIMS-V1-SIGNALS` custom boundaries affect the scorer
only after Apply, refresh mounted consumers, and are included in workspace export/
import. Original Claims A−P magnitudes and other family settings are independent.

**Stored implementation audit:** source Elev8-Demo2, revision 78430, 1,818 rows,
606 publication groups from January 2015 through 1 October 2026. 574 produce a
bias (237 Long, 337 Short); 32 are Uncomputed. The first 28 lack the initial history
needed for calibration. Four later publications (20/26 November and 4/11 December
2025) lack a complete preceding four-week sequence in this inventory. No values
were fabricated to fill those gaps. Of 85 publications in 2025–2026, 81 compute.
These are coverage counts, not price-prediction results.

Every stored signal matched its Scatter values, inputs, magnitude points, boundaries
and calibration N. Removing same-time/later inventory preserved every assessment.
Production Inspector/Scatter workers matched pure calculations and kept the main
thread active (72/116 ms including thread startup in the initial run). Automated
checks cover conflicts/ties, reference cadence/lag, source validity, missing data,
revisions/zero, forecasts/future removal, scoped storage, Inspector menus, flat UI,
manual preview/apply/reset, worker reuse/error/stale replies and workspace portability.
Stored vintages may contain later provider revisions; date filtering cannot undo
those corrections. The full frontend test suite, lint and TypeScript/Vite build
passed for this implementation. Visual review and H1 price diagnostics remain
with the user.

Reproduce after a frontend build:
`node scripts/audit-claims-v1.mjs <claims-calendar.json> <output-prefix>`.
The local ignored report is [Claims implementation audit](storage/data/claims-v1-design-audit.md).

### Archived policy: shared context v3 Claims integration

Claims integration remains active; the fixed-weight policy is superseded by v4 below.

Keep the existing total labor budget at **40%**, split into **NFP 30% + Claims 10%**.
Together with CPI 40%, ISM 10% and Retail 10%, the total remains 100%.
NFP stays the monthly anchor; Claims provides a smaller weekly update. This is a
prototype policy to audit, not a mathematically optimal or fitted allocation.

Retain only the latest Claims publication, replacing its previous slot rather than
accumulating weekly votes. Use a 14-day Claims expiry instead of the monthly
45-day expiry, with no redistribution of disabled/missing/expired weights. Admit
each source only at publication; a later Claims release cannot rewrite earlier
NFP-time context. Treat NFP and Claims as a shared labor domain when assessing
combined evidence: agreement is not another independent confirmation. Their
opposition is visible and caps combined evidence at Moderate, with Weak
still used for a narrow lead, missing sources or cancellation. Exact context ties
use CPI → NFP → Claims → ISM → Retail. All unavailable evidence stays Uncomputed; a
standalone declared zero-score tie direction remains eligible.

Implemented following user authorization on 6 October 2026. Standalone scorer
formulas remained unchanged at this stage. GDP was then the next planned family.
The v5 section records its implementation and the remaining policy-text dependency.

Methodology: [DOL claims definitions](https://oui.doleta.gov/press/2016/122916.pdf),
[DOL release: reference weeks and revisions](https://www.dol.gov/sites/dolgov/files/OPA/newsreleases/ui-claims/20260478.pdf),
[BLS: UI recipients and total unemployment differ](https://www.bls.gov/cps/cps_htgm.htm).


## Implemented: CPI v4 dual interpretation and shared publication context

The initial fixed-weight v3 audit below is archived; current interaction policy
and v4 audit follow in the next section. CPI v4 remains the Inspector menu label.

Implemented 6 October 2026. Select **Scoring system v4** on a USD CPI release in
EURUSD Inspector. The flat view presents:

1. **This CPI release:** the exact canonical v3.1 result, evidence, change size,
   explanation and original component readings/weights/calibration.
2. **Combined context after CPI:** the shared engine's bias/evidence at publication,
   the context immediately before it, and how the new CPI vote replaces the old one.
3. **Context inputs:** CPI/NFP/Claims/ISM/Retail source biases, freshness, raw scores,
   weights and contributions. Enabled/Off changes the same controls as Raycaster.

This answers a release and its surrounding context in one Inspector view without
changing the meaning of the standalone CPI scorer. CPI Off/all inputs Off leaves
the standalone assessment visible. The combined table explains when surrounding
sources outweigh CPI, instead of altering CPI's own readings. Its direction can
remain the same as standalone: no historical price mismatch forces a flip.

Publication context looks up the shared timeline at CPI chart time minus 1 ms
and exactly at publication. Raycaster uses the hovered candle's exclusive end;
a whole H1 candle may admit another later publication. Identical timestamps and
inputs produce identical snapshots. Other simultaneous publications/expiry changes
are named separately from CPI's contribution change. Current uncomputed CPI
replaces the old vote rather than silently retaining favorable old evidence.

The shared context store retains the existing local key with a version-2 object.
A legacy complete four-input default adds Claims; deliberate partial/all-off
settings survive. A newly saved Claims-Off choice remains Off on reload/export/
restore. Inspector marker filters remain independent. Existing signal magnitudes
and manual boundaries remain shared with standalone scorers and Scatter.

The context and standalone CPI assessment run in module workers. Selecting a
historical CPI reuses the prepared context timeline; clock heartbeats and cursor
movement do not rebuild it. Changes to relevant component settings or family
selection invalidate background results; stale replies are discarded. Reusable
context UI/storage belong to `usd-context/`, not Raycaster. CPI v3's component table
is extracted without changing its math. No screenshot/browser audit was performed.

The evidence cap for opposing NFP/Claims is one explicit interaction rule; broader
Fed-policy regimes and inflation-versus-labor interpretation are not implemented
in this pass. Priority weights/freshness remain declared assumptions to audit,
not price forecasts, probabilities or objectively unique macro conclusions.

**Verification on 6 October 2026:** full sequential frontend suite, lint and
TypeScript/Vite production build passed. Stored baseline parity preserves totals,
directions, evidence and change size for **140 CPI, 141 NFP, 284 ISM, 144 Retail
and 606 Claims** publications. The five-family timeline contains **1,244 snapshots**;
ten future-removal cutoffs preserve the full publication result, including CPI v4
before/after comparisons. Actual production context and CPI standalone workers
match their canonical pure functions. One run took about 9.3 seconds in the context
worker while the main event loop remained active; hover stays a prepared lookup.

The stored replay deliberately retains disagreements with price:

| CPI publication | Standalone CPI | Combined publication context | Interpretation |
| --- | --- | --- | --- |
| 12 August 2025 | Short / Strong | Short / Weak, USD score +0.3045 | CPI +0.58, Retail +0.20 and Claims +0.02 outweigh NFP -0.39 and ISM -0.1055. Labor opposition and a narrow net lead weaken evidence; the reported rally is not explained by forcing Long. |
| 11 September 2025 | Short | Short / Weak, USD score +0.2405 | CPI and other positive votes outweigh weaker labor; Claims updates simultaneously, which CPI v4 identifies separately. |
| 12 August 2026 | Long | Long / Moderate, USD score -0.773 | CPI supports the Long context, but replaces a larger previous Long vote, reducing net support rather than strengthening it. |

These are reconstructed source snapshots from differing collection revisions,
not certified original-release vintages or measured price-reaction performance.
The weak August 2025 combined assessment documents disagreement; it does not
establish why the market rallied. Policy guidance, EUR context and market pricing
remain outside this implementation.

Local report: [USD context v3 audit](storage/data/usd-context-v3-design-audit.md).
Reproduce after a frontend build:
`node scripts/audit-usd-context.mjs <cpi.json> <nfp.json> <ism.json> <retail.json> <claims.json> <output-prefix>`.

Manual review: select CPI v4, compare standalone v3, resize the dock, toggle shared
inputs from either CPI v4 or Raycaster, and inspect the source contributions and
before/after explanation. Compare equal timestamps; an H1 candle end may include
later releases. Visual verification remains with the user.


## Archived: context memory v4 conditional labor–inflation priorities

Implemented 6 October 2026 following the August/September 2025 user audit. This
updates the shared context engine used by **CPI Scoring system v4** and Raycaster.
It adds a declared data interaction, rather than changing individual source
readings or inserting historical date exceptions. No new event family is added.

**Rule:** prioritise confirmed labor deterioration when opposing CPI pressure
stays within explicit escalation guards. Every condition must pass:

| Condition | Requirement |
| --- | --- |
| Labor deterioration | Active, complete, Strong USD-weakening NFP; hiring below its recent average and unemployment rising |
| Opposing inflation | Active, complete USD-supportive CPI |
| Current core pace | Core CPI m/m ≤ 0.30% |
| Recent core pace | Latest three-month core m/m average ≤ 0.30% |
| Annual core level | Core CPI y/y ≤ 3.50% |
| Positive acceleration | Monthly core block and annual core each at most Medium / 2 magnitude points |

The monthly block uses **max(0, fresh points, trend points)** for this gate. It
does not add overlapping signals. The source-overlap review found that fresh
and trend already divide a fixed 70% source budget and share an evidence group;
standalone CPI v3.1 is preserved. Context CPI's budget is reduced only when the
conditional rule passes. Source grades remain source grades.

| Policy | CPI | NFP | Claims | ISM | Retail |
| --- | ---: | ---: | ---: | ---: | ---: |
| Balanced priorities | 40% | 30% | 10% | 10% | 10% |
| Labor priority | 20% | 50% | 10% | 10% | 10% |

The 20-point transfer is an explicit analytical priority, not an estimated FX
coefficient. These inflation ceilings are prototype safeguards, **not Fed targets
or proof that inflation is acceptable to policymakers**. Guidance-aware policy
regimes remain future work. The output means easing pressure under this declared
interpretation, not an observed Fed intention. No forecast or price outcome enters.

The rule enters/exits at eligible publication or expiry snapshots. It requires
both CPI and NFP enabled and active; missing/partial/moderate NFP, absent validated
traits, cooling CPI or hotter inflation retains base priorities. Fresh publications
replace old assessments even when uncomputed. Missing/Off/expired weights are not
redistributed. Claims stays a single 14-day slot; other votes expire after 45 days.
Opposing CPI and NFP cannot produce Strong combined evidence under this rule;
a narrow lead still produces Weak. Existing cancellation/Uncomputed policy remains.

**Visibility:** CPI v4 and the Raycaster gear show the same rule label, every
condition's Met/Not met/Unavailable state, effective weights and changed base
weights. Raw source bias/score remains visible. A collapsed Raycaster names active
Labor priority. CPI's before/after text separates source replacement at old weight
from the CPI priority effect, and identifies reweighting of other existing votes.
Simultaneous Claims/CPI still enter atomically. No context rule is inferred from
later Powell remarks or a subsequent Fed decision.

**Implementation:** small `usd-context/core/interaction/` modules own typed traits
and guard logic; canonical scorers validate and calculate all features. Shared
`ContextPolicyDetails` owns presentation. Worker timeline rebuild rules, binary
hover lookup, saved filters, Scatter magnitudes and workspace compatibility remain.
Standalone scorer totals/directions/evidence/magnitudes remain unchanged.

**Audit discipline:** freeze default guards before replay; compare every stored
publication with archived v3, report earlier 2015–2024 separately, and disclose
0.25/0.35 monthly and 3.25/3.75 annual guard sensitivity. These coverage comparisons
have no historical FX return labels and cannot measure predictive success.
The two user cases motivated the hypothesis. Defaults were declared before the
broader replay; that does not make these cases independent validation.

**Verification on 6 October 2026:** the full sequential frontend suite, lint and
production build passed. Additional interaction regressions cover hotter
inflation, unchanged/recovering labor, missing/Off/expired sources, guard boundaries,
manual magnitudes, visible effective/base arithmetic and future removal. Even
with Labor priority active, sufficiently strong opposing activity/Claims votes
can still produce Short: the rule changes priorities, not a forced Long override.

All **140 CPI, 141 NFP, 284 ISM, 144 Retail and 606 Claims** standalone totals,
directions, evidence and change size match the prior reports. Across **1,315
publication snapshots**, Labor priority is active at **35**, and direction changes
versus v3 at **24**. All base-policy publication results retain their prior score
and direction. There are 1,244 prepared timeline points. These are interpretation
coverage counts, not price hit rates.

| Period | Publications | Labor priority active | Direction changes |
| --- | ---: | ---: | ---: |
| 2015–2024 | 1,124 | 15 | 6 |
| 2025–2026 | 191 | 20 | 18 |

Thirteen full future-removal replays pass, including the two user cases and
older affected context on 1/21 September 2017 and 9 April 2020. Both production
workers match pure functions; one context worker run took about 10.4 seconds
while the main event loop remained active. Hover remains a binary lookup, and
selection/heartbeat worker-reuse checks pass. Reconstructed source vintages can
contain later revisions; date filtering cannot undo them.

| CPI publication | Standalone CPI | Previous combined v3 | Current combined context v4 |
| --- | --- | --- | --- |
| 12 August 2025 | Short / Strong, unchanged | Short / Weak, +0.3045 | **Long / Weak, -0.2455** |
| 11 September 2025 | Short / Strong, unchanged | Short / Weak, +0.2405 | **Long / Weak, -0.2895** |
| 12 August 2026 | Long, unchanged | Long / Moderate, -0.773 | Long / Moderate, -0.773 |

August 2025: effective CPI +0.29 and NFP -0.65, with Claims +0.02, ISM -0.1055 and
Retail +0.20. September: CPI +0.32, NFP -0.525, Claims -0.18, ISM +0.0305 and Retail
+0.065. Both remain Weak because opposing votes leave a narrow net lead. August's
CPI still reduces support for an existing Long context; September's simultaneous
Claims/CPI update reinforces Long. Matching the observed rally does not imply
CPI itself became cooling or prove attribution of the exact release candle.

**Sensitivity:** the default 0.30% monthly guards yield 35 active / 24 changed
publications. Tightening both monthly guards to 0.25% yields 19 / 10 and returns
both 2025 user cases to Short. Relaxing to 0.35%, or varying the annual ceiling to
3.25%/3.75%, leaves this inventory's default outcomes unchanged. The prototype
therefore depends materially on the monthly ceiling. Keep that visible and audit
broader reactions before treating the rule as established policy interpretation.
No sensitivity variant was selected by optimizing price outcomes.

Manual audit candidates: the two 2025 cases, changed CPI context on **14 September
2017**, hotter-inflation releases where the rule stays Off, and weaker NFP that
fails the full confirmation gate. Compare H1 release windows separately from
later reversals; these stored audits contain no standardized FX return labels.

Report: [USD context v4 coverage and sensitivity audit](storage/data/usd-context-v4-design-audit.md).
After a frontend build, use the same five-snapshot audit command with a v4 output
prefix; it requires the archived v3 and standalone JSON reports. Shared policy
source and UI details are documented in [USD context](frontend/src/usd-context/README.md).
No visual automation or screenshot audit was performed.

Research context, not scoring inputs: [Powell's 22 August 2025 speech](https://www.federalreserve.gov/newsevents/speech/powell20250822a.htm)
discusses balancing inflation and employment risks. It occurs after the August
12 release, so it cannot be used to classify that earlier publication. The
prototype does not import this speech, later Fed decisions or survey forecasts.

### Implemented: USD numerical menu completion and context v5

The current numerical USD menu now has standalone policies for CPI, PCE, PPI,
NFP, Claims, both ISM sectors, Retail Sales and GDP. Original established source
formulas remain unchanged. Every registered full scorer also shows combined
economic context at the selected publication; CPI retains its dedicated v4 view.

**GDP v1:** GDP growth 50%, real consumer spending 30%, real final sales 20%.
The first stored estimate of a quarter compares each growth rate with the latest
usable readings of the preceding four consecutive quarters, with the mean
floored at zero. A valid supplied Revised Previous replaces the nearest prior
quarter. A later stored estimate compares actual with the latest earlier
estimate of the same quarter, ignoring Previous as a quarter-growth benchmark.
First-quarter estimates and revisions calibrate separately against strictly
earlier signals; each component needs 24 usable observations. GDP itself is
required. Missing quarters, ambiguous latest readings and invalid units do not
fall back to another quarter. Consumption is the demand evidence group; GDP and
final sales share output. They overlap, so agreement is not independence.
Quarterly inflation rows are non-voting context, not another monthly PCE vote.
A revision replaces the GDP context slot with the revision interpretation.
The feed does not certify that the first stored estimate is BEA's advance
estimate, or guarantee original data vintages.

**PPI v1:** core monthly pace 50%, annual core change 30%, headline monthly pace
15%, annual headline change 5%. Pace compares actual with the preceding three
consecutive months, incorporating supplied Revised Previous for the nearest
month. Annual change uses Revised Previous when present, otherwise Previous.
A calibrated core component is required. Monthly core/headline share one
evidence group; annual readings share another. This catalog's core excludes
food and energy; it does not supply the separate less-food-energy-trade-services
measure. PPI describes producer selling prices and receives only a small
upstream-inflation share; it is not a numerical PCE forecast.

Both use signed magnitude points 0–4, fixed source weights, 24 earlier usable
signals, nearest-rank 1/3, 2/3 and .90 automatic boundaries with ties retained,
and the existing grouped evidence policy. Missing weights do not redistribute.
Exact cancellation follows table order; all-zero/unavailable evidence remains
Uncomputed. Scoring signal mode exposes exact derived inputs, baselines and
custom limits; overrides are portable and independent of original A−P settings.

**Context v5 budgets:** inflation remains 40% (CPI 28, PCE 10, PPI 2); labor
remains 40% (NFP 30, Claims 10); activity remains 20% (ISM 10, Retail 7, GDP 3).
Weights are declared priorities, not fitted price coefficients. GDP expires
after 120 days; Claims after 14; other numerical slots after 45. Off/unavailable
weights are never redistributed. Enabling new inputs adds their assigned weight;
it does not stack another full inflation or activity domain budget.
The existing labor-priority conditions transfer 20 points from CPI to NFP
(CPI 8, NFP 50). An active Strong USD-supportive PCE/PPI assessment with total
at least 2 blocks that transfer as an additional inflation-escalation guard.
This threshold is a prototype judgment; no price outcome or date chooses it.

Saved defaults migrate from the former four-family array or version-2 full
five-family object to all eight inputs. Partial/all-off selections remain exact.
Version-3 selections preserve deliberate new-family exclusions on reload and
workspace restoration. Tables show every source, its effective weight,
contribution and evidence. Both tools consume the same canonical source scorers.

**FOMC and Fed Chair limitation:** the actual feed contract stores rate values
and event labels, without statement, projections, press-conference answers or
speech content. FOMC action v1 interprets a hike as USD-supportive and a cut as
USD-weakening, both with Weak rate-action evidence because guidance is absent.
A hold gives the factual label Rate hold and no fabricated action bias. Invalid
rate data or a speech-only event is Uncomputed with the missing-text explanation.
The accompanying economic-context panel can still give Long/Short from prior
numerical releases. Fed action/tone adds no Raycaster weight. Full policy-aware
menu completion requires a timestamped text source and a declared guidance
interpretation policy; this pass does not claim that capability exists.

Next work: acquire publication-timestamped official Fed materials, distinguish
rate action from changes in forward guidance and projections, and update the
same context engine atomically at statement/conference times. No look-ahead from
a later speech, press conference or subsequently revised release is admissible.
User audit remains the next review of the completed numerical policies.

Methodology references:
- [BEA GDP revisions](https://www.bea.gov/gdp-revision-information): separate quarter growth and revisions to estimates.
- [BLS PPI definitions](https://www.bls.gov/ppi/faqs/questions-and-answers.htm): producer prices and the distinct exclusion measures.
- [Federal Reserve FOMC materials](https://www.federalreserve.gov/monetarypolicy/fomc.htm): policy statements and related guidance are separate source content.

Validation and local audit results are recorded after the chronological replay.
Visual UI audit remains with the user, including the expanded Raycaster table,
GDP/PPI signal selector and each publication-context panel at short dock heights.

**V5 stored implementation audit:** source Elev8-Demo2, revision 78432,
137 GDP publications (36 Long, 45 Short, 56 Uncomputed) and 140 PPI publications
(56 Long, 60 Short, 24 Uncomputed). Early insufficient calibration and absent
comparison data stay visible instead of becoming directional guesses. Every
GDP/PPI release passed removal of same-time/later inventory; each plotted value,
magnitude point, calibration count, boundary, input and missing-data reason
matched its scorer. The eight-family timeline contains 1,489 snapshots. Twelve
full-context publication replays passed across 2017, 2020, 2022, 2025 and 2026,
including simultaneous Claims/CPI and GDP/PCE publications.

The August 12 and September 11, 2025 CPI combined outputs remain EURUSD Long /
Weak, with USD totals −0.2715 and −0.375 under the expanded history and weights.
August 12, 2026 is Long / Weak (−0.952). These are implementation replay results,
not additional independent price-validation observations.

Production worker parity passed: full context approximately 13 seconds, latest
GDP approximately 97 ms and latest PPI approximately 81 ms in this run, while
the main event loop stayed active. These are calculation timings, not UI
benchmarks. The snapshot contains 304 Fed/Chair publication groups, 32
directional rate actions and 63 holds; no speech/statement text is available.

Reproduce after building:
```powershell
node frontend/scripts/audit-usd-menu-v5.mjs storage/data/usd-menu-v5-design-snapshot.json storage/data/usd-menu-v5-design-audit
```
The local snapshot/report live in ignored personal calendar storage. Audit logic
and tests are tracked. [Local v5 audit](storage/data/usd-menu-v5-design-audit.md).

Terminal verification: the complete frontend test command passed, including
new model and mounted integration tests. Final lint, TypeScript/Vite production
build and diff whitespace checks passed. After separating GDP Scatter
distribution populations, GDP/PPI parity and the shared signal-plot regressions
passed again. No visual browser or screenshot audit was performed.

## December 2025–January 2026 Raycaster audit

The user's Long-until-9-January observation reproduced under all eight enabled
families and automatic magnitudes. Retained December CPI/NFP/PCE votes outweighed
the new GDP/Claims/ISM inputs. NFP's 9 January replacement tipped the total from
−0.2395 to +0.0905. Missing CPI on 13 January removed an old negative vote,
increasing the Short lead without supplying new USD-supportive inflation evidence.
These are implementation facts, not validation against the observed price path.

ISM's grouped 5 January chart marker and its final monthly Inspector summary
refer to different cutoffs: Manufacturing was Long under defaults at publication;
Services changed the monthly result to Short on 7 January. Audits must use the
summary's As-of time or the v2 publication snapshots, not the grouped marker's
anchor date alone. Saved manual magnitude settings are outside this replay.

A confirmed wording defect is corrected: each incoming source's direction is
now stated separately from the combined context and change in weighted lead.
A smaller positive replacement must not be described as a USD-weakening release.
Same-time updates state every source. Scoring math and outputs are unchanged.

Next context research: age-sensitive retention, explicit coverage influence,
bounded Claims confirmation against older NFP, and distinguishing new information
from retained background. No new policy weights or direction flips are approved
by this audit alone. Check candidates across independent windows before adoption.
The post-9-January rally remains unresolved in the USD-only numerical model.

[Detailed findings and reproducible audit](reports/USD-context-Dec2025-Jan2026-audit.md).

## Implemented: shared context memory v6

The June 17–18, 2026 audit exposed a narrow v5 Long score (−0.0395) despite
positive NFP and new Retail inputs. The December audit also identified CPI with
20% nominal component coverage and NFP with 45% coverage retaining their source
budgets without additional context caution. V6 preserves every standalone scorer
and changes only shared context influence and one bounded weekly interaction.

**Vote:** unchanged source total × assigned weight/100 × age retention × usable
nominal component coverage. Retention is `2^(-ageDays/halfLifeDays)`, advancing at
broker calendar day boundaries. Claims half-life 7 days, monthly families 30,
GDP 90; hard expiries remain 14/45/120. Nominal component coverage uses NFP base
weights rather than its participation adjustment. Usable zeros count; missing
weights are not restored. This extra coverage caution is a declared prototype
choice even though source totals already omit unavailable components. Evidence
grades are not numerical probability multipliers.

**Weekly labor priority:** three consecutive complete same-direction Claims
reports, 4–10 days apart with at least 80% component coverage each, and a latest
Moderate/Strong report, can receive priority over an opposing NFP at least 14
days old that is Weak or incomplete. NFP 30→20%, Claims 10→20%; the shared labor
budget stays 40. Older weekly reports add no independent votes. This rule works
in both directions and does not stack with the earlier labor–inflation transfer.
Fresh or complete Moderate/Strong NFP blocks it. Conditions remain visible.

The gear/publication tables now expose age, half-life, retained percentage,
coverage, assigned and effective weight, weekly confirmation and final votes.
Enabled/active budgets and retained weight are distinct. Worker-precomputed daily
updates explicitly identify memory aging; mouse movement remains a binary lookup.
CPI v4's vote-change decomposition includes retention reset and coverage changes.

**Stored replay:** all 1,471 publications retain source-score parity. V6 changes
66 combined directions (55 before 2025, 11 in 2025–2026). Weekly priority
qualifies at 75 publications; the existing labor–inflation rule at 29. Default
half-lives ±25% change 15/11 directions versus default; no FX returns selected
the parameters. Eight publication and eligible daily replays pass future removal.
The complete frontend tests, lint, TypeScript/Vite build and compiled-worker
parity pass. The 5,682-point timeline calculated/transferred in about 20 seconds
with the main event loop active; this is not a chart-pan latency benchmark.

**User cases under defaults:** June 17, 23:59 broker time now Short / Weak
(+0.024009); June 18, 03:00 is Short / Weak (+0.031357). December 31 and January 8
become Short / Weak before the January 9 NFP update. August 12 and September 11,
2025 and August 12, 2026 remain Long. December 23 remains Long and the January 28
rally retains Short context: both remain open findings, not forced date-specific
exceptions. Manual saved settings/source exclusions are outside this replay.

The June 17 [official Fed statement](https://www.federalreserve.gov/monetarypolicy/files/monetary20260617a1.pdf)
is relevant missing content; v6 does not import/classify it or assert it caused
the fall. Timestamped policy content and EUR remain deferred. Earlier v5 and
prior-version descriptions above are historical policies.

[V6 design, results, limitations and reproduction](reports/USD-context-memory-v6-audit.md).
