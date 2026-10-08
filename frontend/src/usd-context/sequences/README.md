# USD relationship snapshots / roofs v3

Implemented 7 October 2026 alongside `usd-context-memory-v8`. Price never enters
this derivation. Roofs remain USD-only regardless of Candy mode. ISM sectors
resolve standalone ISM; labor relationships use quality-gated accumulated USD
context; fresh-news sequences use changes in interpreted support at common calibration. This distinction is
shown in tool settings, tooltips and Combo details. Participating standalone
readings remain visible; no context output is fed back as another family vote.

## What qualifies

| Roof | Qualification | Direction shown |
| --- | --- | --- |
| Manufacturing + Services | Both included ISM sector publications are known for the same reference month | One existing ISM v3 resolution; own sector biases remain in details |
| Labor + inflation priority | Existing guarded labor-priority policy is active | Accumulated USD context at qualification |
| Claims challenge older NFP | Existing weekly-labor-priority policy is active | Accumulated USD context; preceding two Claims reports are confirmation only |
| Fresh-news sequence · Experimental | Comparable interpreted-support changes agree across at least two domains within seven days | Net change; Weak when directional, Mixed when near-cancelling |

Snapshot identities retain kind, qualification clock and source IDs. New inputs
can produce another dated snapshot; unchanged membership does not emit one every
broker midnight. They are update annotations, not mutually independent statistical
episodes. Policy qualification can occur at an aging boundary as well as a new
publication. Sources never postdate the snapshot.

## Fresh news is a change, not a source label

For a comparable preceding/current family assessment:

`support change = base weight / 100 × (new total − old features regraded under current limits)`.

Both need active calibrated totals, matching usable component IDs/weights and
assessment stage (including GDP new-quarter/revision), equal coverage and at
least 60% usable components. Unknown predecessors, changed coverage and unavailable readings
replace the fresh slot with a zero support-change vote, with a disclosed reason.
Neither age renewal nor calibration drift adds a support-change vote. Base weights exclude conditional
policy transfers. Advanced details separately decompose the actual replacement:

- Change in interpreted support, only when comparable under common limits.
- Calibration effect: old features under current limits minus the old published score.
- Memory renewal at the old published score.
- Availability / non-comparable residual.

Those parts sum to total replacement effect. Changed component membership,
weights or assessment stage makes the comparison unavailable. This does not
certify an original provider vintage. Old snapshots stay intact; only the
comparison regrades their derived features using limits known at the new release.
Missing calibration provenance blocks the comparison. Component weights already
reflect missing data; no additional coverage multiplier is applied. Archived v2
subtracted differently calibrated totals and could mistake drift for fresh news.

Keep only the latest update per family; do not sum several overlapping Claims
reports. Drop it exactly seven elapsed broker-clock days after publication, even
between precomputed stages. Unchanged GDP can accompany a roof as **No directional
update** and contributes zero. Opposing PCE/other inputs remain visible.

Inflation = CPI/PCE/PPI; labor = NFP/Claims; activity = ISM/Retail/GDP. Sum changes
within each domain first. At least two domain nets must agree with the overall
direction before drawing a fresh roof. Two inflation reports, or NFP plus Claims,
cannot alone qualify as two domains. Exact cancellation supplies no directional roof. A net lead below one third
of gross changes is Mixed evidence, with no strength grade. No comparable
changes produce Insufficient context in the fresh-news summary.

The seven-day window, budgets and domain grouping are declared prototype rules,
not fitted optimal parameters or statistically independent evidence. The
experimental result can oppose older accumulated context. It is available in
the gear, and in dashed roof details; the main box retains accumulated context.
The optional EUR/USD relative result remains a separate selected view.

## Ownership and performance

- `core/`: typed snapshots, single-pass derivation and binary fresh lookup.
- `chart/`: containing-candle projection, visible-range lookup, focused/all layout,
  overflow access and animation-frame-coalesced subscriptions.
- `ui/`: result-first Inspector details, optional calculations, manual audit actions,
  gear comparison and display controls.
