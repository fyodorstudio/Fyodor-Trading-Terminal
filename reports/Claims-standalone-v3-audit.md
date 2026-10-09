# Claims standalone v3 audit

Captured source: Elev8-Demo2; revision 79473. Example: October 8, 2026, 19:30 Asia/Jakarta.

The weekly and four-week models are independent. Roofs, Raycaster and Candy retain Claims v2 (+2.25 for this example). Forecasts and market prices do not enter the new models.

## October 8 comparisons

| View | Component | Current (k) | Comparison (k) | USD feature (k) | Boundaries (k) | Earlier samples | Points | Weight | Contribution |
| --- | --- | ---: | ---: | ---: | --- | ---: | ---: | ---: | ---: |
| This release | Initial claims | 197 | 199 | 2 | 6 / 14 / 34 | 605 | 1 | 60% | 0.6 |
| This release | Continuing claims | 1716 | 1699 | -17 | 16 / 38 / 126 | 606 | -2 | 40% | -0.8 |
| Four-week trend | Initial claims four-week average | 198 | 206 | 8 | 6 / 14 / 51 | 599 | 2 | 60% | 1.2 |
| Four-week trend | Continuing claims four-week mean | 1711 | 1777.75 | 66.75 | 18.5 / 47 / 382.75 | 594 | 3 | 40% | 1.2 |

**release: USD weakness bias · EURUSD Long · weak evidence · -0.2 points.**


**trend: USD strength bias · EURUSD Short · strong evidence · 2.4 points.**

## Replay and sensitivity

Each view was replayed over all stored eligible publications. Scorer/Scatter values, grades, limits, sample counts and baselines matched; removing same-time/later inventory preserved every assessment. Every input provenance clock was at or before its publication. Both production scoring and Scatter workers matched their pure entry points.

| View | Initial/continuing | Short | Long | No net bias | Unavailable | Direction changes vs 60/40 | Strength changes vs 60/40 | October 8 |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| release (607 publications) | 50/50 | 264 | 207 | 112 | 24 | 130 | 183 | EURUSD Long (-0.5) |
| release (607 publications) | 55/45 | 334 | 248 | 1 | 24 | 19 | 36 | EURUSD Long (-0.35) |
| release (607 publications) | 60/40 | 322 | 243 | 18 | 24 | 0 | 0 | EURUSD Long (-0.2) |
| release (607 publications) | 65/35 | 329 | 253 | 1 | 24 | 17 | 30 | EURUSD Long (-0.05) |
| release (607 publications) | 70/30 | 339 | 243 | 1 | 24 | 53 | 145 | EURUSD Short (0.1) |
| trend (607 publications) | 50/50 | 310 | 191 | 75 | 31 | 86 | 133 | EURUSD Short (2.5) |
| trend (607 publications) | 55/45 | 334 | 242 | 0 | 31 | 11 | 30 | EURUSD Short (2.45) |
| trend (607 publications) | 60/40 | 327 | 240 | 9 | 31 | 0 | 0 | EURUSD Short (2.4) |
| trend (607 publications) | 65/35 | 329 | 247 | 0 | 31 | 9 | 22 | EURUSD Short (2.35) |
| trend (607 publications) | 70/30 | 331 | 245 | 0 | 31 | 37 | 98 | EURUSD Short (2.3) |

release: 250 opposing-input publications; 300 consecutive directional reversals.

| Recent conflict | Initial points | Continuing points | USD total | Bias | Evidence |
| --- | ---: | ---: | ---: | --- | --- |
| 2026-07-30 | -2 | 1 | -0.8 | EURUSD Long | moderate |
| 2026-08-13 | -2 | 2 | -0.4 | EURUSD Long | weak |
| 2026-08-20 | 1 | -2 | -0.2 | EURUSD Long | weak |
| 2026-09-24 | 1 | -1 | 0.2 | EURUSD Short | weak |
| 2026-10-08 | 1 | -2 | -0.2 | EURUSD Long | weak |

trend: 206 opposing-input publications; 79 consecutive directional reversals.

| Recent conflict | Initial points | Continuing points | USD total | Bias | Evidence |
| --- | ---: | ---: | ---: | --- | --- |
| 2026-07-16 | 2 | -2 | 0.4 | EURUSD Short | weak |
| 2026-07-23 | 3 | -1 | 1.4 | EURUSD Short | moderate |
| 2026-08-27 | -1 | 1 | -0.2 | EURUSD Long | weak |
| 2026-09-03 | -2 | 1 | -0.8 | EURUSD Long | moderate |
| 2026-09-10 | -2 | 1 | -0.8 | EURUSD Long | moderate |

## Default and limits

60/40 is an explicit starting policy: initial claims describe new benefit filings more directly; continuing claims describe continued receipt and can also change with eligibility or exhaustion. This supports giving initial claims greater weight, but does not uniquely prove 60%. The replay reports sensitivity instead of tuning the policy to one desired release. Review standalone results before extending it to relationships or NFP.

Revisions published on later stored releases now update every affected week in the selected four-week window. A malformed latest revision is unavailable rather than silently replaced. Missing/ambiguous weeks are not imputed. Exact cancellation and all-zero observations have no net bias; missing inputs retain their nominal weights and weaken evidence. Extreme scores are capped at four points.

The captured feed can contain provider corrections to existing stored records without original vintage timestamps. The audit proves the stored publication cutoff and supplied-revision handling, not reconstruction of unavailable first-publication vintages. Headless integration tests cover Inspector, settings preview/apply/reset, portability, worker reuse, stale replies and cleanup. Visual layout and browser performance remain for the user to review.

Reproduce after building: `node frontend/scripts/audit-claims-standalone.mjs`.
