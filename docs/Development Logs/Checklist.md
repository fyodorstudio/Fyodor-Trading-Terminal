# Current mission and handoff

Updated 2026-09-09. There is no authorized implementation task in progress. The owner is investigating frozen FMS records and will return with specific cases before discussing any explicit correction. Rules: [AGENTS](../../AGENTS.md). Durable context: [CONTEXT](../../CONTEXT.md). Unknown owner: [navigation](../NAVIGATION.md).

## Non-negotiable product behavior

- Local manual-trading support only. Fyodor sends no orders and makes no profitability promise.
- Trusted inputs remain MT5 OHLCV and the broker economic calendar. Research stays gross; there is no new cost model or external feed.
- Preserve immutable first-seen provenance, frozen contracts, no-lookahead semantics, unresolved outcomes, release monitoring, and all saved records.
- Never silently rewrite a frozen result. A confirmed defect requires an explicit, versioned correction with the original record and provenance retained.
- No setup is promoted automatically. Real-account access remains outside scope.
- Target layout remains 1440x900 at 100% Chrome zoom. Browser automation has not been authorized; visual verification belongs to the owner.

## Current owner investigation — frozen records

The owner is reviewing registered arrows and will provide suspicious cases. No model, recipe, result, or historical record should change until the evidence is reviewed together and the owner explicitly authorizes a correction.

For each case, retain or request:

- Pair, setup/registration ID, source version, release date/time, and screenshot when useful.
- The immutable release package and which values were known at decision time.
- Direction vote and the exact reason the registered rule selected it.
- Release-to-activation-candle mapping, entry timeframe, and timezone conversion.
- Frozen entry, ATR, SL, TP, risk/reward, management, and maximum-duration formulas.
- Candle path through resolution: TP first, SL first, expiry, same-candle ambiguity, or unavailable coverage.
- First-seen provenance and whether the displayed record came from prospective, recovered, reviewed-entry, reviewed-execution, chronological-holdout, or pooled evidence.
- Any disagreement between stored evidence, bridge projection, Past Result, chart placement, and Trade-row summaries.

Classify each investigated case before proposing a change:

- Correct but unintuitive registered behavior.
- Chart placement or presentation defect.
- Historical-evidence projection defect.
- Stale or incomplete cached detail.
- Outcome/path evaluation defect.
- Genuine contract/model weakness.
- Insufficient evidence; retain unresolved status.

If a correction is warranted, document the confirmed cause, affected record set, immutable original, replacement/version identity, migration or projection behavior, regression evidence, and any remaining uncertainty before implementation.

## Current implemented baseline

- Rapid pair/timeframe switching no longer turns an expected chart WebSocket disconnect into a bridge traceback. Every stream send and close is lifecycle-safe, client disconnect frames are consumed promptly, obsolete streams stop polling MT5 immediately, and the error path never attempts a second send over an already-closed socket.
- The focused bridge contract now passes 15/15. It reproduces the exact `Cannot call send once a close message has been sent` failure and exercises a complete connect/candle/pair-switch disconnect route without an unhandled exception. Existing FastAPI lifespan and `datetime.utcnow` deprecation warnings remain unrelated.
- Charts is usable as the working surface with Trade, Journal, Setups, and table-only Past Result docks.
- Trade continuity, compact disclosures, setup filtering, Go to arrow, selected-arrow detail recovery, explicit outcome definitions, and coherent historical-evidence priority are implemented.
- The full broker symbol universe remains available. The selector has the existing Browse mode and a dense Market Watch mode with Symbol, Bid, Ask, and MT5 Daily Change.
- The selector stays open during repeated symbol choices. Session-resident candle loading, background warming, per-symbol/timeframe zoom memory, pre-paint viewport replacement, and configurable 40–400-candle refocus width support rapid review.
- The latest focused frontend checks passed: TypeScript, 46/46 chart preference/render regressions, and production build. The build retains the known non-blocking large-chunk warning.
- The symbol portion of that bridge contract continues to cover complete ordered broker rows, one bulk MT5 symbol call, quote projection, and non-blocking cached background refresh.
- The bounded entry-known H4 research campaign completed with 12 declared variants, zero survivors, and no promotion. Its immutable artifacts and exhaustion-ledger records remain preserved outside this active handoff.

## Deferred until the owner explicitly brings it up

These are product-direction notes, not authorization to implement, delete application code, move files, or redesign routes.

### Chart-first application shell

Product direction: a chart-first manual research terminal rather than several equal-weight prototype destinations.

Proposed shell:

