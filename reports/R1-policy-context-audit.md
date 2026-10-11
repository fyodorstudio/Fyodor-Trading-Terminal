# Fed policy context and fractional Jobs — 11 October 2026

Read-only replay: Elev8-Demo2, 8633 calendar rows, 7512 clocks, 63 hold comparisons. 73 hold parity/future-removal checks; 15024 currency snapshots bounded at ±100. Timeline parts conserve the combined change. Inspector and Scatter use the same historical comparison; production timeline, history and pair workers match pure output, including both named decisions.

| Jakarta decision date | Hold interpretation | Current policy pressure | Prior pressure | Overall USD | Overall change at hold | Nearby-policy range | Direction sensitive |
|---|---:|---:|---:|---:|---:|---:|---|
| 2026-01-29 | 7.16 (insufficient) | 20.72 | 6.39 | 9.61 | 5.00 | 5.33 to 7.55 | No |
| 2026-03-19 | -3.07 (insufficient) | 14.58 | 20.72 | -8.44 | 0.00 | -3.46 to -1.92 | No |
| 2026-04-30 | 6.45 (strengthening) | 27.48 | 14.58 | 13.65 | 0.00 | 5.53 to 7.28 | No |
| 2026-06-18 | 6.33 (strengthening) | 40.14 | 27.48 | 8.89 | 0.00 | 5.46 to 6.84 | No |
| 2026-07-30 | -13.33 (weakening) | 13.49 | 40.14 | -10.16 | 0.00 | -15.27 to -10.96 | No |

June and July reproduce the requested distinction under the explicit CPI overrides below. These are historical calibration scenarios, not a read of the user's browser settings. No dates or price outcomes enter the formula. A hold adds no fresh actual-rate action; its standalone interpretation compares economic pressure across decision dates. Overall uses retained current pressure, so it need not jump at a hold. Early missing comparison history remains uncertain.

CPI core monthly/annual: 0.1/0.2/0.4; headline monthly: 0.2/0.4/0.6; headline annual: 0.1/0.3/0.6. All other native bands use prior-history automatic calibration. Default automatic June: hold 4.97, overall 7.51; July: hold -9.87, overall -7.62.

Stress checks cover all 63 stored holds: 34 retain insufficient comparison evidence; 1 change direction under the tested nearby policies. They vary origin category weights (30/30/20/20, 35/30/15/20, 25/35/20/20) and policy-input boundaries ±10%, with the PCE target-gap scale held fixed. They are limited sensitivity checks, not proof of optimal parameters. Runtime combined sensitivity also tests the routed share at 20%/30%, existing family shares, and freshness.

Sensitive historical cases: 2024-05-02: 6.11 (insufficient).

Pure timeline construction: 4276 ms (informational; not browser responsiveness). Cursor lookup performs no scoring; deterministic work-count coverage is in test_r1_raycaster.mjs. Forecasts, projections and speeches remain excluded. Stored data includes retrospectively captured/revised values; replay does not establish original as-released availability. Price alignment is separate validation, not a scoring input.

## Fixed-window price review

5000 EURUSD H1 bars read from the existing MT5 bridge. Each window starts at the release candle's open and ends at the last close of 1/4/24 consecutive H1 bars. The stored calendar's trade-server timestamp matches the OHLC timestamp directly; the offsets below come from stored timing metadata. These windows include the press conference and any intervening news; they do not isolate the hold's causal effect. This is retrospective review of the available 2026 sample, not an independent out-of-sample validation.

| Jakarta date | Broker offset from UTC | EURUSD 1h pips | 4h pips | 24h pips |
|---|---:|---:|---:|---:|
| 2026-01-29 | 3.00h | 5.10 | 40.40 | 10.90 |
| 2026-03-19 | 3.00h | -7.70 | -20.30 | 106.60 |
| 2026-04-30 | 3.00h | -12.70 | -14.90 | 40.10 |
| 2026-06-18 | 3.00h | -54.00 | -90.10 | -130.40 |
| 2026-07-30 | 3.00h | 58.90 | 68.00 | 136.50 |

Canonical formulas, fixed level scales, source rationale and review instructions: [design](../docs/scoring%20system%20overhaul.md#fed-policy-context-and-jobs--11-october-2026).
Reproduce: pnpm --dir frontend exec node scripts/audit-r1-policy-context.mjs. Build first. Visual review stays with the user.

Terminal verification: all 73 frontend suites, including assembled-terminal and deterministic hover work counts; lint and production build pass. The existing main-bundle size warning remains. Mounted Jobs Scatter preview stays local and Apply reaches Inspector; hold presentation and both audit baskets are tested without browser automation. Price cache is optional: save the existing bridge's GET /api/v1/ohlc?symbol=EURUSD&timeframe=H1&count=5000 response to storage/data/r1-policy-price-audit.json before replaying its price section.