- `storage/`: validated, portable, cross-window display preferences.
- `audit/`: broker/pair/snapshot-scoped manual observations and portable local storage.

The existing shared background job builds sequence metadata once with the USD
timeline. Source settings/family changes invalidate the versioned job normally.
Opening the gear, clicking a roof, hovering or panning does not rescore history.
The two display controls require no new calculation. Context snapshots share
existing point results; they do not copy the full calendar or price history.

## Auditing

Enable Roofs with the chevrons-up icon in the right-side Fundamental tools group, enable desired context inputs and Inspector markers/date range,
then click a roof. Read its known-by clock, source roles, standalone outputs and
before/after result. Open any source to inspect its actual readings. Record H1
release-candle reaction separately from later 4/24-bar reactions; a delayed rally
is not evidence that the initial release interpretation caused it.

The fixture suites test atomic updates, future removal, domain overlap, seven-day
expiry, unavailable updates, ISM pending sectors, confirmation-only Claims,
containing-bar geometry, cutoff/hidden filters, crowded access, coalesced panning,
source navigation and preference portability. `scripts/usd-context/audit-sequences.mjs`
compares every accumulated point with the committed builder and replays dated
roofs with future rows physically removed. The user performs visual UI checks.

Not implemented: PCE income/spending sub-context, generalized new interaction
weights, automatic price-audit labeling or a historical volatility detector.
These remain research tracks; this layer makes existing relationships reviewable.


## Roof names

Display v8 adds **Concise** in Fundamental tool settings → Roofs → Display density.
It replaces stacks with one `+N Combo` button per visible available-from candle,
counting every enabled relationship at that column. A tick and vertical stem mark
that candle on the time axis; neighboring buttons stagger without changing their
X anchors. Selection opens the existing Roofs details/Candy scope and keeps the
chart concise. Focused and All roofs retain their previous behavior.

The existing popover entries preserve exact clocks, support splits and source
inspection. Concise adds Long/Short lead counts, with separate balanced, unchanged
and insufficient counts. These describe overlapping snapshots, not independent
votes or another combined percentage. Triggering publications are named at their
real available-from clocks (including Services despite its grouped ISM symbol
being at Manufacturing). Aging/expiry updates explicitly state No new release.
Counts cache frozen snapshot readings; pan/hover/chooser actions never rescore news.
Concise is a portable saved density choice; previous preferences keep their mode.

`chart/roof-label.ts` names nonzero comparable economic-change families once, with up to
three compact names and an additional-family count. Opposing effects still
participate in that list; names do not imply agreement. Zero-change companions
stay in the full tooltip and Inspector. Tooltips include full release names,
roles and replacement-effect direction, even for filtered markers. Display v7 uses
uniform 220×60px labels in 64px rows. The centered name span truncates while
Changes in support / Release support and plain Long/Short percentages remain
visible. Aging/expiry and rate annotations occupy a reserved row inside each box.
The whole box is tinted by the support lead; balanced conflict is amber and
unchanged/insufficient support is gray. Full state/evidence stays in the tooltip
and details. Overflow retains full state explanations and exact timestamps.
The snapshot title/type and publication qualification are unchanged.

## Roof workflow / display v2 — 7 October 2026

Display v2 originally used two lanes in **Focused**; current display v6 uses three in both modes with hollow source circles, filled publication circles and outlined memory diamonds. Display priority is evidence strength,
then established relationships ahead of experimental fresh-news sequences, then
most recent activation, with ID as a stable tie-breaker. Bracket spans as well as
label footprints reserve space. Repeated overlapping roofs of the same kind,
direction and family set keep the highest-ranked representative. Opposing roofs
are never deduplicated as the same direction, but can still overflow crowded lanes.
Every omitted eligible roof remains in **+N more**, newest activation first, with
its direction, evidence and selected display time. **All roofs** uses three lanes and
full-span collision avoidance, including symbol/label footprints. Density is a saved display choice in the shared gear's Roofs tab; neither mode
changes relationship qualification or scoring and neither fits to price.

