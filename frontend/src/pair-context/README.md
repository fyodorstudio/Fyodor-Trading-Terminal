# EURUSD relative numerical context

`core/` owns pure EUR publication replay, bounded domain budgets, country/aggregate
replacement and normalized leg comparison. `runtime/` owns scoped storage and
shared worker calculation. `storage/` owns saved mode/EUR toggles. `ui/` exposes
relative contributions in Raycaster and Inspector without importing either
subsystem's view or runtime.

The USD engine is unchanged and remains the default. Relative mode is EURUSD-only.
Both legs use signed magnitude points with nominal 100% budgets. EUR is normalized
inside its timeline; USD is divided by 4 at comparison. Missing weight is not
redistributed. EUR aggregates replace overlapping national proxies per reference
period. Publication and broker chart-clock order are verified; daily aging is
precomputed and cursor lookup is binary. No mouse movement triggers scoring.

Standalone EUR rules/settings live in
`inspector/scoring/PAIR/EURUSD/EUR/{policy,assessment,runtime,ui}`. ECB numeric
rate actions remain separate, with no hold/text vote. See the root scoring library
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
