# Candy and Roofs audit: 16 December 2025–28 January 2026

Audited 7 October 2026 before implementation. No production code, scoring rule, weight or preference changed during this baseline investigation.

The subsequent implementation and replay are documented in [Context v7 refinement audit](Context-v7-refinement-audit.md).

## Conclusion

The user's disagreement reproduces substantially. EUR-vs-USD Candy describes most of the decline more successfully than USD-only Candy, but both remain Short throughout the January reversal. This is a material failure if these outputs are used as dependable directional guidance. Correct arithmetic does not establish useful market interpretation.

There are also specific weaknesses to address: substantial missing components still produce directional colors; near-cancellation still produces a directional Roof; fresh replacement effects include renewal of aged votes; and identical Roofs accompany two different Candy modes because Roofs remain USD-only. None of these findings establishes the economic cause of the rally.

## Data and reproducibility

- Stored calendar: Elev8-Demo2, revision 78619; observed USD/EUR history from January 2015 through the audit window. Replay uses all eight numerical USD and eight EUR families with automatic magnitudes.
- Price: broker EURUSD H1, bridge generation 2. The fetched window contains 720 bars for 16 December–28 January, with surrounding bars retained for release reactions.
- Engines: `usd-context-memory-v6.2`, `eurusd-relative-context-v1`, relationship derivation v1. Roof display changes do not change scores.
- Exact user-saved exclusions and magnitude overrides were not captured. This is the current default-policy replay, not a certification of every screenshot pixel or the user's precise saved configuration.
- Dates/times below are **broker chart clock**, unless stated otherwise. Audit JSON encodes broker clock values in ISO strings ending in Z; these are not UTC publication timestamps. Calendar rows separately retain the actual UTC publication time.
- Raw snapshots, scripts and generated JSON are in ignored `storage/data/dec-jan-2026-*` and `storage/data/audit-candy-roofs-dec-jan.mjs`. The existing `frontend/scripts/pair-context/audit-release-sequence.mjs` generated the publication/reaction replay.

Checks: 137 USD/EUR contribution-sum assertions passed; no numerical releases were rejected for uncertain timing. Six publication replay checks passed in the release audit. Additional removal of later publications at 16 December, 19 January and 22 January preserved USD state, EUR state and all earlier Roof snapshots.

These checks remove later publications, not later edits to an already stored reading. The calendar is a current stored vintage; historical provider revision contamination remains unverified. Price observations are evaluation inputs only and never enter the scorers.

## What the two views show

| Interval / update | USD-only Candy | EUR-vs-USD Candy | Audit interpretation |
| --- | --- | --- | --- |
| 16 Dec, entering window | Long | Long | Both initially oppose the ensuing net decline |
| 17 Dec, 12:00 | Long | Changes to Short | New EUR inflation/wage data makes EUR weaker relative to USD |
| 7 Jan, 17:00 | Changes to Short | Remains Short | Completed ISM sector score replaces the incomplete Manufacturing-only assessment |
| 8 Jan Claims; 9 Jan NFP | Short | Short | USD support increases; the decline continues for part of this interval |
| 19 Jan reversal through late January | Short | Short | Both fail to represent the bullish price regime |

The default USD flip occurs on **7 January at 17:00 broker time**, which is 8 January at 00:00 Asia/Jakarta. That is consistent with the user's approximate January 8 boundary. It occurs at ISM Services, not at January 9 NFP.

All sampled directional Candy states in this window have Weak evidence. Green in USD-only mode still means **EURUSD Long inferred from USD weakness**, not USD strength.

Price measurements confirm the broad shape, while also showing why a single trend arrow should not be treated as every candle's behavior:

- From the 16 December opening H1 price to the last close before 19 January: about **−154 pips**. There are intervening rallies, including late December.
- From the 7 January USD flip to the last close before 19 January: about **−95 pips**. USD-only does align with this later portion of the decline.
- Local reversal-window low: **1.15768**, 19 January 00:00 broker candle.
- Subsequent window peak: **1.20833**, 27 January 22:00 broker candle, or 28 January 03:00 Asia/Jakarta. Low-to-high excursion: approximately **+506.5 pips**. This is an observed extreme-to-extreme move, not an executable trade return.
- Both Candy modes remain Short throughout that rise. From the 19 January opening price to the close immediately before broker 28 January, price gains approximately **459 pips**.

## Why EUR mode turns Short earlier

Relative mode computes `EUR total − USD total / 4`. Both legs contain retained, coverage-adjusted numerical scores; this is not a comparison of measured FX impacts.

At 17 December 12:00:

- USD raw total: **−0.066520**; normalized USD leg: approximately **−0.016630**.
- EUR total: **−0.055566**.
- Relative result: **−0.038936**, hence EURUSD Short.

EUR wages change from an older positive score to **−1.7**, making their contribution **−0.0425**. The new EUR inflation contribution is still positive **+0.035**, but wage weakness, PMI weakness and the existing unemployment reading outweigh it. EUR is interpreted as weaker than an already weak USD.

