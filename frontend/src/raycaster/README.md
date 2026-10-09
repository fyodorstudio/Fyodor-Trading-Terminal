# Raycaster / USD context memory v8

## USD presentation v1

`core/usd-context-presentation.ts` is a cached read-only projection of canonical
retained **policy** contributions. It partitions pair-oriented Long/Short support
once and resolves aligned, conflicted with a named lead, balanced, unchanged and
insufficient states. It preserves the 60% usable configured coverage gate; a
conflicted lead below one-third net/gross separation is Weak, other conflicts
are capped at Moderate, and incomplete evidence remains Weak. Zero never uses
the raw priority tie-break. Coverage and retention are not applied twice.

Box, Candy and current Notebook captures share this projection.
Publication panels continue to use the canonical agreement gate. Relative mode
continues to use its original labels, grades, colors, updates and gates; no USD
presentation metadata is inserted into its ribbon points. Existing capture
schemas and saved records remain valid. Immutable result identity invalidates
the WeakMap cache naturally when inputs or magnitude settings rebuild history.
Clock validation runs before cache access. Hover performs no scoring.

USD Candy conflicts are amber with a green/red bottom lead edge. Balanced and
unchanged are amber without an edge; unavailable is gray. Relative amber keeps
its original Mixed meaning. Shares are support, not probabilities. Public Roofs
v6 retains its separate relationship v4 / display v8 counters and calculations.

Press **Show Raycaster** (the wave glyph) in the outlined Fundamental tools group
on the header's right, before Bid/Ask. Its active button toggles the box, and × hides it. Raycaster
visibility is independent of the drawing toolbar. The header
handle drags the box, constrained to the chart area. Visibility and position are
saved locally and included in workspace export/import. Non-USD supported pairs
disable the header button; the user's saved visibility is retained when switching
back to a supported major USD pair.

The draggable box has an explicit **Context / Context-detailed / Selected combo** view selector.
Context reads accumulated news at the last inspected chart candle's end; Selected
combo reads the original roof snapshot at its exact activation clock. A roof click
opens the dedicated Roofs dock without opening Raycaster or switching its view.
**Open in Raycaster** in that dock explicitly opens the selected-combo view. The
box's close button hides only Raycaster, leaving the selected roof and Roof Candy
intact. The toolbar Candy button shows or hides both configured strips; choose
Raycaster Candy and/or Roof Candy in Fundamental tool settings → Candy.
**Clear combo** separately clears that selection.

USD readings use equal-width Long/Short percentage cards and a proportional bar,
with direction, evidence and conflict presented separately. Relative mode retains
its existing interpretation and does not acquire USD-only percentage shares.
Context-detailed uses a larger stable frame with one bordered card per input.
Each card groups its direction/status, aligned source score × weight × retention
and vote values, and labeled publication/calculation/memory details. All
calculations stay open. Each input has a dedicated age/influence row (cumulative influence lost, including
expiry) and a new-release row. New releases are identified by source availability
at the context update, never by the timeline's remembered last publication;
aging-only updates show `-`. Generic Latest update / Memory update prose is omitted.
Manual price observations remain under **Record price reaction** in the selected-combo
view. Content changes never move the frame; scrolling stays inside it. These UI
choices do not rescore history or start calculation workers.

The compact frame is 400 × 560 px; Context-detailed is 700 × 740 px. Maximum
dimensions depend only on the chart viewport, never the dragged x/y position.
Chart resizing or an explicit frame-size change clamps the anchor; reading
updates neither restart the placement observer nor save a new position.

**At publication** in Context-detailed preserves the Inspector’s original
publication panels for the selected release: CPI before/after replacement,
Fed economic pressure and previous-meeting comparison, publication-time USD
inputs/relationships/coverage, optional relative EUR/USD context and grouped PMI
publication notes. The Inspector mounts standalone scoring only; publication
context is accessed through Raycaster's **Context-detailed** view. Publication cutoffs remain
independent of hovered candle ends. The publication surface is memoized so chart
hover does not rerender its scorers; it unmounts outside Context-detailed.

