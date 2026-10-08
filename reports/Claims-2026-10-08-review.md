# US Jobless Claims — 8 October 2026, 19:30 Asia/Jakarta

The app's sustained-trend interpretation is USD supportive / EURUSD Short. The
release's immediate weekly changes are mixed, and its scored support is unchanged
from the preceding publication. Today's stronger retained context comes entirely
from renewing the latest Claims vote, rather than a scored improvement in Claims.

## Evidence and scope

Read-only Elev8-Demo2 storage capture, revision 79473, containing 41,566 USD rows.
All eight context families enabled, automatic magnitudes. Browser preferences were
not read. This configuration reproduces the supplied image's nine combinations,
including its exact count of two Long leads and seven Short leads. No source data,
preferences, scorer rules or application code were changed by this review.

Publication: 12:30 UTC / 19:30 Asia/Jakarta; broker chart time: 15:30. The stored
three Claims actuals and supplied revisions match the
[official DOL report](https://www.dol.gov/ui/data.pdf), checked on 8 October 2026.
This URL is rolling; its release header at review time was 8 October 2026.

| Reading | Actual | Revised preceding value | Immediate reading |
| --- | ---: | ---: | --- |
| Initial claims | 197,000 | 199,000 | Down 2,000 |
| Initial four-week average | 198,000 | 200,500 | Down 2,500 |
| Continuing claims | 1,716,000 | 1,699,000 | Up 17,000 |

Stored forecasts were 190,000 initial and 1,694,000 continuing: both actuals were
higher than those forecasts. Forecast surprise does not enter this scorer.

## Standalone Claims arithmetic

Positive feature values mean easing claims pressure under the declared rules.
All component comparisons use stored observations, not web-sourced inputs.

| Component | Stored comparison, thousands | Points | Weight | Contribution |
| --- | --- | ---: | ---: | ---: |
| Smoothed initial trend | Four-weeks-earlier reported average 206 minus current 198 = +8 | +2 | 45% | +0.90 |
| Continuing trend | Previous four-week mean 1,782.5 minus latest four-week mean 1,716 = +66.5 | +3 | 40% | +1.20 |
| Latest initial week | Previous four weekly mean 199.5 minus current 197 = +2.5 | +1 | 15% | +0.15 |

Total +2.25: EURUSD Short, Strong evidence, complete component coverage. Strong
describes agreement between the new-claims and continuing-claims evidence groups;
it is not a market probability or a claim that the weekly headline is uniformly
positive. A weekly rise in continuing claims can coexist with a lower sustained
four-week trend. The official report also shows its continuing four-week average
falling week over week.

The app's recomputed latest continuing mean is 1.716 million, whereas DOL's latest
fully revised published mean is 1.711 million. The app uses stored weekly Actual
vintages and the current release's nearest Revised Previous, rather than rebuilding
the entire window from the official release's latest revision table. For example,
the stored Sep 5 and Sep 12 continuing values used in the window are 1.730 and
1.719 million. This vintage distinction must remain explicit; the official average
was not substituted into scoring.

## What changed today

The 1 October publication also scored +2.25, with the same component points
(+2, +3, +1). At common current calibration, today's scored change is zero.
Claims has a seven-day half-life. The preceding retained Claims contribution was
+0.1125 immediately before this release; the new vote is +0.225. The +0.1125
replacement effect is entirely renewal: score change, calibration change and
availability change are all zero.

The accumulated USD-only EURUSD presentation remains **Conflicted · Short leads,
Moderate evidence**. Short support rises from 68.6% to 71.8%; Long support is 28.2%
after the release. NFP remains the opposing Long contributor. Support shares
describe the declared weighted votes, not price-move probabilities.

## Nine combinations

| Combination | Output | Meaning |
| --- | --- | --- |
| Claims + Fed | Rate increase · Aligned · Short | Today's Claims alongside the stored Sep 16 UTC / Sep 17 Jakarta rate decision; no new rate action today. Fed is unweighted. |
| ISM + NFP fresh changes | Aligned · Long | Recent interpreted-support changes, not current standalone levels; Claims contributes zero fresh change. |
| Claims + GDP | Aligned · Short | Retained standalone interpretations agree. |
| Claims + ISM | Aligned · Short | Retained standalone interpretations agree. |
| Claims + PCE | Aligned · Short | Retained standalone interpretations agree. |
| Claims + PPI | Aligned · Short | Retained standalone interpretations agree. |
| Claims + Retail Sales | Aligned · Short | Retained standalone interpretations agree. |
| CPI + Claims | Aligned · Short | Retained standalone interpretations agree. |
| NFP + Claims | Conflicted · Long leads | NFP's retained Long support 0.3134 exceeds Claims' Short support 0.225; narrow lead, Weak evidence. |

The fresh ISM family change is -0.016 and NFP change -0.75, both USD-adverse at
this clock. Claims has zero scored change, so the visible fresh driver label names
ISM and NFP only. The opposite directions of current levels and recent changes
are mathematically consistent. The nine combinations overlap; seven Short-leading
rows are not seven independent confirmations. A 100% support split is agreement
within the selected voting inputs, not 100% probability or full evidence strength.

## Verification

Canonical scorer replay reproduced all nine combinations and the supplied counts.
Verified exact component-weight arithmetic, unchanged Claims assessment after
removing same-time/later history, no future sources in the release-time accumulated
snapshot, and renewal-only Claims replacement decomposition. No arithmetic or sign
defect was found against the current declared rules. No browser automation,
additional screenshots or market-price analysis was performed.

Ignored frozen input, replay script and detailed result are under
`storage/data/claims-oct08-live-review-*`. This is a review of current rules and
stored data, not validation of weights as causal FX coefficients.
