# Scatter Plot

EURUSD numeric-family inspection, including raw Actual−Previous and retained scorer
comparisons. Adding a currency to Inspector does not add a Scatter/scorer binding.
Speeches and FOMC minutes remain commentary without numeric magnitude.

| Entry | Responsibility |
| --- | --- |
| `index.ts`, `dock/ScatterPlotDock.tsx` | Public dock integration and composition |
| `inspection/` | Shared comparison model and selected publication |
| `navigation/` | Inspector-to-Scatter target and series selection |
| `runtime/` | Scoped inventory and signal-history workers |
| `PAIR/EURUSD/` | Explicit pair/currency/family adapters |
| `plot/`, `controls/`, `settings/` | Plot interaction, presentation and saved chart controls |

Raw magnitude admission, distributions and saved manual limits are owned by
[Inspector magnitude](../inspector/magnitude/README.md). Derived comparisons use
[shared scoring definitions](../scoring-system/README.md) and
[R1 history/calibration](../scoring-system/r1/README.md).

Use all admitted broker history through the selected cutoff, independently of the
viewport. Preserve manual limits, native units, correction replacement, missing
readings and preview/Apply/Reset separation. Pan, hover and zoom never recalibrate
or launch scoring workers. Claims v3 assessments have distinct bindings; Claims v2
bindings remain available for legacy audits.

Tests: `frontend/tests/scatter-plot/` from the repository root.
[Earlier implementation records](../../../reports/module-history/scatter-plot-through-2026-10-11.md).
