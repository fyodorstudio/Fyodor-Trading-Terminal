# Raycaster / USD context memory v6.2

Press **Show Raycaster** (the wave glyph) beside the paintbrush toggle near the
timeframe selector. Its active button toggles the box, and × hides it. Raycaster
visibility is independent of the drawing toolbar. The header
handle drags the box, constrained to the chart area. Visibility and position are
saved locally and included in workspace export/import. Non-USD supported pairs
disable the header button; the user's saved visibility is retained when switching
back to a supported major USD pair.

Raycaster has saved CPI/NFP/Claims/ISM/Retail/PCE/PPI/GDP context filters, independent of
Inspector marker filters. These controls are shared with CPI v4's publication
context table; all eight inputs default On. The gear opens `ui/RaycasterDetails.tsx`;
the shared `usd-context/ui/ContextInputTable.tsx` shows versions, clickable Enabled/
Off controls, each source bias/evidence/date, source score, weighted contribution
and the combined total. The compatibility `RaycasterInputTable.tsx` re-export
keeps existing imports. Base weights are CPI 28%, PCE 10%, PPI 2%, NFP 30%, Claims 10%, ISM 10%,
Retail 7%, GDP 3%. Qualified Labor priority uses CPI 8%, NFP 50%, with other weights
unchanged. The table shows effective/base weights; the rule details explain
every condition using canonical publication-time CPI/NFP facts.
V6 multiplies each vote by cadence retention (7-day Claims, 30-day monthly,
90-day GDP half-life) and usable nominal component coverage. Age changes at broker
calendar midnights, precomputed in the worker. The table exposes these factors,
source age and final effective weight. Standalone scores remain unchanged; this
is an additional cautious context policy, not a probability transformation.
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
The collapsed explanation identifies Labor priority when active. Standalone scorer math remains
CPI v3.1, NFP v2, Claims v2, ISM v3, Retail v1, PCE v1, PPI v1 and GDP v1. ISM switches both sectors together;
they update one slot. Inspector's view, date range and marker visibility do not
select context inputs. Applied Scatter signal magnitudes still affect both tools.

The shared context preferences are session-safe, portable and receive cross-tab
updates. Existing full four-family and version-2 five-family defaults gain the new inputs; intentional partial or
all-off lists survive. A versioned saved object preserves deliberate Claims-Off
choices. Opening the gear alone does not fetch or rescore; input changes rebuild
the background timeline. Escape/close/outside pointer presses dismiss it;
Escape/close restores gear focus.

The footer labels the reading as **USD side only** and identifies the broker time.
Source dates, weighted contributions, evidence and unavailable or expired status
remain available in the context snapshots and chronological audit. Partial coverage, timing exclusions or storage outages are
disclosed. A retained snapshot during a storage outage is reconstructed stored
context, with a warning; a new broker never displays the previous broker's results.

`chart/useRaycasterHover.ts` subscribes to the native chart crosshair. Only actual
numeric candle times with series data are inspected; whitespace or leaving the
chart clears the reading while the popover is closed. While open, the last
valid candle is retained and explicitly labelled so the breakdown remains usable.
Changing filters recomputes that candle from new inputs, not stale totals. Closing
the popover restores the hover prompt if the cursor is outside the chart.
Broker, symbol or timeframe changes clear the held candle; a new chart scope
requires a fresh valid candle hover. Pair changes still reuse the USD timeline. Mouse movement coalesces into one animation frame and
updates local Raycaster state only. Unmount cancels its frame and subscription.
The box itself does not capture pan/zoom gestures; only its handle, buttons and open explanation popover
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

The gear now has flat, labeled sections: accumulated result; input contributions;
active relationship conditions; experimental fresh-news change; chart controls;
calculation/evidence notes. The optional relative EUR/USD controls remain within
Inputs. The fresh-news and roof results specifically describe the USD side;
they do not substitute for the optional relative main result.

On EURUSD, **Show clickable combo roofs** connects already-qualified ISM-sector,
labor/inflation and weekly-labor relationships above visible event markers.
Dashed roofs identify the seven-day fresh-news experiment. Both display controls
default On and are saved/exported independently of the context-family switches.
Roofs and the context ribbon now have independent header controls; hiding Raycaster's
hover box leaves those views visible. Turning a display control Off does not change
weights, fetch calendar history or rerun scorers.

Click a roof to open a captured **Combo details** snapshot in the bottom Inspector.
It lists original publications and their own bias, roles/replacement effects,
before/after accumulated context, applicable conditions and source contributions.
Click a publication to enable its Inspector family, select its broker date and
open its original readings; ISM still uses one grouped table. Return to releases
restores normal Inspector. Snapshots are ephemeral, cleared on broker/symbol
changes, and do not change when a gear setting is later edited: reopen a roof.

Roofs are fixed dated annotations at the first known qualifying snapshot, not
projections onto price highs and not completed sequences available before their
publication times. A prior candle's hover cannot include a later endpoint even
when the full historical chart displays later annotations. Source visibility
follows Inspector marker filters/date range; hidden inputs are disclosed and do
not lose their context vote. All-hidden sequences are omitted. Three lanes and
an overflow chooser preserve crowded roof access. Release symbols replace dots at
each roof level; Starts/Update tags identify activation. Symbol clicks open releases
and direction boxes open Combo details. Candle gaps and future bars
are not used as guessed endpoints. Range/resize updates coalesce into one frame;
hover uses binary lookup plus at most eight fresh-family expiry checks.

The fresh-news comparison keeps the latest replacement effect per family within
seven elapsed broker-clock days. A weaker Long replacement can be a USD-positive
change; its standalone Long label remains intact. Two agreeing economic domains
are required for a fresh-news roof. The comparison is always Weak evidence,
adds no vote to accumulated memory and makes no historical-volatility claim.
See [sequence rules](../usd-context/sequences/README.md) and the implementation
audit in `reports/Context-sequence-implementation-audit.md`.

Manual UI checks: pan/zoom with roofs enabled, inspect overflow, click into Combo
details and source releases, toggle either display control, hide event families,
resize the bottom dock, and confirm the gear's section layout. No visual UI audit
or browser automation was performed.

## Raycaster Candy / context ribbon

`ribbon/ribbon-timeline.ts` merges selected USD/EUR histories into one dated state
timeline. Simultaneous updates are atomic; EUR-only publications affect relative
mode. `ribbon-geometry.ts` maps exact publication times into candle intervals and
maps hover coordinates back through the compressed session axis. Viewport lookup
is binary; only visible intervals are projected. Pan/resize and pointer bursts
are RAF-coalesced. The box, ribbon and Notebook capture reuse shared calculation
jobs, with no scoring on pointer movement.

The ribbon starts Off, saved as an optional backwards-compatible `ribbon` field
in `fyodor.context-sequences.v1`. Green/red means pair Long/Short, evidence shade
is not probability, and gray is unavailable. Mode, exact broker clock, triggering
publication/memory/expiry update and clicked contribution explanation are explicit.
The box still uses candle-end cutoff. Roof relationships remain USD-only, even
when the box/ribbon compare EUR against USD. Numerical engine versions are unchanged.

The separate gray strip immediately above Candy contains manual outside-event
notes. Outside events + opens title/range/observation editing; these annotations
are stored per broker/pair and exported with the workspace. Their chart clocks and
actual UTC recording dates are separate. They add no votes, history fetches or
worker rebuilds. See [outside-event ownership](../external-events/README.md).
