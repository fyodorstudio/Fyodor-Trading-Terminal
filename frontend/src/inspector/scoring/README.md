# Inspector scoring presentation

Scoring development is paused. EURUSD retains R1 and its existing family views;
the other 27 supported pairs offer Table only and disabled Scatter Plot (WIP).
The [main objective](../../../../fyodor%20trading%20terminal%20main%20objective.md)
defines interpretation; this folder owns presentation and calculation lifecycles.

| Entry | Responsibility |
| --- | --- |
| `R1Score.tsx`, `r1-details.tsx` | R1 summary and selected detail table |
| `scoring-registry.ts`, `scoring-contracts.ts` | Explicit family/pair bindings and labels |
| `PAIR/EURUSD/` | Retained USD/EUR family UI and hook adapters |
| `shared/runtime/` | Scoped history loading, worker lifecycle and caching |
| `shared/ui/` | Common result/table presentation |

Formulas, policy, calibration and worker entries belong to
[scoring-system](../../scoring-system/README.md); R1 has its own
[ownership guide](../../scoring-system/r1/README.md). Fundamental Settings owns
model controls; Inspector filters select visibility independently of those controls.
Raw Actual−Previous magnitude belongs to [magnitude](../magnitude/README.md).

Retained Claims standalone v3 and legacy Claims v2 context use separate settings.
Changing a view or detail table must not rescore history. Preserve selected-release
identity, correction propagation, stale-worker rejection and hidden-view cleanup.

[Earlier implementation records](../../../../reports/module-history/inspector-scoring-through-2026-10-11.md).