Raycaster has saved CPI/NFP/Claims/ISM/Retail/PCE/PPI/GDP context filters, independent of
Inspector marker filters. These controls are shared with CPI v4's publication
context table; all eight inputs default On. The shared header gear's Raycaster tab
uses `fundamental-tools/settings/RaycasterSettings.tsx` for input controls only.
Context-detailed reuses `usd-context/ui/ContextInputTable.tsx` and its
`ContextInputCards.tsx` audit layout to show versions, read-only Enabled/Off status,
each source bias/evidence/date, source score, weighted contribution and combined
total. Input switches remain under Advanced settings. The old box gear, standalone
RaycasterDetails and compatibility table re-export are retired. Base weights are CPI 28%, PCE 10%, PPI 2%, NFP 30%, Claims 10%, ISM 10%,
Retail 7%, GDP 3%. Qualified Labor priority uses CPI 8%, NFP 50%, with other weights
unchanged. The table shows effective/base weights; the rule details explain
every condition using canonical publication-time CPI/NFP facts.
V8 multiplies each vote by cadence retention (7-day Claims, 30-day monthly,
90-day GDP half-life). Missing component weights are already reflected once
in the source total; usable nominal component coverage is a separate qualifier. Age changes at broker
calendar midnights, precomputed in the worker. The table exposes these factors,
source age and final effective weight. Standalone roles and budgets remain intact; the numerical integrity repairs
are separately versioned. This is a declared context policy, not a probability transformation.
Qualified three-report weekly confirmation against an aging Weak/incomplete NFP
can shift NFP 30→20 and Claims 10→20 inside the existing labor budget. It does
not stack with Labor priority or accumulate old weekly votes. See the shared
USD context README for the complete conditions and sensitivity audit.
Enabled, active and retained weight are shown separately. Missing/Off/expired weights are
not redistributed. Claims expires after 14 days; GDP after 120 days; other families after 45.

NFP and Claims share one labor domain: 40% base budget, 60% during Labor priority. Opposing active directions cap evidence
at Moderate, with Weak taking precedence for incomplete/narrow/cancelled votes.
Their agreement adds no independent confirmation. The conditional rule gives
priority to confirmed labor deterioration only when active CPI passes declared
level/acceleration guards. It implies easing pressure, not observed Fed guidance.
Hotter inflation, incomplete/expired or disabled CPI/NFP restores base priorities.
Context-detailed identifies Labor priority when active. Standalone scorer math remains
CPI engine v3.2 (Inspector v4.1), NFP v2.2, Claims v2, ISM v3, Retail v1, PCE v1, PPI v1 and GDP v1. ISM switches both sectors together;
they update one slot. Inspector's view, date range and marker visibility do not
select context inputs. Applied Scatter signal magnitudes still affect both tools.

The shared context preferences are session-safe, portable and receive cross-tab
updates. Existing full four-family and version-2 five-family defaults gain the new inputs; intentional partial or
all-off lists survive. A versioned saved object preserves deliberate Claims-Off
choices. Opening the gear alone does not fetch or rescore; input changes rebuild
the background timeline. Escape/close/outside pointer presses dismiss it;
Escape/close restores gear focus.

The footer labels the reading as **USD side only** and identifies the selected display-clock cutoff.
Source dates, weighted contributions, evidence and unavailable or expired status
remain available in the context snapshots and chronological audit. Partial coverage, timing exclusions or storage outages are
disclosed. A retained snapshot during a storage outage is reconstructed stored
context, with a warning; a new broker never displays the previous broker's results.

