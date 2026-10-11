# Repository navigation and terminology

Read the root [AGENTS.md](../AGENTS.md) and [main objective](../fyodor%20trading%20terminal%20main%20objective.md) first.
The objective defines active scope; module READMEs describe ownership. Dated reports
and older sections beneath current README introductions are historical evidence,
not instructions to restore earlier formulas or UI.

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
| Test entry points | `frontend/tests/suites.mjs` (from root); run suites sequentially |
| R1 Raycaster tanks and release rows | `raycaster/ui/{R1Reading,R1EvidenceTank}.tsx`, `raycaster/core/r1-evidence-presentation.ts` |
| Chart drawing geometry, interaction and hover labels | `market-data/chart-drawings/`; position labels in `ChartDrawingShape.tsx`, hover styling in `chart-drawing-overlay.css` |

Inspector supports **all 28 conventional major-currency pairs**, with currency catalogs
shared across pairs and separately saved filters. EURUSD retains existing scoring;
the other pairs offer Table only and disabled Scatter Plot (WIP).
[Family coverage and source boundaries](INSPECTOR-MAJOR-FOREX.md).

Runtime APIs and settings keys are contracts. Prefer these entry points and `rg`
over renaming product terms across code or rewriting historical reports.

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

## Historical hygiene review — 9 October 2026

The [11 October PMI/tanks audit](../reports/R1-PMI-tanks-audit.md) removes two
unreachable worker entries. All 463 then-current frontend source files were reachable
from bootstrap; relative imports resolve. Active objective/navigation text is
updated and its full previous handoff is preserved as historical evidence.

The review found 644 tracked files and no tracked dependency folders, build output,
Python caches or local inventory. Three broken root README links to deleted user
documents were removed. Two historical links in
`reports/Context-v7-refinement-audit.md` still refer to deleted notes; retain that
report as evidence rather than recreating the notes.

At that review, navigation debt included: long historical module READMEs and deep pair/family
paths. Some shared input/history/settings helpers still live under Inspector;
the shared calculations folder is not a completely independent package. These
are documented boundaries, not reasons for an unscoped refactor.
