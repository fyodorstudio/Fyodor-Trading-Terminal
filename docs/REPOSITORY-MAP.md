# Repository navigation and terminology

Read the root [AGENTS.md](../AGENTS.md) and [main objective](../fyodor%20trading%20terminal%20main%20objective.md) first.
The objective defines active scope; module READMEs describe ownership. Scoring
development is paused. Dated [reports and archived module narratives](../reports/README.md)
are historical evidence, not instructions to restore earlier formulas or UI.

## Project entry points

| Path | Start here for |
| --- | --- |
| [Frontend](../frontend/README.md) | Commands, suite ordering and bootstrap |
| [Storage](../storage/README.md) | HTTP/CLI entry points, persistence and recovery |
| [Bridge](../bridge/README.md) | Read-only MT5 adapter and MQL5 programs |
| [Setup](SETUP.md), [recovery](BACKUP-RESTORE.md), [maintenance](MAINTENANCE.md) | Running and maintaining the terminal |
| [Scripts](../scripts/README.md) | Routine checks versus dataset-specific audits |
| [Evidence archive](../reports/README.md) | Reviewed findings, historical plans and research |
| [Icon catalogue](tools/icon-catalogue.html) | Standalone manual icon reference |

The browser enters through `frontend/index.html` →
`frontend/src/bootstrap/mount-fyodor-terminal.tsx` → terminal shell. Broker quotes
and candles come from the Python bridge. Calendar observations flow from publisher/
bridge into storage, then through the shared calendar domain to feature consumers.
Settings export and calendar backup are separate data contracts.

## Terms

| Product term | Meaning and code location |
| --- | --- |
| Release / publication | A calendar publication and its grouped numerical observations; `economic-calendar/releases/`, `inspector/releases/group-releases.ts` and `inspector/episodes/`. Reference week/month is distinct from publication time. |
| Standalone score | One family's eligible inputs resolved into currency evidence. Active USD/EUR R1: `scoring-system/r1/`, UI `inspector/scoring/R1Score.tsx`. Older USD models: `scoring-system/PAIR/EURUSD/USD/`. |
| Assessment | A model's comparison horizon. Claims v3 has independent This release and Four-week trend assessments, not two extra context votes. |
| Signal / component | A derived comparison used by a scorer. Its magnitude boundaries differ from the raw Actual−Previous bands in Scatter Plot. |
| Roofs / combo / relationship | A group of releases evaluated at its activation time. Includes retained support and fresh-news changes; it is not automatically a combination of the newest standalone model versions. Math in `scoring-system/relationships/`, UI/storage in `usd-context/sequences/`. |
| Context / Raycaster | Evidence retained across publications, family weights and aging. Math in `scoring-system/context/{usd,relative}/`; inventory/workers in `usd-context/` and `pair-context/`; chart presentation in `raycaster/`. |
| Candy / ribbon | Timeline presentation of Raycaster or Roofs results, not another scorer. `raycaster/ribbon/`. |
| Outside events / external events | Manual notes and highlights; no scoring vote. `external-events/`. The settings tab is Outside Events. |
| Fundamental Settings | Gear-controlled bottom dock for model settings and tool sections. `fundamental-tools/`. Global Settings remains application configuration. |

The active USD/EUR R1 implementation is in `frontend/src/scoring-system/r1/`. Inspector and
Scatter and Raycaster expose R1 separately; its relationships share that engine.
Retired Raycaster views, Roofs and Candy retain older calculations and settings. The user
permits redesign, but an R1 model must never silently mix with legacy votes.

## Where to change things

Paths below are relative to `frontend/src/`.

