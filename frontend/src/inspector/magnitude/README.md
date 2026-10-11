# Raw-reading magnitude

Shared admission, distribution and manual Actual−Previous limits for Inspector and
Scatter Plot. Derived scorer calibration belongs to
[scoring-system](../../scoring-system/README.md), with separate R1 rules.

| Entry | Responsibility |
| --- | --- |
| `magnitude-families.ts` | Numeric IDs, native units, scope and settings bindings |
| `family-magnitude-history.ts` | Broker/clock admission and sample extraction |
| `magnitude-distribution.ts` | Manual classification, signed bins and extremes |
| `settings/` | Validated saved tuples, subscriptions and legacy normalization |
| `useFamilyMagnitudeHistory.ts` | Scoped inventory/settings lifecycle |
| `MagnitudeHistogram.tsx`, `FamilyMagnitudeCell.tsx` | Reading presentation |

Persisted states are Undefined or frozen manual limits. Small/Medium/Large must be
finite, positive and increasing; rate changes use basis points. Preserve valid
legacy manual tuples. P95 markers normalize to Undefined without invented limits.

History includes unique admitted released readings from January 2015 through the
current cutoff, for the selected broker. Missing/nonfinite/incompatible values,
uncertain clocks, withdrawn observations and future schedules do not become samples.
Corrections replace source observations; selection and viewport do not narrow N.

Freeze saves valid limits. Unfreeze edits a draft without changing Inspector;
Scatter previews valid drafts. Invalid drafts retain the last valid preview.
[Earlier implementation records](../../../../reports/module-history/magnitude-through-2026-10-11.md).
