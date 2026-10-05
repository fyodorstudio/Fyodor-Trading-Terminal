# Market Watch collapse

The Market Watch tab toggles its content and shows a narrow reopen control when
collapsed. The workspace grid changes from its normal sidebar width to 36px,
giving the chart the remaining width. The chart's existing automatic resize
handles the container change.

`LeftDockPanel.tsx` owns this presentation state. It persists at
`fyodor.market-watch.collapsed.v1`; missing/invalid settings default to open.
Unavailable storage still permits session changes. Content stays mounted but
hidden, preserving search/category state; the active symbol and market-data
feed stay unchanged. The toggle has an accessible name, expanded state,
controlled-content ID and visible keyboard focus.

The mounted navigation suite verifies collapse/reopen, retained search, saved
state restoration and storage failure. Visual review belongs to the user:
rail width, chart expansion, pointer/keyboard toggle and light/dark contrast.