During January, negative EUR inflation, PMI and retained wage contributions keep the EUR leg negative. At 19 January 12:00, the final EUR inflation publication changes the relative score from approximately **−0.1560** to **−0.1952**: the model becomes more bearish during the emerging rally.

This is not a reversed color or subtraction sign. It is the declared economic interpretation producing a result that fails this price regime.

## What Roofs actually calculate

Roof labels do not all represent the same calculation, and they do not consume the Inspector's context-aware output as another input.

| Roof type | Direction source |
| --- | --- |
| ISM sectors | The existing ISM standalone Manufacturing/Services resolution |
| Labor + inflation priority | Accumulated USD context when that priority rule qualifies |
| Claims challenge older NFP | Accumulated USD context when the weekly labor rule qualifies |
| Fresh-news sequence, dashed and Experimental | Net latest replacement effects per family within seven days, qualifying through at least two agreeing economic domains |

Candy uses accumulated context, optionally compared against the EUR leg. Roofs use USD information in both modes. Changing Candy to EUR-vs-USD therefore leaves the Roofs unchanged.

This window produces **one ISM-sector snapshot and twelve fresh-news snapshots**, before Focused-mode suppression and chart overflow. Neither priority-rule type qualifies. Snapshots are overlapping updates, not thirteen independent discoveries or thirteen independent signals.

Representative activations:

| Available from, broker time | Roof | USD accumulated context at activation |
| --- | --- | --- |
| 18 Dec 15:30 | Retail + Claims + NFP +1 · Short | Long |
| 23 Dec 15:30 | Claims + CPI + GDP · Long | Long |
| 24 Dec 15:30 | Claims + CPI + GDP · Long | Long |
| 7 Jan 17:00 | ISM sectors · Short | Short |
| 9 Jan 15:30 | ISM + Claims + NFP · Short | Short |
| 15 Jan 15:30 | Retail + Claims + NFP +1 · Short | Short |
| 22 Jan 17:00 | Claims + GDP + PCE · Short | Short |

A label may include opposing families; their presence does not mean they all support its direction. On 22 January, Claims and PCE increase USD support, while GDP's replacement reduces it. The positive sum wins. The shortened label conceals those different roles until details are opened.

The bracket begins at earlier contributing publications, but the result is only available at its **filled activation dot**. Its span does not express a holding period or the duration of its direction. The final January 22 Roof does not continuously reassess subsequent candles.

## Specific interpretation weaknesses

### 1. Missing data is material, not a footnote

| Input | Usable component coverage | Consequence |
| --- | ---: | --- |
| 16 Dec NFP | 35% | Hiring pace, wage pace and revision unavailable; unemployment and hours determine the remaining score |
| 9 Jan NFP | 45% | Hiring/wage pace still unavailable; a reduced unemployment improvement, revision and hours supply the score |
| 18 Dec CPI | 20% | Only annual core confirmation is usable |
| 13 Jan CPI | 20% usable components, no directional result | Monthly history unavailable; usable annual change is zero |
| 18/24/31 Dec Claims | 60% | Continuing-claims trend lacks the required continuous weekly history |

The stored series have no usable October-reference payroll/wage observations for the required consecutive-month benchmarks. December CPI lacks the November-reference monthly readings, and October monthly history is also absent. Consequently, having January actual CPI numbers does not restore its three-month comparison.

Calendar date-range coverage is therefore not equivalent to complete scoring-component coverage. Within the dataset-only scope, this audit cannot establish whether missing observations reflect absent publications, incomplete broker data or an import issue. Filling them with inferred values would invent evidence.

At the 19 January reversal, aging-adjusted usable USD weight totals only about **37.1% of the nominal budget**. At 22 January it is about **39.6%**. Those figures combine aging and completeness; they are not probabilities. Nevertheless, the system still prints a directional color rather than an insufficient-context state.

### 2. Nearly balanced evidence still gets a direction

The 24 December Long Roof sums:

`Claims +0.0431264; CPI −0.0336; GDP −0.0099827 = −0.0004563`.

Its net is only **0.53% of gross opposing replacement effects**. A Long label is mathematically consistent but overstates the decisiveness of this near-cancellation. Weak shading alone does not communicate how close it is to changing sign. There is no meaningful neutral band.

### 3. Fresh news includes vote renewal

On 15 January, Claims' standalone total rises only **1.55 → 1.60**. Its fresh effect is **+0.0825**:

- **+0.0050** from the score improvement at the fixed 10% budget;
- **+0.0775** from replacing the prior vote after seven days of decay.

About **94%** of that fresh effect is renewal of older evidence. This follows the documented formula, but it is not 94% new improvement in the labor report. The experiment should distinguish economic score change, coverage change and memory renewal before being read as a reinforcing news combination.

### 4. The late rally cannot be solved by reducing Claims alone

