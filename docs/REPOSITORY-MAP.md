# Repository navigation and terminology

Read the root [AGENTS.md](../AGENTS.md) and [main objective](../fyodor%20trading%20terminal%20main%20objective.md) first.
The objective defines active scope; module READMEs describe ownership. Dated reports
and older sections beneath current README introductions are historical evidence,
not instructions to restore earlier formulas or UI.

## Terms

| Product term | Meaning and code location |
| --- | --- |
| Release / publication | A calendar publication and its grouped numerical observations; `frontend/src/inspector/episodes/` and `inspector-data.ts`. Reference week/month is distinct from publication time. |
| Standalone score | One family's eligible inputs resolved into USD bias and evidence. Calculations in `scoring-system/PAIR/EURUSD/USD/`; presentation in `inspector/scoring/PAIR/EURUSD/USD/`. |
| Assessment | A model's comparison horizon. Claims v3 has independent This release and Four-week trend assessments, not two extra context votes. |
| Signal / component | A derived comparison used by a scorer. Its magnitude boundaries differ from the raw Actual−Previous bands in Scatter Plot. |
| Roofs / combo / relationship | A group of releases evaluated at its activation time. Includes retained support and fresh-news changes; it is not automatically a combination of the newest standalone model versions. Math in `scoring-system/relationships/`, UI/storage in `usd-context/sequences/`. |
| Context / Raycaster | Evidence retained across publications, family weights and aging. Math in `scoring-system/context/{usd,relative}/`; inventory/workers in `usd-context/` and `pair-context/`; chart presentation in `raycaster/`. |
| Candy / ribbon | Timeline presentation of Raycaster or Roofs results, not another scorer. `raycaster/ribbon/`. |
| Outside events / external events | Manual notes and highlights; no scoring vote. `external-events/`. The settings tab is Outside Events. |
| Fundamental Settings | Gear-controlled bottom dock for model settings and tool sections. `fundamental-tools/`. Global Settings remains application configuration. |

The active USD R1 overhaul is in `frontend/src/scoring-system/r1/`. Inspector and
Scatter expose R1 separately; its relationships share that engine. Roofs,
Raycaster and Candy currently retain older calculations and settings. The user
permits redesign, but an R1 model must never silently mix with legacy votes.

## Where to change things

Paths below are relative to `frontend/src/`.

| Task | Start here |
| --- | --- |
| Inspector model/menu/version | `inspector/scoring/scoring-registry.ts` |
| Family formula, weights, calibration | `scoring-system/PAIR/EURUSD/USD/<FAMILY>/{assessment,policy}/` |
| USD R1 families, relationships, calibration and history | `scoring-system/r1/`; see its README and the root scoring overhaul design |
| Claims standalone versus legacy context | `CLAIMS/assessment/claims-standalone-score.ts` versus `claims-score.ts` under the family path above |
| Canonical settings metadata / Scatter definitions | `scoring-system/scoring-catalog.ts`, `scoring-signal-bindings.ts` |
| Settings layout / Claims draft, Apply, Reset | `fundamental-tools/settings/`, `fundamental-tools/ui/fundamental-settings.css` |
| Gear toggle versus methodology open request | `fundamental-tools/runtime/settings-navigation.ts`, `terminal-shell/FyodorTerminalShell.tsx` |
| Inspector result tables | `inspector/scoring/PAIR/EURUSD/USD/<FAMILY>/ui/` |
| Calculation jobs / history queries | Family runtime plus `inspector/scoring/shared/runtime/`; context runtime in `usd-context/` and `pair-context/` |
| Saved settings portability | `workspace-portability/workspace-snapshot.ts` |
| Test entry points | `frontend/tests/suites.mjs` (from root); run suites sequentially |

Runtime APIs and settings keys are contracts. Prefer these entry points and `rg`
over renaming product terms across code or rewriting historical reports.

## Hygiene review — 9 October 2026

The review found 644 tracked files and no tracked dependency folders, build output,
Python caches or local inventory. Three broken root README links to deleted user
documents were removed. Two historical links in
`reports/Context-v7-refinement-audit.md` still refer to deleted notes; retain that
report as evidence rather than recreating the notes.

Remaining navigation debt: long historical module READMEs and deep pair/family
paths. Some shared input/history/settings helpers still live under Inspector;
the shared calculations folder is not a completely independent package. These
are documented boundaries, not reasons for an unscoped refactor.
