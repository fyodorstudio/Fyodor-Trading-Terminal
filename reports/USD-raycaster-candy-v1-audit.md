# USD Raycaster / Candy presentation v1 — 7 October 2026

Only implementation step 1 is included. Raycaster and Candy now expose the
weighted leading side when USD family contributions conflict. User visual audit,
EUR scoring refinement and extension to EUR-vs-USD remain later steps. Roofs v6
is the public release; its relationship v4 / display v5 counters are unchanged.

## Scope and interpretation

Canonical USD memory v8, all standalone scorers, magnitude settings, conditional
policy weights, retention, component arithmetic, publication Inspector gates and
Roof calculations are unchanged. The resolver partitions the existing retained
policy votes into pair-oriented Long and Short support. It adds no vote, fitted
coefficient, independent confirmation or second coverage/retention multiplier.

USD outputs are Aligned, Conflicted with a named lead, Balanced conflict with no
lead, Unchanged with no lead, and Insufficient context. The 60% usable configured
coverage gate remains. Narrow leads below one-third net/gross separation are
Weak; broader conflicts are at most Moderate; incomplete evidence is Weak.
Canonical zero uses no presentation priority winner. Shares are not probabilities.

Box, gear and Candy share the same cached projection. Candy conflicts remain
amber with a green/red bottom lead edge. Neutral amber has no edge; insufficient
context is gray. Click details expose shares, net, separation, coverage and leading
contributors. Exact publication, memory and expiry clocks remain intact. Notebook
current-context capture records this USD label, evidence and presentation version;
existing records and the relative capture branch retain their semantics.

Publication panels retain their existing agreement safeguard. A publication
panel can therefore say Mixed evidence while USD Raycaster discloses a Weak
conflicted lead from the same retained votes. Relative mode retains its original
Long/Short/Mixed/Insufficient labels and colors; it has no new lead edge.

## Frozen numerical replay

Elev8-Demo2, revision 78619: 41,559 USD and 35,412 EUR rows. Settings are an
explicit frozen automatic snapshot, not browser-local custom preferences. No
price, forecast surprise, outside notes, transcripts or geopolitical feed enters
the calculations. Current stored vintage cannot certify original publication
vintages or historical market causality.

- 5,696 USD snapshots: 4,358 conflicted, 173 aligned, 1,165 insufficient.
  There are 1,356 narrow leads. The default replay contains no exact-balanced or
  unchanged state; those boundaries are covered by independent fixtures.
- Policy counts: 5,357 balanced priorities, 214 weekly-labor priority and 125
  labor priority. Support matches the resolved policy, not base weights alone.
- **9,788 relative ribbon states exactly equal the committed implementation**
  at `56b1b1dc1ab5b1298d1429de28374c605cbd12d8`, including every field, clock,
  label, direction/color state, evidence, explanation and responsible update.
- Full integrity replay checks 5,696 USD and 8,299 EUR snapshots, 15,750 fresh
  decompositions, 15,484 ribbon label/evidence comparisons and nine future-removal
  assertions. All 140 manually recalibrated CPI feature sets stay unchanged;
  84 interpretation scores change under the deliberate manual configuration.
- Existing 12,467 Roof annotations retain their type counts: 9,053 macro pairs,
  2,031 Fed/macro pairs, 1,229 fresh sequences, 113 ISM sector, 30 weekly-labor
  and 11 labor/inflation annotations.
- 56,960 warm immutable presentation lookups took 46 ms in the recorded terminal
  run. This is an informational pure lookup benchmark, not a visual frame-rate
  certification. Existing viewport binary lookup and frame coalescing remain.

December 16/23, January 8/19/28 samples remain Insufficient (32%–52.9% usable
configured coverage). The display does not manufacture a directional explanation
for their price movement. Sep 3, 2026, 22:00 in broker-chart coordinates shows
Conflicted · Long leads / Moderate: Long support 0.666152, Short 0.091962,
separation 75.739%, coverage 100%. This includes the later Services release and
all selected retained families; it is distinct from the earlier ISM + Claims
Roof's partial, two-family activation snapshot.

Replay output is saved without overwriting earlier audits:
`storage/data/usd-presentation-v1-replay-results.json` and
`storage/data/usd-presentation-v1-integrity-results.json` (ignored local outputs).
Commands, from `frontend`:

```text
node scripts/usd-context/audit-usd-presentation.mjs ../storage/data/context-v8-integrity-input.json <new-output.json>
node scripts/usd-context/audit-interpretation-integrity.mjs ../storage/data/context-v8-integrity-input.json <different-new-output.json>
```

## Terminal and manual acceptance

Focused pure and headless tests passed: orientation, policy-transfer
counterexamples, single application of component coverage, measured zero versus
missing, exact balance versus priority, invalid/future sources, cache freshness,
atomic publication and memory/expiry transitions. Headless rendering verifies
box/gear/Candy label, grade and share parity, correct lead-edge classes and
relative isolation without preference writes. No browser automation or screenshots
were used. All **56 serial frontend suites** passed. Final focused presentation
tests, lint, TypeScript and the production build passed. The build retains its
existing nonblocking main-chunk size advisory (510.32 kB minified); worker assets
retain the same hashes. Whitespace validation passed. Visual frame rate, layout,
theme readability and real interaction remain the user's manual audit.

The user's next audit is **USD side**. Compare exact clocks, click both conflict
leads, inspect narrow/insufficient examples, check Notebook current captures,
and pan/zoom in both themes. See `docs/manual edit.md` for the checklist and
`docs/trading workflow.md` for scope and usage. No commit, service deployment,
dataset overwrite or actual user preference mutation was performed.
