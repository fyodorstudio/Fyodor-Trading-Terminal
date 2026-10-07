# Market Watch collapse

The chart header's symbol badge and name toggle Market Watch. Its tab also
collapses the panel while expanded. When collapsed, the entire sidebar is
hidden and the workspace grid uses a single chart column, with no reopen rail.
The chart's existing automatic resize handles the container change.

`useMarketWatchDock.ts` owns this presentation state, shared by the shell,
`LeftDockPanel.tsx` and `ChartWorkspaceHeader.tsx`. It persists at
`fyodor.market-watch.collapsed.v1`; missing/invalid settings default to open.
Unavailable storage still permits session changes. Content stays mounted but
hidden, preserving search/category state; the active symbol and market-data
feed stay unchanged. The toggle has an accessible name, expanded state,
controlled-content ID and visible keyboard focus.

The mounted navigation suite verifies collapse/reopen, retained search, saved
state restoration and storage failure. Visual review belongs to the user:
chart expansion, pointer/keyboard toggle and light/dark contrast.