The filled endpoint marks the containing activation candle. The tooltip
and Inspector give the precise selected clock; lines back to earlier publications
identify context, not an earlier available signal. Future activation and any
snapshot with a future source are excluded before display prioritization.

The dedicated **Roofs** bottom dock puts direction and evidence together in its header,
followed by a proportional Long/Short support bar and its main contributors. Collapse
keeps the header and percentages visible; selecting another combo preserves that state.
The scrolling body uses compact newspaper-style columns, a short reason and **What changed?**,
including the actual activating source or a memory update with no new publication.
Recent replacement-effect direction and older accumulated context stay explicitly
separate. Participant links retain release navigation and standalone outputs.
Weights, numerical effects, guard checks and contribution tables are mounted only
when **Advanced calculations** is opened. Net and separation also stay in that section.
Participating releases open Inspector without discarding the selected combo; the Roofs tab
returns to it. The visible Experimental badge and duplicate price audit are removed from
Combo details; the existing price-reaction controls remain in Raycaster. Context remains `usd-context-memory-v6.2`;
relationship derivation remains v1; display v2 is not a new scoring engine.

Raycaster now has explicit Context and Selected combo views. Roof selection only
opens the Roofs dock; Open in Raycaster explicitly opens the selected-combo view.
Hiding Raycaster preserves the roof selection and its Candy. The toolbar Candy
button is the shared switch; Candy settings choose either or both timelines.
Roof Candy projects the selected relationship across all available history,
including before activation. Fed relationships include every action type; each
segment resolves the evidence and action known then. Missing inputs stay gray.
Original labels/details retain their dated percentages.

Roofs settings expose all 36 registered pairs and four specialized categories,
with search, grouped checkboxes, Show all and Hide all. These saved display filters
remove annotations before label/More allocation. They do not alter scores, enabled
inputs, the exhaustive catalogue, or an already selected relationship's Candy.
Legacy `fresh` visibility remains compatible; optional Candy choices default to
both enabled when absent and `hiddenRoofs` defaults to an empty exclusion list.

Manual labels are **Aligned / Opposed / Unclear**, separately for the activation
H1 candle, the next four H1 trading candles and the next 24 H1 trading candles.
The next-24 window contains the next-four window; observations are comparisons,
not independent samples, clock-hour returns or automatic volatility judgments.
Click a selected label again to clear that window. No candle data or manual label
enters the numerical rules. Audits persist under `fyodor.roof-audits.v1` and are
included in workspace exports/imports. Broker, symbol, roof identity and complete
interpretation snapshot distinguish observations; changed settings/results start
unaudited while previous records remain stored. Storage failures retain session
observations with a visible message. Automatic price labeling remains deferred.

## Independent context views / display v3

Header controls independently toggle Roofs, Candy (the accumulated context ribbon)
and Raycaster's hover box. The shared controller remains mounted while any view is
active; hiding the box unsubscribes its crosshair listener. The shared gear's Roofs tab explains
the four relationship types, current USD input exclusions and shape semantics.
Focused keeps the previous ranking and deduplication, now with three lanes.

`raycaster/ribbon` merges USD/EUR update clocks once and projects only visible
intervals, plus the preceding state. Precise clocks interpolate within bars;
weekend gaps collapse on the chart axis. Range/size and hover bursts coalesce with
RAF; pointer movement never scores. Gray is unavailable; future time is clipped.
EUR publication/memory metadata avoids mislabeling an incoming country publication
whose aggregate already controls the vote. All numerical policies are unchanged.

Notebook's workflow record remains separate from manual roof reaction audits.
Pinning preserves written conditions and an optional explicitly captured current
context snapshot. Neither feature places orders or implements exit strategies.

## Pan-stable roof anchoring

