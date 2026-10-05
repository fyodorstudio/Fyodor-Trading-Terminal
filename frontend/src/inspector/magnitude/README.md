# Inspector signed A−P histograms

Version: `zero-centered-ap-configurable-v5`. Supported adapters: US/USD NFP and CPI. The existing
`magnitude` module paths remain, but both samples and selected readings now keep
their signs.

This is descriptive calendar presentation. It does not change NFP grades, the
experimental majority direction, chart symbols or published Criterion results.

## Module boundaries and reuse

| Module | Responsibility |
| --- | --- |
| `magnitude-distribution.ts` | Pure seven-band counts using custom native-unit boundaries, or explicit per-series absolute P95. |
| `nfp-magnitude-settings.ts` / `cpi-magnitude-settings.ts` | Thin scoped bindings for saved per-series modes/boundaries and shared reactive snapshots. |
| `settings/magnitude-settings-store.ts` | Reusable scoped store factory: pair/currency/side/family keys, admitted series, immutable snapshots, persistence and subscriptions. |
| `MagnitudeHistogram.tsx` / `magnitude-histogram.css` | Reusable compact SVG; receives a distribution, formatter, color and provenance text. No fetching or economic rules. |
| `MagnitudeDetails.tsx` | Structured hover/focus detail card, portaled out of table overflow and positioned within the viewport. |
| `magnitude-families.ts` | Canonical registered family definitions, history scope, series catalog, grading version and settings binding. |
| `family-magnitude-history.ts` | Shared prior-release cutoff, series/unit matching and sample admission. NFP history exports remain thin compatibility wrappers. |
| `useFamilyMagnitudeHistory.ts` | Selected-broker history lifecycle; skips fetching if all selected readings are Undefined. Composes the existing paginated storage hook. |
| `FamilyMagnitudeCell.tsx` | Native formatting and loading/error/partial/no-sample presentation; truly empty cells in Undefined mode. |
| `family-magnitude-tally.ts` / `FamilyMagnitudeTally.tsx` | Descriptive Good/Bad size counts and separate undefined/unclassified notes. The NFP wrapper supplies its existing direction badge; future families retain the descriptive fallback. |
| `grading/cpi-magnitude-score.ts` / `CpiMagnitudeScoreTable.tsx` | Pure four-reading CPI score and its matrix: signed magnitude points, monthly/annual subtotals, total, explicit cancellation priority and EURUSD direction. |
| `grading/signed-magnitude-score.ts` / `SignedMagnitudeMatrix.tsx` | Shared signed-point validation/classification and accessible matrix cells for rates and indexes. |
| `grading/cpi-index-magnitude-score.ts` / `CpiIndexMagnitudeTable.tsx` | Four native-point CPI indexes and separate adjusted/unadjusted subtotals, excluded from the rate direction. |

Future families register their catalog, grading, settings and documented
sample rules, reusing shared engines. Do not copy NFP IDs or favorable directions into
other families. The shell only composes Inspector; request and transformation
logic remain here and in `useStoredCalendar.ts`.

The isolated `scatter-plot/PAIR/EURUSD/USD/NFP` and `CPI` adapters consume the
shared family history engine and canonical classifier. The plot
and Inspector therefore admit the same samples and use one threshold/classifier.
Scatter Plot edits three independent native-unit boundaries and exposes
individual source points. Unconfigured series default to Undefined; P95 is opt-in.
its point selection and full-history inventory are independent of Inspector's
visible range and selected publication.

## History contract

- Start at **January 1, 2015**. Admit established UTC release instants on/after
  that date and **strictly before** the selected release. The selected release
  and later releases never enter its baseline.
- Query only the selected broker, family currency, and that family's ten stable event IDs. The
  storage API's optional `event_ids` filter applies before pagination. This is
  an additive read-only API change; it requires a storage restart after updating,
  with no schema migration, bridge or publisher changes.
- Query native chart-clock dates using established historical broker timing.
  Independently enforce UTC release identity before calculating distributions.
- One distribution per stable series. Use **signed Actual minus supplied
  Previous** (`A−P`), including negatives and zeros. Preserve k, pp, h or pts; never pool units or
  compare raw distances between different rows.
- Ignore unobserved/withdrawn rows, uncertain/unknown release times, and other
  currencies/countries. Deduplicate value IDs through normal release grouping.
  Exclude a series/publication with multiple rows/reference periods/revisions,
  missing/nonfinite delta, or units/multiplier incompatible with the current
  reading. These exclusions are described in the accessible plot description.
- A row can have a valid baseline even when its selected Actual/Previous is
  missing: show the gray history without a selected band or extreme marker.
- All pages must share one data revision; publish only the completed snapshot.
  Cancel and hide obsolete broker/range requests. Poll every ten seconds,
  retaining the existing unchanged-revision optimization. Switching release
  dates starts a fresh bounded query; no persistent browser history cache is
  introduced. Storage remains the persistent source of truth.
