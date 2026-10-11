# Shared scoring system

Scoring development is paused. This folder owns calculation contracts, model
policies, calibration, settings and workers. UI and inventory hooks live in their
feature modules. Follow the [main objective](../../../fyodor%20trading%20terminal%20main%20objective.md)
for interpretation and the [R1 guide](r1/README.md) for current engine ownership.

| Location | Responsibility |
| --- | --- |
| `r1/` | USD/EUR R1 features, assessments, relationships, history and workers |
| `PAIR/EURUSD/{USD,EUR}/` | Retained family policies, assessment and workers |
| `shared/core/`, `shared/runtime/` | History, arithmetic and legacy worker infrastructure |
| `context/{usd,relative}/` | Retained context calculations |
| `relationships/` | Retained Roofs relationship/activation calculations |
| `scoring-catalog.ts`, `scoring-signal-bindings.ts` | Canonical model metadata and Scatter/settings definitions |

[Inspector scoring](../inspector/scoring/README.md) owns result presentation;
[Fundamental Settings](../fundamental-tools/README.md) owns model controls.
Raw Actual−Previous limits remain separate from derived scorer calibration.
Adding an Inspector calendar family does not create a numerical scoring binding.

Retained Claims standalone v3 has independent release/trend assessments and settings.
Legacy context/Roofs/Candy use Claims v2. R1 is a third explicit model boundary;
imports or UI cleanup must not migrate weights, settings keys or formulas between them.
The [Claims v3 audit](../../../reports/Claims-standalone-v3-audit.md) preserves its design/replay evidence.
