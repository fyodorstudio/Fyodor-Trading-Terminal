# Raycaster v1

Open the paintbrush toolbar near the timeframe selector, then press **Show
Raycaster** (the wave glyph). Its active button toggles the box, and × hides it.
The paintbrush hides/shows the toolbar and active Raycaster together. The header
handle drags the box, constrained to the chart area. Visibility and position are
saved locally and included in workspace export/import. Non-USD supported pairs
disable the toolbar button; the user's saved visibility is retained when switching
back to a supported major USD pair.

The box follows Inspector's enabled CPI, NFP and ISM families. There is no second
settings popover. Scorers are fixed to CPI v3.1, NFP v2 and ISM v3; Inspector's
selected table/scoring view, date range and symbol visibility do not change them.
The footer labels the reading as **USD side only** and identifies the broker time.
Source dates, weighted contributions, evidence and unavailable or expired status
remain available in the context snapshots and chronological audit. Partial coverage, timing exclusions or storage outages are
disclosed. A retained snapshot during a storage outage is reconstructed stored
context, with a warning; a new broker never displays the previous broker's results.

`chart/useRaycasterHover.ts` subscribes to the native chart crosshair. Only actual
numeric candle times with series data are inspected; whitespace or leaving the
chart clears the reading. Mouse movement coalesces into one animation frame and
updates local Raycaster state only. Unmount cancels its frame and subscription.
The box itself does not capture pan/zoom gestures; only its handle/close controls
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

Manual checks belong to the user: open/hide via paintbrush and Raycaster toggle,
drag and resize the box/dock, pan while active, compare the August snapshots,
inspect H1 versus M15 boundaries, toggle supported Inspector families, and check
USDJPY inversion. No browser automation or screenshot audit is used.
