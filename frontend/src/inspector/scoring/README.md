# Inspector scoring

Signed scores and pair directions live here, separately from the descriptive
Higher/Lower reading labels in `../grading` and the histogram/settings/history
machinery in `../magnitude`.

```text
scoring/
  scoring-contracts.ts        View props and explicit pair/family bindings
  scoring-registry.ts         Supported symbols, country, currency and family
  InspectorScoringView.tsx    Scoring-only, scrollable presentation
  shared/
    core/signed-magnitude-score.ts
    ui/SignedMagnitudeMatrix.tsx
  PAIR/EURUSD/USD/
    NFP/
      assessment/nfp-magnitude-score.ts
      ui/NfpMagnitudeScoreTables.tsx
    CPI/
      assessment/cpi-magnitude-score.ts
      assessment/cpi-index-magnitude-score.ts
      ui/CpiMagnitudeScoreTables.tsx
      ui/CpiMagnitudeScoreTable.tsx
      ui/CpiIndexMagnitudeTable.tsx
```

USD is EURUSD's quote currency. Assessment modules own the family's selected
series, signs, coefficients, cancellation priority and completeness requirements.
UI modules compose shared matrices. Moving these files does not change existing
NFP/CPI score versions, magnitude persistence keys, boundaries or dataset admission.

The Inspector view dropdown contains Table only, Scoring system and Scatter Plot,
with Scoring system v2 available for US/USD CPI, NFP and both ISM families on EURUSD, and v3
available for US/USD CPI and both ISM families. The saved v2 mode selects the appropriate family scorer.
US/USD PCE has its derived scorer under Scoring system. The retired ISM v1
selection opens v3; its sector formula remains documented below.
Scatter Plot opens the selected release without changing the saved Inspector view.
Table only is the default Inspector view. Scoring system replaces the readings
table with the registered family's scores; CPI retains separate index/rate
matrices and NFP retains separate supporting/primary matrices. The selected view
is saved and travels in workspace exports. Unsupported families fall back to the
table, with the Scoring system option disabled, without discarding that preference.

To add an agreed scoring policy, create `PAIR/<pair>/<currency>/<family>` with
`assessment` and `ui` modules, then register its explicit symbol matcher, country,
currency and Inspector family ID in `scoring-registry.ts`. Keep the symbol matcher
specific to that pair even when Inspector's broader pair support expands. Register
its magnitude family separately if needed; a magnitude catalog alone never invents
a directional score. Document the policy and add regression cases for missing,
duplicate and undefined readings, native units, signs and cancellation.

Existing regression coverage lives in `frontend/tests/inspector/nfp`,
`frontend/tests/inspector/cpi`, `frontend/tests/inspector/pce` and
`frontend/tests/inspector/ism-services`; navigation and workspace tests cover view selection,
refresh persistence and unsupported families. Shared code should stay free of
family-specific event IDs and pair direction rules.

## USD CPI v2 prototype

`PAIR/EURUSD/USD/CPI/assessment/cpi-score-v2.ts` is an independent scorer. The
original CPI signed A−P scorer, index display and manual magnitude settings stay
unchanged. V2 is selectable, persists across refresh/workspace transfer, and falls
back to Table only on other families without dropping the saved preference.
`ui/CpiScoreV2.tsx` displays one pair bias and a short explanation, followed by
components and calibration details in a flat, vertically scrolling layout. It queries only the required USD CPI series
when mounted, independently of whether v1 magnitudes were configured.

Positive scores indicate USD pressure / EURUSD Short; negative scores indicate
EURUSD Long. For reference month t, the four signals (in percentage points) are:

| Signal | Formula | Weight |
| --- | --- | --- |
| Core pressure | Mean actual Core m/m for t, t−1, t−2 minus 0.20% | 35% |
| Core trend | Mean actual Core m/m for t, t−1, t−2 minus mean for t−1, t−2, t−3 | 35% |
| Annual confirmation | Actual Core y/y minus supplied Previous | 20% |
| Headline context | Actual Headline m/m at t minus mean actual Headline m/m for t−1, t−2, t−3 | 10% |

The 0.20% monthly reference and weights are experimental policy choices, not
empirically validated estimates. The monthly reference is not the Fed's 2% PCE
target. The core windows overlap; pressure and trend are related signals, not
independent statistical votes. No forecast, revised-previous field, price outcome,
headline annual rate or index-level row votes in v2. Actual historical readings
are used for rolling windows, rather than chaining supplied Previous values.

