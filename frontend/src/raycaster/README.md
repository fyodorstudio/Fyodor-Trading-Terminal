# Raycaster / USD context memory v5

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
Enabled and active weight are shown separately. Missing/Off/expired weights are
not redistributed. Claims expires after 14 days; GDP after 120 days; other families after 45.

NFP and Claims share one labor domain: 40% base budget, 60% during Labor priority. Opposing active directions cap evidence
at Moderate, with Weak taking precedence for incomplete/narrow/cancelled votes.
Their agreement adds no independent confirmation. The conditional rule gives
priority to confirmed labor deterioration only when active CPI passes declared
level/acceleration guards. It implies easing pressure, not observed Fed guidance.
Hotter inflation, incomplete/expired or disabled CPI/NFP restores base priorities.
The collapsed explanation identifies Labor priority when active. Standalone scorer math remains
CPI v3.1, NFP v2, Claims v1, ISM v3, Retail v1, PCE v1, PPI v1 and GDP v1. ISM switches both sectors together;
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
