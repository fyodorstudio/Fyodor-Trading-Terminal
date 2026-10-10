# USD R1 stored-history replay

Run: 10 October 2026. Input: local captured USD inventory through 2026-10-08T12:30:00.000Z. R1 automatic fallback, no manual overrides or invented raw bands. Saved user bands remain separate and are never overwritten.

| Family | Publications | Strengthening | Weakening | Balanced | Insufficient | Sensitive | Latest raw net / coverage | Runtime ms |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- | ---: |
| us-cpi | 140 | 44 | 34 | 1 | 61 | 24 | strengthening: 60; coverage 100% | 2812 |
| pce | 139 | 42 | 35 | 2 | 60 | 12 | strengthening: 70; coverage 100% | 2980 |
| ppi | 140 | 44 | 35 | 1 | 60 | 11 | strengthening: 50; coverage 100% | 2487 |
| jobs | 141 | 38 | 43 | 0 | 60 | 13 | weakening: -160; coverage 100% | 2397 |
| claims | 607 | 319 | 227 | 1 | 60 | 191 | strengthening: 40; coverage 100% | 2518 |
| gdp | 137 | 15 | 8 | 21 | 93 | 0 | strengthening: 300; coverage 100% | 2374 |
| retail | 144 | 32 | 46 | 8 | 58 | 0 | strengthening: 300; coverage 100% | 2308 |
| ism-services | 142 | 43 | 39 | 0 | 60 | 14 | weakening: -140; coverage 100% | 2254 |
| ism-manufacturing | 142 | 6 | 8 | 0 | 128 | 45 | insufficient: 60; coverage 60% | 2346 |
| fomc | 96 | 21 | 11 | 63 | 1 | 0 | strengthening: 100; coverage 100% | 2303 |

Every replay reconciles positive + negative = net, enforces score and magnitude bounds, and checks every plotted component against the same assessment. Earliest/latest assessments match after removing later publications. Production-built history-worker replies match every family exactly. Sensitivity counts use the documented weight/boundary registry; they are not probabilities.

This capture is stored inventory, not proof of original publication vintages. Later corrections or retrospectively supplied priors can be present. No price-response, profitability or uniquely optimal weighting claim is made. Publication schedule provenance is tested independently; historical dates without a previously observed planned release remain unavailable in relationships.

Feed gap: preferred manufacturing Production is not mapped; its 40% uncertainty is preserved. This replay does not silently replace it with the headline or employment index.

## Source and aggregate replay

Read-only local SQLite adapter, including captured observation versions and planned schedules. 59 mapped planned observations. Earliest recoverable snapshots remain explicitly retrospective when captured after publication. Corrections are available at capture time, not an inferred publisher timestamp.

| As of (UTC) | Direction | Supportive | Negative | Net | Coverage | Current slots |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| 2026-10-01T12:30:00.000Z | insufficient | 0 | 0 | 0 | 0% | 0 |
| 2026-10-07T12:30:00.000Z | strengthening | 17.15 | -11 | 6.15 | 99% | 10 |
| 2026-10-08T12:30:00.000Z | strengthening | 16.7 | -11.45 | 5.25 | 99% | 10 |

All three aggregate snapshots match after removing later publications and later schedule announcements, and match production R1-worker replies. Unknown historical schedules retain uncertainty; no current slot is fabricated from an actual release date. Last captured eligible publication: ["claims","US","USD",1791462600,0,"US Jobless Claims",null].
