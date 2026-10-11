# Inspector: major currencies and pairs

Eight currencies support seven USD majors and 21 non-USD crosses. Pair identity
follows EUR, GBP, AUD, NZD, USD, CAD, CHF, JPY precedence. Broker suffixes share the
canonical pair's preferences. Unsupported instruments have no Inspector families.

| Currency | Visible families | Currency-specific coverage |
| --- | ---: | --- |
| EUR | 10 | Existing ECB, area/national inflation, labor/wages, GDP and PMI |
| USD | 11 | Existing Fed, CPI/PCE/PPI, jobs/claims, GDP, retail and ISM |
| GBP | 8 | BoE, speeches, CPI, employment, earnings, GDP, PMI and retail |
| AUD | 9 | RBA, speeches, headline/underlying CPI, jobs, wages, GDP, PMI, retail, trade |
| NZD | 11 | RBNZ, speeches, CPI/expectations, jobs/wages, GDP, BusinessNZ, retail, trade, dairy |
| CAD | 8 | BoC, speeches, headline/core/median/trimmed CPI, jobs, GDP, Ivey/manufacturing, retail, trade |
| CHF | 8 | SNB, speeches, CPI, jobs, GDP, manufacturing PMI, retail, KOF |
| JPY | 12 | BoJ, speeches, national/Tokyo CPI, wages/jobs, GDP, Tankan, PMI, retail/spending, production, trade |

Every pair reuses its two currency catalogs, with separate saved selections,
symbols and colors. EURUSD's existing scoring views remain available. The other
27 pairs offer Table only and disabled Scatter Plot (WIP), including their USD/EUR
readings. No new currency scorers, bands or formula changes are included.

Catalog admission uses exact MT5 IDs plus country/currency, verified against the
28 September 2026 export. Source names, missing values, native units, capture clocks,
revisions and exact raw integers remain intact. Uncertain publication times stay
in the release list without a chart symbol. Policy companions retain the existing
bounded, unambiguous attachment rule; speeches remain separate publications.

The pinned MT5 catalog has no distinct Australian monthly CPI ID, Canadian wage
series or current replacement IDs for several central-bank speakers. Existing
verified IDs remain available; official releases do not become fabricated feed rows.
Two unnamed AUD/NZD archive records are retained as raw observations and excluded
from the visible catalog. Expand only after verifying new source IDs.

Family choices reflect central-bank/statistical context, not a fixed ranking of
market reactions: [RBA monetary policy](https://www.rba.gov.au/monetary-policy/),
[RBNZ handbook](https://www.rbnz.govt.nz/monetary-policy/about-monetary-policy/monetary-policy-handbook),
[BoC inflation indicators](https://www.bankofcanada.ca/rates/indicators/key-variables/inflation-indicators/),
[SNB assessment](https://www.snb.ch/en/publications/communication/summaries/zus_20260716),
[BoJ outlook](https://www.boj.or.jp/en/mopo/outlook),
[Stats NZ trade](https://www.stats.govt.nz/information-releases/international-trade-june-2026-quarter/),
[ABS CPI](https://www.abs.gov.au/statistics/economy/price-indexes-and-inflation/consumer-price-index-australia/latest-release).

Publisher V2.0.4 accepts backfill for all eight currencies. Older publishers retain
their original currency capabilities and cannot lease unsupported jobs. Historical
inventory can be safely reimported to add the newly supported currencies. See
[setup](SETUP.md) and [storage contract](STORAGE-CONTRACT.md).