- USD coverage gaps show **Partial history**. Loading, incompatible/older
  storage service, outages and no earlier usable readings have explicit states.
  Visible chart dates do not limit the historical sample.
- Stored values can incorporate subsequent corrections. Date exclusion does
  **not** establish historical point-in-time vintages or certify a backtest.

## Plot arithmetic and appearance

Version 5 uses seven equal visual slots: three negative bands, an exact-zero
band in the center, and three positive bands. The slots describe signed
change-size categories; the zero slot has no numeric width. Each stable series
uses its saved Small, Medium and Large boundaries `S < M < L`, with `S > 0`.
Both signs mirror these same native-unit boundaries. Extreme means `|A−P| > L`.
They are configured in Scatter Plot's Magnitude form, stored independently per
series on this device, and consumed reactively by Inspector's history, labels
and summary. Applying them recounts the admitted history and reclassifies CPI
score points; it does not change Actual/Previous values, Good/Bad grades or
NFP's majority direction. Boundaries stay
fixed across dates and broker changes. Invalid settings/drafts never enter the
classifier. Setting a series to Undefined removes only its configuration and
leaves its Inspector histogram cell empty. Undefined produces no distribution
or size; raw Scatter Plot points and Good/Bad grades remain. All-Undefined
Inspector selections make no magnitude-history request. Existing saved tuples
remain Custom with the same storage key. Explicit P95 saves a `"p95"` marker.

A series explicitly configured to P95 computes T = historical P95 of |A−P|, in native units, using
all its usable earlier readings, including zeros and extremes. P95 uses
type-7 interpolation at (N−1) × .95. There is no pooled NFP threshold and the
selected/current or future releases never enter the threshold sample.

In that automatic mode, S = T/3, M = 2T/3 and L = T. From left to right:

| Slot | Admitted A−P |
| --- | --- |
| 0 | −L ≤ A−P < −M |
| 1 | −M ≤ A−P < −S |
| 2 | −S ≤ A−P < 0 |
| 3 | A−P = 0 |
| 4 | 0 < A−P ≤ S |
| 5 | S < A−P ≤ M |
| 6 | M < A−P ≤ L |

A change is extreme only when |A−P| > L; equality stays in an outer band.
P95's interpolation position uses the integer ratio 19/20. Boundary comparisons
admit up to four relative floating-point epsilons so exact decimal equality at
S, M or L stays in its inclusive category. Distinct micro-unit source changes
remain distinct, exact zero remains exact, and T=0 admits no nonzero reading.
Historical extreme readings are omitted from the bars, without stretching the
axis or adding Tail bins. Below/above extreme counts remain in the statistics:
sum(bins) + extremeBelow + extremeAbove = count. Tooltip percentages use the
full count, including hidden extremes. If the selected reading is extreme, a
colored outward marker appears at its edge and the summary reads "Extreme";
no historical bar is falsely selected. True signed historical min/max include
all usable samples, including extremes, and are retained for the tooltip.

Bar height is the actual earlier-reading count, scaled to the most populated
displayed band. The selected reading is never added to the baseline. Its band
retains existing Good/Bad/Unchanged color independently of sign. An empty
selected band uses an outline without inventing frequency. The axis labels
show −L, exact zero centered underneath its slot, and +L. There is no tall zero
guide. The selected reading's size appears beside the plot: Small for the
inner ranges, Medium for the middle ranges, Large for the outer ranges, and
Extreme beyond L. Exact zero reads Unchanged; missing A−P reads Unavailable.
Both signs use the same size labels, calculated at full precision. The label
stays tied to the selected reading while inspecting another band. The earlier-
reading count lives only in the tooltip.

The NFP release summary is a compact table: its existing direction badge
sits in the top-left header, followed by Small, Medium, Large and Extreme columns, with
Good and Bad rows. Zero counts display as an en dash, with an accessible zero
label. The former majority-rule caption, Compared with Previous label, A−P
magnitude label and visible totals strip are removed. Aggregate counts, including
Unchanged and Missing, remain in the screen-reader caption; these readings do
not enter nonzero size categories.
A Good/Bad reading with Undefined magnitude is explicitly marked undefined;
a configured reading with no usable baseline is explicitly unclassified in an
exceptional footer. Loading
or failed history hides size counts with the same status as the cells, and partial
coverage remains visible. Counts refresh on release/broker changes and incoming
Actual/Previous changes. This is a descriptive breakdown; it does not introduce
weights or change the existing majority direction rule.

