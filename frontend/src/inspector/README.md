# Inspector

Filters → configurable chart symbols → selected publication → raw release table.
All 28 conventional major-currency pairs are supported. EURUSD retains its existing
scoring/magnitude views; other pairs show Table only and disabled Scatter Plot (WIP).

| Folder | Ownership |
| --- | --- |
| `catalog/` | Visible families and four menu categories |
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
