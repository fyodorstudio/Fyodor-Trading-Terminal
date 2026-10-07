# February–March 2025 release-sequence audit

Completed 7 October 2026. Scope: stored numerical calendar and broker EURUSD H1 bars only. No forecast, transcripts, geopolitical feed or candle-based vote enters any scorer. The proposed roof is documented only; no chart overlay or scoring change is implemented in this pass.

## Finding

This is a useful unresolved context disagreement, but it is not four releases confirming an immediate rally. GDP had no growth revision, Claims and Manufacturing ISM leaned Long, and PCE had a very narrow Short lead. The sustained broker-session rally began on March 3; EURUSD fell on both February 27 and 28. About 80.3 of March 3’s 83.5 net daily pips had already accrued before Manufacturing ISM. That publication cannot explain the start of that day’s rise.

All-enabled USD Raycaster and the optional EUR-versus-USD view both remain Weak Short through March 6, then switch to Weak Long at March 7 NFP. Adding EUR numerical releases does not resolve this case. These are model interpretations, not verified causes of returns.

## Provenance and measurement

- Calendar: `Elev8-Demo2`, USD snapshot revision 78432, EUR revision 78555. All eight USD and eight EUR numerical families enabled, automatic magnitude settings. User-saved filters/manual settings were not captured.
- Prices: EURUSD H1, 218 bars from February 26 through the first March 11 bar, acquired through the existing bridge; broker matches the calendars, MT5 generation 1 remained stable. Local files are ignored under `storage/data/`.
- Calendar publication times below use Asia/Jakarta (UTC+7). Bar matching uses stored `chart_time_seconds`, matching MT5 broker timestamps; it does not match UTC publication milliseconds directly. The stored broker offset in this window is +2 hours.
- 6 physical future-removal comparisons passed: three representative publication cutoffs on each currency leg. Removing later rows reproduces the full-inventory historical context exactly.
- This proves publication-cutoff consistency for the saved inventory, not original release-vintage accuracy. Later provider revisions retained in old rows remain a limitation.
- H1 reaction baseline is the preceding candle close. A 20:30 Jakarta release occurs within the H1 bar, so its measured bar includes 30 minutes before publication. These are coarse H1 observations, not second-by-second event returns.
- Four/24-bar measurements include the release-containing bar plus subsequent trading bars. Weekends and later releases can intervene; they are not isolated causal effects. The raw JSON records endpoint clocks and elapsed hours.

## Daily broker sessions

| Broker day | Open-to-close EURUSD move |
| --- | ---: |
| 2025-02-27 | -84.7 pips |
| 2025-02-28 | -22.3 pips |
| 2025-03-03 | +83.5 pips |
| 2025-03-04 | +138.5 pips |
| 2025-03-05 | +164.8 pips |
| 2025-03-06 | -5.6 pips |
| 2025-03-07 | +48.2 pips |

## USD publications and H1 outcomes

| Jakarta publication | Family | Standalone | Evidence | Release-containing H1 | Four trading bars | 24 trading bars | 24-bar elapsed |
| --- | --- | --- | --- | ---: | ---: | ---: | ---: |
| Feb 27 20:30 | claims | EURUSD Long | moderate | -53.1 | -62.9 | -69.9 | 23.5 h |
| Feb 27 20:30 | gdp | Uncomputed | No directional update | -53.1 | -62.9 | -69.9 | 23.5 h |
| Feb 28 20:30 | pce | EURUSD Short | weak | +0.3 | -5.1 | +63.7 | 71.5 h |
| Mar 03 22:00 | ism-manufacturing | EURUSD Long | weak | +2.7 | +5.2 | +39.5 | 24 h |
| Mar 05 22:00 | ism-services | EURUSD Long | weak | -2.5 | +6.0 | +69.6 | 24 h |
| Mar 06 20:30 | claims | EURUSD Long | weak | +26.0 | +17.4 | +54.4 | 23.5 h |
| Mar 07 20:30 | jobs | EURUSD Long | strong | -9.4 | +4.2 | -3.7 | 70.5 h |

GDP and Claims share a timestamp and are one atomic context update. Their identical return cells must not be counted as two independent price observations.

## What the releases actually say

