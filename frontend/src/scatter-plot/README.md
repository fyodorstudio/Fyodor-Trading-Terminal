# Scatter Plot

Bottom dock for EURUSD / EUR Base or USD Quote, with all 19 numeric filterable
families. Speeches remain nonnumeric. NFP/CPI/PPI default to the latest completed
family episode: exactly one usable Actual/Previous reading per admitted ID.
Other families default to the latest usable selected-series publication, since
siblings can publish on different schedules. X is publication date (UTC),
Y signed Actual minus supplied Previous in the default measure. Forecast is excluded. Existing dots are
connected by straight lines by default. Raw dots and their connecting line remain
visible with Undefined magnitude; later samples never dim.

Magnitude modes are Undefined and Manual boundaries. Enter three increasing
positive native-unit cutoffs (basis points for policy rates) and press Freeze. Unfreeze opens editing while the
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

## Scoring signal visibility (CPI v3, NFP v2, PCE v1, Retail v1 and both ISM families)

These five families also expose **Measure → Scoring signal**, replacing Series
with a Signal selector. CPI shows latest core pace, overlapping core trend,
annual core change and headline context. NFP shows hiring pace, inverse
unemployment change, wage pace, payroll revision and working hours. PCE shows
latest core/headline pace and annual core/headline change. Its monthly comparison
includes supplied Revised Previous for the nearest preceding month; annual
comparison prefers supplied Revised Previous. ISM Services shows new orders,
business activity, employment and prices paid against max(50, prior three-month
mean), incorporating supplied Revised Previous for the nearest month. Its source
and delta units are index points, not percentage inflation. The headline composite
is non-voting Inspector context. Manufacturing v2 exposes orders, employment
and prices paid using the same index comparison policy. Services components
are shared by its v1 scorer and monthly v2 context. Context source-date exclusions
appear in Inspector; a plotted source component does not certify its publication
time. Labels disclose revised inputs. Each uses the
same feature extractor and magnitude calibration as the Inspector scorer.
The sidebar shows source/comparison labels, values, the exact derived signal,
formula, magnitude, calibration N and unavailable reasons. Positive is USD
supportive; negative is USD adverse. A component is not the full release bias.

Automatic boundaries are nearest-rank 1/3, 2/3 and .90 percentiles of earlier
nonzero absolute component values. Zero observations count toward N but not
percentiles; at least 24 usable earlier values are needed to score. Tied
boundaries are retained and can leave a bucket empty. Dots can show valid values
before calibration is sufficient; missing inputs leave gaps, never zero dots.
Selecting a dot updates the bands using only publications preceding that release.
Every tooltip reports its own historical classification, not the selected dot's
classification. Later dots are visible context and cannot change earlier bands.

**Manual override** offers strictly increasing positive cutoffs. Valid edits
preview the chart; **Apply to scorer** saves that component's boundaries and
updates its Inspector scorer immediately. **Use automatic** removes the override.
Overrides apply across historical releases and retain the minimum-history gate;
they are present-day user settings, not historical settings vintages. Other
component/family settings and original A−P magnitudes remain separate. Scope
changes discard unsaved previews. The Measure selection is local to the dock;
saved boundaries survive reopening and travel with workspace export/import.

Signal settings live under independent `CPI-V3-SIGNALS`, `NFP-V2-SIGNALS`,
`PCE-V1-SIGNALS`, `ISM-SERVICES-V1-SIGNALS` and `ISM-MANUFACTURING-V2-SIGNALS`
magnitude scopes. Unsupported families retain the original Series/A−P controls;
contextual combinations are a separate planned layer.

## Navigation and appearance

The initial X viewport includes the selected/latest completed release and up to
12 prior usable readings. A normal monthly series therefore shows 13 points,
including the same release month a year earlier. All admitted observations stay
in the model and remain available through pan/zoom or All history. Calculation N,
manual limits and histogram frequencies use the complete dataset in A−P mode.
Scoring-signal calibration uses only earlier publications regardless of viewport.

Latest release selects the newest eligible episode/selected-series publication and restores this
recent X window, including after manual pan/zoom or All history. It preserves a
manual Y range. Recent releases restores the window around the inspected date.
Point selection and series changes keep the exact inspected release identity.

Inspector's Scatter Plot shortcut passes an explicit broker/family/release target
through the terminal shell. NFP opens Payrolls; CPI and PPI open Headline m/m. Verified
released publications since January 2015 are eligible, including publications
whose selected series is unavailable. Unsupported, future or uncertain targets
are disabled. A requested release absent from stored history has an explicit
unavailable state; Latest release recovers without silently substituting a date.
Changing Base/Quote, family or broker discards the navigation target. Normal dock opening
starts at Latest rather than replaying a previous Inspector shortcut.