`chart/roof-plan.ts` prepares the original source and activation candle indices
across eligible loaded history, including sources outside the viewport. The layout
is cached per candle spacing / density / input history, independently of panning.
Each pan translates that plan, using an indexed span query that includes crossing
brackets even when their activation or label lies beyond a screen edge. Labels keep
their full-source midpoint and are clipped naturally instead of clamped to the edge.
Display v5 restored source/activation dots and stems to the existing bottom
release-symbol row. Dot clicks open the original release, or Combo details for an
activation without a visible publication; the direction box opens the dated combo snapshot. More remains
outside the clipping layer and retains overflow.

Lane collision and repeated-roof checks use sorted interval lookups. Panning does
not scan/repack complete history; range/resize callbacks remain RAF-coalesced. Zoom,
new eligible publications/history, timeframe, marker filters or density changes
can rebuild the plan. This is a display change only, with no combination merging,
numerical model change, future-source admission or inferred signal duration. The
old activation-only viewport layout and screen-edge label clamping are retired.

## Retired release-symbol endpoints / display v4

`chart/roof-symbols.ts` groups nearby publications at fixed candle anchors once per
zoom. The plan translates both symbols and labels on pan without regrouping. Three
42px-separated rows leave room above each line for its direction box. Both density
modes reserve the full span so endpoints on different roofs cannot overlap in the
same lane; crowded roofs remain accessible in More. Inspector's original bottom
row still lists all releases, including those outside displayed combinations.

Endpoint glyphs/colors follow Inspector preferences, including grouped ISM source
aliases, without replacing their individual publication clocks. Counted symbols
open a keyboard-accessible chooser; individual symbols use the existing release
navigation handler. Choosers dismiss on pan/repacking rather than retaining a stale
anchor. Starts identifies publication activation; Update identifies a memory update.
A hidden activation publication uses a text badge, not a fabricated visible glyph.
The direction box and overflow entries remain the paths to Combo details. Numerical
scoring, qualification clocks, context budgets and stored audit snapshots are unchanged.

## Restored brackets / display v5

Display v4's duplicate symbols, Starts/Update badges, and inline hidden-input counts
are retired. The original Inspector marker row is the single release-symbol baseline.
Three roof rows hold direction labels, hollow source dots, a filled activation dot,
and thin vertical stems. Exact hidden-input disclosures remain in tooltips and details.

`clusterRoofEndpoints` combines only publications at the same containing candle,
not different candles that happen to be close at wide zoom. A filled dot routes only
publications whose exact clock equals activation. Earlier inputs sharing its candle
do not become the activating release. Multiple targets open the existing chooser;
memory-only or filtered-publication activation opens Combo details. Those points
have a short stem rather than pretending a new visible release exists below them.

Dot targets are 14px with a small circle, accessible button names and precise clock
tooltips. Label clicks retain the dated relationship explanation. The cached
whole-history plan, three-level collisions, Focused priorities, overflow access,
RAF-coalesced panning and release navigation are preserved. No scoring version,
qualification rule, trade action or audit snapshot changes.

`trading workflow.md` documents all clicks, both density modes, exact availability
inside H1 candles, memory activations, relationship snapshots versus changing Candy,
and Notebook invalidation/review guidance. Terminal tests cover hidden activators,
same-candle earlier sources, release choosers, pan stability and future rejection.
The user performs the final visual audit.

## Endpoint clarity / display v6

Display provenance is attached to existing relationship snapshots without changing
IDs, scores, weights or qualification: publication, aging, or expiry. Removed
seven-day fresh contributors (including individual ISM sector publications) and
expired assessments retain their names/timestamps for explanations. Cause does
not depend on chart marker visibility. A publication simultaneous with removal
keeps its publication classification.

Hollow sources align with `projectMarkers` grouped symbol boxes; activation keeps
its native containing-candle anchor. Alignment is a viewport projection, leaving
the cached global lane plan intact. Labels use their actual CSS height above the
connector and the midpoint of its span. Outlined diamonds route to Combo details;
filled circles retain publication routing, including hidden-release fallback.
Candy uses matching New publication / Aging update / Expiry update terminology.
The public Roofs v6 and relationship engine v4 remain unchanged; display v6 tracks
this presentation pass.