| Task | Start here |
| --- | --- |
| App composition, dock navigation and shared selection | `terminal-shell/`; see its README |
| Quotes, candle paging and chart lifecycle | `market-data/{contracts,mt5-feed,candlestick-chart,market-watch}/`; see its README |
| Chart appearance and drawing interaction | `market-data/{chart-settings,chart-drawings}/` |
| Currency catalogs, pair recognition, source contracts and polling | `economic-calendar/{catalog,forex,contracts,storage}/`; see its README |
| Inspector filters, saved preferences, raw tables and date picker | `inspector/{catalog,preferences,filters,readings,date-range}/`; see its README |
| Inspector model/menu/version | `inspector/scoring/scoring-registry.ts` |
| Active family formula, weights, calibration | `scoring-system/r1/{profiles,eur-profiles,features,assessment,arithmetic}.ts` |
| Older standalone family models | `scoring-system/PAIR/EURUSD/USD/<FAMILY>/{assessment,policy}/` |
| USD/EUR R1 families, relationships, pair comparison, calibration and history | `scoring-system/r1/`; see its README and `docs/scoring system overhaul.md` |
| Inspector/Raycaster change contributions | `scoring-system/r1/changes.ts`; Inspector summary in `inspector/scoring/R1Score.tsx` |
| Claims standalone versus legacy context | `CLAIMS/assessment/claims-standalone-score.ts` versus `claims-score.ts` under the family path above |
| Canonical settings metadata / Scatter definitions | `scoring-system/scoring-catalog.ts`, `scoring-signal-bindings.ts` |
| Settings layout / Claims draft, Apply, Reset | `fundamental-tools/settings/`, `fundamental-tools/ui/fundamental-settings.css` |
| Gear toggle versus methodology open request | `fundamental-tools/runtime/settings-navigation.ts`, `terminal-shell/FyodorTerminalShell.tsx` |
| Inspector result tables | `inspector/scoring/PAIR/EURUSD/USD/<FAMILY>/ui/` |
| Calculation jobs / history queries | Family runtime plus `inspector/scoring/shared/runtime/`; context runtime in `usd-context/` and `pair-context/` |
| Saved settings portability | `workspace-portability/workspace-snapshot.ts` |
| Notebook plans, journal, registered arrows and captures | `trader-notebook/`; see its README |
| Alerts and upcoming publication countdowns | `alert/`; see its README |
| Connection state, broker clocks and transport | `system-connectivity/` |
| Activity logging and display | `system-observability/` |
| Dock sizing, Market Watch collapse and saved layout | `workspace-docking/` |
| Theme, selected display clock and common styles | `appearance/`, `styles/` |
| Manual Outside Events annotations | `external-events/`; see its README |
| Test entry points | `frontend/tests/suites.mjs` (from root); run suites sequentially |
| R1 Raycaster tanks and release rows | `raycaster/ui/{R1Reading,R1EvidenceTank}.tsx`, `raycaster/core/r1-evidence-presentation.ts` |
| Chart drawing geometry, interaction and hover labels | `market-data/chart-drawings/`; position labels in `ChartDrawingShape.tsx`, hover styling in `chart-drawing-overlay.css` |

Inspector supports **all 28 conventional major-currency pairs**, with currency catalogs
shared across pairs and separately saved filters. EURUSD retains existing scoring;
the other pairs offer Table only and disabled Scatter Plot (WIP).
[Family coverage and source boundaries](INSPECTOR-MAJOR-FOREX.md).

Runtime APIs and settings keys are contracts. Prefer these entry points and `rg`
over renaming product terms across code or rewriting historical reports.

## Finding and checking a change

Search the owner first (`rg --files frontend/src/inspector`, then `rg -n <name>`).
Expand to its shared contract/runtime and the matching fixture suite. Look in reports
only when the current contract needs historical rationale. The deep `PAIR/EURUSD/`
paths retain legacy ownership; folder presence does not enable another currency.

`pnpm check:repo` checks current document file links, relative source dependencies,
worker URLs and reachability. It shares the source-graph helper with the terminal
navigation suite. Five old calendar entry files remain intentional compatibility
exports for tests/consumers; their implementation lives in `economic-calendar/`.
New production code should import shared observation/release contracts directly.

Run affected fixture suites sequentially, then lint/build for implementation changes.
`pnpm test` includes storage fixtures. Dataset audits and live MT5/visual acceptance
are separate; [maintenance](MAINTENANCE.md) describes the standard gates.

## Active module boundaries — 11 October 2026

Shared calendar contracts, source-ID catalogs, clocks, paging and polling live under
`economic-calendar/` without importing Inspector UI or scorers. Thin historical entry
files provide compatibility exports; production imports use the ownership paths.

Terminal composition is in `terminal-shell/TerminalWorkspace.tsx`; its controller is
`terminal-shell/runtime/useTerminalWorkspace.ts`. Notebook plan state/math and its
three columns are separate files under `trader-notebook/notebook-dock/`. Drawing
pointer lifecycle, drag math and inline text editing are under
`market-data/chart-drawings/interaction/`. Date-picker state, grid and portal are
under `inspector/date-range/`.

Storage's public `calendar_store.py` shares one connection/lock across the focused
`storage/persistence/` modules. MT5 research export functions are under
`bridge/mql5/Active/research-export/`; copy that folder when compiling source.
Existing scoring models/settings and historical reports retain their ownership.

## Historical evidence

Earlier module narratives and the completed currency-evidence plan are in the
[evidence archive](../reports/README.md). The [PMI/tanks audit](../reports/R1-PMI-tanks-audit.md)
records the earlier unused-worker cleanup. Historical reports can reference retired
files; those references do not authorize recreating removed features.
