# Scatter Plot bottom dock

Initial scope: **Pair EURUSD → USD / Quote → NFP → ten series**.
X is the established UTC release date. Y is **signed Actual minus supplied
Previous**, in the series' native k, pp or h units. No Forecast comparison,
weights or trading-direction calculation is introduced by this feature.

## Navigation and ownership

Open **Scatter Plot** from the terminal status bar or bottom-dock tab. Its height
is independently remembered under `fyodor.scatter-plot.dock-height.v1`.
The three scope selectors expose only their current supported option; Series
contains the ten NFP readings in Inspector order, defaulting to headline payrolls.
The scope stays EURUSD even if the price chart is displaying another symbol.

Each opening defaults to the latest completed NFP release: it must be at or
before the established current UTC clock and contain exactly one usable
Actual/Previous reading for each of the ten required series. Upcoming and partial
publications cannot replace that default. While following the default, incoming
completed releases become the inspection target. Clicking a point fixes the
inspected publication; changing Series preserves that publication. **Latest
release** resumes following the latest completed release. Selection is independent
of Inspector and resets on reopen or broker change. The broker source remains
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

The NFP adapter reuses `nfpHistoryReleases` and `nfpMagnitudeSamples` from
Inspector. Observed, established UTC publications from January 2015 are
admitted, with one compatible-unit reading per publication/series. Duplicated
reference periods, unusable A−P and changed units are excluded. Duplicate value
IDs retain the existing grouping behavior. `inspectorDelta` remains the exact
raw-integer source for delta arithmetic.

The inspected reading and all later publications are excluded from its
baseline. Canonical `magnitudeDistribution` version `zero-centered-ap-p95-v4`
calculates P95 of earlier |A−P|, including exact zeros and all extremes, and its
thirds. The scatter does not implement a separate threshold algorithm. It also
uses the canonical classifier for each point's tooltip against the inspected
thresholds. Actual/Previous and A−P values retain their source precision.

The plot retains all usable published points in the chosen series/units. All
points have full opacity; later readings are identified in their tooltip as outside the baseline. Clicking them
changes the inspection target rather than adding them to an earlier baseline.
The inspected point uses its Good/Bad/Unchanged color. By default, six horizontal
guides represent ±T/3, ±2T/3 and ±T; zero has its own line. The inspected date is
a vertical guide. P95's two interpolation-source points have colored outlines.

**Appearance** opens the isolated settings panel. Dot diameters default to 10px
(selected: 14px); both are configurable, including their off-scale triangle and
hit-target sizes. Ordinary, selected Good/Bad and P95-source outline colors are
editable. Grid, zero and inspected-date lines each have visibility, color and
width controls. Magnitude guide lines and band shading can be hidden separately;
line style and opacity are configurable. Up to eight mirrored guide levels can
be added, removed or hidden, each with its own P95 percentage, color, line width
and shading opacity. Enabled levels are sorted by position when drawing bands.

These levels are visual guides. Editing them never changes canonical magnitude
cutoffs or categories in the inspection pane, sample admission, or the manual
viewport. Preferences apply immediately and persist on this device under
`fyodor.scatter-plot.appearance.v1`, independently of the price chart settings.
Invalid stored values fall back safely; Reset appearance restores defaults.

**Full range** shows all extremes. **P95 zoom** changes only the viewport and
places out-of-range readings at dated edge triangles with their true values in
the tooltip. It never changes samples, counts, thresholds or classifications.
All-zero history gets visual axis padding only; the calculated threshold stays
zero. A first publication has no invented baseline. Missing selected readings
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
P95 and the four size ranges. Expand **P95 calculation** to inspect the sorted
absolute samples used for interpolation, their publication dates, zero-based
position and fractional weight. Source corrections can change history; stored
values do not establish point-in-time vintages.

## Folder boundaries

```
scatter-plot/
  index.ts                         Public dock entry point
  contracts/                       Shared point/model contracts
  controls/                        Pair, side, family, series and view controls
  dock/                            Composition and scoped styles
  plot/                            Rendering and pure coordinate geometry
  inspection/                      Calculation details
  settings/                        Appearance controls and saved preferences
  PAIR/EURUSD/USD/NFP/              NFP-specific binding
    nfp-scatter-config.ts           Scope and series catalog
    nfp-scatter-adapter.ts          Completed release selection and model adapter
    useNfpScatterData.ts            Scoped inventory lifecycle
```

Future pairs/currency sides/families supply their own adapters under `PAIR/`
and reuse the shared interface. NFP IDs, unit rules, favorable directions and
completion requirements remain in the NFP binding and canonical NFP modules.
Shared renderers accept data contracts and formatters; they do not fetch data.
Integration outside this feature is limited to shell/dock registration, resize
metadata, and the canonical sampling/classification helper exports.

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

Manual visual checks belong to the user: dock layout and resizing, light/dark
contrast, point hit targets, native hover details, and full-range/P95 zoom
readability. No browser automation or screenshot audit is required.
Also check crosshair labels, axis drag feel, wheel anchoring, plot panning and
double-click resets with the mouse/trackpad you use.
Check the Appearance panel's layout, point sizes/colors and guide styles in your
preferred theme.
