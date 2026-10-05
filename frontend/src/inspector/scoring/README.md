# Inspector scoring

Signed scores and pair directions live here, separately from the descriptive
Higher/Lower reading labels in `../grading` and the histogram/settings/history
machinery in `../magnitude`.

```text
scoring/
  scoring-contracts.ts        View props and explicit pair/family bindings
  scoring-registry.ts         Supported symbols, country, currency and family
  InspectorScoringView.tsx    Scoring-only, scrollable presentation
  shared/
    core/signed-magnitude-score.ts
    ui/SignedMagnitudeMatrix.tsx
  PAIR/EURUSD/USD/
    NFP/
      assessment/nfp-magnitude-score.ts
      ui/NfpMagnitudeScoreTables.tsx
    CPI/
      assessment/cpi-magnitude-score.ts
      assessment/cpi-index-magnitude-score.ts
      ui/CpiMagnitudeScoreTables.tsx
      ui/CpiMagnitudeScoreTable.tsx
      ui/CpiIndexMagnitudeTable.tsx
```

USD is EURUSD's quote currency. Assessment modules own the family's selected
series, signs, coefficients, cancellation priority and completeness requirements.
UI modules compose shared matrices. Moving these files does not change existing
NFP/CPI score versions, magnitude persistence keys, boundaries or dataset admission.

The Inspector view dropdown contains Table only, Scoring system and Scatter Plot.
Scatter Plot opens the selected release without changing the saved Inspector view.
Table only is the default Inspector view. Scoring system replaces the readings
table with the registered family's scores; CPI retains separate index/rate
matrices and NFP retains separate supporting/primary matrices. The selected view
is saved and travels in workspace exports. Unsupported families fall back to the
table, with the Scoring system option disabled, without discarding that preference.

To add an agreed scoring policy, create `PAIR/<pair>/<currency>/<family>` with
`assessment` and `ui` modules, then register its explicit symbol matcher, country,
currency and Inspector family ID in `scoring-registry.ts`. Keep the symbol matcher
specific to that pair even when Inspector's broader pair support expands. Register
its magnitude family separately if needed; a magnitude catalog alone never invents
a directional score. Document the policy and add regression cases for missing,
duplicate and undefined readings, native units, signs and cancellation.

Existing regression coverage lives in `frontend/tests/inspector/nfp` and
`frontend/tests/inspector/cpi`; navigation and workspace tests cover view selection,
refresh persistence and unsupported families. Shared code should stay free of
family-specific event IDs and pair direction rules.
