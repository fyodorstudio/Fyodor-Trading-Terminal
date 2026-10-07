# Context v7 refinement audit

Implemented and replayed 7 October 2026. Candidate: USD context v7, EURUSD relative v2, relationship derivation v2, NFP v2.1.

## Finding and outcome

This pass corrects unsupported directional interpretation under incomplete inputs, near cancellation and renewed old evidence. It does **not** establish a model explanation of the January 2026 rally, or prove that standalone or combined outputs predict returns. No score was inverted or fitted to the rally. Prices are used only in this report.

The default December 16–January 28 replay now withholds direction at every evaluable USD publication boundary: 14 of 14 observations in both combined modes. The 12 old experimental fresh-news Roofs no longer qualify; the one ISM-sector Roof remains a standalone sector interpretation. This is an integrity improvement through abstention, not 14 correct predictions.

## Implementation

- NFP v2.1 requires an observed immediately preceding reference month for unemployment, participation, hours and supporting annual wages/broader unemployment. Supplied valid revisions replace stale Previous; invalid revisions and gaps remain unavailable. The nearest hiring/wage benchmark month uses its known revision only when all three required months already exist.
- Combined context requires at least 60% usable configured components and at least 60% for each enabled primary USD CPI/NFP. Each EUR/USD leg is checked. Age retention remains separate. Genuine zero is usable; absence remains missing.
- Unchanged/cancelling or near-cancelling net below one third of gross contributions yields Mixed evidence rather than a priority-driven Long/Short. Incomplete context yields Insufficient context. These thresholds are declared prototype safeguards, not tuned price probabilities.
- Candy uses green/red for directional output, amber for Mixed and gray for Insufficient. Shared labels preserve this decision in Raycaster, Inspector, Roof details/overflow and Notebook recording.
- Fresh v2 votes only comparable economic score changes. Matching component IDs/weights, assessment stage and coverage (at least 60% on both) are required. Renewal, changed coverage and availability/non-comparable residual are separately decomposed. GDP new-quarter vs revision populations are distinguished. Opposing changes remain included.
- ISM Roofs retain standalone sector resolution; labor Roofs use quality-gated accumulated USD context; dashed fresh Roofs show changes. All Roofs stay USD-only in both Candy modes. Participating standalone interpretations remain visible.
- Budgets, expiry, pan anchors, dot routing, input persistence, current-only menus and worker/binary-lookup architecture remain in place. No raw dataset edit or pointer-triggered scoring was introduced.

## Release facts checked against official publications