`chart/useRaycasterHover.ts` subscribes to the native chart crosshair. Only actual
numeric candle times with series data are inspected. While the box or settings are
open, the last valid chart candle is retained when the cursor leaves the candles,
so the selector and disclosures remain usable. The visible Through clock identifies
that reading. Combo activation never supplies a fallback Context clock. Changing
filters recomputes that candle from new inputs, not stale totals. Hiding the box
with settings closed detaches the listener; reopening requires a fresh hover.
Broker, symbol or timeframe changes clear the held candle; a new chart scope
requires a fresh valid candle hover. Pair changes still reuse the USD timeline. Mouse movement coalesces into one animation frame and
updates local Raycaster state only. Unmount cancels its frame and subscription.
The box itself does not capture pan/zoom gestures; its handle, buttons, selector and disclosures
accept pointer input. Selecting Raycaster exits drawing mode but creates no
persisted chart drawing and does not disable normal navigation.

`chart/candle-cutoff.ts` uses the exclusive end of the hovered candle, labelled
in the box. A release halfway through H1 is included; one exactly at the next
candle's open is excluded. Live candle end is capped to corrected current UTC
plus the broker's current offset. Historical lookup uses recorded per-publication
chart coordinates rather than applying today's broker offset to old releases.
Thus the same exact timestamp always resolves the same context; coarser candles
can include several publications before their end. Use finer timeframes for finer
timing. UTC publication metadata remains separate from broker chart coordinates.

`ui/` contains the small box, styles and drag lifecycle; `storage/` contains local
preferences. Calculation lives in `usd-context/`, off the chart's main thread.

Manual checks belong to the user: open/hide via the header Raycaster toggle independently of paintbrush, open/close the gear popover,
drag and resize the box/dock, pan while active, compare the August snapshots,
inspect H1 versus M15 boundaries, toggle context families independently of Inspector markers, compare CPI v4 at the same timestamp, and check
USDJPY inversion. No browser automation or screenshot audit is used.

The single grouped Inspector ISM control is only a filter UI adapter: original
source family IDs, release clocks and histories remain distinct.

FOMC and Fed Chair text are not stored by the calendar feed. Raycaster does not
infer policy tone from a hold or event title. Their Inspector views show available
rate actions and the same economic context separately.

Claims v2 uses nonoverlapping underlying trends; only joint trend agreement can qualify weekly confirmation. Fed decision v2 displays this same contextual headline and a prior-meeting comparison in Inspector. Fed rates and speeches add no vote or evidence-age reset.

## Clickable roofs and the organized gear

The header gear has Raycaster, Roofs and Candy tabs containing settings only:
USD/EUR input switches, roof density/combination filters and Candy timeline choices.
Accumulated contributions, active conditions, experimental fresh-news changes and
calculation notes belong to Raycaster's Context-detailed view. The optional EUR/USD
mode is shared above the tabs.
The fresh-news and roof results specifically describe the USD side;
they do not substitute for the optional relative main result.

On EURUSD, the **Roofs** chevrons-up icon shows already-qualified ISM-sector,
labor/inflation and weekly-labor relationships above visible event markers.
Dashed roofs identify the seven-day fresh-news experiment. Both display controls
default On and are saved/exported independently of the context-family switches.
Roofs and the context ribbon now have independent header controls; hiding Raycaster's
hover box leaves those views visible. Turning a display control Off does not change
weights, fetch calendar history or rerun scorers.

Click a roof to open a captured **Combo details** snapshot in the dedicated **Roofs** bottom dock.
It lists original publications and their own bias, roles/replacement effects,
before/after accumulated context, applicable conditions and source contributions.
Click a publication to enable its Inspector family, select its broker date and
open its original readings; ISM still uses one grouped table. Use the bottom dock
navigation to switch between Inspector and Roofs while retaining the selection.
The summary stays outside the scrolling body, and price-reaction recording remains
in Raycaster. Snapshots are ephemeral, cleared on broker/symbol
changes, and do not change when a gear setting is later edited: reopen a roof.

