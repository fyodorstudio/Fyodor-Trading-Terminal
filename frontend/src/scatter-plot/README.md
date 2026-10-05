# Scatter Plot bottom dock

Supported scope: **Pair EURUSD → USD / Quote → NFP or US CPI / core CPI → ten series per family**.
X is the established UTC release date. Y is **signed Actual minus supplied
Previous**, in the series' native k, pp, h or index-point units. No Forecast comparison,
weights or trading-direction calculation is introduced by this feature.

## Navigation and ownership

Open **Scatter Plot** from the terminal status bar or bottom-dock tab. Its height
is independently remembered under `fyodor.scatter-plot.dock-height.v1`.
Pair and Base/Quote expose only their current supported option. Family selects
NFP or CPI. Series contains that family's ten readings, defaulting to headline
payrolls for NFP and CPI m/m for CPI.
The scope stays EURUSD even if the price chart is displaying another symbol.

Each opening or family switch defaults to the latest completed release in that family: it must be at or
before the established current UTC clock and contain exactly one usable
Actual/Previous reading for each of the ten required series. Upcoming and partial
publications cannot replace that default. While following the default, incoming
completed releases become the inspection target. Clicking a point fixes the
inspected publication; changing Series preserves that publication. **Latest
release** resumes following the latest completed release. Selection is independent
of Inspector and resets on reopen, family switch or broker change. The broker source remains
the terminal's selected broker, never a pooled inventory.

Only the active Scatter Plot dock mounts its storage hook. Closing or switching
away aborts requests and clears polling. Its full-history query starts January
2015 and is independent of price bars, chart dates and Inspector date filters.
The existing series-filtered, chart-clock storage hook manages paging, immutable
revision snapshots, ten-second polling and obsolete-response cancellation. The
query's two-day date margin handles chart-clock offsets; the adapter independently
enforces the exact UTC publication cutoff. Errors hide the plot; partial coverage
is marked. An offline publisher can still supply persistent stored history.

## Calculations and display

Both adapters reuse `familyHistoryReleases` and `familyMagnitudeSamples` from
Inspector. Family definitions own their stable IDs, country, currency and rules.
Observed, established UTC publications from January 2015 are
admitted, with one compatible-unit reading per publication/series. Duplicated
reference periods, unusable A−P and changed units are excluded. Duplicate value
IDs retain the existing grouping behavior. `inspectorDelta` remains the exact
raw-integer source for delta arithmetic.

The inspected reading and all later publications are excluded from its
baseline. Canonical `magnitudeDistribution` version `zero-centered-ap-configurable-v5`
uses the selected series' saved Small/Medium/Large boundaries in Custom mode.
Unconfigured series default to **Undefined**: raw points remain visible, with
no size, magnitude guides, P95 interpolation or Inspector histogram. **P95**
is an explicit, separately saved opt-in using the earlier absolute-P95/thirds
calculation. The scatter does not
implement a separate threshold algorithm. It also
uses the canonical classifier for each point's tooltip against the inspected
thresholds. Actual/Previous and A−P values retain their source precision.
Axis and crosshair delta labels round to at most two decimal places, with no
trailing zeros. Detailed inspection, guide values and editable boundaries retain
their full precision; display rounding never changes coordinates or scoring.
The model explicitly supplies `deltaUnit` instead of extracting a unit from a
localized number string, and its delta formatter accepts display precision.

The plot retains all usable published points in the chosen series/units. All
points have full opacity; later readings are identified in their tooltip as outside the baseline. Clicking them
changes the inspection target rather than adding them to an earlier baseline.
The inspected point uses its Good/Bad/Unchanged color. In P95 mode, six horizontal
guides represent ±T/3, ±2T/3 and ±T; zero has its own line. The inspected date is
a vertical guide. Custom mode instead draws the six lines at the actual saved
Small, Medium and Large boundaries. P95's two interpolation-source points have
colored outlines only while that series uses P95.

The **Magnitude** form in the inspection pane accepts three independent positive
boundaries in native k, pp, h or index-point units. Select **Custom boundaries**
before editing. Require `0 < Small < Medium < Large`;
invalid drafts do not change the chart or classification. **Apply boundaries**
saves the three values for that series and immediately updates the scatter
guides, Inspector's seven bars, size labels and Good/Bad magnitude tally. Both
signs use the same boundaries; exact equality stays in the lower inclusive
category, exact zero stays in the center and `|A−P| > Large` is Extreme.
The histogram's seven visual slots retain equal widths even when numeric
intervals differ. Historical bar heights recount earlier samples in the new
intervals; no source data is removed or changed.

The Small, Medium and Large rows also have color boxes. Each box immediately
colors that magnitude band's shading and boundary lines on both sides of zero,
using the currently applied magnitude mode. Color edits preserve unfinished
boundary drafts and do not require **Apply boundaries**. These are global
appearance preferences, separate from each series' numeric configuration.
The same colors can be edited in Appearance. In P95 mode, the boxes target
the canonical T/3, 2T/3 and T guides; choosing a color restores a missing
canonical guide without moving or recoloring additional guides.

