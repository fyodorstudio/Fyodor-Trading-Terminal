# Current mission and handoff

Updated 2026-09-09. P0–P7, owner follow-up fixes, and the Past Result overhaul are complete; owner visual verification remains. Rules: [AGENTS](../../AGENTS.md). Durable context: [CONTEXT](../../CONTEXT.md). Unknown owner: [navigation](../NAVIGATION.md).

## Non-negotiable product behavior

- Local manual-trading support only. Fyodor sends no orders and makes no profitability promise.
- Trusted inputs remain MT5 OHLCV and the broker economic calendar. Research stays gross; there is no new cost model or external feed.
- Immutable first-seen provenance, frozen contracts, no-lookahead semantics, unresolved outcomes, release monitoring, and all saved records remain intact.
- No setup was promoted automatically. Real-account access remains outside scope.
- Target layout is 1440x900 at 100% Chrome zoom. Browser automation was not used; the owner must perform the visual checks below.

## 2026-09-09 Past Result overhaul

- Replaced the dense eight-cell opening grid with a result-led hierarchy: direction/outcome and gross R, lifecycle explanation, exact Entry/SL/TP, compact frozen-contract facts, then the arrow-position disclosure.
- Moved `Initial price reaction` directly below the result summary and made it always visible. It now shows one-H4 reaction, six-H4 direction, MFE, MAE, and the final frozen result together; missing one-H4 data is an explicit non-inferred status rather than an absent section.
- The screenshot case `eurusd-ism-manufacturing-employment-package:1788282000` does have immutable reaction data. Its first-H4 response is -0.201R (price opposed the short arrow), six-H4/final response is -0.043R, MFE is +0.594R, and MAE is -0.713R. The old UI had buried this below target/context content.
- Removed the standalone unavailable Entry timing disclosure. Entry timing is now a normal, always-expanded chronology section only for arrows with an immutable first-seen MT5 quote; historical arrows without one show no stray dropdown and still retain the honest H4 contract.
- Supporting release, target, structure, context, timeline, path, and provenance evidence remains available below the decision-first summary without changing any frozen data or interpretation.
- Validation: `pnpm run typecheck` passed; the existing chart test file remains 29/29 and now checks that Initial price reaction precedes Why the arrow appeared and that unavailable entry timing renders no disclosure.

## 2026-09-09 owner follow-up fixes

- Fixed the confirmed lazy-Setups crash: each disclosure now snapshots `event.currentTarget.open` synchronously before a React state updater can outlive the synthetic event.
- Added `Go to arrow` on Current/Recent signal rows and `Go to latest arrow` on Next setup rows when a recorded signal exists. It enables the FMS/history layers, unhides that setup, switches to the exact pair and H1/H4 entry timeframe, focuses the activation candle, selects that signal, and opens Past Result.
- Fixed the narrow clickable rectangle below Choose setups. A broad input selector was forcing the search field to checkbox dimensions; sizing now applies only to checkboxes.
- Anchored `Hide no trade` in a two-column grid with tabular count numerals, so changes in `x displayed / x total` no longer shift the control.
- Corrected chronological-holdout evidence projection to read the linked immutable selected contract even when serving an older durable chart-response cache. `FMS-EURUSD-H4-E293` now reports the actual holdout: evaluable 11, TP 6 (54.5%), SL 2 (18.2%), expired 3, ambiguous 0, unevaluable 0, average +0.581R, total +6.40R gross.
- Rate-only reviewed cohorts now say `exact count not stored` instead of implying a failed count lookup. Expanded evidence includes definitions for expired, ambiguous, and unevaluable, and lists stored ambiguous case IDs/times when available.

## Implemented P0–P7

### P0 — Trade continuity

- Trade view state is lifted into `ChartViewport` and session-persisted: Next/Current/Recent subtab, expanded schedule/activity row, setup search, no-trade filter, and per-view scroll anchor/offset.
- Opening Past Result remembers the prior dock destination. Closing it returns to that destination; Trade restores its saved disclosure and scroll state.
- Stable row keys anchor restoration without permanently mounting the Trade body.

