# Chart and Inspector responsiveness — 7 October 2026

## Repeated work found

- Bridge health polls every two seconds. Small clock-offset corrections reset the
  calendar interval and immediately changed application state, propagating through
  Inspector and chart overlays even when the underlying readings were unchanged.
- Marker panning projected the complete marker history synchronously on every
  range/size notification. Labels were also repeatedly formatted during rendering.
- Live OHLC updates serialized the whole candle timeline into a string, then split
  it back into objects. Price-only changes reached overlays that need only times.
- Publication admission scanned the full calendar inventory on hover and clock
  updates. Raw magnitude history rebuilt on clock ticks without new publications.
- Scoring content and the release list followed unrelated parent updates; an inline
  Scatter callback and an unused raw-history prop defeated component isolation.
- Scoring columns contained nested scroll regions and sticky table headings.
- The empty drawing overlay maintained subscriptions even with no drawings/tool.

## Implementation

`useCalendarNow` keeps its interval stable and samples the latest small correction
at the next ten-second tick. Corrections of at least one second apply immediately.
Disabled consumers do not run a redundant timer. This still uses corrected UTC;
broker wall time remains a separate display/chart conversion.

Marker projection indexes historical anchors, selects the visible range with
binary bounds, and coalesces range/size notifications into one animation frame.
Projected future releases remain eligible in blank chart space. Identical cluster
results retain their state; labels are cached lazily for visible immutable markers.
Frame callbacks and subscriptions are cancelled on unmount.

The shared time-only candle snapshot preserves identity on price-only updates,
while detecting interior timestamp corrections, append and prepend. Raycaster
and roofs receive that snapshot. Immutable calendar inventories have a cached
publication-time index; as-of lookup is binary and keeps the exact publication
gate. Raw histograms rebuild when inventory, selection, settings or the last
admitted publication changes, rather than on every clock sample.

Scoring bodies, contribution/calibration tables, release navigation and roofs have
stable component boundaries. Calendar/view wrappers and callbacks retain identity
when their inputs have not changed. Drawing projection has its own focused
`useDrawingViewport` lifecycle; notifications batch by animation frame. The empty
overlay is not mounted. Saved drawings continue to redraw with chart/price updates,
so price-scale changes are not hidden behind an unsafe memo boundary.

Publication scoring now owns one scroll container. Inner scoring/table containers
allow their content to flow and their headings no longer create many sticky
layers. The two columns, flat sections, visible versions, settings and explanations
remain available. Raw readings and their table controls retain their behavior.

## Removed code

Eight source modules were outside the app's transitive import graph, including
worker entries. They are removed: the old family/NFP magnitude-tally renderer and
helpers, `nfp-magnitude-history`, `useNfpMagnitudeHistory`, `NfpMagnitudeCell`,
`useNfpScatterData`, and the unused CPI Scatter settings re-export. The obsolete
tally CSS is removed too. Tests now call active shared history/cell modules;
assertions for the unmounted tally screen are retired. Histogram, raw-series,
calibration, paging, settings and Scatter parity coverage remains.

The duplicate Inspector clock, unused scorer raw-history prop, full-history string
conversion and Panel's duplicated release-list implementation are removed.
Current scorer engines, numerical weights, source gates, worker calculations,
stored magnitude keys and public scoring versions are unchanged.

## Verification and limits

The terminal regression `frontend/tests/test_responsiveness.mjs` verifies:

- A 100,000-row calendar is indexed once; subsequent forward/backward as-of
  lookups make no additional row reads. A new inventory and exact future gate work.
- Price-only changes reuse a 100,000-candle time snapshot; interior time changes,
  appending and prepending replace it.
- A 100,000-marker history with ten visible anchors projects ten coordinates.
  A burst of 200 range notifications schedules one frame and one projection.
  Future projections and unmount cleanup remain correct.
- Drawing projection also batches 200 notifications into one frame, cancels work
  on unmount and responds to changed price coordinates.
- Twenty unrelated parent renders do not rebuild the scoring body; changed scoring
  inputs still render. Small clock corrections do not restart the timer; large
  corrections and disable/re-enable work.
- Publication CSS retains one outer scroll container, flowing inner views and
  ordinary table headings.

These measure work counts and lifecycle behavior, not frame rate or perceived
smoothness. Visual panning, scrolling, resizing, live-candle/drawing alignment and
both themes remain user checks in `manual edit.md`. No browser automation or
screenshot audit was used. Large enabled event ranges still keep their release
list in the DOM; this pass does not introduce list virtualization or hide details.

All 42 terminal suites were verified in sequential runs after the cleanup. One
remaining assertion for the removed tally screen was replaced with a check of
the active model's nine unconfigured series; the corrected CPI suite and all
remaining suites passed. Lint, TypeScript and production build pass. The source
import graph, including worker entry paths, reaches all 288 remaining TS/TSX
modules, with none outside that graph. Validation is also recorded in the library.

## Follow-up — Activity log during “Checking”

The user still observed panning pauses and tied them to the bridge's Checking
indicator. A focused headless probe using the actual health hook and Activity
components with 200 synthetic entries found 200 new date formatters and roughly
50–60 ms of Activity rendering on each Checking/Running transition.

This follow-up changes only Activity presentation: the unchanged list is memoized,
individual retained rows are memoized, and each timestamp depends on its actual
time/display fields. Filtering/reversal runs when entries or selected sources
change. Appending one entry formats one timestamp; changing timezone updates all
visible timestamps. Health polling, its root state updates, the visible Checking
indicator and numerical scoring behavior are unchanged in this targeted pass.

The new `test_activity_log.mjs` checks real pending/completed health transitions,
zero formatter creation for unchanged rows, append/detail updates, timezone,
source filters, Clear and timer cleanup. Headless Checking samples were about
1.3–1.8 ms; these are diagnostic samples, not a browser frame-rate guarantee.
Publisher activity, terminal navigation, Activity regression and responsiveness
suites pass sequentially; lint and TypeScript/production build pass. The full
43-suite suite list was not rerun for this presentation-only change.

Manual check remains pending: pan with Activity open and a populated log, and
watch whether the Checking transition still pauses the chart. Broader Inspector
or Raycaster lag remains unproven by this scoped result.