Custom boundaries stay fixed across inspected publication dates, broker changes
and later releases. Each series saves independently on this device under
`fyodor.scatter-plot.EURUSD.USD.QUOTE.<NFP|CPI>.magnitude.v1`. Inspector consumes the
same shared snapshot even with Scatter Plot closed, and mounted consumers
receive settings updates without refetching inventory. Custom classification
also works with zero earlier samples, while historical min/max remain unknown.
**Set Undefined** clears only the selected series' configuration. A saved tuple
remains Custom; a saved `"p95"` marker explicitly enables P95. An absent or
invalid entry is Undefined. Existing saved NFP tuples retain their original
key and behavior. Switching from Custom to Undefined clears that series' tuple.
P95 values, when explicitly enabled, are suggestions rather than silently saved custom boundaries.
Untouched suggestions refresh with the history baseline; a user's in-progress
draft survives polling. A broker, series or inspected-release change starts a
fresh draft. Invalid raw scaled source values are unavailable and excluded
through shared `inspectorDelta`, rather than throwing during rendering.

**Appearance** opens the isolated settings panel. Dot diameters default to 10px
(selected: 14px); both are configurable, including their off-scale triangle and
hit-target sizes. Ordinary, selected Good/Bad and P95-source outline colors are
editable. Grid, zero and inspected-date lines each have visibility, color and
width controls. Magnitude guide lines and band shading can be hidden separately;
line style and opacity are configurable. In P95 mode, up to eight mirrored guide levels can
be added, removed or hidden, each with its own P95 percentage, color, line width
and shading opacity. Enabled levels are sorted by position when drawing bands.
Color boxes can restore up to three canonical guides in addition to the eight
guides admitted by the Appearance editor. New defaults use cyan, amber and
violet for Small, Medium and Large, with 12%, 16% and 20% shading opacity.
Existing saved colors and opacity are preserved.

In custom mode, the three guide positions are locked to the scoring boundaries;
Appearance edits only their visibility, colors, widths and shades. Extra guide
levels and percentage controls are unavailable in this mode. Styling never
changes scoring, sample admission or the manual viewport. Appearance preferences
apply immediately and persist on this device under
`fyodor.scatter-plot.appearance.v1`, independently of the price chart settings.
Invalid stored values fall back safely; Reset appearance restores defaults.
Automatic and custom guide styles are saved separately, so styling a custom
boundary cannot discard extra guides configured for automatic mode. Older saved
appearance settings initialize custom styles from matching existing levels.

**Full range** shows all extremes. **P95 zoom** (or **Boundary zoom** in custom mode) changes only the viewport and
places out-of-range readings at dated edge triangles with their true values in
the tooltip. It never changes samples, counts, thresholds or classifications.
All-zero history gets visual axis padding only; the calculated threshold stays
zero in P95 mode. A first publication has no invented historical baseline;
saved custom boundaries can still classify it. Missing selected readings
retain known source values and show Unavailable rather than zero. Hover titles
include date, Actual, Previous, signed delta, size and baseline status. Enter or
Space selects a focused point; Left/Right and Home/End move through publications.

The free crosshair follows the pointer inside the plot, with UTC date/time and
signed-delta axis labels. Drag the date axis horizontally or the delta axis
vertically to zoom that axis independently. Scroll over an axis to zoom around
the value under the pointer. Scrolling inside the plot zooms X; Shift-scroll
zooms Y. Drag inside the plot to pan both axes. Axis double-click restores that
axis; plot double-click restores both. Focus either axis and use +/− to zoom or
0/Enter/Home to reset. Browser Ctrl/Command-wheel shortcuts remain available.

Manual axis navigation preserves all data and calculation inputs. Plot clipping
keeps points, threshold bands and guides within the plot; vertically out-of-range
points retain their dated edge markers. P95/full-range presets and scope/series
changes clear manual navigation. Changing the inspected release preserves it;
viewport resizing preserves the visible date/delta ranges. Pointer capture keeps
drags active outside the plot and prevents a pan from selecting a publication.

The inspection pane shows Actual, Previous, Delta, size, earlier-reading count,
the active outer boundary and the four size ranges only when configured. In P95 mode,
expand **P95 calculation** to inspect the sorted
absolute samples used for interpolation, their publication dates, zero-based
position and fractional weight. Source corrections can change history; stored
values do not establish point-in-time vintages.

## Folder boundaries

```
scatter-plot/
  index.ts                         Public dock entry point
  contracts/                       Shared point/model contracts
  controls/                        Pair, side, family, series and view controls
  dock/                            Family registry, shared panel, scoped inventory lifecycle and styles
  plot/                            Rendering and pure coordinate geometry
  inspection/                      Shared family model and calculation details
  settings/                        Appearance controls and saved preferences
  PAIR/EURUSD/USD/NFP/              NFP-specific binding
    nfp-scatter-config.ts           Scope and series catalog
    nfp-scatter-adapter.ts          Thin family binding to the shared model
    useNfpScatterData.ts            Compatibility wrapper around shared inventory hook
    magnitude/nfp-magnitude-settings.ts  Scoped binding to shared Inspector settings
  PAIR/EURUSD/USD/CPI/              CPI-specific binding
    cpi-scatter-config.ts           Scope and ten-series catalog
    cpi-scatter-adapter.ts          Thin family binding to the shared model
    magnitude/cpi-magnitude-settings.ts  Scoped binding to shared Inspector settings
```

