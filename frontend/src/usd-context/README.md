# Retained USD context runtime

This module integrates the legacy USD context engine with storage, workers and
presentation. R1 has its own [engine and runtime](../scoring-system/r1/README.md).
These models and their saved settings remain separate; scoring development is paused.

| Folder | Responsibility |
| --- | --- |
| `runtime/` | Scoped history loading, shared calculation jobs and cached lookup |
| `storage/` | Retained context preferences |
| `ui/` | Context tables and selected-publication presentation |
| `sequences/` | Roofs relationship storage, projections and workflow |

Pure context arithmetic lives in `../scoring-system/context/usd/`; legacy
relationship arithmetic lives in `../scoring-system/relationships/`.
Claims v2 supplies this context, independently of standalone Claims v3 or R1.

Preserve chronology, missing-component budgets, source revisions, settings keys
and cached pan/hover lookup. Read the [main objective](../../../fyodor%20trading%20terminal%20main%20objective.md)
before changing interpretation. [Roofs ownership](sequences/README.md).

[Earlier implementation records](../../../reports/module-history/usd-context-through-2026-10-11.md).