At 22 January 17:00, USD total is **+0.321061**, including Claims **+0.230000**. Removing Claims entirely leaves **+0.091061**, still EURUSD Short.

Every remaining active USD family also has a positive score. CPI is unavailable. Any nonnegative reweighting that retains at least one of those positive inputs remains Short. At 19 January, removing Claims also leaves a positive total.

The missing bullish interpretation is therefore deeper than one excessive weight: either the available release signals need a defensible different contextual mapping, or the dataset does not contain the information needed to explain this move. This audit does not identify which economic cause drove the rally.

## Release reaction versus subsequent regime

Examples demonstrate that initial and later outcomes must remain separate:

| Update | Model interpretation | Release-containing H1 move | Next 4 trading bars | Next 24 trading bars |
| --- | --- | ---: | ---: | ---: |
| 7 Jan ISM Services | Short | −2.8 pips | −10.1 | −28.6 |
| 9 Jan NFP | Short | +3.8 | −8.2 | +39.9 |
| 19 Jan EUR inflation | Short | −0.6 | +7.5 | +101.7 |
| 22 Jan Claims + GDP, simultaneous | Short | +10.1 | +34.8 | +38.6 |
| 22 Jan PCE / new Roof activation | Short | +14.2 | +27.8 | +27.2 |

Baseline is the preceding H1 close. A half-hour release's containing candle includes pre-release minutes; this is not an isolated immediate reaction. January 9's 24 trading bars span 71.5 elapsed hours over the weekend. Subsequent bars can include other releases, and simultaneous releases cannot be assigned separate causal reactions. These observations are diagnostics, not an independent-sample accuracy or trading-profit estimate.

## Recommended next work

1. Preserve this window as a failed audit case before changing rules. Keep release reaction, subsequent trend and causal explanation separate.
2. Audit the origin of missing components. If the observations genuinely do not exist in the stored dataset, disclose insufficiency and avoid manufacturing consecutive-month values.
3. Research a neutral/insufficient state using coverage and cancellation, including exact tie behavior. Predeclare rules and evaluate additional untouched windows. Neutral would make weak outputs more honest; it would not explain or predict this rally.
4. Split fresh effects into score change, coverage change and renewal. Qualify combinations on the explicitly chosen effect and disclose each family's supporting/opposing role. This is a candidate model change requiring replay, not a cosmetic rename.
5. Make Roof type and USD-only scope explicit next to the result, especially beside EUR-vs-USD Candy. Distinguish snapshot activation from continuing accumulated context.
6. Test any proposed context-regime mapping against fixed horizons and unseen periods before changing pair directions. Do not reverse January's outputs merely because the observed price rose, and do not use candle direction as an input to the fundamental score.

The current outputs can summarize the declared numerical interpretation, but this audit does not validate them as dependable guidance for holding or exiting a trade. The January bullish regime remains unexplained within the tested dataset model.

## Official-source cross-check, 7 October 2026

The earlier findings above were dataset-only. Subsequent web verification clarifies the provenance issues without changing stored data or scoring.

- BLS confirms October household-survey observations were not collected. November unemployment therefore compares against September. However, the December 16 publication includes initial October **establishment** estimates: payroll change was −105,000, followed by November +64,000. These observations have different reference months but the same publication date. Missing standalone October rows in our representation must not be confused with nonexistent official payroll data. [November employment release](https://www.bls.gov/news.release/archives/empsit_12162025.htm).
- BLS published November CPI changes over September–November, a two-month interval, with ordinary October/November monthly changes unavailable. A two-month reading must not silently enter monthly calibration. [November CPI release](https://www.bls.gov/news.release/archives/cpi_12182025.htm).
- January 9's employment release revised November unemployment from 4.6% to 4.5%; December was 4.4%. Our replay uses the broker's unrevised Previous 4.6%, despite Revised Previous 4.5% being present. The code's supplied-Previous rule consequently measures a 0.2-point improvement instead of the revised 0.1-point monthly comparison. This is a baseline-vintage interpretation issue requiring explicit handling; correcting it alone does not establish a Long combined result. [December employment release, revision table A](https://www.bls.gov/news.release/archives/empsit_01092026.htm).
- The ECB's retrospective review of 18 December–4 February associates the euro's temporary dollar high with geopolitical tensions and trade uncertainty. This supports investigating influences beyond the numerical calendar. It does not attribute each January candle or quantify their share of the rally. The later report is audit evidence, never information available to a January historical score. [ECB Economic Bulletin 1/2026, financial markets discussion](https://www.ecb.europa.eu/pub/pdf/ecbu/eb202601.en.pdf).

Refinement priority is now **reference-period and vintage integrity first**, followed by explicit insufficient/mixed states and separation of economic replacement change from memory renewal. Evaluate standalone-only, current accumulated context and the revised candidate under the same predeclared price horizons and chronological held-out windows. Standalone is a comparison baseline, not an assumed winner. Official-source research does not authorize automatically adding external observations or geopolitical votes to the engine.
