# Raycaster / USD context memory v2

Press **Show Raycaster** (the wave glyph) beside the paintbrush toggle near the
timeframe selector. Its active button toggles the box, and × hides it. Raycaster
visibility is independent of the drawing toolbar. The header
handle drags the box, constrained to the chart area. Visibility and position are
saved locally and included in workspace export/import. Non-USD supported pairs
disable the header button; the user's saved visibility is retained when switching
back to a supported major USD pair.

Raycaster has its own saved CPI/NFP/ISM/Retail filters, independent of Inspector.
All four inputs are enabled by default. A gear beside the draggable title opens
`ui/RaycasterDetails.tsx`; `RaycasterInputTable.tsx` shows scorer versions, weights,
clickable Enabled/Off controls, each latest source's pair bias/evidence/date, raw
signed source score and weighted USD contribution. Its Total row shows the same
summary as the collapsed box. The 100% budget is CPI 40 / NFP 40 / ISM 10 / Retail
10; enabled and active weight are shown separately. Off, absent, expired and
uncomputed sources do not gain redistributed weight or fabricate a vote.

ISM switches both Manufacturing and Services together; they update one slot.
The filters are immediate, session-safe, local-storage backed, receive cross-tab
updates and travel with workspace export/import. No Inspector filter migration
is performed. Shared Scatter Plot component magnitude settings still apply.
Scorers stay fixed to CPI v3.1, NFP v2, ISM v3 and Retail v1. Inspector's selected
view, date range and chart symbol visibility cannot change this configuration.
Opening the popover alone does not fetch or rescore; input changes rebuild the
background timeline. Escape, close or outside pointer presses dismiss it.
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
inspect H1 versus M15 boundaries, toggle Raycaster families independently of Inspector, and check
USDJPY inversion. No browser automation or screenshot audit is used.

The single grouped Inspector ISM control is only a filter UI adapter: original
source family IDs, release clocks and histories remain distinct.
