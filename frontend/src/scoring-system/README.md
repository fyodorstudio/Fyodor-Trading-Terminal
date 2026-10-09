# Shared scoring system

This folder owns formulas, model definitions, calibration, settings and worker
entry points. Inspector, Scatter, Roofs, Raycaster and Candy consume these modules;
presentation and storage/query hooks remain in their existing UI modules.

| Location | Responsibility |
| --- | --- |
| `PAIR/EURUSD/{USD,EUR}/` | Family policies, feature extraction, assessment and workers |
| `shared/core/` | Chronological history, bounded magnitude/evidence, legacy signal stores |
| `context/{usd,relative}/` | Existing accumulated/publication context calculations |
| `relationships/` | Existing relationship and activation calculations |
| `scoring-signal-bindings.ts` | Shared definitions for settings and Scatter |
| `scoring-catalog.ts` | Supported USD models and canonical metadata |

The chart gear opens **Fundamental Settings → Scoring System**. Inspector keeps
its existing standalone views, concise results and contributing numbers. General
USD methodology and calibration controls live in settings. Raw A−P calibration
remains separate in Scatter.

## Claims standalone v3

Two independent assessments share publication-time admission and native-unit
validation. Fewer claims supply positive USD points. Weights start at 60% initial
and 40% continuing; each view can be tuned separately with explicit Apply.

| View | Initial | Continuing |
| --- | --- | --- |
| This release | Revised prior week minus current, or verified prior week | Same comparison in thousands |
| Four-week trend | Reported four-week average at t−4 minus current average | Mean t−4…t−7 minus mean t…t−3 |

Every comparison week uses the latest stored observation/revision published by
the selected release. Invalid revisions and missing/ambiguous weeks are unavailable.
Historical calibration uses each earlier release's own cutoff. Forecasts do not
vote. Magnitudes remain bounded at ±4 with at least 24 usable earlier features.

A nonzero weighted total resolves USD strength/weakness and its EURUSD translation.
Exact cancellation and all-zero comparisons give no net bias; unavailable inputs
are not zeros. Missing weights are not redistributed and evidence is weakened.
The two assessments do not become a third combined score.

`CLAIMS-V3-RELEASE-SIGNALS`, `CLAIMS-V3-TREND-SIGNALS` and
`fyodor.scoring.claims-standalone.v3` isolate new calibration, weights and selected
view. Workspace portability includes them. Roofs, Raycaster and Candy still use
Claims v2 (`assessClaimsScore`, `CLAIMS-V2-SIGNALS`). Explicit `claims-v2` Scatter
bindings support historical audits. Other family formulas/settings were moved
without retuning.

The [Claims audit](../../../reports/Claims-standalone-v3-audit.md) records the
October 8 example, all 607 captured publications, alternative weights, chronology,
Scatter/worker parity and vintage limitations. Reproduce after building with
`node frontend/scripts/audit-claims-standalone.mjs` from the repository root.

Run frontend suites sequentially, then lint/build. Visual audits belong to the
user. NFP refinement, relationship migration and Raycaster redesign are deferred
until standalone review; follow the root main objective and temporary plan.