### P1 — Compact Trade UI

- Removed the redundant Trade header and compacted tabs, table headers, dates, and collapsed rows without reducing primary body copy below the existing readable range.
- Collapsed rows no longer repeat execution, freshness, or source prose; those facts remain in expanded detail.
- Recent includes a default-off `Hide no trade` filter with displayed/total counts.
- Choose setups has case-insensitive search across friendly label, raw label, setup ID, and pair, plus filtered select/clear behavior.
- Placeholder separators were replaced with labeled separators; loading ellipses use the intended character.

### P2 — Coherent historical evidence

- The bridge emits one `historicalEvidence` source per setup by explicit priority: reviewed H1 entry, reviewed execution, chronological holdout, then pooled benchmark.
- Expanded Trade rows show the cohort/scope/source ID, evaluable N, exact TP/SL/expiry/break-even/ambiguous/unevaluable counts when actually recorded, average gross R, and total gross R.
- Unknown counts stay unknown. Total gross R is labeled as the exact mean multiplied by exact evaluable N; rounded rates are never reverse-engineered into counts.

### P3 — Selected-arrow detail

- Detail lookup now includes `recoveredSignals`, fixing the confirmed 404 for `AUDUSD|audusd-us-payroll-package|1788535800`.
- Cache identity includes model hash, mode, symbol, source version, pattern, event, entry timeframe, execution, status, and an evolving timestamp only for unresolved signals. Terminal detail is cached; current/replay results cannot collide.
- Concurrent identical frontend requests are deduplicated, stale selection responses remain canceled/key-scoped, requests have a 90-second timeout, and errors expose `Retry detail`.
- The exact saved AUDUSD recovered result returned entry `0.71926`, target `0.7218418039985335`, `target_hit`, `+1R`, and eight ladder rows. Measured local calls were 0.1236s cold and 0.0010s cached.
- The saved USDJPY replay case with incomplete historical coverage remains unresolved. It was not backfilled because this session prohibited MT5/account access; no outcome was inferred or rewritten.

### P4 — Four-window dock and lazy Setups workspace

- Dock buttons are now exactly `Trade`, `Journal`, `Setups`, and `Past Result`.
- Setups owns one collapsed `Registered setup benchmarks` workspace with collapsed `Benchmarks`, `Research / reviews`, and `Knowledge` subsections.
- Heavy subsection bodies mount only after first opening. Disclosure/visited state is session-persisted; embedded children suppress duplicate headers and footers.

### P5 — Arrow versus entry semantics

- Existing activation mapping was retained after its H4/H1/M15/D1 focused check passed.
- Marker labels identify the entry timeframe and direction. Past Result now states that the arrow is anchored to the activation candle, its vertical placement is visual, and the displayed Entry value is the exact frozen price.

### P6 — One bounded research campaign

- Consulted the exhaustion ledger first. D1/weekly structure was already complete, prospective first-seen evidence requires future chronology, and M1 remains coverage-limited.
- Ran one non-duplicative family: entry-known H4 state on high-sample unregistered packages.
- Frozen scope: three cells (`EURCAD` business sentiment, `AUDJPY` JPY CPI package, `GBPCHF` retail headline) and four variants per cell (compressed range, expanded range, direction-aligned trend, direction-opposed trend), for exactly 12 declared/completed variants.
- The protocol reused immutable Stage-A gross executions, used past-only completed H4 state, applied chronological development/validation/final partitions with boundary embargoes, and allowed no registration.
- Result: `no_later_survivor`; 0 survivors and 0 registrations. Manifest `5b984c6dbbe9615c4292dd5072a8c52721048f97bb0abe80e6dd77c8e3f9052b`; result `febc32bfb8cc3700d48960401791a6fafe752554fd6aeb015c872423d774fb94`.
- Durable outputs: `docs/Development Logs/artifacts/fms-entry-state-2026-09-08/{manifest,result}.json`, `Main/src/app/lib/fmsEntryStateSummary.json`, and exhaustion ledger `641b015b66d103e5d1df19dfa19215aa3bf8f5fbfad3c3bbb218a4392378caa5`.
- Knowledge now records the negative result and the next-search map excludes repeating these exact 12 variants.