```text
Compact chart workbar
  Symbol · Timeframe · Trust state · Chart controls

Main chart
  Left dock:  Trade · Journal · Setups · Past Result
  Right dock: Inspector / Settings

Bottom dock
  Matrix · Lens · Calendar
```

- Move Trust State into the compact chart workbar before removing the universal header.
- Treat Charts as the sole primary route.
- Move the Economic Calendar into the bottom panel beside Matrix and Lens. The intended grouping is comparative context, focused event inspection, and release timeline.
- Remove Overview and Specialist Tools from normal navigation first; quarantine their routes and styles behind the existing garbage boundary while confirming Charts has no remaining dependency on their state or layout assumptions.
- Do not delete archived/prototype application records merely to simplify navigation. Physical deletion remains a separate owner decision after quarantine proves safe.

### Right inspector and Lens redesign

Treat the current right settings drawer as a deprecated information architecture rather than incrementally decorating it.

Candidate right-inspector structure:

- `Chart`: appearance, candle behavior, default focus, and timezone.
- `Layers`: FMS arrows, events, price lines, and Pair Matrix context.
- `Selected`: the current candle, arrow, event, or price-level inspection.
- `Data`: symbol/timeframe history, bridge state, and cached coverage.
- `Diagnostics`: technical information kept out of ordinary review.

Lens should remain a focused inspection tool. It should not become a miscellaneous settings or diagnostics container. Its final fields should be informed by actual frozen-record audits rather than guessed in advance.

### Repository foundation and ownership pass

The desired isolation is ownership, not indiscriminately moving files into more folders.

- Give each chart feature a clear vertical owner: component, local state/view model, feature CSS, bridge client/adapter, and focused existing checks.
- Keep financial calculations and immutable interpretation in pure domain modules, separate from React renderers and bridge storage adapters.
- Keep `server.py` as an adapter/orchestrator where an existing pure owner already exists; do not duplicate research or projection logic there.
- Keep shared modules limited to genuinely shared contracts. Avoid broad utility files that quietly couple unrelated panels.
- Define a small route/dock registry before changing navigation so active and quarantined surfaces are explicit.
- Preserve generated evidence, research manifests, ledgers, first-seen data, and release-monitoring records throughout any source-layout cleanup.
- Perform cleanup in coherent, behavior-preserving slices with targeted validation; do not combine it with model changes or financial corrections.

Suggested sequence when this work is reopened:

1. Settle the shell and named dock regions.
2. Rebuild the right inspector and Lens around evidence learned from arrow audits.
3. Quarantine obsolete routes and verify no active imports remain.
4. Strengthen feature/domain/adapter ownership one vertical slice at a time.
5. Consider physical deletion only after an explicit owner review.

### Configurable panel placement — low priority

- First establish three stable regions with centralized open/closed and size state: left dock, right inspector, and bottom dock.
- Keep content ownership independent of placement so a panel is not coupled to left/right-specific CSS or lifecycle assumptions.
- Only after those boundaries are reliable should preferences allow right-to-left placement, docking changes, or user layouts.
- Avoid a general drag-and-drop desktop framework until ordinary chart review proves it necessary.

## Concise owner visual checks still outstanding

- Restart the bridge, keep its console visible, then switch pairs rapidly and use Go to arrow several times. Trust State may transition during normal reconnection but must recover, the bridge process must remain available, and no WebSocket traceback should print.
- Keep Browse or Market Watch open and rapidly select several symbols and timeframes. Confirm the popover stays open and the chart does not show an intermediate zoom/axis jump.
- In Settings > Appearance > Viewport, change Default refocus width and use Refocus. Confirm smaller values show fewer/wider candles and larger values show more/narrower candles.
- Compare Market Watch count/order and several Bid, Ask, and Daily Change values with MT5 after using MT5 Show All. Missing broker quotes may show an em dash, but the symbol row must remain.
- During frozen-record review, compare the selected chart arrow, Past Result table, Trade evidence, and immutable source data. Record exact IDs for every disagreement rather than correcting records manually.

## Remaining limitations

- Visual smoothness, layout, and browser-console cleanliness remain owner-verified; automated checks do not constitute browser validation.
- First-ever uncached symbols can still wait for MT5 until durable or background history exists. A loaded or warmed symbol/timeframe remains resident for rapid revisits.
- MT5 may expose a broker symbol without a current quote, especially when hidden or inactive. The audit table preserves the row and does not fabricate data or mutate MT5 Market Watch selection.
- One named USDJPY historical replay remains honestly unevaluable until its source interval can be resolved without violating the account-access boundary.
- The completed 12-variant research campaign is reused-history evidence, not fresh forward evidence, and does not exhaust orthogonal entry-known interactions.
