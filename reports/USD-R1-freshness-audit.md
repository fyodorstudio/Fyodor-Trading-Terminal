# USD R1 freshness refinement replay

Run: 10 October 2026. Source: Elev8-Demo2, read-only SQLite export through 2026-10-10T12:00:00.000Z. Policy: r1-scheduled-or-age-v1. Automatic magnitude fallback; browser manual settings were not read or changed.

## Why September 11 showed unknown schedules

No mapped schedule was captured by 2026-09-11T12:30:00.000Z. The earliest captured October CPI schedule is 2026-10-03T15:55:35.091Z; its projected due time is 2026-10-14T12:30:00.000Z. It cannot supply historical schedule knowledge on September 11. CPI now uses its 45-day age rule and expires 2026-10-26T12:30:00.000Z. This is a fallback expiry, not an invented publisher date.

## Default age windows and stored release gaps

| Family | Publications | Median days | P95 days | P99 days | Maximum days | Fallback days | Gaps within fallback |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| us-cpi | 140 | 30.00 | 35.00 | 43.00 | 55.04 | 45 | 138/139 |
| pce | 139 | 29.00 | 39.00 | 69.94 | 70.10 | 45 | 135/138 |
| ppi | 140 | 29.00 | 35.00 | 50.04 | 76.00 | 45 | 137/139 |
| jobs | 141 | 28.00 | 35.04 | 36.00 | 76.00 | 45 | 139/140 |
| claims | 607 | 7.00 | 7.00 | 8.00 | 56.04 | 10 | 605/606 |
| gdp | 137 | 29.00 | 37.00 | 89.04 | 97.96 | 45 | 133/136 |
| retail | 144 | 30.00 | 34.00 | 62.00 | 70.00 | 45 | 141/143 |
| ism-services | 142 | 30.00 | 34.00 | 35.00 | 35.00 | 45 | 141/141 |
| ism-manufacturing | 142 | 30.04 | 33.00 | 35.00 | 35.00 | 45 | 141/141 |
| fomc | 96 | 42.04 | 56.00 | 56.00 | 56.00 | 70 | 95/95 |

Defaults are fixed operational policies informed by these gaps, not runtime estimates of the next release. Claims gets 10 days (P99 8); monthly families and GDP estimates get 45 (P95 up to 39); Fed decisions get 70 (P95/P99 56). GDP estimates publish repeatedly within a quarter, so a quarterly 120-day lifetime would be too permissive for this feed. Large archive gaps do not stretch the windows indefinitely. The configured policy can be applied to historical reviews; this does not claim it was deployed in 2015. Known schedules still take precedence and expire after their configured allowance. Storage corrections do not restart publication age.

## Aggregate replay and sensitivity

| As of UTC | Direction | Net | Coverage | Current slots | Age-based slots | Direction with 80% / 120% age windows | Timing sensitive |
| --- | --- | ---: | ---: | ---: | ---: | --- | --- |
| 2026-09-11T12:30:00.000Z | strengthening | 12.5875 | 99.40% | 10 | 10 | strengthening / strengthening | false |
| 2026-10-01T12:30:00.000Z | strengthening | 25.125 | 99.40% | 10 | 10 | strengthening / strengthening | false |
| 2026-10-07T12:30:00.000Z | strengthening | 6.15 | 99.40% | 10 | 0 | strengthening / strengthening | false |
| 2026-10-08T12:30:00.000Z | strengthening | 5.25 | 99.40% | 10 | 0 | strengthening / strengthening | false |

Every snapshot matches after removing future publications and later-known schedules, and matches the production-built R1 worker. Inclusive expiry and one-millisecond-after expiry were checked for all 1828 captured publications. Missing numerical inputs, manufacturing Production, mismatched PPI months, and source vintage uncertainty retain their independent treatment. Grace alternatives 0/72 hours and fallback windows 80%/120% are sensitivity checks, never silent substitutions for saved settings.

This replay supports bounded retention and chronology, not uniquely optimal day limits. The original strict-schedule audit remains historical evidence. Browser visual review remains with the user.
