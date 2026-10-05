# Inspector scoring

Signed scores and pair directions live here, separately from the descriptive
Higher/Lower reading labels in `../grading` and the histogram/settings/history
machinery in `../magnitude`.

```text
scoring/
  scoring-contracts.ts        View props and explicit pair/family bindings
  scoring-registry.ts         Supported symbols, country, currency and family
  InspectorScoringView.tsx    Scoring-only, scrollable presentation
  shared/
    core/signed-magnitude-score.ts
    ui/SignedMagnitudeMatrix.tsx
  PAIR/EURUSD/USD/
    NFP/
      assessment/nfp-magnitude-score.ts
      ui/NfpMagnitudeScoreTables.tsx
    CPI/
      assessment/cpi-magnitude-score.ts
      assessment/cpi-index-magnitude-score.ts
      ui/CpiMagnitudeScoreTables.tsx
      ui/CpiMagnitudeScoreTable.tsx
      ui/CpiIndexMagnitudeTable.tsx
```

USD is EURUSD's quote currency. Assessment modules own the family's selected
series, signs, coefficients, cancellation priority and completeness requirements.
UI modules compose shared matrices. Moving these files does not change existing
NFP/CPI score versions, magnitude persistence keys, boundaries or dataset admission.

The Inspector view dropdown contains Table only, Scoring system and Scatter Plot,
with Scoring system v2 additionally available for US/USD CPI on EURUSD.
Scatter Plot opens the selected release without changing the saved Inspector view.
Table only is the default Inspector view. Scoring system replaces the readings
table with the registered family's scores; CPI retains separate index/rate
matrices and NFP retains separate supporting/primary matrices. The selected view
is saved and travels in workspace exports. Unsupported families fall back to the
table, with the Scoring system option disabled, without discarding that preference.

To add an agreed scoring policy, create `PAIR/<pair>/<currency>/<family>` with
`assessment` and `ui` modules, then register its explicit symbol matcher, country,
currency and Inspector family ID in `scoring-registry.ts`. Keep the symbol matcher
specific to that pair even when Inspector's broader pair support expands. Register
its magnitude family separately if needed; a magnitude catalog alone never invents
a directional score. Document the policy and add regression cases for missing,
duplicate and undefined readings, native units, signs and cancellation.

Existing regression coverage lives in `frontend/tests/inspector/nfp` and
`frontend/tests/inspector/cpi`; navigation and workspace tests cover view selection,
refresh persistence and unsupported families. Shared code should stay free of
family-specific event IDs and pair direction rules.

## USD CPI v2 prototype

`PAIR/EURUSD/USD/CPI/assessment/cpi-score-v2.ts` is an independent scorer. The
original CPI signed A−P scorer, index display and manual magnitude settings stay
unchanged. V2 is selectable, persists across refresh/workspace transfer, and falls
back to Table only on other families without dropping the saved preference.
`ui/CpiScoreV2.tsx` displays one pair bias and a short explanation, followed by
components and calibration details in a flat, vertically scrolling layout. It queries only the required USD CPI series
when mounted, independently of whether v1 magnitudes were configured.

Positive scores indicate USD pressure / EURUSD Short; negative scores indicate
EURUSD Long. For reference month t, the four signals (in percentage points) are:

| Signal | Formula | Weight |
| --- | --- | --- |
| Core pressure | Mean actual Core m/m for t, t−1, t−2 minus 0.20% | 35% |
| Core trend | Mean actual Core m/m for t, t−1, t−2 minus mean for t−1, t−2, t−3 | 35% |
| Annual confirmation | Actual Core y/y minus supplied Previous | 20% |
| Headline context | Actual Headline m/m at t minus mean actual Headline m/m for t−1, t−2, t−3 | 10% |

The 0.20% monthly reference and weights are experimental policy choices, not
empirically validated estimates. The monthly reference is not the Fed's 2% PCE
target. The core windows overlap; pressure and trend are related signals, not
independent statistical votes. No forecast, revised-previous field, price outcome,
headline annual rate or index-level row votes in v2. Actual historical readings
are used for rolling windows, rather than chaining supplied Previous values.

Each signal gets a signed 0–4 magnitude from its **own derived history**. At least
24 earlier usable observations are required per component. Nonzero absolute
historical signals are sorted; nearest-rank percentiles 1/3, 2/3 and 0.90 define
Small/Medium/Large upper boundaries, with Extreme above the last. Zero contributes
zero. Percentile ties are retained (some buckets may be empty). These thresholds
are independent of v1's manual A−P boundaries and recalculated using only earlier
publications since January 2015. Floating signal arithmetic is rounded to 12
decimal places to suppress subtraction noise; weighted sums use integer percent
units before division by 100, preserving exact cancellation.

The total is the sum of signed magnitude × weight / 100. Exact cancellation uses
the first nonzero signal in table order: pressure, trend, annual, headline. There
is no Mixed output. Missing/ambiguous data, insufficient history and all-zero
evidence remain Uncomputed rather than fabricating a direction or importing a
prior NFP bias. Calendar coverage gaps are disclosed even if enough valid samples
remain for scoring.

The selected release needs a verified publication time and exactly one observed,
finite US percentage reading for each required series (005, 006, 008), sharing a
reference month before publication. Rolling windows require consecutive months.
For an earlier reference month, use its latest publication **strictly before** the
release being assessed; duplicates at that timestamp invalidate that month. The
selected and later publications never enter calibration. Inventory copies are
deduplicated by value identity. Unavailable/retired rows and uncertain publication
times are excluded. Storage can retain provider revisions in older rows; date
filtering cannot reconstruct original vintages that have been overwritten. V2 is
therefore a historical-reading prototype, not a guaranteed point-in-time backtest.

`tests/inspector/cpi/test_cpi_score_v2.mjs` reconstructs the discussed August case
with synthetic earlier calibration data: the original scorer is +3 / Short and
v2 is Long. It also verifies strong/persistently high inflation can remain Short,
publication cutoffs, missing months, source/unit/duplicate gates, no forecast
dependence, presentation defaults, scoped fetching, navigation and persistence.
This regression establishes implementation behavior; price-prediction accuracy
still needs evaluation across unseen releases and a defined holding period.
