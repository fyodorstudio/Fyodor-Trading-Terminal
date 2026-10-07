# EURUSD relative numerical context

`core/` owns pure EUR publication replay, bounded domain budgets, country/aggregate
replacement and normalized leg comparison. `runtime/` owns scoped storage and
shared worker calculation. `storage/` owns saved mode/EUR toggles. `ui/` exposes
relative contributions in Raycaster and Inspector without importing either
subsystem's view or runtime.

USD-side context remains the default. Relative v3 uses USD context v8. Relative mode is EURUSD-only.
Both legs use signed magnitude points with nominal 100% budgets. EUR is normalized
inside its timeline; USD is divided by 4 at comparison. Missing weight is not
redistributed. EUR aggregates replace overlapping national proxies per reference
period. Publication and broker chart-clock order are verified; daily aging is
precomputed and cursor lookup is binary. No mouse movement triggers scoring.

Standalone EUR rules/settings live in
`inspector/scoring/PAIR/EURUSD/EUR/{policy,assessment,runtime,ui}`. ECB numeric
rate actions remain separate, with no hold/text vote. See the `docs/scoring system library.MD`
for weights, retention, evidence limits and the current audit scope.

The replay implementation is split by responsibility:

- `core/publication/eur-publications.ts` validates clocks and batches releases.
- `core/publication/eur-sources.ts` separates monthly and quarterly labor slots.
- `core/memory/eur-members.ts` selects aggregate/proxy sources and applies aging.
- `core/eur-context-timeline.ts` schedules publication, daily and expiry stages.

Scorer and Scatter use `earlierEurSignalReleases` from EUR assessment history for
the same distinct-reference-period calibration population. The hygiene audit
compares complete timeline, assessment and Scatter output hashes against a
pre-refactor stored-data baseline; these are behavior-preserving changes.

Run `scripts/pair-context/check-refactor-parity.mjs` to capture/compare an EUR
snapshot, or `scripts/pair-context/audit-release-sequence.mjs` to replay a date
window using both calendar snapshots and a broker H1 snapshot. Local inventories
and generated audit JSON belong in ignored `storage/data/`; reviewed findings
belong in `reports/`. Price is used only for evaluation.

## Relative v3 completeness and agreement

Each currency leg needs at least 60% usable components of its enabled configured
budget. Proxy overlap does not expand that budget: German-only inflation is at
most 40% of its inflation slot, so cannot masquerade as complete aggregate
coverage. No individual CPI/NFP veto is applied. Each source already retains
missing component weights; neither leg multiplies coverage into its score again.
Age retention is separate. A leg below 60% yields Insufficient context; usable
neutral/cancelling pressure or net/gross below one third yields Mixed evidence.
No exact-cancellation fallback supplies a direction. Directional evidence stays
capped at Moderate; incomplete usable leg coverage caps it at Weak and is
explicitly disclosed. EUR numerical scorers are v1.1 (calibrated PMI fallback).
The current stored vintage cannot certify original publication vintages.

Archived relative v2 used the individual USD primary veto and an additional
coverage multiplier. Those are superseded by v3.

Archived v1 used USD-leg priority on exact relative cancellation and assigned
Weak rather than withholding direction under sparse or near-cancelling context.
