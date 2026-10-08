# Unified display clock and release timing audit

8 October 2026. Scope: presentation, input conversion and date-range boundaries.
No scoring-policy, weights, dataset or live publisher protocol changes.

## Findings and implementation

The July 2, 2026 release has UTC `12:30`, projected chart coordinate `15:30`,
and Jakarta display time `19:30`. The old chart formatter treated its native
wall-clock coordinate as UTC and displayed `22:30`. The Raycaster box read the
historical candle end; the ribbon used the exact mid-candle release. These were
two different issues: incorrect clock presentation and an unlabeled cutoff.

The shared display-clock provider converts chart coordinates to real UTC before
applying the selected clock. It mirrors storage's explicit Elev8 EET/EEST
profile, including winter history. Unknown sources use a disclosed current
offset fallback; skipped/duplicated DST wall clocks have no guessed timestamp.
Stored chart/scoring coordinates remain intact. UTC publication timestamps use
the selected clock directly. Date filters convert selected calendar-day bounds
back to native coordinates for the existing storage API, then filter on UTC
publication identity. Economic reference periods are unchanged.

Raycaster explicitly distinguishes read-through cutoff from last update. In
relative mode the latter includes the more recent currency leg. Candy retains
exact activation boundaries. M15/M30 already use their own cutoff duration and
need no candle-close wait for live news. Ten-second calendar polling is retained;
publisher/processing latency has not been measured end to end in this pass.

Outside-event forms convert selected-clock input back to their existing storage
schema, including valid in-progress drafts when the preference changes. Existing
notes are not migrated or rewritten. Notebook captured records and pinned arrows
display the selected clock. Broker offset information is confined to Chart
settings; Activity retains source-clock verification status without its offset.

Fresh Roof direction labels disclose `Change:` to distinguish their recent
comparable changes from accumulated Raycaster support. No votes or versions
change. Date formatters are cached with a 64-entry bound to avoid recreating
Intl formatters during panning; pointer/projection batching remains intact.

## Verification

Final verification: **all 57 frontend suites passed serially**; TypeScript/Vite
production build and lint passed; `git diff --check` passed. The existing
non-blocking 500 kB main-chunk warning remains (main chunk approximately 512 kB).
Scoring/context worker bundle hashes remain unchanged. The Activity regression
check confirms 200 existing rows are not reformatted during Checking/Running;
appending one row formats only that row with a shared cached formatter.

The dedicated
clock test covers July 2 crosshair/axis/Box/Candy/Roof agreement, winter offsets,
DST ambiguity, unknown-source fallback, display-date rollover, M15/M30 live
caps, immutable scoring objects, saved-note coordinate round-trip and draft
conversion. Existing Inspector tests cover selected-day storage query bounds,
release identity, native symbol coordinates, timezone refresh, cancellation,
snapshot consistency, and FOMC/ECB per-row clocks.

User visual checks are listed at the top of `docs/manual edit.md`. No browser
or screenshot-driven audit was performed, per the repository preference.