Each signal gets a signed 0–4 magnitude from its **own derived history**. At least
24 earlier usable observations are required per component. Nonzero absolute
historical signals are sorted; nearest-rank percentiles 1/3, 2/3 and 0.90 define
Small/Medium/Large upper boundaries, with Extreme above the last. Zero contributes
zero. Percentile ties are retained (some buckets may be empty). These thresholds
are independent of v1's manual A−P boundaries and recalculated using only earlier
publications since January 2015. Floating signal arithmetic is rounded to 12
decimal places to suppress subtraction noise; weighted sums use integer percent
units before division by 100, preserving exact cancellation.

The total is the sum of signed magnitude × weight / 100. Exact cancellation uses
the first nonzero signal in table order: pressure, trend, annual, headline. There
is no Mixed output. Missing/ambiguous data, insufficient history and all-zero
evidence remain Uncomputed rather than fabricating a direction or importing a
prior NFP bias. Calendar coverage gaps are disclosed even if enough valid samples
remain for scoring.

The selected release needs a verified publication time and exactly one observed,
finite US percentage reading for each required series (005, 006, 008), sharing a
reference month before publication. Rolling windows require consecutive months.
For an earlier reference month, use its latest publication **strictly before** the
release being assessed; duplicates at that timestamp invalidate that month. The
selected and later publications never enter calibration. Inventory copies are
deduplicated by value identity. Unavailable/retired rows and uncertain publication
times are excluded. Storage can retain provider revisions in older rows; date
filtering cannot reconstruct original vintages that have been overwritten. V2 is
therefore a historical-reading prototype, not a guaranteed point-in-time backtest.

`tests/inspector/cpi/test_cpi_score_v2.mjs` reconstructs the discussed August case
with synthetic earlier calibration data: the original scorer is +3 / Short and
v2 is Long. It also verifies strong/persistently high inflation can remain Short,
publication cutoffs, missing months, source/unit/duplicate gates, no forecast
dependence, presentation defaults, scoped fetching, navigation and persistence.
This regression establishes implementation behavior; price-prediction accuracy
still needs evaluation across unseen releases and a defined holding period.

## USD CPI v3 release-change prototype

`assessment/cpi-score-v3.ts` and `ui/CpiScoreV3.tsx` add an independent selectable
policy. V1, v2 and manual magnitude settings remain available. Selection persists
through refresh and workspace transfer. Presentation is flat, vertically scrolling
and wraps within the resized dock. History loading is scoped to the same three
USD CPI series, independent of configured v1 magnitudes.

V3 replaces v2's static 0.20% reference vote with **latest core pace**: actual
Core m/m at t minus the average actual Core m/m at t−1, t−2, t−3. The supporting
core trend, annual confirmation, headline context and weights 35/35/20/10 are
retained to isolate this policy change. Thus a high but cooling reading can vote
Long, and an unchanged high level does not by itself create fresh Short evidence.
The monthly core features are related, overlapping signals; weights are policy
choices, not fitted coefficients or estimates of independent information.

Each component separately validates its current row, consecutive reference months
where needed, and at least 24 earlier usable samples. Calibration uses the same
nearest-rank 1/3, 2/3, .90 quantiles on nonzero absolute signals, but fresh core
has its own derived history. Current usable rows must share a reference month
before publication. Uncertain publication times invalidate the whole assessment.
Duplicate/invalid current rows disable their own components. Earlier-month values
use the latest unique earlier publication; missing months are never skipped.
No forecast, revised-previous field, price, NFP, policy decision or index votes.

Missing components have null contributions, not zero votes. Available weights
are **not redistributed**; total sums only usable signed magnitude × weight/100
in integer percentage units. At least one calibrated core component is required;
headline alone cannot establish a result. This allows an annual-only release to
give a disclosed reduced-data bias, including the December 2025 monthly gap,
without treating a two-month change as monthly inflation. Exact cancellation
uses the first nonzero usable component: latest core pace, trend, annual, headline.
There is no Mixed/Neutral label. No usable core component or all-zero usable
signals remain Uncomputed; equal weights are not assumed in either case.

Evidence strength describes agreement **within these policy components**, not a
price probability. Let agreement = absolute weighted net / sum of absolute
weighted contributions. A directional result is weak if data are reduced, it
uses a tie-break, or agreement < 1/3; strong if at least two evidence groups support
the winning direction and agreement ≥ 2/3; otherwise moderate. Fresh core and core
trend share one group, with annual core and headline as the other groups. Each
group's signed weighted net determines whether it supports the winner. These are
conceptual confirmations, not statistically independent observations. An absent
supporting component stays visible with the reason it could not vote.

