# Context repository hygiene audit

Completed 7 October 2026. This pass preserves numerical rules, saved settings,
UI behavior and worker ownership; it does not add the proposed chart roof.

## Changes

- Split EUR replay into publication validation/batching, monthly versus quarterly
  source extraction, aggregate/proxy selection and memory aging. The timeline
  module now owns scheduling and orchestration only.
- Replaced the `as never` family-selection escape with policy-based narrowing.
- Removed duplicated EUR distinct-reference-period calibration selection from
  Scatter. Scorer and Scatter now call the same history helper, preserving flash/
  final selection, prior-period exclusion and ambiguous-publication rejection.
- Replaced the long package test command with an explicit 41-suite manifest and
  a fail-fast sequential runner. The runner resolves the frontend directory itself;
  Vite SSR suites remain sequential to avoid dependency-cache races.
- Added repeatable baseline comparison and calendar/H1 sequence-audit scripts under
  `frontend/scripts/pair-context/`. Generated inventories/results remain ignored
  in `storage/data/`; reviewed findings remain tracked in `reports/`.

Live legacy scorers were not removed merely because they have older version names.
Selectable Inspector views and later-version dependencies remain supported. The
removed material is duplicate implementation, not an exposed scoring option.

## Verification

- All **41** existing frontend suites passed through the new runner.
- Frontend lint and TypeScript/production build passed.
- Before editing, recorded a complete EUR baseline using Elev8-Demo2 snapshot
  revision **78555**, as-of 7 October 2026 00:00 UTC. After editing, all **8,299**
  timeline points, **2,239** standalone assessments and **22** complete Scatter
  signal models have identical serialized output hashes.
- The separate February–March sequence replay passes **six** physical future-removal
  checks across USD/EUR context. H1 price measurement uses broker chart clocks,
  with the bar/calendar broker identity and MT5 generation checked.
- No browser automation, screenshots or visual inspection were used. Manual
  confirmation of Inspector/Scatter layout, dock resizing and chart responsiveness
  remains with the user. This pass does not claim a newly measured rendering-speed
  improvement; the existing worker/cache and binary cursor lookup remain intact.

## Reproduction

From the repository root:

```powershell
pnpm --dir frontend test
pnpm --dir frontend lint
pnpm --dir frontend build
node frontend/scripts/pair-context/check-refactor-parity.mjs capture storage/data/eur-menu-design-snapshot.json storage/data/hygiene-eur-baseline.json
# Capture before a later refactor, then compare after it:
node frontend/scripts/pair-context/check-refactor-parity.mjs compare storage/data/eur-menu-design-snapshot.json storage/data/hygiene-eur-baseline.json
node frontend/scripts/pair-context/audit-release-sequence.mjs storage/data/usd-menu-v5-design-snapshot.json storage/data/eur-menu-design-snapshot.json storage/data/feb-march-2025-h1.json 2025-02-27 2025-03-07 storage/data/feb-march-2025-sequence.json
```

Use the original unchanged snapshots for a meaningful parity comparison. Local
snapshot files are workstation evidence and are not included in Git. The acquisition
used the existing read-only bridge OHLC endpoint; it did not restart services or
modify chart settings.
