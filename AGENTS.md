# Fyodor Trading Terminal Lite

Market Watch, chart/drawings, raw calendar Inspector, upcoming Alert, Activity and
Settings only. Interpretation happens in a separate market-analyst session.
No scoring, Notebook, Scatter Plot, Fundamental Settings, Roofs, Raycaster, Candy
or Workspace backup UI belong here. Keep the copied bridge unchanged.

Read only task-relevant owners. README.md covers commands/ownership;
docs/DATA-CONTRACT.md covers calendar, clocks and recovery. Keep docs short.
Preserve per-pair filter Save/Cancel and persistence, all eight currencies/28 pairs,
all series, date-only timing, unknown-ID admission, blank-chart dismissal, the
shared date viewport, future axis and saved drawing interactions.

Keep polling clocks local, unchanged data/callback identities stable and viewport
work batched by animation frame. Cancel listeners/timers and stale replies.
Run frontend suites sequentially. For dependency/extraction changes use pnpm test,
pnpm lint, pnpm build and pnpm check:repo. Performance changes need deterministic
work counts and an assembled-terminal regression. Preserve storage/data.
Leave visual audits to the user: no browser automation, computer-use or screenshot
inspection without an explicit request.