The evidence refinement is policy `cpi-eurusd-release-change-v3.1`; the menu remains
Scoring system v3. Directional formulas, weights and tie priority are unchanged.
It adds a reason distinguishing limited data, conflict and a single evidence group,
and a separate change-size label. Change size uses the weighted average absolute
magnitude points across usable components (including usable zeros): >0 to 1 is
Modest, >1 to 2 Noticeable, >2 to 3 Large, >3 Extreme. This describes historical
signal size, not price impact. Strong agreement can accompany a modest change.

Tests: `tests/inspector/cpi/test_cpi_score_v3.mjs` covers fresh deceleration,
rebound, heating, partial-data behavior, future/forecast independence, publication
cutoffs, continuity, duplicate/unit/source gates, exact cancellation, strength,
flat presentation, navigation, scoped fetching and saved-view portability.

Reproduce a chronological comparison with an exported calendar snapshot:

```sh
node scripts/audit-cpi-v3.mjs <calendar.json> <output-prefix> [price-audit.json]
```

The script reports v2/v3/fresh-core-only coverage across stored history, and
optional fixed +15/+60/+240-minute price direction agreement against an always
Long baseline. It does not tune parameters. The primary price diagnostic is
release→+60 minutes, not a containing H1 candle that includes pre-release time.
The manually discussed 16 releases are development examples, not an untouched
validation set. Historical vintage and broker-clock caveats still apply. V3
interprets inflation changes; it does not establish price-prediction accuracy.

## USD NFP v2 labor-context prototype

`PAIR/EURUSD/USD/NFP/assessment/nfp-score-v2.ts` and `ui/NfpScoreV2.tsx` provide
Scoring system v2 for US/USD jobs releases on EURUSD. The original NFP scorer
remains Scoring system. V2 independently fetches the ten NFP series from stored
history and presents a flat bias/evidence/change-size summary, five voting
components and six non-voting context readings. It uses no forecast or other
release family, and does not require original manual magnitude boundaries.

| Signal | USD-positive interpretation / formula | Weight |
| --- | --- | --- |
| Hiring pace | Actual payroll job change minus max(0, mean actuals of preceding three reference months), in thousands | 40% |
| Unemployment | Negative of Actual minus supplied Previous, in pp | 30% |
| Wage pace | Actual Earnings m/m minus mean actuals of preceding three reference months, in pp | 15% |
| Payroll revision | Supplied Revised Previous minus Previous payrolls, in thousands | 10% |
| Working hours | Actual weekly hours minus supplied Previous, in hours | 5% |

The hiring benchmark's zero floor stops smaller job losses after larger losses
from receiving a positive hiring vote. It is not a population-adjusted break-even
job-creation estimate. Baselines use preceding stored actuals, rather than silently
rewriting them with the current release's revision field. The revision signal
covers only the preceding month exposed by this provider, not BLS's complete
two-month revision. Missing revision data are unavailable, not an assumed zero.

When unemployment and participation both fall, unemployment weight is halved
from 30 to 15. This is a conservative policy qualifier, not proof of the cause of
the unemployment change. Missing participation leaves weight 30 with a visible
caution that caps strength at moderate. Participation itself never adds a vote.
Annual wages and U6 describe change; private/government/manufacturing payrolls
describe jobs added/lost without voting again alongside total payrolls.

NFP reuses the earlier-only native-reading and derived-magnitude helpers in
`shared/core/historical-release-signals.ts`. Payrolls accept units 0 or 4 with
multiplier 1 (thousands); rates use unit 1/multiplier 0; hours use unit 3/multiplier
0. Optional raw scaled integers take precedence and must parse safely. Current
voting rows must share a valid reference month before verified publication.
Supporting rows with a different month are excluded from context. Historical
windows require exactly the preceding three consecutive months, using the latest
unique publication before the assessed release. Retired/uncertain/non-US rows,
duplicates, bad units and later publications cannot fill a window.

At least 24 earlier usable observations calibrate each component's own nonzero
absolute signal percentiles (1/3, 2/3, .90). Signed points 0–4 use the same boundary
rules as CPI v3; tied percentiles are retained. Missing components do not vote,
weights are not redistributed and at least one usable hiring or unemployment
component is required. Integer percentage units preserve exact cancellation.
Tie priority is hiring, unemployment, wages, revision, hours. No Mixed/Neutral
label; absent employment evidence or all-zero usable signals remain Uncomputed.

