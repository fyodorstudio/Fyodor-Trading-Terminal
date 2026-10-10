# Currency evidence R1 expansion audit

Read-only Elev8-Demo2 inventory through 2026-10-10T12:00:00.000Z. No collection, database migration, browser settings or price fitting. Source capture uses the existing observation-vintage layer; unrecoverable original vintages remain retrospective.

## EUR coverage and robustness

| Profile | Stored rows | Publications | Fully scorable | Sensitive complete directions | Native unit/multiplier | Prior sample minimum |
| --- | ---: | ---: | ---: | ---: | --- | ---: |
| Euro-area HICP | 566 | 283 | 165 | 8 | 1/0 | 60 |
| German HICP | 283 | 283 | 180 | 0 | 1/0 | 60 |
| Euro-area composite PMI | 281 | 281 | 165 | 0 | 0/0 | 60 |
| Euro-area services PMI | 281 | 281 | 163 | 0 | 0/0 | 60 |
| Euro-area manufacturing PMI | 281 | 281 | 160 | 0 | 0/0 | 60 |
| German composite PMI | 282 | 282 | 164 | 0 | 0/0 | 60 |
| German services PMI | 282 | 282 | 161 | 0 | 0/0 | 60 |
| German manufacturing PMI | 282 | 282 | 161 | 0 | 0/0 | 60 |
| French composite PMI | 281 | 281 | 158 | 0 | 0/0 | 60 |
| French services PMI | 281 | 281 | 157 | 0 | 0/0 | 60 |
| French manufacturing PMI | 281 | 281 | 159 | 0 | 0/0 | 60 |
| Euro-area unemployment | 142 | 142 | 106 | 0 | 1/0 | 60 |
| Euro-area employment | 158 | 79 | 37 | 6 | 1/0 | 24 |
| Euro-area wage costs | 47 | 47 | 25 | 0 | 1/0 | 24 |
| Euro-area GDP | 272 | 136 | 101 | 17 | 1/0 | 24 |
| ECB action | 93 | 93 | 93 | 0 | 1/0 | 60 |

3595 publication assessments passed Inspector/Scatter equality after removing future inventory, including each component's points. 6 production-worker checks passed: HICP, manufacturing PMI and employment histories, plus both-currency results at all three clocks below. Unchanged values can score zero before sufficient automatic calibration; nonzero changes without boundaries remain unknown. Exact weights and fallback lifetimes are documented policies, not empirically proven FX coefficients. Sensitivity counts vary weights where the profile defines challengers and boundaries by ±10%.

## Publication comparisons

| Publication (UTC) | Selected release | Overall before | Overall after | Unrounded change, displayed | EUR net | USD net | EURUSD net | Pair possible interval |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| 2026-03-19T12:30:00.000Z | Claims | -17.82 | -17.61 | 0.22 | 7.70 | -17.61 | 12.65 | 6.65 to 18.65 |
| 2026-03-19T13:15:00.000Z | ECB hold | 7.70 | 7.70 | 0.00 | 7.70 | -17.61 | 12.65 | 6.65 to 18.65 |
| 2026-10-01T14:00:00.000Z | Manufacturing | 24.03 | 24.59 | 0.55 | 11.76 | 24.59 | -6.41 | -12.41 to -0.41 |

Both currencies use the selected publication clock, with a before snapshot one millisecond earlier. Claims remains USD-negative overall despite its positive standalone contribution. The before/after endpoints round independently; +0.22 is computed from the unrounded values. The ECB hold contributes zero action points while retained macro evidence remains active. These observations assess evidence interpretation and arithmetic; they do not establish which event caused the observed price move.

## Contract checks

Deterministic tests cover distinct-month comparisons, flash/final replacement, quarterly estimate revisions versus retained quarter momentum, composite/sector ownership, national context without duplicate area votes, simultaneous release updates, later corrections, expiry, missing-side intervals, selectable table persistence and settings isolation. Mounted Inspector/Scatter tests verify shared manual limits and local-only previews. The assembled terminal uses the actual pair engine and checks genuine corrections, storage paging, clocks, hidden views, pan work and cleanup. Visual layout and browser performance remain user review.

Canonical policy and sources: [scoring design](../docs/scoring%20system%20overhaul.md#currency-evidence-summary-and-eur-r1).

Final implementation gates: all 71 frontend suites and 29 storage tests pass; lint is clean and production build passes. The existing bundle-size warning remains. `git diff --check` and the new/changed-text encoding scan pass. Manual visual/browser-performance review remains with the user.
