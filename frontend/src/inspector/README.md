# Inspector

Filters → configurable chart symbols → selected publication → raw release table.
All 28 conventional major-currency pairs are supported. EURUSD retains its existing
scoring/magnitude views; other pairs show Table only and disabled Scatter Plot (WIP).

Filters save **By release** (compatible default) or **By day** per pair. Daily
icons select one display day and currency; badges count visible series rows.
`releases/group-days.ts` uses original publications before policy/PMI grouping,
preserves all readings and keeps source dates for unknown-hour schedules.
`readings/InspectorDayTable.tsx` owns the single table with publication sections.
Daily selections expose raw tables and do not create a combined scoring release.
Day icons remain selectable on intraday viewports; only their visual position
changes. Relationship overlays retain `publicationMarkers` at original clocks.

| Folder | Ownership |
| --- | --- |
| `catalog/` | Full catalog admission and visible menu categories |
| `preferences/` | Canonical pair keys, compatible defaults and workspace validation |
| `filters/` | Combined menu rows and release visibility |
| `releases/`, `episodes/` | Publication identity, bounded companions and selection |
| `chart/` | Candle placement, viewport projection and marker interactions |
| `readings/` | Source tables, exact deltas, native units and revised priors |
| `date-range/` | Date draft/lifecycle, month grid and popover |
| `grading/`, `magnitude/`, `scoring/` | Retained USD/EUR analysis and UI |

Shared observations, currency catalogs, clocks and polling live in
[the calendar domain](../economic-calendar/README.md). The `inspector-data.ts`
compatibility entry contains exports only. Filter keys retain the existing EURUSD
and GBPUSD values and derive the other 26 keys from the canonical pair.

[Pair/family coverage](../../../docs/INSPECTOR-MAJOR-FOREX.md).
