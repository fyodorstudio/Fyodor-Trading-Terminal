# US FOMC episodes and rate-delta colors

Episode rule: `fomc-decision-anchored-v1`. Scope: US / USD, Inspector family
`fomc` under Monetary policy. Calendar storage and original rows are unchanged.

## Episode identity

The Fed Interest Rate Decision (840050014) anchors the episode, its selection
ID, title, release time, broker/chart time and chart marker. Known companions
are FOMC Statement (840050002), Economic Projections (840050003), and Press
Conference (840050018), verified against the broker inventory.

Attach a companion only when exactly one verified decision precedes its start
by **0–60 minutes inclusive**. Compare established UTC instants; display
timezone and calendar date do not affect grouping. The window always measures
from the decision, never from another companion. Ambiguous matches, absent
decisions and uncertain or unavailable timing stay separate. Ordinary Chair
speeches/testimony retain their own episodes and `fed-chair` filter. FOMC
minutes are not meeting-window companions.

The numeric decision appears first, followed by statement, projections and
press conference. Every row retains its original publication instant, reference
period, revision, value ID and values. FOMC tables show a Release time column
with the current display timezone and, in stored-calendar mode, each row's
selected display time. Commentary has no numeric delta: A−P is Not applicable.

Stored Inspector queries include a one-hour buffer on both sides of the chosen
range so an episode crossing midnight is complete. Visible releases and chart
markers still filter against the original range at the decision's time.
Magnitude-history family scopes remain independent of episode grouping.
Incoming companions keep the selected decision ID and anchored marker stable.

## Fed rate decision color

Use **Actual minus supplied Previous**, never Forecast or revised Previous.
Positive delta is green, negative red, exact zero gray, missing/nonfinite delta
gray. Percentage-point changes display as basis points: +0.25 percentage points
is +25 bp and −0.25 is −25 bp. Numeric rates have Higher/Lower labels and frozen manual magnitude boundaries
in bp, configurable from Scatter Plot. These add no speech sentiment or EURUSD
direction rule. Optional A−RevP appears when Revised Previous is supplied; its
size uses the same limits and never changes primary A−P history counts.

## Module and verification boundaries

- `episodes/policy-episodes.ts`: explicit companion IDs, bounded attachment and
  ambiguity checks.
- `InspectorReadingTime.tsx`: per-row selected display clocks.
- `grading/policy-rate-grading.ts`: rate-only sign colors.
- `tests/inspector/monetary-policy/test_fomc_episodes.mjs`: one-hour edges,
  cross-midnight dates, missing/uncertain/overlapping anchors, no chaining,
  stable selection/markers, incoming companions, row clocks, filter isolation
  and green/red/gray numerical changes.

Visual checks remain with the user: row-clock readability and dock space.

The [Federal Reserve meeting calendar](https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm)
identifies the meeting's materials. Its [January 2026 calendar](https://www.federalreserve.gov/newsevents/2026-january.htm)
lists the statement at 14:00 New York and press conference at 14:30. The
one-hour tolerance is an application grouping rule, not a claim that all Fed
communications within an hour belong to the same meeting.

## Forecast and surprise display

The Fed/ECB table also shows the supplied broker Forecast and A−F (Surprise),
calculated independently as Actual minus Forecast. Numeric rate surprises display
in basis points: positive green, negative red, exact zero gray. Missing/nonfinite
Actual or Forecast produces —; commentary surprise is Not applicable. Stored
raw precision is used when available. A−F is informational and never changes
A−P, magnitude, scoring, episode identity or grouping. No replacement forecast
is inferred from Previous or revised Previous.
