# Fed v2 / Claims v2 user findings audit — October 6, 2026

## Decision

Keep the Claims v2 voting rules for now. Improve context runtime before changing interpretation weights. Fed v2 has a material scope limitation: its headline is the existing numerical USD economic context at the meeting, not an interpretation of the newly published Fed guidance. The user's disagreements justify further investigation, but do not establish that reversing a component or changing a weight is correct.

This pass adds a reproducible audit runner and documentation; it changes no application scoring, UI, filters, worker lifecycle or saved settings. Speeches remain excluded from scoring as requested. Official transcripts below were consulted for retrospective research only.

## Scope and verification

- Current implementation: `usd-context-memory-v6.1`, Claims v2, Fed decision context v2.
- Stored inventory: Elev8-Demo2 revision 78432, 41,558 rows; 7,548 observed numerical rows enter the context inventory by the audit cutoff.
- All eight Raycaster families enabled, automatic component magnitudes. The user's saved browser filters and custom cutoffs were not captured. All 13 reported Fed directions and four reported Claims directions nevertheless reproduce.
- Live storage revision 78553: 1,913 Claims/rate-decision rows matched the snapshot on publication/reference/chart timing, actual/prior/revised-prior, units, multiplier, revision and availability. This does not verify every other macro family against live storage or establish original publication vintages.
- Three difficult Fed meetings (October 2025, March 2026, April 2026) reproduced after physically removing later publications; all four Claims assessments also passed future-removal parity.
- The built production context worker exactly matched the pure timeline and allowed the parent event loop to continue running.
- No chart price bars were retrieved, no numerical price-return accuracy was calculated, and no visual UI audit was performed. Price descriptions below are the user's H1 observations.

Reproduce after building the frontend:

```powershell
node frontend/scripts/usd-context/audit-fed-claims-findings.mjs storage/data/usd-menu-v5-design-snapshot.json storage/data/fed-claims-user-findings-audit
```

The ignored JSON report contains exact publication and broker-clock cutoffs, each component contribution, later updates, 1/4/14/24/48/168-hour context lookups and the timing profile. Removing future rows does not remove later revisions already retained within older stored records.

## Meeting replay

Dates below are Asia/Jakarta. Positive USD totals mean EURUSD Short; negative totals mean Long. Evidence grades describe agreement/coverage under declared rules, not the probability of a candle moving in that direction.

| Jakarta meeting date | Numerical action | Context bias | Evidence | USD total |
| --- | --- | --- | --- | ---: |
| 2026-09-17 | Increase | Short | Moderate | +0.9276 |
| 2026-07-30 | Hold | Long | Moderate | -0.7231 |
| 2026-06-18 | Hold | Short | Weak | +0.0765 |
| 2026-04-30 | Hold | Short | Weak | +0.2451 |
| 2026-03-19 | Hold | Long | Weak | -0.2683 |
| 2026-01-29 | Hold | Short | Weak | +0.2068 |
| 2025-12-11 | Reduction | Long | Weak | -0.2865 |
| 2025-10-30 | Reduction | Long | Weak | -0.0436 |
| 2025-09-18 | Reduction | Long | Weak | -0.1656 |
| 2025-07-31 | Hold | Short | Moderate | +0.3661 |
| 2025-06-19 | Hold | Long | Moderate | -0.8555 |
| 2025-05-08 | Hold | Long | Weak | -0.8014 |
| 2025-03-20 | Hold | Long | Weak | -0.6880 |

### October 30, 2025: missing guidance and incomplete labor inventory

The Long score is only -0.0436. CPI contributes -0.1372, while GDP and Retail oppose it with +0.0762 and +0.0363. NFP, Claims and PPI have expired, leaving partial historical coverage. No arithmetic or future-admission error was found in the replay.

