# Terminal composition

| Entry | Responsibility |
| --- | --- |
| `FyodorTerminalShell.tsx` | App composition and global settings |
| `TerminalWorkspace.tsx` | Chart, Market Watch and bottom dock layout |
| `runtime/useTerminalWorkspace.ts` | Shared selection and feature wiring |
| `LiveTerminalPanels.tsx` | Mount the selected dock |
| `TerminalStatusBar.tsx` | Experimental and primary navigation groups |
| `chart-overlays/` | Compose drawings, event markers and inspection dismissal |

Features own their requests, transforms, caches and saved state. Keep this module
focused on connecting them. Fundamental Settings and Roofs occupy the left WIP
group; Inspector, Alert, Scatter Plot, Notebook, Activity and Settings occupy the
primary group.

Chart release selection opens Inspector. Clearing that selection closes Inspector
while preserving other dock choices. Grouped-event choosers own their chart-click
dismissal subscription. Registered Notebook arrows and chart objects retain their
separate selection behavior.

Keep polling status/display clocks local, callbacks stable and unchanged data
identities intact. Assembled regression coverage is in
`frontend/tests/test_terminal_navigation.mjs` and
`frontend/tests/test_terminal_responsiveness.mjs` from the repository root.