Roofs are fixed dated annotations at the first known qualifying snapshot, not
projections onto price highs and not completed sequences available before their
publication times. A prior candle's hover cannot include a later endpoint even
when the full historical chart displays later annotations. Source visibility
follows Inspector marker filters/date range and loaded candle history. The combo's
own available-from candle admits its label, even with no drawable source symbols;
missing symbol connections do not remove the label or its local More entry. Full
sources remain disclosed and retain their context votes. Uniform tinted labels
sit at activation in Focused/All roofs, with rows growing to fit the chart. Hover/focus/selection draws
available connections and emphasizes release symbols; label clicks open Combo details.
Concise instead shows one +N Combo button per visible candle, with time-axis stems
and every enabled combo in the existing local chooser. Selecting an entry opens the
same details/Candy scope while retaining the compact chart.
The bottom release-symbol row remains separate. Candle gaps and future bars
are not used as guessed endpoints. Range/resize updates coalesce into one frame;
hover uses binary lookup plus at most eight fresh-family expiry checks.

The fresh-news comparison keeps the latest comparable economic score change per
family within seven days. Calibration drift, renewal, coverage changes and unknown predecessors
are disclosed separately and do not vote. The exhaustive USD relationship catalogue
composes eligible named inputs without adding votes. Opposing support shows a
named conflicted lead; narrow leads remain Weak and exact balance has no lead.
Fresh Roofs add no accumulated vote and make no volatility claim.
See [sequence rules](../usd-context/sequences/README.md) and the implementation
audit in `reports/Context-sequence-implementation-audit.md`.

Manual UI checks: pan/zoom with roofs enabled, inspect overflow, click into Combo
details and source releases, toggle either display control, hide event families,
resize the bottom dock, and confirm the gear's section layout. No visual UI audit
or browser automation was performed.

## Raycaster Candy / context ribbon

The toolbar Candy control is the shared visibility switch. The Candy settings
choose Raycaster Candy (all enabled news), Roof Candy (selected relationship),
or both; these optional preferences are saved and included in workspace portability.
Selecting a combo respects the switch and does not force a hidden strip on.
Roof Candy follows that relationship throughout available history, before and
after the clicked roof. Claims + Fed includes holds, cuts and increases. Each
segment uses only then-known evidence, with canonical publication shares retained
and missing/expired participants shown as insufficient. Fed actions remain
unweighted annotations. The selected roof's label/details remain its frozen snapshot.
The outside-event strip follows Raycaster Candy visibility.
The ribbon has no selected-snapshot activation cutoff; individual historical
readings and unavailable intervals follow their own available-from clocks.

`ribbon/ribbon-timeline.ts` merges selected USD/EUR histories into one dated state
timeline. Simultaneous updates are atomic; EUR-only publications affect relative
mode. `ribbon-geometry.ts` maps exact publication times into candle intervals and
maps hover coordinates back through the compressed session axis. Viewport lookup
is binary; only visible intervals are projected. Pan/resize and pointer bursts
are RAF-coalesced. The box, ribbon and Notebook capture reuse shared calculation
jobs, with no scoring on pointer movement.

The ribbon starts Off, saved as an optional backwards-compatible `ribbon` field
in `fyodor.context-sequences.v1`. USD colors follow presentation v1 above;
relative green/red means pair Long/Short and amber means Mixed evidence. Gray
means Insufficient context/unavailable history. Evidence shade is not probability. Mode, exact selected clock, triggering
publication/memory/expiry update and clicked contribution explanation are explicit.
The box still uses candle-end cutoff. Roof relationships remain USD-only, even
when the box/ribbon compare EUR against USD. USD engine v8 keeps its canonical
gates; USD presentation v1 exposes qualified conflicted leads separately.
Relative v3 still applies completeness/agreement gates before coloring a direction.

The separate gray strip immediately above Candy contains manual outside-event
notes. The shared gear's Manage outside events opens title/range/observation editing
even with Candy hidden; clicking a highlight can still open its note. These annotations
are stored per broker/pair and exported with the workspace. Their chart clocks and
actual UTC recording dates are separate. They add no votes, history fetches or
worker rebuilds. See [outside-event ownership](../external-events/README.md).
