# FX event volatility: research sources

Saved 11 October 2026 for the Inspector filter review. These are research references,
not implementation instructions or scoring requirements.

## AUD announcement study

Igor Martins and Hedibert Freitas Lopes, *What events matter for exchange rate
volatility?* Paper dated October 2024; arXiv v1 submitted 25 November 2024.

- [Saved original PDF](Martins-Lopes-2024-AUD-event-volatility.pdf)
- [Source and version](https://arxiv.org/abs/2411.16244v1)
- [Searchable paper](https://arxiv.org/html/2411.16244v1)

Sections 2.1 and 3.1 describe five-minute AUD returns over 2017–2023 and 117 US
and Australian announcement types. Estimation ends in June 2022; subsequent data
are reserved for evaluation. The model accounts for persistent volatility and
time-of-day patterns. Nine announcements exceed its 95% posterior inclusion
threshold:

| US | Australia |
| --- | --- |
| FOMC rate decision | RBA cash target rate |
| Nonfarm payrolls | Employment change |
| CPI | GDP |
| FOMC meeting minutes | Retail sales |
| Retail sales | |

This threshold measures confidence in model inclusion, not the probability of a
large move on each release. The principal selection result concerns AUD; it is
not a current ranking for all eight currencies or 28 pairs. An omitted event can
still matter in another currency, period or market regime.

## FOMC minutes: independent FX evidence

Carlo Rosa, *The Financial Market Effect of FOMC Minutes*, Federal Reserve Bank
of New York Economic Policy Review, December 2013.

- [Saved original PDF](Rosa-2013-FOMC-minutes-market-effects.pdf)
- [Official source](https://www.newyorkfed.org/research/economists/medialibrary/media/research/epr/2013/0913rosa.pdf)
- [Official research summary](https://www.newyorkfed.org/newsevents/news/research/2013/rp130905.html)

The event study compares five-minute returns around minutes releases with matched
control periods over January 2005–March 2011, including EUR/USD, USD/CHF and
USD/JPY. It finds elevated volatility, with weaker effects after 2008. See Chart 1
and the surrounding discussion. The paper's eightfold volatility comparison
concerns FOMC statements, not minutes.

## NZD policy surprises

Rachael Grant and Kate Poskitt, *Financial market reaction to monetary policy
surprises*, RBNZ Analytical Note AN2024/08, September 2024.

- [Official findings and methodology](https://www.rbnz.govt.nz/news-and-events/news/2024/09/financial-market-reaction-to-monetary-policy-surprises)
- [Official PDF](https://www.rbnz.govt.nz/-/media/project/sites/rbnz/files/publications/analytical-notes/2024/financial-market-reaction-to-ocr-surprises.pdf)

The study associates a positive 10-basis-point OCR surprise with approximately
0.5% NZD trade-weighted appreciation one hour after the announcement. Its sample
covers 2006–2023. This concerns unexpected policy changes, not every OCR decision.
The host returned HTTP 403 for direct PDF downloads; retain the official links.

## Inspector implication at this review

Eight of the AUD study's nine selected announcement types already have visible
Inspector families. FOMC minutes are registered but hidden. The evidence supports
considering that addition; it does not establish that every other omitted family
is irrelevant. AUD's current monthly CPI source coverage also needs verification
within the existing inflation family.

This archive makes no application, filter or scoring changes.
