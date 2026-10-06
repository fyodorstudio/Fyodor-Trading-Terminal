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
| USD PCE v1 | Scoring system | Core monthly pace, annual core change, headline monthly pace and annual headline change. Weights 45/30/15/10; revision-aware comparisons, grouped evidence and visible magnitudes. Implemented. |
| USD ISM Services v1 | Scoring system | New orders, business activity, employment and prices paid versus the higher of 50 and preceding three-month average. Weights 35/25/25/15; composite is context only. Implemented; user audit next. |

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
on jobs releases. V3 remains CPI-only; unimplemented families fall back to Table.

These weights, confirmation groups, thresholds and participation adjustment are
explicit prototype policies; they are not fitted estimates or validated market
probabilities. No combination system has been implemented yet.

Terminal validation and manual review status are recorded below.

## Planned development order

The user accepted CPI/NFP signal visibility and its automatic magnitudes.
Expansion has added USD PCE and ISM Services. Build the remaining inflation, labor and
activity inputs before FOMC and before a contextual combination layer.

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
| 3 | ISM Services | Services activity, employment and price-pressure context | Implemented; user audit next |
| 4 | Retail Sales | Consumer-demand context | Next |
| 5 | Jobless Claims | Employment updates between monthly reports | Proposed |
| 6 | GDP | Broad growth, expenditure components and revision context | Proposed; before FOMC |
| After the surrounding inputs | FOMC | Rate action plus changes in statement, projections and press-conference guidance | Proposed; requires source text, not merely a rate number |
| Later | ISM Manufacturing, PPI, Fed Chair speeches | Additional context after the core families are useful | Proposed; order revisable |
| Later | USD context combinations | Combine inflation, employment and policy interpretations | Proposed |
| Later | ECB and euro-area families | Relative EUR versus USD context for EURUSD | Proposed |
| Later | Other currencies | Reuse infrastructure with explicit currency-specific policies | Proposed |

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

### Implemented: USD ISM Services v1

Inspector → US ISM Services → **Scoring system** now displays a single bias,
weak/moderate/strong evidence, separate change size and a plain explanation.
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

## Future combination design

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
- [ISM seasonal adjustment methodology](https://www.ismworld.org/supply-management-news-and-reports/reports/seasonal-adjustment-factors/)
- [FOMC policy materials](https://www.federalreserve.gov/monetarypolicy/fomc.htm)
