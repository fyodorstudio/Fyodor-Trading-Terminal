# ECB episodes and rate-delta colors

Scope: EU / EUR, Inspector family `ecb`. Uses the shared decision-anchored
policy episode rule; source calendar rows remain unchanged.

Numeric rate rows are Interest Rate Decision (`999010007`), Deposit Facility
Rate Decision (`999010006`) and Marginal Lending Facility Rate Decision
(`999010015`). Simultaneous rows form one ECB rate decision anchor. Its
selection ID, release time, broker/chart time and chart marker stay stable
when other rate rows or meeting commentary arrive.

Known companions are Monetary Policy Statement (`999010024`) and Monetary
Policy Press Conference (`999010003`). The stored broker inventory contains
statements at the decision timestamp and conferences 30 or 45 minutes later.
Attach only to exactly one verified anchor 0–60 minutes earlier, inclusive.
This tolerance is an application rule. It does not infer speech sentiment or
make all nearby speeches part of a meeting. Absent/ambiguous decisions,
uncertain clocks and out-of-window commentary remain independent. Ordinary
Draghi/Lagarde speeches stay under `ecb-president`; meeting accounts are excluded.

Show the three numeric rates first, then statement and press conference.
Each source row retains its own time, value ID, revision, period and values.
The table shows each row's selected display time.
Commentary A−P is Not applicable. Missing numeric values remain missing.

Rate A−P uses Actual minus supplied Previous. Positive is green, negative red,
zero/unavailable gray. +0.25 percentage points displays as +25 bp. Forecast and
revised Previous do not affect the delta. Rates have Higher/Lower labels and frozen manual bp magnitudes configured
in Scatter Plot, with optional A−RevP using the same limits. Primary A−P history
counts remain unchanged; no pair direction score is inferred. Inspector and Alert share grouping; completed numeric rates resolve
the alert without waiting for numeric speech values.

Implementation: `episodes/policy-episodes.ts`, `grading/policy-rate-grading.ts`
and `InspectorReadingTime.tsx`. Tests: `tests/inspector/monetary-policy/test_ecb_episodes.mjs`.
Visual checks remain with the user.

## Forecast and surprise display

The Fed/ECB table also shows the supplied broker Forecast and A−F (Surprise),
calculated independently as Actual minus Forecast. Numeric rate surprises display
in basis points: positive green, negative red, exact zero gray. Missing/nonfinite
Actual or Forecast produces —; commentary surprise is Not applicable. Stored
raw precision is used when available. A−F is informational and never changes
A−P, magnitude, scoring, episode identity or grouping. No replacement forecast
is inferred from Previous or revised Previous.
