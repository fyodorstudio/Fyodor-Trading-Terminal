# Major forex Inspector and repository hygiene — 11 October 2026

## Delivered scope

All eight major currencies, seven USD majors and 21 non-USD crosses share a
source-ID registry. Inspector has 77 visible families (48 new AUD/NZD/CAD/CHF/JPY
families plus retained EUR/USD/GBP), base/quote filters, configurable symbols/colors,
chart selection and raw tables. Each of the 28 canonical pairs owns its preferences
and workspace export entries; existing EURUSD/GBPUSD keys remain compatible.

EURUSD retains its existing scoring/magnitude views. The other 27 pairs expose
Table only and disabled Scatter Plot (WIP), including USD/EUR readings. New currency
families are excluded from magnitude/scatter catalogs and retained R1 settings.
Scoring formulas and legacy model ownership are unchanged.

[Coverage and source limits](../docs/INSPECTOR-MAJOR-FOREX.md).

## Separation and navigation

- Shared observations, catalogs, clocks, pair identity and stored polling moved to
  `frontend/src/economic-calendar/`, independent of UI and scorer imports.
- Inspector catalog/preferences, release grouping, raw values, marker construction
  and date-picker controller/grid/portal have focused ownership paths.
- SQLite schema, observations, coverage/imports, backfill and queries share one
  CalendarStore connection/lock in `storage/persistence/`.
- Terminal composition/controller, Notebook controller/math/columns, and drawing
  pointer lifecycle/translation/text editing are separated.
- MT5 exporter functions are split into six `research-export/` includes. Expanding
  those includes reproduces the original source content after whitespace normalization.
- Active navigation/setup/contracts are updated; historical reports and scoring
  models remain in place. The largest active source file is now 367 lines, down
  from a 1,067-line exporter and several mixed-purpose frontend components.

Thin old entry files retain compatibility exports. Production imports use the
new owners. All 284 catalog source IDs have one family membership.

## Verification

- Sequential `pnpm --dir frontend test`: all 75 suites pass.
- Storage unittest discovery: all 37 tests pass.
- Frontend lint and TypeScript/production build pass. Existing large bundle warning remains.
- Publisher V2.0.4 and reorganized exporter compile: zero errors, zero warnings.
- All 28 pair workflows cover markers/selection/tables, Save/Cancel, broker suffixes,
  separate preferences, workspace export and genuine corrections.
- Deterministic checks prove one admission lookup per observation in a 10,000-row
  reproducer and zero regrouping work for unrelated currency corrections.
- Existing assembled-terminal, drawing, paging/cancellation, timing, scoring,
  correction and hidden-view regression coverage passes.
- Changed active documentation's local links resolve; `git diff --check` passes.

## Local runtime and remaining manual review

The hash-verified 28 September archive was additively reimported, selecting all
123,256 historical rows. Existing currencies/live corrections remain intact.
Two unnamed AUD/NZD source records are preserved raw and excluded from visible
families. A pre-import backup is outside the storage data directory at
`%LOCALAPPDATA%/Fyodor/backups/majors-20261011`.

Runtime checks found 125,690 stored rows across eight currencies, healthy collection,
HTTP 200 from the frontend, and correct two-currency API scopes. MT5 Market Watch
contains all 28 conventional pairs. Publisher V2.0.4 files are installed in the
previously used MT5 Scripts location; the attached older instance has not been
reloaded. Reattach the publisher to enable all-eight-currency automatic backfill.

Visual layout, browser performance and live MT5 reattachment/backfill acceptance
remain user-owned. No computer-use or screenshot-driven audit was performed.
