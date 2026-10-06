# Dataset-only context expansion audit

Implementation: 6–7 October 2026. Replay cutoff: 6 October 2026 00:00 UTC. Source: Elev8-Demo2 stored calendar. All numerical inputs on,
automatic magnitudes, no price series, forecasts, transcripts or geopolitical feeds.

## Validation evidence

- All 606 Claims v2 and 141 NFP v2 releases match the original cutoff-dependent
  historical-feature path exactly, including metadata and evidence grades.
- The entire 5,696-point USD context timeline matches that reference path.
- Cold pure timeline calculation: 8,326 ms prepared path versus 14,978 ms reference
  path in the same audit process. An earlier production-worker replay matched the
  pure timeline, with the main event loop remaining responsive. Warm equivalent
  consumers now share completed results; this is not a promise of zero storage latency.
- Eight EUR family inventories were replayed. Standalone future-removal checks
  passed for the latest directional reading in every family; combined EUR context
  passed physical future-removal at three historical cutoffs (11 checks total).
- EUR context build: 1,986 ms and 8,299 points, including daily aging and separate
  monthly unemployment / quarterly employment slots. Final per-family counts
  are recorded in the local JSON audit output.
- Synthetic tests cover flash/final chronology, distinct-period calibration,
  Scorer/Scatter magnitude parity, aggregate/proxy replacement, latest missing
  readings, PMI contraction, ECB consistent rate signs and relative normalization.
- Shared-job tests cover fan-out, last-consumer cancellation, StrictMode resubscribe,
  suspended-consumer restart, stale generations, worker errors, bounded caching and
  exact inventory identity. Mounted integration checks saved mode, scoped requests,
  historical output parity, EUR filters, other-pair isolation and workspace restore.

## Revision findings

593 of 606 Claims publications contain at least one supplied revised prior that
differs from the stored preceding weekly publication. This is an observation of
provider updates, not a corruption count. The nearest revision can be applied;
older feature-window weeks do not become a certified same-vintage history.
The UI now exposes this limitation without a seasonal-date penalty or new vote.

28 of 141 NFP releases have an unavailable calibrated preceding-month revision
component (including early calibration and missing/invalid chronology). The prior
shutdown-report safeguard remains. Payroll hiring history and revision voting
have different coverage; no whole-history revision series was invented.

## Interpretation limits and review

Rate history can distinguish a hold after cuts from a hold after increases. It
cannot establish statement tone or why traders responded. No empty policy row
receives a fabricated directional vote. Relative EUR/USD contributions are a
transparent rule system on normalized magnitude points; they are not estimated
FX coefficients or price probabilities. Uncomputed is retained for insufficient
facts, rather than forcing a misleading directional label.

The complete frontend test suite, lint and production build passed.

Use the user audit for visual behavior and H1 release/context/price comparisons.
No automated visual audit was performed. Dataset-only scope does not establish
the cause of the reported April or October Fed price reversals.

## Reproduce

From the repository root (run Vite SSR tools sequentially):

```powershell
pnpm --dir frontend test
pnpm --dir frontend lint
pnpm --dir frontend build
node frontend/scripts/usd-context/capture-eur-inventory.mjs storage/data/eur-menu-design-snapshot.json
node frontend/scripts/usd-context/audit-dataset-expansion.mjs storage/data/usd-menu-v5-design-snapshot.json storage/data/eur-menu-design-snapshot.json storage/data/dataset-expansion-audit.json
```

Snapshot and JSON audit outputs are ignored local artifacts, not original-vintage
archives. The USD design snapshot already exists locally. Later revisions may
change a newly captured inventory, so counts and timings should be reported anew.