The [October 29 statement](https://www.federalreserve.gov/newsevents/pressreleases/monetary20251029a.htm) cut the range to 3.75–4.00%. However, the [official press-conference transcript](https://www.federalreserve.gov/mediacenter/files/FOMCpresconf20251029.pdf), pages 3–5, explicitly cautioned against treating a December cut as assured. That is policy-path information absent from the numerical engine. A USD-supportive interpretation of that caution is plausible even alongside a rate cut; this audit does not establish the size or sole cause of the observed FX move.

The meeting was at 01:00 Jakarta; the conference began later. Separate the decision-to-conference interval from subsequent H1 candles. A later transcript cannot retroactively vote at the decision timestamp. The November 6 endpoint is also a separate multi-day audit horizon.

### April 30, 2026: credible missing information, unresolved exact reversal cause

The model remains Short at the sampled later horizons. Its meeting contributions are dominated by Retail +0.1251 and NFP +0.1152, partly offset by GDP/PPI. Numerical macro context does not explain the user's later rally.

The [April 29 Fed statement](https://www.federalreserve.gov/newsevents/pressreleases/monetary20260429a.htm) held at 3.50–3.75%. Three dissenters supported holding but opposed the statement's easing bias, demonstrating that hold and policy-path guidance are distinct information. This content is not scored in v2. It is a candidate explanation, not a verified candle attribution.

There was also an [ECB decision on April 30](https://www.ecb.europa.eu/press/pr/date/2026/html/ecb.mp260430~81b7179e6f.en.html) and a [press conference](https://www.ecb.europa.eu/press/press_conference/monetary-policy-statement/2026/html/ecb.is260430~f99cb123a8.en.html): rates held, with greater inflation and growth risks. The euro side is outside the current engine. A later ECB announcement cannot explain the earlier 15:00 Jakarta reversal onset by itself. Claims, GDP and PCE also published later that day; the replay stays Short following them. An exact causal diagnosis remains unestablished.

### July 31 → August 1, 2025: the engine already recognizes the later labor update

Short at the Fed hold changes to Long at August 1 NFP, 12:30 UTC / 19:30 Jakarta; the ISM publication at 21:00 Jakarta leaves it Long. This precedes the user's sharp rally at approximately 22:00 Jakarta.

The [BLS release-day payroll analysis](https://www.bls.gov/ces/publications/highlights/2025/current-employment-statistics-highlights-07-2025.pdf) reported July growth of 73,000 and combined May/June downward revisions of 258,000. Those are facts from a newly published labor release, not evidence that July's earlier Fed-hold interpretation must reverse. The timing and economic weakness are consistent with the rally but do not prove exclusive causality. Audit Raycaster at the new publication, rather than carrying the fixed Fed Inspector output forward indefinitely.

### September 18, 2025: labor priority is active, but the meeting message is absent

Labor-priority mode raises NFP to 50% and lowers CPI to 8%. NFP contributes -0.3979 and Claims -0.0773; inflation, Retail and GDP oppose them. The resulting Long is Weak evidence. This declared interaction is an explicit candidate for broader validation, not proof of an appropriate policy regime for every meeting.

The [September 17 statement](https://www.federalreserve.gov/newsevents/pressreleases/monetary20250917a.htm) cut by 25 basis points. In the [conference transcript](https://www.federalreserve.gov/mediacenter/files/FOMCpresconf20250917.pdf), pages 6–7, Powell described a risk-management cut and said a 50-basis-point move did not have widespread support. Directional guidance and projected policy paths are missing from v2. This establishes an omitted information channel; it does not establish the cause of the reported 04:00 wick or every subsequent day's movement.

### Other meetings

- The reported immediate matches for September/July/June 2026 and December 2025 reproduce; they are useful observations, not a validated success rate.
- March 2026 Long is driven mainly by NFP (-0.2956) and GDP/Retail. CPI is unavailable. A rally starting many hours after an initial fall should be recorded separately from an immediate-release match.
- January 2026 Short is chiefly Claims-led (+0.1270); CPI is unavailable. The later fall and initial rally are separate outcomes.
- June 2025 Long has a broad numerical USD-weakness balance. The multiday rally after earlier falls remains a separate horizon with potential outside events.
- May 2025 Long is largely CPI/PCE-driven. The [May 7 Fed statement](https://www.federalreserve.gov/newsevents/pressreleases/monetary20250507a.htm) described both greater inflation and unemployment risks while holding rates. That two-sided policy assessment is absent from the v2 numerical headline; do not fix this case by declaring every hold bullish USD.
- March 2025 held rates but also [reduced the Treasury runoff cap](https://www.federalreserve.gov/newsevents/pressreleases/monetary20250319a.htm) from $25 billion to $5 billion per month starting April. This is another distinct policy action absent from our rate-only facts. The user's March 20 → May 27 → April 3 sequence contains an ordering inconsistency and should be clarified before assigning a long-horizon audit outcome.

### April 7–8, 2026 rally outside the numerical menu

An [April 8 European leaders' statement](https://north-africa-middle-east-gulf.ec.europa.eu/news/statement-pr-macron-pm-meloni-cnc-merz-pm-starmer-pm-carney-pm-frederiksen-pm-jetten-pm-sanchez-pr-2026-04-08_en) confirms the US–Iran two-week ceasefire. [Standard Chartered's contemporaneous market note](https://www.sc.com/en/uploads/sites/66/content/docs/wm-market-watch-ceasefire-optimism-08-april-2026.pdf) reports falling oil, a weaker USD index and a broad asset rally following the overnight announcement. Reduced safe-haven demand is that institution's interpretation and a plausible mechanism for EURUSD strength. It does not prove the cause of the whole April 7 move or a specific user's broker candle. No selected numerical family published on April 7–8 in the snapshot. Geopolitical news is outside the current menu.

## Claims replay

Values below are thousands of claims, expressed as baseline minus current reading/window. A negative feature denotes increased claims pressure.

| Publication | Initial trend | Continuing trend | Latest week | Bias | Evidence | Total |
| --- | ---: | ---: | ---: | --- | --- | ---: |
| March 13, 2025 | -10.00 | -1.25 | +4.00 | Long | Strong | -1.15 |
| March 20, 2025 | -11.75 | -11.75 | +2.75 | Long | Strong | -1.15 |
| March 27, 2025 | 0.00 | -9.25 | +3.00 | Long | Moderate | -0.25 |
| April 3, 2025 | +1.25 | -8.50 | +3.25 | Short | Weak | +0.20 |

March 13's weekly initial count improved relative to its baseline, but the four-week initial average and continuing window both deteriorated. That is why the release can say Long without using a simplistic weekly initial-claims sign. April 3's improving initial features only narrowly outweigh adverse continuing pressure; Weak evidence is appropriate under the current rules. A small sample of price observations does not validate the weights or Strong labels as price probabilities.

The [March 27 DOL release](https://oui.doleta.gov/press/2025/032725.pdf) states that seasonally adjusted values from 2020 onward were revised. Our windows combine stored earlier publications and only the latest supplied t−1 revision, without a complete same-vintage revised history. This can compare different adjustment vintages. It is a concrete data-quality refinement to investigate; this pass does not quantify how much it changed any score, silently rewrite history, apply an arbitrary date-specific penalty, or assert the Long sign is wrong. Keep four-week windows, missing-week gates, native-unit handling, grouped evidence and weekly-spike caution.

## Runtime finding and proposed order

On this machine the full pure build took 14.91 seconds; the built context worker roundtrip took 17.31 seconds. These include the whole inventory and are headless measurements, not the exact user's click latency. Profiling a separate scorer pass took roughly 5.81 seconds for 606 Claims assessments and 2.64 seconds for 284 ISM assessments. The rest includes other scorers, chronology, aggregation, transfer and result handling.

`usePublicationContext` invokes `useUsdContextTimeline`, which rebuilds the historical timeline through the current admission cutoff. `useBackgroundCalculation` owns a worker per mounted consumer and does not share completed timelines across Inspector and Raycaster or remounts. Scorers repeatedly reconstruct earlier calibration/features across publications. Stored-calendar retrieval for the four Claims/Fed series was only 0.34 seconds; that narrower query does not measure full macro paging, but the isolated calculation already reproduces the delay scale.

Recommended next pass:

1. Share a bounded in-memory context result/job by broker, inventory revision/identity, enabled families, all component settings, algorithm version and admission cutoff. Coalesce equivalent Inspector/Raycaster requests. Preserve error handling, cancellation, invalidation, publication gating and no stale-broker output.
2. Build each family's chronological features and calibration prefixes once, preserving exact prior-only samples, revised-prior semantics, tied magnitude boundaries and per-publication output parity. Hover remains a binary timeline lookup. Benchmark cold and warm requests against this baseline.
3. Improve Fed interpretation coverage before tuning context weights. Keep numerical economic context clearly identified; add only genuinely available structured policy facts in a separately timestamped channel. Options include actual action, published projection changes and balance-sheet decisions. Projections are the Fed's published scenarios, not provider survey forecasts. Do not backdate conference/text information or manufacture a policy tone from prices. Speeches remain excluded unless separately authorized.
4. Audit Claims vintage consistency around annual adjustment revisions; retain its core weights pending broader evidence.
5. Add the previously deferred EUR leg, then evaluate relative policy/economic context. These findings support the need for that scope rather than treating USD as the sole cause of pair direction.

For subsequent manual reviews, record immediate H1 movement, 4-hour and 24-hour outcomes independently; append a separate multiday comment and note intervening releases. This standardizes the evidence without changing the user's chart timeframe or introducing price data into the fundamental interpreter.