NFP uses `shared/core/magnitude-evidence.ts` for the same strength/change-size
policy as refined CPI. Hiring, revision and hours share an employment group;
unemployment and wages are separate groups. Missing scoring components and exact
ties force weak evidence; participation cautions prevent strong evidence. These
grades and the weights are explicit judgment choices, not fitted probabilities.
The historical-vintage limitation applies to NFP as it does to CPI.

`tests/inspector/nfp/test_nfp_score_v2.mjs` verifies pace, job-loss rebounds,
intentional revisions, participation adjustment, non-voting composition, partial
data, unit/source/reference gates, publication cutoffs, zero/tie behavior,
evidence, flat UI, navigation, persistence and scoped history fetching.

```sh
node scripts/audit-nfp-v2.mjs <calendar.json> <output-prefix>
```

This chronological audit records all component readings, thresholds, reasons and
recent outputs without tuning or claiming price accuracy. The broader project
inventory and next-family roadmap live in the root `scoring system library.MD`.

## USD PCE v1 inflation-change prototype

`PAIR/EURUSD/USD/PCE/assessment/pce-score.ts` and `ui/PceScore.tsx` implement the
first PCE scorer, selected with **Scoring system**. Only monthly PCE inflation
IDs 840010001/002/003/004 enter; GDP's quarterly core PCE series is excluded.
The view independently fetches its four native percentage series from January
2015, even when original A−P magnitude settings are Undefined.

| Signal | Calculation | Weight |
| --- | --- | --- |
| Latest core pace | Actual core m/m minus preceding three-month mean | 45% |
| Annual core change | Actual core y/y minus annual comparison | 30% |
| Latest headline pace | Actual headline m/m minus preceding three-month mean | 15% |
| Annual headline change | Actual headline y/y minus annual comparison | 10% |

For monthly means, all three consecutive earlier reference months must exist.
When this release supplies Revised Previous, it replaces only the nearest
preceding month's actual in that comparison average. Older two months remain the
latest unique earlier stored actuals; a single revision field cannot reconstruct
an entire revised history. Annual comparisons use supplied Revised Previous when
present, otherwise supplied Previous. A supplied but malformed/nonfinite revision
disables that component instead of silently falling back. Input labels disclose
the selected comparator. Revisions affect the baseline without a separate vote.

