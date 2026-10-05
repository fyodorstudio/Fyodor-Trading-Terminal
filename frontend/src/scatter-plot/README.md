# Scatter Plot

Bottom dock for EURUSD / USD Quote, with NFP and CPI family/series controls.
The default inspected release is the latest completed family episode: exactly one
usable Actual/Previous reading per admitted ID. X is publication date (UTC),
Y signed Actual minus supplied Previous. Forecast is excluded. Raw dots remain
visible with Undefined magnitude; later samples never dim.

Magnitude modes are Undefined and Manual boundaries. Enter three increasing
positive native-unit cutoffs and press Freeze. Unfreeze opens editing while the
saved limits remain active in Inspector. Valid edits immediately preview the
colored bands, guides and size label in Scatter Plot; invalid edits keep its last
valid preview. Freeze saves the preview, and reopening locks saved tuples.
Changing broker/series/release discards unsaved preview. Set Undefined clears
classification/histogram/guides. New releases grow N without moving frozen limits.
Retired P95 preferences become Undefined; existing Custom tuples remain intact.

The model shares Inspector admission/distribution/settings. History includes all
usable released readings since January 2015 through corrected current UTC,
selected broker only. Earlier / All distinguishes chronology from calculation N.
Duplicates, missing/nonfinite/incompatible values, unobserved/withdrawn/uncertain
rows and future schedules are excluded. Corrections replace samples. Stored
values are not point-in-time vintages. Selection preserves the inventory query.

## Navigation and appearance

Crosshair, independent axis wheel/drag/keyboard zoom, anchored pan and reset are
view changes only. Boundary zoom is the default whenever saved or preview limits
exist, and uses those limits without hiding extreme samples;
triangles mark off-scale points. Rounded axis/crosshair labels preserve underlying
coordinates and exact inspection readings. Keyboard dot selection is supported.

Appearance and color boxes share a global Small/Medium/Large palette across all
series/families. Three guide lines/bands mirror the numeric boundaries. Line width,
shade, visibility, style, grid/zero/date lines and point sizes are configurable.
Changing styles does not change numeric limits, requests, drafts or navigation.
Palette migration retains old saved colors. Legacy extra automatic guide fields
are read for appearance migration; they are no longer user-configurable scoring.
Shared immutable snapshots synchronize same-window and cross-window changes.
Persistence uses `fyodor.scatter-plot.appearance.v1` separately from per-scope
magnitude keys. Workspace Settings export/import carries both.

## Isolated folders and extension

- `PAIR/EURUSD/USD/NFP/`, `PAIR/EURUSD/USD/CPI/`: thin family configs/adapters and
  settings bindings. Future pairs/sides/families belong under `PAIR/`.
- `dock/`: shared composition and inventory lifecycle.
- `contracts/`: plot data contracts; renderers do not fetch inventory.
- `inspection/`: family model and selected reading details.
- `plot/`: geometry, interaction, crosshair and renderer.
- `settings/`: manual draft/Freeze form, global appearance and color controls.
- `controls/`: supported selector and navigation controls.

Canonical IDs, units and favorable directions belong to Inspector family rules.
Register the shared magnitude family and a ScatterPlotDock binding rather than
copying renderer/calculations. Update workspace portability for new settings
scopes. Inspector never depends on the Scatter dock's mount/request lifecycle.

## Verification

`pnpm --dir frontend test` includes model/admission parity, default completeness,
all-dataset growth/correction/selection invariance, scoped pagination/cancellation,
controls, accessible point selection, geometry, crosshair/axis/pan/reset behavior,
manual freeze/unfreeze and inclusive boundaries, malformed persistence, migration,
per-scope isolation, shared palette/store events, drafts and unchanged navigation.
The 140-release ten-series fixture reports calculation time as a baseline.

Visual/manual checks belong to the user: layout/dock sizing, pointer feel,
contrast/hit targets, colors/guide styling and full-range/boundary zoom readability.
No screenshot or browser automation is part of this verification.
