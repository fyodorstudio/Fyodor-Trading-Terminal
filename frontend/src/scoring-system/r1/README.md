# USD evidence R1

The canonical design and source rationale are in
[scoring system overhaul](../../../../scoring%20system%20overhaul.md#usd-evidence-design-r1).
This module owns R1 profiles, arithmetic, interpretation, relationships,
calibration and worker entry points. Legacy scorers retain their own settings.

- `analysis.ts`: one selected publication plus the USD relationship snapshot at
  its publication clock. GDP's standalone revision and retained quarter momentum
  are separate comparisons, never extra votes.
- `history.ts`: historical standalone assessments for Scatter, using the same
  feature extractor and assessor as Inspector. Pan, hover and selection do not
  invoke this calculation.
- `features.ts`: explicit provider IDs, native units, reference periods and
  revised-prior comparisons. Continuing claims convert millions to thousands.
  Manufacturing R1.1 explicitly scores New Orders only (100%); the current feed
  has no ISM Production series. This is a narrower model, not a missing-input
  fallback. The proposed 60/40 demand model needs connected Production history.
  PMI identifies publication/reference/schedule metadata only, so a newer report
  with missing Orders cannot silently reuse the preceding month's score.
- `vintages.ts`: preserve the earliest recoverable release snapshot; later
  corrections replace current evidence only from their capture time. Late first
  captures are retrospective, never proof of original-time availability.
  Automatic historical calibration uses those release snapshots, keeping old
  outputs stable when a later correction arrives.
- `assessment.ts`: raw contribution is weight × signed magnitude. Leaves and
  balances use raw / 4, bounded at ±100; the release UI displays raw totals.
  Category and overall balances preserve signed leaves and uncertainty budgets.
  Claims and Manufacturing New Orders R1.1 interpolate through zero, Small=1, Medium=2 and Large=4,
  capped at four. Size labels remain independent of fractional points; other
  families retain integer bands. Assessor, sensitivity and Scatter preview share
  `arithmetic.ts`. See the [Claims review](../../../../reports/Claims-R1-fractional-audit.md)
  and [manufacturing review](../../../../reports/Manufacturing-orders-R1-audit.md).
  Manufacturing explanations separate expansion/contraction at 50 from A−P
  evidence direction. Level and threshold crossings supply no additional vote.
- `settings.ts`: separate portable R1 overrides and relationship scope. Saved
  compatible raw A−P bands are inherited without mutation. Otherwise R1 uses
  earlier-history 50/80/95% quantiles with 60 usable earlier observations; ties
  coalesce. This automatic fallback is a versioned design policy, not fitted USD
  price-impact coefficients. GDP revisions do not inherit momentum bands.
  R1 Scatter provides chart-only previews, Apply and Reset to inherited calibration;
  Apply shares the same overrides with Fundamental Settings and Inspector. Preview
  edits reclassify the displayed component without launching a history worker.
  Retired manufacturing Production overrides remain portable but inert; old
  Scatter Production selections resolve to Orders.
- `useR1Analysis.ts`: scoped storage, stable inputs and the existing latest-job
  worker client. Storage supplies scheduled dates observed before the chosen
  clock; unknown schedules never become guessed dates.
- `freshness.ts`: known next release plus the saved allowance, otherwise bounded
  publication age (Claims 10 days, monthly families/GDP estimates 45, Fed 70).
  Corrections do not restart age; new publications replace the slot. Settings
  expose all limits; the audit shows the rule and expiry in the display timezone.
  See the [freshness replay](../../../../reports/USD-R1-freshness-audit.md).

Positive means USD-supportive economic evidence; negative means USD-negative
evidence. No forecast, speech, raw price index or inherited duplicate vote enters
R1. Exact cancellation is balanced; missing evidence crossing zero is insufficient.
These labels describe evidence, not an FX price prediction or probability.

Historical storage often contains later-captured/revised values rather than
original publication vintages. Replay must report this limitation explicitly;
calendar timestamps alone do not establish original-vintage availability.

Verification: all 69 frontend suites and 29 storage tests, clean lint and
production build. Read-only replay covers 1,828 publications, both built R1
workers, Scatter parity and three aggregate clocks. See
[the audit](../../../../reports/USD-R1-stored-history-audit.md).
Browser appearance/performance review remains manual.
