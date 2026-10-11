# Retained EURUSD relative context

Legacy relative v3 runtime and UI. It combines legacy EUR context with USD context
v8; R1 uses its own [pair engine](../scoring-system/r1/README.md).
The models and their settings are separate; scoring development is paused.

| Folder | Responsibility |
| --- | --- |
| `runtime/` | Scoped inventory, worker jobs and cached snapshots |
| `storage/` | Saved relative mode and EUR family toggles |
| `ui/` | Relative context and selected-publication presentation |

Pure replay, component budgets, reference-period replacement and leg comparison
live in `../scoring-system/context/relative/`. Legacy EUR standalone extraction
lives in `../scoring-system/PAIR/EURUSD/EUR/`.

Retain clock ordering, missing-component budgets, aggregate/national overlap rules,
correction propagation and binary cursor lookup. Pan/hover do not score history.
Audit scripts are under `frontend/scripts/pair-context/` from the repository root;
they require local inventory and are not routine fixture checks.

[Earlier interpretation records](../../../reports/module-history/relative-context-through-2026-10-11.md).