The line joins real delta coordinates chronologically behind the dots, with no
smoothing or added observations. A stored publication of the selected series with a missing,
duplicate or incompatible series breaks the line. Off-scale segments use actual
Y coordinates and the plot clip; edge triangles remain separate point indicators.
Appearance includes Connect dots visibility, color and width, shared and persisted
with the existing appearance snapshot. Old preferences default the new line on.

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

- `PAIR/EURUSD/USD/NFP/`, `PAIR/EURUSD/USD/CPI/`, `PAIR/EURUSD/USD/PPI/`: thin family configs/adapters and
  settings bindings. `PAIR/EURUSD/shared/` binds the other numeric families to
  the currency-specific Inspector catalog. Future pairs belong under `PAIR/`.
- `dock/`: shared composition, family binding registry and inventory lifecycle.
- `navigation/`: explicit broker/family/release targets for Inspector shortcuts.
- `contracts/`: plot data contracts; renderers do not fetch inventory.
- `inspection/`: family model and selected reading details.
  `scoring-signal-model.ts` adapts existing scorer features without duplicating formulas.
- `plot/`: recent-date window, straight-line paths, geometry, interaction, crosshair and renderer.
- `settings/`: manual draft/Freeze form, global appearance and color controls.
- `controls/`: supported selector and navigation controls.

Canonical IDs, units and numeric admission belong to Inspector family rules.
See [numeric family catalog](../inspector/grading/catalog/README.md).
Register the shared magnitude family and a ScatterPlotDock binding rather than
copying renderer/calculations. Update workspace portability for new settings
scopes. Inspector never depends on the Scatter dock's mount/request lifecycle.

## Verification

`pnpm --dir frontend test` includes model/admission parity, default completeness,
all-dataset growth/correction/selection invariance, scoped pagination/cancellation,
controls, accessible point selection, geometry, crosshair/axis/pan/reset behavior,
manual freeze/unfreeze and inclusive boundaries, malformed persistence, migration,
per-scope isolation, shared palette/store events, drafts, recent/all X windows,
line gaps/styles/clipping, exact Inspector targets, Latest reset and preserved Y.
The 140-release ten-series fixture reports calculation time as a baseline.
`tests/scatter-plot/test_scoring_signals.mjs` verifies signal/scorer parity,
chronological calibration, tied quantiles, input labels, missing-data gaps,
preview/apply/reset, live Inspector updates, scope isolation and workspace restore.

Visual/manual checks belong to the user: layout/dock sizing, pointer feel,
contrast/hit targets, colors/guide styling and full-range/boundary zoom readability.
No screenshot or browser automation is part of this verification.

## Responsiveness boundaries

`runtime/` derives scoring-signal history in a module worker using the canonical
feature functions. Clock ticks invalidate the calculation only when another
publication becomes eligible. A-P models and signal previews reuse stable inventory
and publication cutoffs; selection and boundary changes retain the same formulas.
Storage keeps identical row arrays across unrelated revision updates. Only the
latest pending worker request runs after the active job, obsolete results are
ignored, and closing/changing the view terminates its worker. Loading/error output
prevents an old broker/release from being shown as the new request. Headless tests
and non-worker environments retain the pure calculation fallback. Production build
emits a separate signal-history worker asset. No screenshot audit is required.

Retail v1 exposes control-group, ex-autos-and-gas and headline pace signals.
Each uses a revision-aware preceding three-month average floored at zero. The
chart and scorer share the same feature extractor and calibration; missing
months/revisions leave explicit gaps. `RETAIL-V1-SIGNALS` stores independent
component overrides; source Actual − Previous boundaries remain separate.


## Jobless Claims v1 signal visibility

The Claims family exposes smoothed initial claims, continuing claims and latest
initial claims in Scoring signal. Each is its preceding four consecutive weekly
readings mean minus Actual. The smoothed component uses reported 4-week averages;
continuing counts convert from millions to thousands. Revised Previous replaces
the nearest benchmark observation. Continuing has its own earlier reference week.
Missing weeks leave gaps, never imputed zeros or Previous substitutes.

A positive signal means fewer claims and USD support, so its sign is inverted
relative to the original A−P measure. The shared Claims feature extractor supplies
both plotted values and standalone scoring; automatic cutoffs use strictly earlier
signals with the 24-observation gate. `CLAIMS-V1-SIGNALS` provides independent,
portable custom boundaries and the existing preview/Apply/reset workflow.