This matters when annual inflation appears to fall against the old Previous but
equals the revised prior reading: the fresh annual-change signal is zero. These
rules are specific to this PCE policy; existing CPI and NFP formulas stay intact.
BEA publishes monthly estimates and annual updates that can revise earlier
results. See [BEA's August 2026 release](https://www.bea.gov/news/2026/personal-income-and-outlays-august-2026).

Core receives 75% of the weighted vote. Core/headline monthly features share one
evidence group; both annual features share another, so two overlapping same-horizon
readings cannot create two confirmations. Shared earlier-only magnitude and
evidence helpers retain 24 usable earlier observations, nearest-rank 1/3 / 2/3 /
.90 quantiles, tied boundaries, signed 0–4 points, weak/moderate/strong evidence,
and separate historical change size. These are judgment policies, not fitted
weights, statistical independence or market-prediction probabilities.

At least one usable calibrated core component is required. Missing weights are
not redistributed. Exact cancellation follows core pace, annual core, headline
pace, annual headline. A usable direction is Long/Short; absent directional
evidence is Uncomputed, with the reason. Forecast, prices, CPI and Fed decisions
never enter. Annual headline PCE relative to 2% is non-voting policy context;
high levels alone do not imply a fresh hike or add a directional vote.

The [Fed's 2% objective](https://www.federalreserve.gov/economy-at-a-glance-inflation-pce.htm)
uses annual headline PCE. [Core PCE](https://www.bea.gov/help/faq/518) excludes food
and energy; its prominence in this prototype does not redefine that objective.

`tests/inspector/pce/test_pce_score.mjs` covers formulas, conflicts/ties, evidence
grouping, target context, revisions and malformed fields, insufficient/missing
history, duplicate/reference/native-unit/source gates, chronology and forecast
exclusion. It also covers flat Inspector registration/navigation, scoped requests,
chart/scorer parity, manual preview/apply/reset, scope isolation and live workspace
restore. Stored readings can overwrite vintages; date guards do not fix that.

```sh
node scripts/audit-pce-v1.mjs <calendar.json> <output-prefix>
```

This chronological implementation audit checks chart/scorer parity and reports
coverage/components without tuning parameters or evaluating price outcomes.

## Retired USD ISM Services v1 screen; retained sector policy

`PAIR/EURUSD/USD/ISM/sectors/services/` retains the original feature and sector
assessment policy. The standalone v1 UI and its registry binding are removed.
Existing ISM selections saved as **Scoring system** now open v3. Its four votes are New Orders 35%, Business Activity 25%,
Employment 25%, Prices Paid 15%. Each feature is the actual diffusion index minus
max(50, preceding three-month mean), using supplied Revised Previous for the
nearest month when available. All inputs must be native index values in [0,100]
with unit 0 and multiplier 0; all three preceding reference months are required.

The floor prevents contraction rebounds below 50 being treated as positive demand
or employment. Above-50 cooling is disclosed as continued growth below recent
pace. Prices Paid is surveyed input-price pressure, not a CPI inflation rate;
its positive vote is the prototype's modest policy-pressure interpretation.
The [official ISM method](https://www.ismworld.org/supply-management-news-and-reports/reports/ism-pmi-reports/services/april/)
combines activity, orders, employment and supplier deliveries in the headline.
The composite therefore provides non-voting context, avoiding constituent double
counting. Supplier deliveries is absent and is not reverse-engineered.

Orders/activity share the demand evidence group; labor and prices have separate
groups. The shared evidence and change-size rules apply. At least one calibrated
demand component is required; missing weights are not redistributed. Ties follow
table order with weak evidence. No directional evidence stays Uncomputed.
Calibration remains strictly earlier-only with at least 24 usable features,
including under manual overrides. Weights and the floor are judgment policies,
not official ISM calculations, fitted weights or validated market probabilities.

`tests/inspector/ism-services/test_ism_services_score.mjs` covers contraction
rebounds, expansion cooling, conflicting/tied votes, evidence grouping, composite
exclusion, revisions/domains, chronology and data gates. The combined ISM v2/v3 mounted terminal tests
cover registry/menu/navigation, scoped requests, chart parity, manual
preview/apply/reset, isolation and portable live settings. No browser or visual
automation is used. Reproduce the chronological parity/coverage audit with:

`node scripts/audit-ism-services-v1.mjs <calendar.json> <output-prefix>`

## Monthly ISM v2

`episodes/ism-episodes.ts` assembles one monthly display release and chart symbol
at the first publication, preserving original Manufacturing and Services
publications in `ismPublications`. `useInspector` keeps `allReleases` unmerged for
scoring/history/Scatter and groups only the displayed releases. Pairing requires
one reference month, verified timestamps, unique sectors, Manufacturing first
and at most ten days separation. Invalid/ambiguous candidates stay separate.
Ten-day query padding supplies neighboring companions; display filtering accepts
either enabled member and either member in range. The table retains all source
series and times, each sector's grading and magnitude store, with labeled sector
sections. V2 displays two adjacent publication-time outputs and one component
table with Manufacturing and Services row groups. Each output passes its original
source publication to the unchanged scorer. The Services output combines both
sectors; the Manufacturing output excludes later Services. Future publications
stay pending until the supplied Inspector clock reaches them. No publication
selector is shown. Both sections retain exact-source Scatter buttons; the generic
Scatter shortcut uses the latest elapsed source. Adding Services
preserves the monthly selection ID. On narrow screens the output cards stack.

`PAIR/EURUSD/USD/ISM/assessment/ism-score-v2.ts` combines same-reference-month
Services (70%) and Manufacturing (30%) at the selected publication timestamp.
Manufacturing uses `sectors/manufacturing/ism-manufacturing-score.ts`: orders/employment/prices
50/35/15. Services reuses v1 features and settings. All native indexes compare
with max(50, preceding three-month mean), including supplied Revised Previous
for the nearest month. Magnitudes retain each source's strictly earlier history
and the 24-observation gate. No missing weights are redistributed. A sector
without calibrated demand is excluded as a whole. Headlines provide context;
unavailable Manufacturing production/inventories/deliveries are not inferred.

`shared/core/publication-context.ts` selects only observed publications available
at the cutoff, and the latest matching reference-month publication for each
family. Source IDs, timestamps and chart markers are unchanged. The v2 UI has
two flat sections, publication times, pending/excluded states, one pair bias,
grouped evidence, source Scatter buttons and a comparison with context just
before this publication. Manufacturing and Services share demand/labor/prices
groups; opposing sector totals or demand/employment votes cap evidence at moderate.
Totals and ties use integer weight units (10000 = 100%). The tie priority is
Services table order then Manufacturing table order. All-zero stays Uncomputed.

`ism-publication-check.ts` contains the verified 2026 official calendar and a
weekend-date check. Date mismatch excludes a current member and displays the
source issue; no source timestamp is rewritten. Both source and known official
availability bounds gate history before assessment. Earlier stored readings may
enter subsequent comparisons once both bounds pass. Historical dates/vintages
are not comprehensively verified. The April 3, 2026 Services source differs from
the official April 6 calendar; October 5, 2025 is a weekend publication.

Manufacturing component settings use `ISM-MANUFACTURING-V2-SIGNALS` and are
workspace-portable. Services uses its existing v1 scope in both versions.
Source component charts display raw derivations; they do not certify publication
timing or plot the combined score as an index delta. The UI explicitly flags
excluded context members. Scoring weights are fixed judgment policies, not
fitted estimates. Forecasts, price inputs and other event families are excluded.

`tests/inspector/ism-services/test_ism_score_v2.mjs` checks timeline reconstruction,
future removal, matching months, latest-invalid rejection, timing checks,
conflicts/ties/zero data, grouped strength, revisions/domains and chart parity.
Mounted terminal tests check both-family version selection, flat sections,
scoped requests, source navigation, preview/apply/reset and workspace updates.
Reproduce the chronological implementation audit with:

`node scripts/audit-ism-v2.mjs <calendar.json> <output-prefix>`

## Shared signal magnitude visibility

CPI v3, NFP v2, PCE v1 and both ISM sectors expose their exact component inputs
in Scatter Plot's
**Scoring signal** measure. Exported feature extractors and
`shared/core/historical-release-signals.ts` are shared with the chart; weights,
direction rules and evidence policies are unchanged. Automatic calibration stays
strictly earlier-only, retaining tied percentiles and the 24-observation gate.

`shared/core/signal-magnitude-settings.ts` provides separate immutable settings
stores for these derived components. A saved manual override replaces only that
component's automatic cutoffs; the optional third assessment argument supplies
these settings in pure callers. Inspector UI subscribes independently of the dock.
CLI assessments default to automatic boundaries. Original A−P boundaries and
older scoring versions remain separate. Workspace export/import includes both
signal scopes and refreshes mounted subscribers on restore.

Unsaved chart previews do not update Inspector. Applying an override changes
historical classifications too, and does not reconstruct historical settings or
provider vintages. The sidebar discloses the source; **Use automatic** restores
earlier-history calibration. These are magnitude controls, not new scoring weights
or additional family/context votes. See the [Scatter Plot documentation](../../scatter-plot/README.md).

## ISM v3 and calculation boundaries

`ISM/assessment/ism-score-v3.ts` resolves the latest v2 context's original
component votes once, preserving 70/30 weights, evidence, missing-data rules,
timing exclusions and exact cancellation priority. It exposes separate weighted
sector contributions and a dominance explanation. Do not sum publication scores:
the Services-time context already includes Manufacturing. V3 renders one bias;
v2 also renders that headline with publication-time comparisons below it.

`ISM/sectors/{manufacturing,services}/` separates features from sector assessment.
`ISM/runtime/` owns pure analysis, the module worker and publication-aware hook.
`ISM/ui/components/` owns summary, component table, snapshots and notes.
`shared/runtime/` owns the latest-job client and worker hook; stale results are
ignored, pending work coalesces, errors are visible and unmount terminates workers.
`shared/core/reference-history-index.ts` caches immutable history by series,
reference month and publication time with duplicate ambiguity preserved.

`inspector/storage/` retains identical row arrays across unrelated revisions.
`inspector/readings/` owns the raw table. Clock ticks use stable publication cutoffs;
flattened source inventories are memoized. Closed Inspector and ISM derived views avoid raw magnitude
history. Chart markers depend on candle times; the memoized candlestick chart and
stable overlay callback avoid chart work on unrelated Inspector/status updates.
Scatter's worker derives signal history and uses the same pure feature functions.
Headless or non-worker environments retain a pure fallback for compatibility.

The worker path and its errors/cancellation are covered by mounted terminal tests.
`node scripts/benchmark-ism-runtime.mjs <calendar.json>` checks the built production
ISM and Scatter workers in native background threads against the pure calculations and reports event-loop
progress. The existing chronological audit preserves source/chart parity and
future-data removal. Visual frame rate and pointer feel are left to the user.
