# Current mission and handoff

Updated 2026-09-08. This is working memory, not a chronological log. Replace stale sections instead of appending repeated reports. Permanent rules: [AGENTS](../../AGENTS.md). Architecture: [CONTEXT](../../CONTEXT.md). Unknown owner: [navigation](../NAVIGATION.md).

## Current scope

The user requested documentation/navigation efficiency after a Charts/FMS robustness pass. This pass changes Markdown only. No new research campaign, trading behavior, deletion of old tools, or account access is authorized by this documentation request. Continue implementation only when requested; existing settled product decisions stand.

## Accepted product decisions

- Research all 28 configured Major Forex Extended pairs using MT5 calendar and OHLC only. Seek more positive historical recipes and supported immutable improvements; no promised future edge. All FMS expectancy remains gross.
- Daily flow: Charts ? Trade ? Next/Current/Recent. Clear date, status, direction, entry, ATR, SL/TP, expiry, historical N and TP-before-SL; brief reason plus release cards. Deep research stays in its dock.
- Current keeps pending/missing-entry cases and today's no-trade decisions. Scheduled releases waiting for evaluation stay visible. Closed results/older decisions go to Recent; longer performance belongs in Journal. Recovered is visibly distinct from live captured.
- New H1 entries require exact-contract, no-lookahead evidence and explicit successor activation. Earlier H4 history is immutable. Avoid repeated backtests of unchanged candidates.
- The owner prefers autonomous implementation after planning, no subagents, minimal commentary, bounded output, necessary verification, and a short manual audit. No browser automation or new test files without explicit agreement.

## Latest implementation handoff: Charts/FMS

Recorded changes (do not infer that every browser edge case is verified):
- Fixed null H1 activation crash and global snapshot replacement of newer market records.
- Added independent registered-market release monitoring, visible refresh failures, request deduplication/timeouts, and a release-time waiting row.
- Unified Current/Recent partition; pending persists across midnight, no-trade rolls to Recent next Jakarta day; removed ten-row Recent cap.
- Decoupled global dock availability from selected pair loading; preserved tab choice and added panel Retry.
- Shared A/F/P/Surprise/Momentum cards; short reason first, full audit/timing collapsed; removed duplicate Setups account/history content.
- Journal gross totals/previous-week strip follow selected period; Knowledge comparison collapses and clipboard failures are explicit.
- Gzip reduces the measured cached global sample from 3.15 MB to 0.71 MB; cached assembly measured 0.22 seconds. Browser latency is not measured.

Reusable validation from that pass:
- TypeScript and whitespace check passed.
- Direct lifecycle checks passed: scheduled handoff, null label, recovered missing entry, midnight, closed/no-trade decisions, deduplication.
- Two in-process HTTP global reloads retained Japan labor wages and decoded gzip.
- 50 static dock renders across 10 registered markets passed; flag rendering was stubbed due standalone SSR module compatibility. This is not visual/browser validation.
- Existing Charts suite: 20 passed; 3 failed at older UI-text expectations (arrow text, Initial move, Frozen contract heading). Do not silently claim a fully passing suite or rewrite assertions without checking intended behavior.

## Pending acceptance / next implementation starting point

- [ ] Owner/browser audit at 1440x900, Chrome 100%: reload Current, switch pairs rapidly, verify labor-wage visibility, click/deselect H1/H4/recovered/ambiguous arrows, inspect Entry/SL/TP and all docks. Check readable layout and internal scrolling.
- [ ] Observe a real upcoming release: Next hands off to Current without disappearing; actual values/decision update across pairs; failures remain explicit. Synthetic/static checks do not establish real-time capture reliability.
- [ ] Confirm Current still exposes needed exposure/concentration/pause/fresh evidence after consolidation. Earlier passes recorded these features; removing duplicate layouts is not proof they remain accessible.
- [ ] Resolve any reported failure from actual request/state evidence; distinguish stale data, missing observation, rejected recipe, and missing entry geometry. Do not promise an unseen browser fix.

## Deferred research and product work

Do not launch these during narrow fixes. On a later research/goal request, search the progress ledger and saved fingerprints first.

- Continue coverage-ledger-driven discovery across unregistered pair/family cells, bounded OHLC hypotheses, and controlled exploratory mining. Freeze selection/trials and retain negative outcomes; reused history is not fresh proof.
- D1/weekly multi-scale structure: swing prominence, independent reactions, recency, penetration, nesting, freshness, break/retest. Descriptive until a frozen successor passes later comparison. Nearest-zone and sequential-exit campaigns already failed; do not repeat unchanged.
- Prospective maturity/degradation evidence, independent release breadth, drawdown/streak/concentration and portfolio overlap. Much is implemented: inspect existing ledger and UI before proposing another tracker.
- Missing-series/calendar backfill only for a demonstrated gap. Owner may need to keep MT5/EA capture running or confirm broker availability; never ask them to select favorable cases.
- Account-aware exposure/manual real-execution ledger remains separately scoped. No automatic orders, added feeds, cost modeling, or garbage revival.

Research already recorded: 28/28 H4 coverage, 111/112 source baselines (CADCHF sentiment unavailable), eight H1 successors, four cross registrations. Later 21-variant followup and 9,600-configuration co-release campaign produced no new promotion. Counts are dated evidence, not runtime constants.

Full prior decisions, campaign IDs, and completed plans remain intact in [the archived Checklist](archive/Checklist%20through%202026-09-08.md). Consult only a relevant section; do not reload it for orientation.