Future pairs/currency sides/families supply their own adapters under `PAIR/`
and reuse the shared interface. Stable IDs and favorable directions belong in
the family's canonical grading definition. `inspector/magnitude/magnitude-families.ts`
registers history start, settings and admission scope; `dock/ScatterPlotDock.tsx`
registers supported scatter bindings. The shared model requires exactly one
usable reading for every admitted ID before selecting a latest completed release.
Shared renderers accept data contracts and formatters; they do not fetch data.
Integration outside this feature is limited to shell/dock registration, resize
metadata, and the canonical sampling/classification/settings helpers in Inspector.
Inspector does not depend on Scatter Plot UI or its storage lifecycle.
Reusable `inspector/magnitude/settings/magnitude-settings-store.ts` supplies
validated immutable snapshots, storage subscriptions and per-scope settings.
Each family store is a thin binding that declares its EURUSD/USD/Quote scope and
admitted series. Future bindings supply their own scope and series catalog;
pair, currency, side and family all participate in the key. Existing NFP keys
remain compatible. Appearance remains a separate global style preference.

CPI grading uses the chosen **higher A−P = Good/green for USD pressure** convention;
lower is Bad/red and zero is Unchanged/gray. Six rate readings use pp and four
index levels use pts. Scatter magnitude settings also drive Inspector's primary
four-reading score: equal series weights, signed 0–4 magnitude points, separate
monthly/annual subtotals and a total-based EURUSD direction with explicit
cancellation priority. The same saved configurations drive a separate four-index
matrix in Inspector, with native-point classification and adjusted/unadjusted
subtotals. Index levels and unadjusted monthly rates do not contribute to the
EURUSD rate score. See the canonical
[CPI rule definitions](../inspector/Event%20Grading%20Terminology/USD/Inflation/CPI.md).

## Verification

`pnpm --dir frontend test` includes `tests/scatter-plot/test_scatter_plot.mjs`.
Tests cover Inspector distribution parity, exact prior-history cutoffs, source
admission, duplicate publications, unit incompatibility, zero/missing values,
default completeness, point/series selection, date/delta coordinates, visible
extremes, zoom invariance, keyboard navigation, scoped paging, broker cancellation
and partial/outage states. Existing navigation and resizing tests cover the new
tab, status-bar action and independent saved height.
`tests/scatter-plot/test_scatter_plot_interaction.mjs` also verifies crosshair
coordinate conversion under CSS scaling, axis wheel/drag/keyboard zoom, pointer
anchoring, two-axis panning, click suppression, reset and gesture cancellation,
scope changes, invariant calculations, range limits and wheel-listener cleanup.
Appearance tests cover live dot/triangle sizes, undimmed later releases, custom
guide positions/colors/widths, independent lines/shading, add/remove/hide levels,
saved preferences, malformed storage, reset, focus return and unchanged scoring,
inventory requests and manual viewport.
Boundary tests cover unequal native-unit intervals, both signs and inclusive
ties, empty history, invalid drafts/storage, per-series persistence, exact
guide positions, shared Inspector/tally classifications, immediate Inspector
hook updates, reopening and reset without inventory refetches.
Color-box tests verify mirrored shading and strokes, independent custom/P95
styles, restoring canonical guides, persistence and agreement with Appearance,
while preserving numeric drafts, scores, requests and manual navigation.
`tests/scatter-plot/test_magnitude_settings.mjs` covers independent scope keys
even for reused series IDs, key separator collisions, frozen snapshots,
cross-window validation/reset and listener cleanup, no-op saves, unavailable
storage, untouched suggestion refresh, dirty draft preservation and invalid
programmatic form submission. Plot tests verify rounded axis/crosshair labels
against the production adapter while exact inspection values remain intact.
`tests/scatter-plot/test_cpi.mjs` covers the CPI catalog, rules and units,
complete-release selection, Inspector/scatter parity, Undefined defaults for
both families, actual Inspector delta colors, empty cells, no unnecessary
history query, mode draft/apply/clear, live histogram updates, family switching,
obsolete-request cancellation and separately persisted modes/boundaries.
`tests/inspector/cpi/test_cpi_score.mjs` verifies the signed score matrix and
reactive score updates from the same saved configurations.

Manual visual checks belong to the user: dock layout and resizing, light/dark
contrast, point hit targets, native hover details, and full-range/P95 zoom
readability. No browser automation or screenshot audit is required.
Also check crosshair labels, axis drag feel, wheel anchoring, plot panning and
double-click resets with the mouse/trackpad you use.
Check the Appearance panel's layout, point sizes/colors and guide styles in your
preferred theme.
Check entering three boundaries, Apply, the mirrored lines and Inspector's
updated labels/tally, switching series, and reopening with saved settings.
Check the three color boxes and band contrast in your preferred theme.