- **GDP, February 27:** Real GDP 2.3%, real consumer spending 4.2%, final sales 3.2%; all equal the earlier estimate for the same quarter. Each growth vote is zero. Uncomputed means no new directional growth information, not absent data or a Long confirmation. Stored price-index revisions are separate non-voting context.
- **Claims, February 27:** Initial claims 242k versus revised prior 220k; reported four-week average 224k versus 212.5k four weeks earlier. Both lean toward labor weakness. Continuing-claims trend offsets some weakness. Total USD score −0.95, Moderate Long. The H1 and next-day price moves oppose that standalone interpretation.
- **PCE, February 28:** Core monthly 0.3% versus a preceding three-month mean of 0.2%; annual core 2.6% versus revised prior 2.9%. Monthly core contributes +0.90 and annual core −0.90. Headline monthly adds +0.15; headline annual −0.10. Net +0.05 gives Weak Short. This is conflicting inflation evidence with a small positive sum, not a strong inflation warning.
- **PCE publication companions:** Personal spending −0.2% versus revised prior +0.8%, real PCE −0.5% versus revised prior +0.5%, income +0.9% versus +0.4%. These stored readings may support a future spending-context extension, but they currently do not vote in PCE’s inflation scorer. They cannot be silently counted as an implemented confirmation.
- **Manufacturing ISM, March 3:** PMI 50.3 remains above 50 but slows from 50.9; orders 48.6 and employment 47.6 are below 50. Prices paid rise to 62.4 from 54.9. Manufacturing component contributions are −0.45 orders, −0.21 employment, +0.135 prices: net −0.525. Services for the same month is still pending. Weak Long is a partial monthly assessment, not all-sector agreement.
- **Services ISM, March 5:** Services employment and prices support USD; activity and orders are below their recent comparison pace despite readings above 50. Services’ own net contribution is +0.14 within the ISM monthly budget; Manufacturing remains −0.525. Combined ISM v3 is −0.385, Weak Long. The grouped marker must preserve this March 5 publication update; it cannot make Services available on March 3.
- **Claims, March 6:** Initial claims fall to 221k, but the smoothed level still exceeds its earlier comparison. Net −0.35 gives Weak Long. This is less USD-negative than the report it replaces after aging, so the aggregate USD total actually increases at publication.
- **NFP, March 7:** Payrolls 151k versus the scorer’s 208.67k recent mean, unemployment 4.1% versus 4.0%, wages 0.3% versus 0.4% recent pace, and a −18k prior payroll revision. Net −1.45 gives Strong standalone Long. Combined context flips to Weak Long, but the release-containing H1 falls 9.4 pips. Agreement of standalone inputs is not a promise of immediate price alignment.

## Why the existing Raycaster stays Short

The February 12 CPI score is +1.45. Its 28% nominal budget and 30-day half-life leave a +0.249922 USD contribution on March 5. Older NFP adds +0.057583; PCE and PPI add small positives. Retail, Claims and ISM offset those votes but leave net +0.091932, hence Weak Short. GDP’s zero vote contributes nothing. This identifies the arithmetic behind the mismatch; it does not prove that reducing CPI’s weight is economically correct.

| Atomic update (Jakarta date) | Change in aggregate USD score | Meaning under current rules |
| --- | ---: | --- |
| 2025-02-27 | -0.086934 | Less USD support |
| 2025-02-28 | +0.007618 | More USD support |
| 2025-03-03 | -0.004508 | Less USD support |
| 2025-03-05 | -0.023461 | Less USD support |
| 2025-03-06 | +0.012500 | More USD support |
| 2025-03-07 | -0.489983 | Less USD support |

These changes compare the publication with the immediately preceding context stage. They distinguish a standalone direction from the incremental effect of replacing old information. Aging stages are listed separately in the local replay.

The current labor-priority rule requires complete Strong NFP deterioration plus inflation guards; February’s NFP does not qualify. The weekly-Claims rule requires three complete opposing reports with underlying trend agreement; this sequence does not qualify either. Even at March 7, the latest core CPI monthly pace violates the declared 0.3% ceiling, so base weights remain. The NFP replacement is large enough to flip the net score without a policy transfer.

## EUR checks

The window contains German inflation, French/German/euro-area PMI updates, euro-area inflation and labor, March 6 ECB action and March 7 GDP/employment. All were included in the relative replay. Country proxies do not add to same-period aggregates. The numerical ECB deposit rate cut from 2.75% to 2.50% gives Short action evidence; it adds no hold/text inference or extra economic-memory vote. Relative context is still Weak Short until NFP. The stored EUR releases therefore do not supply a verified numerical explanation for the rally either.

## Research conclusion and next experiment

Keep this as an unresolved mismatch. The dataset supports weakening Manufacturing demand/labor, softer Claims, near-cancelling PCE inflation and later weak NFP. It does not support the assertion that these four releases caused a continuous rally beginning February 27. The large March 3 rise precedes Manufacturing ISM, and the largest March 4–5 daily moves cannot be causally allocated by this calendar alone.

The worthwhile next experiment is a **fresh-news sequence layer**, alongside the existing stock of context. Test whether new independent labor/activity deterioration carries useful interpretation information before old inflation/NFP votes expire. Separate release direction, incremental context change and economic-domain overlap. Test the PCE spending companions as a proposed demand signal without counting the same consumer weakness twice with Retail. Do not change retention or force Long on this window before broader chronological validation.

See [Release sequence roof design](Release-sequence-roof-design.md) for the proposed chart presentation and implementation boundaries.