CPI uses a separate four-row matrix: Headline m/m, Core m/m, Headline y/y and
Core y/y. Columns are Unchanged (0), Small (1), Medium (2), Large (3), Extreme (4).
Each active cell displays signed USD points, with green positive/red negative/
gray zero colors. All series have weight 1. Monthly, Annual and Total appear in
the footer; positive Total means EURUSD Short and negative means EURUSD Long.
Cancellation follows Core m/m, Headline m/m, Core y/y, Headline y/y, selecting
the first nonzero contribution. All zero is Uncomputed. Undefined, missing,
duplicate or unavailable scores cannot contribute to a Total/direction. Index
and unadjusted monthly readings remain outside the rate score. A separate
Price indexes matrix sits to its left, using four adjusted/unadjusted headline/
core index levels and their own native-point settings. Its adjusted and n.s.a.
subtotals describe price-level movement; it supplies no FX direction. Selected
release metadata lives in the toolbar, leaving the summary row for matrices.
Both matrices share cell rendering and score validation. See the canonical
[CPI rule](../Event%20Grading%20Terminology/USD/Inflation/CPI.md).

In automatic P95 mode, all-zero or strongly zero-inflated history can have T = 0. The center still
counts exact zeros; all nonzero readings are extreme. Side slots remain empty
and report "Empty (threshold 0)" on inspection, without display padding or a
fabricated threshold. Nonzero constant history has T = abs(constant) and
occupies the appropriate outer slot. Fewer than twelve samples retain the
small-sample label; no usable history has no plot unless custom boundaries exist.
Custom mode can classify the current reading with zero earlier samples, empty
bars and unknown historical min/max; frequencies avoid undefined percentages.

Every slot has a full-height pointer target, including empty bands. Hover to
inspect its range/count, or focus and use Left/Right arrows; Home/End inspect
the first/last slot. The selected release's color stays fixed during inspection.
The portaled tooltip contains selected A−P and size, inspected band size/range,
count/share, earlier-reading count, and true historical min/max. The count
includes a short hidden-extreme count and small-sample label when applicable.
The threshold is used internally and in the accessible description, without
a visible threshold row. There are no percentile/rank tables or explanatory paragraphs.
Coverage/exclusions, observed UTC dates and provenance remain in the accessible
plot description; partial coverage is also visible in the table cell.

The 216 × 40 SVG stays inside the scrollable table with the existing minimum
cell width. Escape, blur/pointer leave, scrolling and resizing dismiss the
detail card; it is removed with its row.

Histogram axis labels and tooltip values use at most two decimal places by
default, without trailing zeros. This affects display only: thresholds, band
boundaries, counts and extreme classification retain their full precision.

## Verification

`frontend/tests/test_inspector.mjs` exercises the production statistics/adapter
and mounts the production history hook/cell with controlled deferred responses:
2015 cutoff, current/future exclusion, raw precision, zeros/ties/missing data,
unit mismatches, duplicate publications, partial paging, series-scoped requests,
broker switching, ignored aborts and older-service errors. Mounted UI checks also
cover all seven signed boundaries, exact-zero placement, absolute-P95
interpolation, independent NFP series thresholds, hidden-extreme accounting,
frequency-scaled heights, extreme labels, constant/zero-heavy history, empty
bands, mirrored size labels, historical min/max including hidden extremes,
stable selected size during hover, concise hover/keyboard details, Escape and scrolling dismissal. Storage tests cover
filtered HTTP validation, pagination, coverage and unfiltered compatibility.

Decimal equality and adjacent micro-unit tests cover both signs at all three
cutoffs. Magnitude tally tests cover every size in each grade, inverse grading,
zero/missing/unclassified readings, live updates, partial/unavailable history,
family isolation and the October 2, 2026 inventory example. Table markup checks
cover column/row headers, zero dashes and their accessible labels, removal of
the old summary text, and preservation of the direction badge.
Custom-boundary coverage in the scatter tests includes unequal intervals,
both signs/ties, zero earlier samples, invalid storage and drafts, fixed
per-series limits across dates, exact guide parity, tally parity and reopen/reset.
The mounted Inspector history test verifies immediate settings-driven
reclassification with no history refetch and no Scatter Plot mount dependency.
The separate settings tests verify scope isolation for reused series IDs,
immutable snapshot identity, key compatibility, cross-window changes and cleanup,
safe session-only updates when storage is unavailable, and editor draft lifecycle.
Invalid raw integer strings return an unavailable delta rather than throwing.
CPI integration tests additionally verify six rate versus four index units,
all-ten higher/lower/zero/missing grading, exact comparison against supplied
Previous, Undefined cells/defaults, draft/apply/clear behavior, mode persistence,
family cancellation, independent scopes and shared live histogram updates.
`tests/inspector/cpi/test_cpi_score.mjs` verifies signed points, equal weights,
subtotals, cancellation priorities, unavailable data, index exclusions, matrix
accessibility and live settings/reading updates without remounting. It also
verifies index units, independent subtotals, unavailable states and exclusions
from the primary rate score. Mounted Inspector checks verify toolbar metadata
placement and the index-before-rate matrix order.

Manual visual checks: table width/height at your preferred dock size, light/dark
contrast, plot details, centered zero and colored extreme/empty-bin readability. These
remain browser audits; no computer-use automation is required.