BLS confirms that [December 16 employment](https://www.bls.gov/news.release/archives/empsit_12162025.htm) lacked October household observations; October establishment payrolls were newly published with November. The [January 9 employment report](https://www.bls.gov/news.release/archives/empsit_01092026.htm) compares December unemployment 4.4% with revised November 4.5%, rather than old 4.6%. The [November CPI report](https://www.bls.gov/news.release/archives/cpi_12182025.htm) lacks normal October/November monthly observations. These establish numerical/reference-period facts; they do not establish why EURUSD moved.

In the actual stored replay, December NFP has no calibrated employment component after enforcing the gap, so its score is null. January NFP has total 0 with 45% usable components; its raw tie policy remains standalone, but the combined primary gate withholds direction. CPI also has only 20% usable components during the sampled window.

Jan15 Claims illustrates why replacement needed decomposition: total replacement effect +0.0825 = comparable economic change +0.0050 + memory renewal +0.0775. About 94% was renewal. This renewal is still visible in advanced audit details but never votes as a new economic improvement.

## Replay protocol and limits

- Broker: Elev8-Demo2, stored calendar revision 78619. All eight numerical USD and eight EUR families, automatic magnitudes, no saved user exclusions. This reproduces defaults rather than certifying every screenshot pixel.
- Frozen baseline was captured before production edits. Current raw provider vintage is used on both sides; original publication-vintage integrity is not certified.
- 5664 broker EURUSD H1 bars from 2025-03-03T00:00:00.000Z through 2026-01-28T23:00:00.000Z. ISO Z notation in this report represents broker chart-clock values, **not UTC publication timestamps**. The available price pages do not supply every scheduled publication in each comparison block.
- Blocks and 1/4/24 trading-bar horizons were declared before running the candidate replay. Earlier historical windows have been discussed, so these are chronological comparisons, not untouched prospective validation.
- One observation per atomic USD publication timestamp. Standalone uses the latest updating family chosen by the existing timeline; it is neither an equal-weight ensemble nor a test of every simultaneous series separately. EUR-only boundaries and continuous holding returns are outside these event-response cohorts.
- Return starts at the first complete H1 bar open at or after publication and ends at the selected last bar close. A missing first bar more than an hour away or internal history gap over four days is excluded. Trading-bar windows can span weekends, later news and intraday reversals; elapsed hours are retained in JSON.
- Alignment excludes flat outcomes and counts only directional observations. Withheld observations are disclosed separately and are never called correct. Signed pips are directional sign times observed return, not strategy P&L. No spread, slippage, stops or entry rule is modeled. Overlapping horizons prevent independent-significance claims.

## Comparative results

Cells show aligned / directional observations; mean signed pips is in parentheses. Coverage is directional / evaluable for the first-hour cohort. A dash means no directional output, not a successful forecast. The JSON retains each horizon’s exact counts, abstentions and medians.

### Mar-Jun 2025 comparison

| Output | Directional coverage (1 bar) | 1 bar alignment (mean pips) | 4 bars | 24 bars |
| --- | --- | --- | --- | --- |
| USD v6.2 baseline | 41/41 | 22/41 (+2.51) | 20/41 (-4.32) | 19/41 (+3.95) |
| USD v7 | 35/41 | 20/35 (+3.54) | 19/35 (-2.77) | 18/35 (+10.65) |
| Relative v1 baseline | 41/41 | 19/41 (-4.36) | 19/41 (-1.88) | 20/41 (+8.63) |
| Relative v2 | 10/41 | 6/10 (+4.80) | 5/10 (-5.06) | 5/10 (+9.19) |
| Latest updating standalone (v2.1 NFP) | 41/41 | 25/41 (+4.20) | 21/41 (-1.99) | 22/41 (+20.09) |

### Jul-Oct 2025 comparison

| Output | Directional coverage (1 bar) | 1 bar alignment (mean pips) | 4 bars | 24 bars |
| --- | --- | --- | --- | --- |
| USD v6.2 baseline | 32/32 | 16/32 (+3.03) | 16/32 (+2.88) | 19/32 (-0.58) |
| USD v7 | 15/32 | 8/15 (+0.88) | 9/15 (+1.27) | 8/15 (-19.71) |
| Relative v1 baseline | 32/32 | 17/32 (+2.65) | 19/32 (+8.15) | 18/32 (+0.61) |
| Relative v2 | 2/32 | 2/2 (+2.25) | 1/2 (+0.05) | 1/2 (-12.45) |
| Latest updating standalone (v2.1 NFP) | 32/32 | 17/32 (+2.30) | 13/32 (-5.97) | 20/32 (+1.12) |

### Dec16-Jan28 development audit

| Output | Directional coverage (1 bar) | 1 bar alignment (mean pips) | 4 bars | 24 bars |
| --- | --- | --- | --- | --- |
| USD v6.2 baseline | 14/14 | 6/14 (-0.07) | 6/14 (-1.76) | 7/14 (-3.58) |
| USD v7 | 0/14 | — (withheld) | — (withheld) | — (withheld) |
| Relative v1 baseline | 14/14 | 9/14 (+1.63) | 9/14 (-1.16) | 6/14 (-2.86) |
| Relative v2 | 0/14 | — (withheld) | — (withheld) | — (withheld) |
| Latest updating standalone (v2.1 NFP) | 13/14 | 6/13 (-2.63) | 8/13 (+0.06) | 5/13 (-1.11) |

The candidate is not consistently better on price-response metrics. For example, July–October v7 USD has weaker mean signed 24-bar returns than its baseline; relative v2 gives only two directional observations, too few to assess reliability. December–January standalone alignment is 8/13 over four bars but 5/13 over 24 bars. This does not justify replacing all Roofs with standalone-only outputs or claiming a trade edge.

## Roof counts

| Block | Fresh v1 → v2 | ISM sector | Labor priority | Weekly labor |
| --- | --- | --- | --- | --- |
| Mar-Jun 2025 comparison | 37 → 22 | 4 → 4 | 0 → 0 | 0 → 0 |
| Jul-Oct 2025 comparison | 27 → 22 | 3 → 3 | 5 → 5 | 0 → 0 |
| Dec16-Jan28 development audit | 12 → 0 | 1 → 1 | 0 → 0 | 0 → 0 |

## Sampled historical states

| Broker clock | v6.2 USD | v7 USD / relative v2 | Usable configured USD components |
| --- | --- | --- | --- |
| 2025-12-16 18:00 | EURUSD Long | Insufficient context / Insufficient context | 32.0% |
| 2025-12-24 15:30 | EURUSD Long | Insufficient context / Insufficient context | 42.7% |
| 2026-01-09 15:30 | EURUSD Short | Insufficient context / Insufficient context | 58.2% |
| 2026-01-15 15:30 | EURUSD Short | Insufficient context / Insufficient context | 58.9% |
| 2026-01-19 12:00 | EURUSD Short | Insufficient context / Insufficient context | 58.9% |
| 2026-01-22 15:30 | EURUSD Short | Insufficient context / Insufficient context | 48.9% |
| 2026-01-28 00:00 | EURUSD Short | Insufficient context / Insufficient context | 52.9% |

Raw retained USD pressure remains positive during January’s rally. Withholding an unsupported direction does not turn that score into a bullish explanation. Missing expectations, policy text, positioning and outside shocks remain possible omissions; no candle-by-candle cause was established. Manual outside-event notes remain annotations without a scoring vote.

## Integrity and verification

- 1,254 non-NFP standalone publication scores/directions/grades/coverage/traits matched the frozen baseline.
- 7,787 EUR raw snapshots matched in members, total and retained coverage; relative gating adds usable configured coverage without changing EUR standalone arithmetic.
- 54 historical NFP publication totals or coverage changed under the new reference/revision rules. This includes calibration effects, not only January's release.
- 9 checks preserved earlier USD states, EUR states and Roof snapshots after removing later publications. This does not remove later edits to already stored observations.
- Targeted tests cover revised baseline/gaps/invalid revisions/future data; quality gates/zero/subset budgets/pair orientation; renewal/components/coverage/atomicity/expiry/non-stacking/fresh cancellation; UI abstention and retained performance behavior.
- All 50 frontend suites passed in the final sequential run; TypeScript/production build, lint and git diff whitespace checks passed. Visual audit is deliberately left to the user.

## Reproduce and next audit

From the repository root, with the locally captured ignored files:

```powershell
node frontend/scripts/usd-context/audit-context-refinement.mjs storage/data/context-v7-baseline.json storage/data/context-v7-price.json storage/data/context-v7-evaluation.json
```

The script reads frozen inputs and broker prices, calculates the candidate, asserts parity/chronology, and writes only the requested audit JSON. It does not contact the broker, change preferences or modify the dataset. Original JSON and local inventory remain in ignored storage/data; this reviewed report is tracked.

Begin manual audit with the December–January incomplete-data window and a complete period in an earlier block. Verify output/reason, Roof type/scope, exact activation and 1/4/24-candle outcomes separately. Check pan/scroll and saved-input consistency. The checklist is in [manual edit.md](../manual%20edit.md), and [trading workflow.md](../trading%20workflow.md) explains the revised meanings.
