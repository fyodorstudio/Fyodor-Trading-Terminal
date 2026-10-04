# Inspector magnitude histograms

Version: `absolute-ap-histogram-v1`. Initial adapter: US/USD NFP only.

This is descriptive calendar presentation. It does not change NFP grades, the
experimental majority direction, chart symbols or published Criterion results.

## Module boundaries and reuse

| Module | Responsibility |
| --- | --- |
| `magnitude-distribution.ts` | Pure, family-independent bins, quantiles and rank arithmetic in native units. |
| `MagnitudeHistogram.tsx` / `magnitude-histogram.css` | Reusable compact SVG; receives a distribution, formatter, color and provenance text. No fetching or economic rules. |
| `MagnitudeDetails.tsx` | Structured hover/focus detail card, portaled out of table overflow and positioned within the viewport. |
| `nfp-magnitude-history.ts` | NFP identity, January 2015/prior-release boundaries, series/unit matching and sample admission. |
| `useNfpMagnitudeHistory.ts` | Selected-broker history lifecycle, separate from the visible chart's date range. Composes the existing paginated storage hook. |
| `NfpMagnitudeCell.tsx` | NFP table adapter, native unit formatting and loading/error/partial/no-sample presentation. |

Future families can reuse the first two modules with their own history adapter
and documented sample rules. Do not copy NFP IDs or favorable directions into
other families. The shell only composes Inspector; request and transformation
logic remain here and in `useStoredCalendar.ts`.

## History contract

- Start at **January 1, 2015**. Admit established UTC release instants on/after
  that date and **strictly before** the selected release. The selected release
  and later releases never enter its baseline.
- Query only the selected broker, USD, and the ten stable NFP event IDs. The
  storage API's optional `event_ids` filter applies before pagination. This is
  an additive read-only API change; it requires a storage restart after updating,
  with no schema migration, bridge or publisher changes.
- Query native chart-clock dates using established historical broker timing.
  Independently enforce UTC release identity before calculating distributions.
- One distribution per stable series. Use **absolute Actual minus supplied
  Previous** (`|A−P|`), including zeros. Preserve k, pp or h; never pool units or
  compare raw distances between different rows.
- Ignore unobserved/withdrawn rows, uncertain/unknown release times, and other
  currencies/countries. Deduplicate value IDs through normal release grouping.
  Exclude a series/publication with multiple rows/reference periods/revisions,
  missing/nonfinite delta, or units/multiplier incompatible with the current
  reading. These exclusions are described in the plot details.
- A row can have a valid baseline even when its selected Actual/Previous is
  missing: show the gray history without a selected bin or percentile rank.
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

The horizontal axis runs from small to large magnitude. Sixteen equal-width
bins cover 0 through historical P95. Gray bar height counts observations within
each bin. The final regular bin includes its right edge; other bins are
left-inclusive/right-exclusive. A separate **Tail** bin contains all magnitudes
strictly beyond the displayed endpoint. Outliers remain in quantiles and ranks.
The bin containing the selected magnitude is colored: Good green, Bad red,
Unchanged gray, following the existing reading rule. Its bar height still counts
earlier readings; the selected release is not added. If the selected interval is
empty, a dashed outline identifies its location without inventing a historical
count. There is no dot or exact-position line. This is separate from the EURUSD
Short/Long badge color.

Small P50/P75/P90 ticks show historical reference magnitudes; their labels and
exact values live in the detail card to avoid repeated crowded text. Quantiles use linear
interpolation at `(N−1) × p` in sorted samples (type 7). The current percentile
is the empirical percentage of historical magnitudes **at or below** the
selected magnitude; ties are included. It is not a confidence or win rate. The
visible **P67** badge rounds this percentage to the nearest integer, while the
detail card retains one decimal. Beside each plot, **140 earlier** means 140
earlier usable observations of that series, excluding the selected release.

If P95 is zero, use the historical maximum as the endpoint. If every historical
magnitude is zero, use a one-native-unit display axis and explicitly describe
the all-zero history. These fallbacks avoid division by zero; no samples are
invented. A magnitude beyond the endpoint colors the separate Tail bin;
details retain its exact value. Fewer than twelve samples are flagged as a
small sample; no-history rows have no plot or fabricated rank.

The 272-pixel plot-and-rank layout keeps compact rows, clearer gray bars, native
unit axis endpoints and a separated Tail area. Hover/focus details and the keyboard-accessible plot description include exact
magnitude, rank, N, quantiles, axis endpoint, overflow count, observed UTC date
span, exclusions and partial-coverage status. The card also states the highlighted
interval and its earlier-reading count. Escape, blur/pointer leave, scrolling
and resizing dismiss the card; it is removed with its row. The compact SVG stays inside the
scrollable table; it does not create a separate dock or chart.

## Verification

`frontend/tests/test_inspector.mjs` exercises the production statistics/adapter
and mounts the production history hook/cell with controlled deferred responses:
2015 cutoff, current/future exclusion, raw precision, zeros/ties/missing data,
unit mismatches, duplicate publications, partial paging, series-scoped requests,
broker switching, ignored aborts and older-service errors. Mounted UI checks also
cover colored-bin boundaries, Tail selection, empty-bin outlines, rank/count
labels and detail-card focus/hover, Escape and scrolling dismissal. Storage tests cover
filtered HTTP validation, pagination, coverage and unfiltered compatibility.

Manual visual checks: table width/height at your preferred dock size, light/dark
contrast, plot details, percentile ticks and colored Tail/empty-bin readability. These
remain browser audits; no computer-use automation is required.
