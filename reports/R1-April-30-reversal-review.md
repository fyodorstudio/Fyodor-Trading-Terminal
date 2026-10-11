# April 30, 2026: dock arithmetic and EURUSD reversal

Review date: 11 October 2026. Read-only Elev8-Demo2 calendar replay and the
existing 5,000-bar EURUSD H1 cache. Default R1 settings; the user's browser bands
were not read. Stored vintages are retrospective/unverified, not proof of the
original feed at release time. No feed record or score policy was changed.

## Implemented arithmetic audit

Fundamental Settings → USD R1 exposes origin, retained, routed and final
relationship allocations for the selected inputs. Fed adds its complete policy
pressure category/input weights, comparison bases, fixed level scales, native
manual/inherited calibration, point method, hold formula and missing-evidence
rule. Allocations pass through `combineR1`; pressure metadata passes through
`derivePolicyEvidence`. These are allocation projections with no history fetch,
not live pressure values for an unspecified date.

The full final allocation is 22.65 / 22.725 / 14.625 / 40 percent. Standalone
pressure category weights are 37.75 / 37.875 / 24.375 percent. Manual/native
calibration changes update the table; inherited continuing-claims bands convert
millions to thousands. Fixed payroll-level bands remain 100 / 200 / 300k despite
changes to standalone payroll AP bands. PPI policy momentum remains categorical;
derived consumer/level comparisons and Jobs/Claims/Manufacturing are fractional.

## Price and publication chronology

All times below are Asia/Jakarta. Price differences are from the Fed release
candle's open, 1.16845. H1 observations resolve hourly windows, not exact ticks.

| Time/window | Observation |
|---|---|
| April 30, 01:00 Fed publication | Hold interpretation +6.0711; overall USD +12.8192, overall change zero. |
| First hour / four hours | EURUSD −12.7 / −14.9 pips. |
| 12:00–13:00 candle close | −26.0 pips; still below the release-time price. |
| 16:00 euro-area GDP/HICP/unemployment | Stored inputs reduce overall EUR by 25.7 points. The HICP input mismatch below compromises this calculation. |
| 16:00–17:00 candle close | +9.5 pips; first hourly close above the release-time price. |
| 19:15 ECB decision | Rate held; zero actual-rate contribution. |
| 19:30 US GDP/PCE/claims | Default overall USD increases by +10.1170 to +22.9362. |
| 21:00–22:00 candle close | +42.8 pips; another substantial advance. |
| First 24 hours | +40.1 pips. |

The positive hold comparison is mostly inflation (+5.3082), with Labor +0.2197
and Activity +0.5432. It compares April's economic pressure with March's;
it is not a measure of unexpected information announced at the meeting.

## Verified input discrepancy

The stored April 30, 16:00 euro-area headline record `999030013` declares April
2026 and **1.9% actual / 2.6% previous**. Core `999030012` is 2.2% / 2.3%.
[Eurostat's original flash release](https://ec.europa.eu/eurostat/web/products-euro-indicators/w/2-30042026-ap)
reports headline **3.0% / 2.6%**, with core excluding energy, food, alcohol and
tobacco **2.2% / 2.3%**. The core matches; headline does not. This is a stored
input discrepancy upstream of R1 arithmetic. The available record does not
establish whether the original provider, collection or later storage caused it.

Read-only counterfactual: replace only that release's headline actual with 3.0
(including its scaled integer), retain all weights and earlier-history bands.
HICP standalone changes from **−43.75 to +14.5833**, EUR-strengthening. This
isolates the input's effect; it is not an applied correction or validation of
price prediction. Historical feed records remain untouched.

## External evidence and limits

The [Fed statement](https://www.federalreserve.gov/newsevents/pressreleases/monetary20260429a.htm)
records three dissents against retaining an easing bias and one for a cut.
The [press conference](https://www.federalreserve.gov/mediacenter/files/FOMCpresconf20260429.pdf)
explains that the majority retained the guidance despite more support for a
neutral stance. These mixed communications are excluded from numeric R1.

At 19:30 the [BEA GDP release](https://www.bea.gov/news/2026/gdp-advance-estimate-1st-quarter-2026)
reported growth of 2.0%, up from 0.5%; the
[PCE release](https://www.bea.gov/news/2026/personal-income-and-outlays-march-2026)
reported headline 3.5% y/y and core 3.2%, matching the stored actuals.
[Reuters' contemporaneous market reaction](https://www.investing.com/news/economy-news/us-growth-picks-up-pce-inflation-is-higher-but-in-line-with-expectations-4649747)
notes GDP below the 2.3% forecast, inflation in line with expectations, falling
Treasury yields and a weaker dollar index. R1's actual-versus-previous readings
can be supportive while the market responds to weaker-than-expected growth;
forecasts remain excluded from scoring.

The [ECB press conference](https://www.ecb.europa.eu/press/press_conference/monetary-policy-statement/2026/html/ecb.is260430~f99cb123a8.en.html)
describes debating a hike before unanimously holding. Other reported developments
included falling oil prices and Japanese currency intervention:
[Reuters market wrap](https://www.lse.co.uk/news/global-markets-bonds-stocks-rise-on-oils-pullback-yen-jumps-after-japans-currency-intervention-tq4a035zbxq1itq.html).
The [Japanese finance ministry](https://www.mof.go.jp/english/policy/international_policy/reference/feio/monthly/20260529e.html)
later confirmed intervention spending over April 28–May 27; that monthly figure
alone does not date an operation or isolate its effect on EURUSD.

These establish intervening news and a concrete feed mismatch. They do not
identify one exclusive cause or establish what fraction of the reversal each
event caused. The reversal began before the later US/ECB publications, so those
cannot explain its entire onset. Fix or establish input provenance before
calibrating EUR weights against this example; do not invert the April Fed score
solely to fit the 24-hour move.

Verification: all 73 frontend suites pass, including assembled-terminal checks
and mounted Fed dock tests for full/subset budgets, native calibration updates,
continuing-claims unit conversion and independent standalone scope. Lint and
the production build pass. The existing bundle-size warning remains; visual UI
review is left to the user.