## P7 validation

- `pnpm run typecheck` — passed.
- `pnpm exec vitest run src/app/tests/chartsTab.test.ts` — 29 passed.
- Scoped bridge regression set — 7 passed, covering snapshot preservation, chart projection, coherent evidence, recovered-signal detail/cache reuse, deterministic management ambiguity, target-path separation, and observed-quote provenance.
- Full `tests/test_macro_signal_api.py` diagnostic — 22 passed, 5 failed. The failures are unrelated existing expectation drift in prospective context ID matching, context candidate count, context artifact-drift behavior, forward supportive status, and H1 successor activation. They were not changed as part of P0–P7.
- Campaign script compiled, frozen manifest validated before execution, and all 12 declared variants completed.
- Follow-up validation: `pnpm run typecheck` passed; the existing chart test file remained 29/29; the focused immutable-evidence bridge regression passed; and the saved EURUSD chart-response path returned the corrected E293 values above without a research rerun.

## Owner manual visual checklist

At 1440x900 and 100% Chrome zoom:

- In Trade, open a row, set search/filter, scroll partway, click a chart arrow, then close Past Result. Confirm the same Trade subtab, row, filter/search, and scroll position return.
- Confirm Trade rows and inline dates are compact, readable, and free of overlapping/clipped controls or whole-page horizontal scroll.
- Confirm `Hide no trade` is initially unchecked and filters only no-trade rows; Choose setups search and filtered select/clear work.
- Toggle `Hide no trade` several times and confirm the checkbox stays fixed while the displayed/total text changes. Open Choose setups and confirm the search input is full-width rather than a narrow vertical rectangle.
- From a Current/Recent signal, click `Go to arrow`; from Next, click `Go to latest arrow` where offered. Confirm the pair/timeframe changes if needed, the activation candle is centered, only the selected arrow is emphasized, and Past Result opens.
- Expand a Next or Recent row and verify the historical benchmark uses one named cohort with counts, average gross R, and total gross R; unavailable counts show as unavailable rather than inferred.
- On EURUSD producer-inflation cooling (`FMS-EURUSD-H4-E293`), confirm SL is `2 · 18.2%` and Other is `Expired 3 · Ambiguous 0 · Unevaluable 0`. Expand Outcome definitions and confirm the terms are readable.
- Select the saved AUDUSD recovered payroll arrow twice. Confirm detail loads, shows +1R and eight target rows, and retry is available if the request is forced to fail.
- Confirm the only dock buttons are Trade, Journal, Setups, and Past Result. In Setups, verify the outer workspace and all three inner disclosures begin collapsed and remain usable without page overflow.
- On H4 and H1, click an arrow and compare its candle/time with Past Result. Confirm the exact Entry price is readable and the arrow-position explanation is visible.
- In Past Result, confirm the first screen reads in this order: frozen result, exact Entry/SL/TP and contract, Initial price reaction, then Why the arrow appeared. For the 02 Sep EURUSD manufacturing-employment arrow, confirm the initial reaction is about `-0.20R` and says price opposed the arrow.
- Confirm old recovered arrows without first-seen quote data have no `Entry timing research · Not available for this arrow` dropdown. Confirm a prospectively captured arrow with timing data shows the comparison as a normal section after What happened.
- In Setups → Knowledge, confirm `Unregistered-package entry-state probe · Completed · no promotion` reports 12 variants and zero survivors.

## Remaining limitations

- Visual layout and interaction continuity have static/type validation only until the owner completes the checklist above.
- The one USDJPY historical replay remains honestly unevaluable until its named source interval can be resolved without violating the account-access boundary.
- P6 is reused-history research and a deliberately small coverage probe. It is not fresh forward evidence and does not exhaust orthogonal entry-known interactions.
- The five broad bridge expectation drifts need a separate contract-fixture reconciliation; they are not evidence that the scoped P2/P3 behavior failed.
