# Fyodor: durable context

Local React/Vite manual-trading terminal with a FastAPI/MT5 bridge. FMS is the main objective: research all 28 Major Forex Extended pairs for immutable economic-event recipes with positive chronological historical expectancy, register supported recipes, inspect historical arrows, and monitor new releases. No automatic orders or guaranteed edge.

## Vocabulary and invariants

- **Recipe/setup/pattern:** exact pair, event/package membership, scoring, direction treatment, optional cohort, and fixed execution contract. Registration is explicit; runtime never promotes research automatically.
- **Evidence direction:** economic score. **Trade direction:** evidence after base/quote orientation and continuation/contrarian treatment. Do not substitute one for the other.
- **Surprise:** Actual versus Forecast. **Momentum:** Actual versus Previous. Numeric differences and policy-filtered directional points are different; Forecast Guard may exclude a comparison. Preserve missing values and units.
- **Live captured:** complete immutable first-seen package/decision before eligible entry. **Recovered offline:** reconstructed history, separate from prospective statistics. A matching direction does not establish entry eligibility.
- **Historical replay:** contract active at event time. Successors receive new activation boundaries; never rewrite old arrows/results.
- Entry normally means the first strictly later H4 open; reviewed successors may use H1. A release-containing candle open is not a post-information entry. H1 successors retain the parent final H4 expiry boundary.
- ATR is completed pre-entry H4 Wilder ATR(14) unless the contract explicitly differs. No eventual candle values, future pivots, revised releases, or retrospective receipt timestamps in decisions.
- Results are gross. Preserve gaps, missing values, ambiguous SL/TP ordering, and unresolved states. MFE/MAE are excursions, not captured returns. Reused holdouts are not fresh validation; one release across pairs is shared evidence.
- The intended pilot is manually chosen 0.01 lots; monetary risk still varies by pair/stop. No autonomous real-account access.

## Daily workflow and ownership

Charts left panel has four windows: **Trade** owns Next/Current/Recent; **Journal** owns longer performance records; **Setups** owns registered benchmarks plus lazy Research/Knowledge disclosures; **Past Result** owns the selected arrow audit. Trade view/disclosure/filter/search/scroll state and Setups disclosure state are session-persisted. Trade rows with a recorded signal can switch to the owning pair/entry timeframe, reveal that setup, focus its activation arrow, and open Past Result.

Current includes open/pending trades, eligible cases awaiting entry geometry, and releases awaiting evaluation across midnight. Recent holds closed trades and completed no-trade/audit decisions immediately. Trade Next/Current/Recent show all available rows without a row cap; Next includes all loaded future occurrences per setup. A scheduled release awaiting assessment must remain visible. Simulated open status is not a broker position. Entry markers are candle annotations, not entry-price coordinates.

- `Main/src/app/tabs/primary/ChartsTab.tsx`: chart state, selected-pair requests, global FMS monitoring.
- `Main/src/app/components/ChartViewport.tsx`: dock selection, layout, error boundary.
- `Main/src/app/lib/bridge.ts`: HTTP client and preload/in-flight caches.
- `Main/mt5-bridge/server.py`: endpoints, registrations, lifecycle and MT5 orchestration.
- `Main/mt5-bridge/macro_signal.py`: scoring, candidates, frozen execution/evaluation.
- `Main/mt5-bridge/research_store.py`: SQLite, calendar/candles, first-seen ledger, runs and metadata. Default DB: `%LOCALAPPDATA%/Fyodor Trading Terminal/fyodor-research.sqlite3`.
- `Main/src/app/config/fxPairs.ts`: canonical 28-pair universe. Registry count is dynamic; inspect code/data rather than old README counts.
- Registered research JSON and immutable experiment IDs/fingerprints are evidence sources. Code-owned approval maps decide activation. FMS Knowledge is a richer reference, not another source of runtime contracts.
- Setup projections expose one coherent `historicalEvidence` cohort. Chronological-holdout setups are re-projected from the linked immutable selected-contract audit even when a durable chart-response cache is reused. Exact counts may be shown only when that source records them; total gross R is exact mean times exact evaluable N, never a reconstruction from rounded rates.

Flow: MT5 EA uploads calendar/cycle records ? immutable observations ? exact package scoring ? oriented trade direction ? fixed entry/SL/TP/expiry evaluation ? persisted market snapshots ? merged global registry ? docks.

## Recurring traps

- Global and per-market snapshots persist independently: global reads must preserve newer market lifecycles. Frontend preload caches are not freshness proof. Monitor releases independently of chart selection; keep failures visible.
- Compact markers may omit events/audits/labels; null entry/activation is valid pending data. Never infer no trade from a failed request or crash on optional fields.
- Fetch one selected arrow's detail, not every pattern's history. Deduplicate in-flight requests; avoid forced all-market rebuild loops.
- Confirmed H4 zones are descriptive. Nearest-zone capping and sequential multi-zone exits did not produce supported successors in their frozen campaigns; do not rerun unchanged families. D1/weekly structure remains a distinct deferred hypothesis.
- Cache H4 before research baselines. Use M1 only for justified finalist ordering/timing work. Resume by fingerprint.

Navigation: [task-to-file map](docs/NAVIGATION.md). Current mission and verification: [Checklist](docs/Development%20Logs/Checklist.md).
