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

## Euro-area PMI publication rounds

`pmi-episodes.ts` provides a display-only Inspector group for France, Germany
and the euro-area aggregate. Verified publications must share a reference month
and UTC publication day, span at most three hours in both release and chart
clocks, and have at most one publication per source family. Unknown periods,
uncertain timing, nonmonotonic chart clocks and ambiguous reissues stay separate.
Flash and later final rounds cannot merge across publication days. A round may
contain only the currently available subset; no missing readings are fabricated.

One marker anchors the round at its earliest original publication. One filter
row controls all three existing IDs, preserving legacy partial selections and
their symbol preferences. Original IDs resolve to the grouped Inspector entry.
One raw table has country sections with each series' original clock, grading,
revision and magnitude history. Each country/aggregate retains its standalone
v1 interpreter and its own Scatter navigation. Raycaster Context-detailed's
At publication section evaluates at
the latest already-published member; a later aggregate never enters an earlier
cutoff. Existing country proxy replacement and overlapping PMI rules are unchanged.

`useInspector` applies this after the raw inventory is built; scoring engines,
Alert and Scatter still use ungrouped original releases. The chart/list anchor
is a display location, not the availability time for every member. The grouped
label names all geographic sections even when one is missing. Terminal tests
are in `tests/inspector/eur/test_pmi_episodes.mjs`; visual checks remain with the user.
