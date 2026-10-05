# Decision-anchored monetary policy episodes

`policy-episodes.ts` owns the explicit bank registry and shared attachment rule.
Inspector and Alert both use it through `groupInspectorReleases`. Adding a bank
requires verified country/currency/event IDs, numeric decision IDs, known meeting
companion IDs, a label, family/filter registration and regression tests. Rate
formatting, descriptive sign colors and per-row clocks use the same registry.
Fed/ECB tables show Forecast and A−F (Surprise) independently of A−P; both
rate differences display in basis points, without adding forecast-based scoring.

Exact publication groups form first. ECB's three simultaneous numeric rates
share one anchor; any available rate row can establish it. Missing rate rows
are never synthesized. Companions attach only to exactly one verified anchor
at 0–60 minutes after its decision. No date-based merging or companion chaining.
Absent/ambiguous/uncertain anchors and companions stay independent. Generic
speeches, testimony, minutes and meeting accounts remain outside the registry.

Grouping preserves source rows and decision identity/times/markers. Inspector
and Alert queries include a one-hour margin while visible date filters retain
the anchor's time. Existing saved family IDs and workspace settings remain valid.
No calendar storage, publisher protocol or historical magnitude scope changes.

Run the FOMC and ECB scripts in `tests/inspector/monetary-policy/`. Visual and
live-broker checks belong to the user.
