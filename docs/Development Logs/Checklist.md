# Current mission and handoff

Updated 2026-09-10. The reopened P0–P7 implementation goal is complete in code and automated validation. Owner visual gates remain listed below. The event-respect/high-TP campaign remains separately deferred and no research run or model mutation was performed. Rules: [AGENTS](../../AGENTS.md). Durable context: [CONTEXT](../../CONTEXT.md). Unknown owner: [navigation](../NAVIGATION.md).

## Early-finish checkpoint

- Completed: P0 architecture baseline; P1 market-data feature seams; P2 optional independent quote publisher, broker-adaptive catalog/cache safeguards, virtualized Market Watch, bounded warmer, and diagnostics.
- Completed P3: Go to arrow stages market/timeframe selection, scoped history coverage, immutable signal lookup, exact arrow selection, and focus with distinct failure reasons. FMS data/navigation, viewport preferences/panel state, event replay/Lens presentation, Pair Matrix state/cache/derivation/geometry, and left/bottom dock composition now have feature owners while compatibility exports remain intact.
- Completed P4 implementation: Charts is the startup and sole normal primary workspace; Trust State now uses the selected chart market in the compact workbar; Economic Calendar is the third bottom-dock window; the FMS Workbench is an explicit Research secondary workspace; and hidden Overview/specialist route IDs remain lazy and recoverable without contributing route-owned CSS to normal startup.
- Completed P5: the FMS Workbench is a four-job table workspace (`Declare / Run status / Results / Archive`); Reaction Atlas, execution outcomes, partitions, provenance, comparisons, candidates, and legacy records use explicit rows; the chart inspector is `Chart / Layers / Selected / Data / Diagnostics`; and Lens is a selected-release/evidence table rather than a settings surface.
- Completed P6: dead Workbench card/disclosure CSS was removed after a zero-reference scan; active/garbage/lazy style boundaries remain intact; route IDs, compatibility exports, and every stored/generated record remain preserved. The deletion ledger below keeps larger removals pending explicit owner approval after normal use.
- Completed P7: a versioned dock registry now constrains panel regions and defaults; the Chart Inspector can move Left/Right from its Chart section and reset to the recoverable default without remounting chart data.
- Research remains deferred: do not run, freeze, promote, or reinterpret an event-respect/high-TP campaign until the owner explicitly reopens it. The intended question is which event/currency/pair/direction packages most consistently produce aligned post-release price movement, followed separately by execution-contract testing.
- No frozen record, model, setup recipe, release monitor, provenance field, or historical evidence artifact was rewritten during this pass.

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
- The bridge now has an optional no-trading `FyodorQuoteBridge.mq5` lane. It publishes complete/delta broker quote snapshots with publisher, broker/catalog, sequence, timestamp, and synchronization facts into a process-local store, allowing fresh `/symbols` reads to bypass Python MT5 history IPC. The original Python catalog path remains the automatic fallback.
- Charts is usable as the working surface with Trade, Journal, Setups, and table-only Past Result docks.
- Trade continuity, compact disclosures, setup filtering, Go to arrow, selected-arrow detail recovery, explicit outcome definitions, and coherent historical-evidence priority are implemented.
- The full broker symbol universe remains available. The selector has the existing Browse mode and a dense, fixed-row virtualized Market Watch table with Symbol, Bid, Ask, and MT5 Daily Change; broker order and unavailable rows are retained while large catalogs render only the visible window.
- The selector stays open during repeated symbol choices. Session-resident candle loading, background warming, per-symbol/timeframe zoom memory, pre-paint viewport replacement, and configurable 40–400-candle refocus width support rapid review.
- While Market Watch is open, its one-second quote audit preempts opportunistic warm/deep candle requests. Outside that interaction, the bounded scheduler warms the selected symbol across timeframes first, then favorites, visible/selected rows, recently used symbols, and the remaining live broker catalog. Failed background rows receive exponential cooldown rather than blocking the queue or creating retry storms; owner-selected history retains foreground priority.
- Chart selection no longer performs an automatic 1971-era oldest-candle probe. The boundary is recorded only when leftward history loading actually exhausts available data.
- An unchanged quote snapshot preserves the existing React symbol and metadata state instead of rerendering the full chart workspace. Rapid pair/timeframe changes debounce the live WebSocket handshake for 150 ms and do not close a socket that is still connecting.
- Browser candle residency is keyed by verified broker/catalog identity. Catalog-scoped history calls reject stale identities and never fall back to the legacy unscoped durable candle table, so a broker switch cannot paint old coverage as current. When identity cannot be verified, history is fetched live without browser-cache reuse.
- Diagnostics now expose broker/catalog identity and source, catalog/quote age, selected-symbol synchronization, scoped cache coverage, queue lanes, active request, cooldown count, and the most recent history failure. They remain behind the existing Diagnostics drawer.
- Latest reusable checks: TypeScript passed after the bounded P3 slice; 43/43 focused chart/storage regressions passed; the complete bridge suite passed 90/90; the P2 production build passed; and `FyodorQuoteBridge.mq5` compiled with zero errors/warnings. The build retains the known non-blocking large-chunk warning and the bridge checks retain five existing framework/time deprecation warnings.
- The symbol portion of that bridge contract continues to cover complete ordered broker rows, one bulk MT5 symbol call, quote projection, and non-blocking cached background refresh.
- The bounded entry-known H4 research campaign completed with 12 declared variants, zero survivors, and no promotion. Its immutable artifacts and exhaustion-ledger records remain preserved outside this active handoff.

## Grand plan — reopened and proceeding in documented order

This preserves the exhaustive direction and documented order after the early finish. The owner has reopened P3–P7 implementation, but not physical record deletion, account access, external feeds, or FMS model changes. Each phase remains one coherent behavior-preserving slice. Do not combine repository restructuring with financial/model corrections.

### Intended end state

Fyodor becomes a chart-first local manual-research terminal whose runtime and source ownership are legible:

```text
Compact chart workbar
  Symbol · Timeframe · Trust state · Chart controls

Chart workspace
  Left dock:  Trade · Journal · Setups · Past Result
  Center:     Chart canvas and overlays
  Right dock: Inspector / Settings

Bottom dock
  Matrix · Lens · Calendar

Runtime lanes
  Broker catalog/quotes · Candle history · FMS evidence · Calendar/release monitoring
```

The product should remain useful after changing brokers, terminal installations, symbol naming schemes, symbol counts, quote precision, trading sessions, or available history. UI panels should consume explicit feature contracts rather than knowing where data was fetched, cached, or interpreted.

### Permanent boundaries for every phase

- Local manual-trading support only: no order transmission, account access, automatic setup promotion, profit promise, external market feed, or new cost model.
- Preserve route IDs until a dedicated migration, lockfile ownership, MT5 OHLCV/calendar trust boundaries, gross-result semantics, immutable first-seen provenance, frozen contracts, unresolved outcomes, release monitoring, research manifests, exhaustion ledgers, and every saved record.
- Never use cleanup as permission to rewrite a frozen result. Financial corrections require their own confirmed cause, affected-record audit, explicit version identity, preserved original, migration behavior, and owner authorization.
- `fms_historical_evidence.py` remains the canonical chart-evidence projection; generated reviewed-entry evidence remains publisher-owned and non-promoting; `chartMacroBiasAuditViewModel.ts` remains the Past Result interpreter; the table renderer must not reacquire financial fallback logic.
- `server.py` should move toward adapter/orchestrator responsibility, but extraction must not change endpoint contracts or duplicate domain calculations.
- Feature CSS stays with the owning feature; the root stylesheet remains an ordered import aggregator. Active and garbage routes/styles stay separate.
- No large rewrite. Every extraction keeps the app runnable, has a narrow rollback boundary, reuses existing checks, and receives owner visual verification at 1440x900.

### Deferred research campaign — event respect before high-TP execution

Status: discussed and deliberately deferred. No scan, experiment, candidate freeze, registration, correction, or promotion is authorized until the owner explicitly reopens this campaign. This research is separate from P0–P7 repository/UI work; completing an interface phase must not start it automatically.

Core question:

> Which economic event families, on which currency pairs, repeatedly move in the direction implied by the first-seen release surprise, by how much, and with how much adverse movement?

Keep the first campaign literal and falsifiable:

- Treat direction from Actual versus Forecast as the primary new-information hypothesis when a trustworthy first-seen forecast exists. Preserve Actual versus Previous, revisions, and per-indicator economic orientation as separate facts rather than collapsing them.
- Evaluate simultaneous releases as immutable packages. Label agreement, contradiction, missing forecast, unreliable forecast, revision conflict, and unknown orientation explicitly.
- Translate currency direction to pair direction deterministically: favorable base-currency news and favorable quote-currency news imply opposite pair directions.
- Begin at the release timestamp and measure fixed post-release horizons before choosing an entry recipe: initial signed returns, maximum favorable excursion, maximum adverse excursion, and final signed return.
- Report literal event-family × pair rows with case count, evaluable/expired/ambiguous/unavailable counts, direction-respect rate, median/quantile signed MFE and MAE, represented years, and chronological development/holdout/recent partitions.
- Distinguish directional events, impulse-then-reversal events, volatility-only events, and events with no stable relationship. High volatility alone is not directional respect.
- Do not optimize SL, TP, holding period, entry delay, or context interactions in the discovery pass. High-TP research begins only after a directional event/pair relationship survives untouched chronological evidence.
- Lock candidate definitions and thresholds before reading holdout results. Correct for the number of event/pair/horizon comparisons by controlling the candidate funnel rather than selecting the prettiest rows afterward.
- Require stability across years and later data, not just pooled average R. Show uncertainty and small samples; neither automatically vetoes positive evidence nor permits promotion.
- Surviving candidates proceed in order: frozen candidate review, prospective paper observation, then a separately authorized execution study of entry timing, SL, TP, and maximum duration.
- Continue to report gross evidence under the existing contract. Gross loss rejects a recipe; gross profit is necessary but does not prove an executable net edge.
- Keep headline/NLP research outside this campaign. It would introduce a new external dataset, licensing/provenance, timestamp, revision, duplication, and model-version problem and requires separate authorization.

Reusable campaign sequence when reopened:

1. `R0 — Coverage audit`: inventory canonical event families, first-seen fields, forecast/revision quality, pair coverage, candle coverage, timestamp mapping, and existing cached datasets. Reuse the research ledger and do not rerun exhausted hypotheses.
2. `R1 — Reaction atlas`: produce the descriptive event/pair/horizon table without trade barriers or candidate promotion.
3. `R2 — Candidate declaration`: choose a small, economically coherent set using development evidence only; freeze identities, directional rules, horizons, and exclusion rules.
4. `R3 — Chronological challenge`: evaluate untouched holdout/recent data and publish every survivor and failure without rewriting the declaration.
5. `R4 — Prospective observation`: record true first-seen releases and paper outcomes under the frozen rule. Recovered counterfactuals remain separate.
6. `R5 — Execution study`: only for R3/R4 survivors, compare a bounded declared grid of entry timing and TP/SL/duration choices. Preserve ambiguous, expired, and unavailable paths.

The FMS Experiment Workbench is the likely control and audit surface for this campaign, but it must be overhauled before use. The workbench should help declare, run, compare, falsify, and preserve experiments; it must not encourage arbitrary parameter fishing or hide negative results.

### P0 — Baseline and dependency map

Milestone: complete 2026-09-09. The authoritative owner/dependency, immutable-flow, persistence, endpoint, validation, manual-gap, priority, and rollback record is [Architecture Baseline](Architecture%20Baseline.md). The captured baseline is 253/253 frontend tests and 85/85 bridge tests; existing framework/time deprecation and production chunk-size warnings remain non-blocking. P1 may proceed through typed compatibility seams without changing behavior.

Purpose: establish evidence before moving code so cleanup does not merely relocate hidden coupling.

- Record the active Charts route, workbar, left/right/bottom dock composition, data hooks, bridge endpoints, storage keys, stylesheets, and existing checks that protect each behavior.
- Identify oversized owners and dependency crossings, especially `ChartsTab.tsx`, `useChartMarketData.ts`, `server.py`, shared chart styles, FMS view models/renderers, and route-level state.
- Build a behavior matrix for symbol/timeframe switching, cached/uncached history, Market Watch, stream lifecycle, Trust State, Go to arrow, frozen evidence, Past Result, Trade/Journal continuity, Matrix, Lens, Calendar, and panel persistence.
- Mark each dependency as presentation, interaction state, domain interpretation, storage, transport, generated evidence, or lifecycle. Extraction order follows ownership risk, not file size alone.
- Capture one reusable validation baseline and current warnings. Do not repeatedly rerun unchanged broad checks in later phases.
- Exit gate: every active surface and immutable data path has a named owner, existing validation route, and rollback point; unknown ownership remains documented rather than guessed.

### P1 — Establish feature seams without redesign

Milestone: high-value market-data seam complete 2026-09-09. Typed contracts, history policy, resident scheduler, and symbol-catalog normalization now live under `features/chart-market-data`; `useChartMarketData.ts` is reduced to React orchestration and the existing component/bridge compatibility surfaces remain intact. Focused tests and TypeScript pass. Further vertical slices proceed only with the phase that needs them.

Purpose: make future edits local before changing visible product structure.

- Define thin typed contracts at feature boundaries: selected market/timeframe, viewport command, selected arrow/event, dock state, quote snapshot/delta, history coverage, Trust State, and evidence-detail request.
- Split pure calculations and normalization from React effects. Renderers receive prepared view models and callbacks; they do not fetch, infer financial fallbacks, or mutate storage.
- Give each major Charts capability a vertical owner containing its component, state/view model or hook, feature stylesheet, bridge client/adapter when needed, and focused existing tests.
- Candidate vertical owners: chart shell/workbar, symbol Browse/Market Watch, candle viewport, stream lifecycle, history residency, FMS left dock, Past Result, event overlays, Pair Matrix, Lens, Calendar dock, right inspector, and panel preferences.
- Keep genuinely shared primitives small and dependency-free. Do not create a generic `utils` or global store that quietly becomes the next monolith.
- Introduce composition boundaries first, then move internals. Preserve exported compatibility shims until all active imports are migrated and verified.
- Exit gate: a change inside one named feature normally touches that feature plus an intentional shared contract or adapter—not the route, unrelated docks, and bridge by default.

### P2 — Broker-adaptive market-data runtime

Milestone: complete 2026-09-10. The independent optional quote publisher, process-local delta store, broker/catalog snapshot endpoint, scoped browser history, catalog-guarded history requests, adaptive backpressured warmer with failure cooldown, virtualized Market Watch, and hidden diagnostics are implemented. Automated evidence is 43/43 focused frontend checks, 90/90 complete bridge checks, TypeScript, production build, and a MetaEditor compile of `FyodorQuoteBridge.mq5` with zero errors/warnings. The owner attached the EA, confirmed a complete 279-symbol snapshot was accepted at sequence 1, and confirmed rapid switching across unusual symbols remained instant while Bid/Ask continued updating. Broker-change invalidation remains a future environment-specific audit, not a blocker to the current broker exit gate. Absence of the EA deliberately retains the slower Python fallback.

Purpose: eliminate the current shared-lane architecture rather than accumulating more timeout patches.

- Split interactive quote refresh from candle-history synchronization so one slow `copy_rates` request cannot stale all Bid/Ask rows.
- Evaluate an MT5-side EA quote publisher or another dedicated quote process/store. Prefer changed-symbol deltas with sequence/timestamp metadata over rebuilding and rerendering the complete catalog each second.
- Discover the universe from the live broker catalog. Never hardcode the current 279 symbols, Forex-only assumptions, suffix rules, folder layout, digit count, market hours, or history depth.
- Build a broker capability snapshot: terminal/broker identity, symbol name/path, visibility/selection, digits, quote availability/age, supported timeframes, synchronization state, and known history coverage.
- Key resident caches by broker/terminal identity plus symbol and timeframe. On broker or account-server identity change, retain old data safely but never present it as current coverage for the new broker.
- Replace eager all-symbol warming with an adaptive, backpressured scheduler ordered by selected chart, visible/favorite symbols, recently used markets, FMS-required markets, and then remaining broker symbols.
- Measure terminal latency and failure modes; adapt batch size, concurrency, retry, and cooldown without artificial sleeps or retry storms. Unsupported or unsynchronized symbols remain auditable and do not block the queue.
- Keep selected-chart work cancellable or supersedable where the MT5 API allows it. Stale completions must not repaint a newer selection.
- Virtualize large Market Watch universes. Preserve broker order and all symbol rows, including rows with unavailable quotes, without forcing route-wide React renders.
- Add ordinary diagnostics for quote age, catalog age, queue depth/age, active request, cache source/coverage, synchronization state, and per-symbol failure. Diagnostics must stay out of the normal trading view unless opened.
- Define degraded behavior: cached chart remains visible, quote age is explicit, Trust State distinguishes stale/busy/disconnected, and no value is fabricated.
- Exit gate: active quotes remain responsive during slow/failed history synchronization; first selection and revisits are measured; broker switching cannot reuse false coverage; workload scales from a small catalog to a much larger one without fixed assumptions.

### P3 — Decompose the Charts workspace

Milestone: complete 2026-09-10. “Go to arrow” remains a staged command that selects broker symbol and registered timeframe, waits for scoped history and the immutable signal response, requests a bounded missing activation window when needed, selects the exact signal, and then focuses/autoscales the chart. Its orchestration, FMS marker/detail/price-line interpretation, selected/global/historical signal loading, release monitoring, and cache merging now live under `features/fms-arrow-navigation`. Viewport capture/restore, chart preferences, and dock selection/width/session continuity live under `features/chart-viewport`; event selection, replay lifecycle, release-row interpretation, and Lens view-model construction live under `features/chart-events`; Pair Matrix range selection, hover, calendar cache, derived timeline/momentum, and chart geometry live under `features/pair-matrix`. Left FMS and bottom-dock render composition now have `features/fms-dock` and `features/chart-bottom-dock` owners. Existing route/component exports remain compatibility shims; `ChartsTab.tsx` has fallen from about 2,660 to 1,275 lines and `ChartViewport.tsx` to about 280 lines without changing public contracts. The exit gate passes 256/256 frontend tests, TypeScript, and the production build; the known large-chunk warning remains. Browser visual verification remains an owner task rather than inferred from static checks.

Purpose: turn `ChartsTab` into composition instead of a cross-feature implementation owner.

- Leave the route responsible only for composing workbar, left dock, chart canvas, right inspector, and bottom dock plus their narrow shared selection state.
- Move feature-specific effects, derived data, commands, modal/disclosure state, and rendering into the P1 vertical owners.
- Separate selected-symbol/timeframe identity from chart viewport state so data replacement does not reset focus, and viewport actions do not restart transport work.
- Route Go to arrow through one explicit navigation command: select symbol/timeframe, ensure required coverage, select the immutable arrow, then focus its activation candle. Each stage reports a distinct unavailable reason.
- Keep Trade, Journal, Setups, and table-only Past Result independent. Opening or failing one dock must not remount or crash the others.
- Keep overlays independently selectable and disposable: FMS arrows, economic releases, price lines, Pair Matrix context, selected-event/arrow focus, and replay state.
- Centralize panel open/closed/size persistence without yet adding free-form docking.
- Exit gate: switching or repairing one dock does not require edits to unrelated docks; the main chart survives a dock error; existing chart interaction and evidence behavior remain identical.

### P4 — Chart-first shell and prototype quarantine

Milestone: implementation complete 2026-09-10; owner visual gate outstanding. Charts now starts directly and is the sole normal primary workspace. The universal header is no longer mounted; its Trust State diagnostics moved to a compact chart-workbar control using the selected chart symbol, while appearance settings remain reachable there and from retained secondary workspaces. Economic Calendar is embedded as `Matrix / Lens / Calendar` without duplicating its data interpretation, sync continuity, or event-navigation contract. The Workbench remains reachable through an explicit Research action and returns through a compact secondary bar. Overview, Central Banks, Differential Calculator, Event Replay, Macro Drivers, Prototyping, and garbage route IDs remain resolvable; they are absent from normal navigation, and Overview/Event Replay/Workbench route-owned CSS now loads lazily. TypeScript, 70/70 focused shell/chart/calendar checks, 256/256 frontend checks, and the production build pass. The build retains the known large flag/chart chunk warning. Manual 1440x900 approval remains required but does not block independent P5 work.

Purpose: align navigation with the product the owner actually uses.

- Move Trust State into the compact chart workbar and verify its lifecycle there before removing the universal header.
- Treat Charts as the sole primary route.
- Move Economic Calendar into the bottom dock beside Matrix and Lens. Their intended grouping is comparative context, focused event inspection, and release timeline.
- Remove Overview and the general Specialist Tools container from normal navigation only after classifying each child. Quarantine obsolete prototypes behind the existing garbage boundary after proving Charts has no dependency on them.
- Do not quarantine the active FMS Experiment Workbench as disposable prototype code. Isolate it from the Specialist Tools shell, retain its stable route identity during migration, and place the rebuilt research surface deliberately—either as a dedicated Research workspace or a chart-adjacent dock chosen during P0/P1.
- Keep old route IDs resolvable or explicitly redirected during quarantine so saved navigation does not fail unexpectedly.
- Do not physically delete prototypes, archives, generated evidence, or historical records merely to simplify navigation.
- Exit gate: app startup lands on a complete chart workspace; Trust State and Calendar remain accessible; quarantined routes cannot affect active bundle lifecycle or styling; owner approves the shell visually.

### P5 — Rebuild the FMS Workbench, right inspector, and Lens

Milestone: implementation complete 2026-09-10; owner visual gate outstanding. The Workbench now separates `Declare`, `Run status`, `Results`, and `Archive` in a table-first workspace. It retains bounded declarations, immutable queue failures, frozen candidates, legacy records, raw JSON/human summary export, a small identity-safe comparison selection, explicit field-level unavailability, the stored Reaction Atlas, full execution outcome/partition tables, and provenance without arbitrary disclosures. The right inspector now separates `Chart / Layers / Selected / Data / Diagnostics`; selected FMS arrows and releases show literal stored facts, while data and technical logs no longer share one page. Lens now renders its release navigator, release values, replay controls, and base/quote evidence as compact literal tables. No experiment was run, frozen, corrected, promoted, or reinterpreted. TypeScript, 42/42 focused chart/Workbench/shell/calendar checks, 256/256 full frontend checks, and the production build pass. The known large chart/flag chunk warning remains. Manual 1440x900 visual approval remains required but does not block independent P6 work.

Purpose: replace deprecated information architecture with literal, task-oriented research and inspection surfaces. Workbench overhaul is authorized separately from running any deferred research campaign.

FMS Experiment Workbench:

- Replace the current card-heavy, long-page experiment builder with a stable table/workspace layout. Prefer explicit columns, named sections, and persistent selection over decorative summaries and scattered disclosures.
- Separate four jobs visibly: `Declare`, `Run status`, `Results`, and `Archive`. A user must always know whether they are configuring an unrun hypothesis, viewing an immutable completed experiment, or reviewing a frozen candidate.
- Suggested structure: left catalog/filter table; center declaration or selected-result table; right compact provenance/contract inspector; bottom experiment/archive queue when space permits.
- Build an Event Respect / Reaction Atlas table suitable for the deferred R1 output: Event family, Currency, Pair, Direction rule, N, Respect rate, Signed MFE, Signed MAE, Horizon, Development, Holdout, Recent, Coverage, and Classification.
- Keep execution-contract results in a separate literal table: Entry rule, SL ATR, TP R/ATR, Duration, TP/SL/Expired/Ambiguous/Unavailable counts, Average gross R, partitions, and qualification checks.
- Make unavailable values explicit and local to their field. Never substitute `0`, infer unsupported counts, or hide ambiguity inside a generic status.
- Make provenance inspectable from every experiment/result row: experiment ID, configuration hash, catalog snapshot, data window, first-seen policy, scoring policy, code/model version, created/completed time, and source classification.
- Retain immutable failed and zero-survivor experiments in the archive. Filtering may reduce visual noise but must never erase them from the record.
- Keep `Run` and `Freeze candidate` separate. Freezing remains review-only and non-promoting; failed checks require explicit acknowledgement and stay attached.
- Eliminate arbitrary expandable sections in the middle of the result flow. Details/disclosures need a clear parent row, count, unavailable reason, and predictable placement.
- Show queue progress and failures without blocking navigation. Restart recovery must retain recorded experiment identity and honest failure state.
- Do not expose unrestricted combinatorial controls by default. Bounded protocol values and declared matrices remain visible before execution so the interface resists accidental p-hacking.
- Support comparison of a small selected set of experiments by identical columns; do not combine unlike scoring policies, event packages, markets, or evidence partitions without an explicit warning.
- Preserve raw JSON export and concise AI/human summary export, but treat the literal stored record as authoritative.

Right inspector and Lens:

- `Chart`: appearance, candle behavior, default focus/refocus width, timezone, scale, and cursor behavior.
- `Layers`: FMS arrows, releases, price lines, Pair Matrix context, visibility, and display density.
- `Selected`: exact candle, arrow, event, or price-level facts and navigation. It should show provenance and unavailable reasons without recomputing financial meaning.
- `Data`: symbol/timeframe source, quote age, resident/durable coverage, synchronization and loading state, and explicit refresh/clear controls.
- `Diagnostics`: technical bridge/stream/cache information kept out of ordinary review.
- Lens remains a focused inspection tool for a selected time/event/range. It must not become a miscellaneous settings or diagnostics drawer.
- Let frozen-record audits determine the final Selected/Lens fields. Do not invent decorative cards or speculative metrics before a real review need exists.
- Prefer literal rows/tables for dense comparable facts; avoid expandable controls with no clear parent, orphaned labels, and bespoke card layouts that obscure missing data.
- Exit gate: every control has one owner and immediate visible effect; every displayed fact has a source; settings, evidence, diagnostics, mutable declarations, completed experiments, and frozen candidates are visually distinct; all existing experiment and archive records remain reachable.

### P6 — Quarantine, styles, tests, and deletion audit

Milestone: complete 2026-09-10. A targeted reference scan proved that the superseded Workbench card/list/inspector selectors had no runtime owner; those selectors were removed while raw-audit, tutorial, and new table selectors were retained. The lazy Workbench CSS chunk fell from 46.44 kB to 33.08 kB. Active startup CSS, garbage-only CSS, lazy route CSS, route IDs, compatibility exports, storage keys, and immutable/generated evidence remain separate and intact. TypeScript, the existing frontend suite, production build, and source/style reference scans pass. No physical route, record, archive, or generated artifact was deleted.

Purpose: finish repository hygiene only after active ownership is proven.

- Remove dead active imports, duplicate adapters, stale compatibility shims, duplicate calculations, and unreachable styles one bounded feature at a time.
- Extract feature CSS into its owner while preserving root import order and checking shared selectors before moving them.
- Keep active and garbage route/style trees separate. Generated artifacts and private/archive/garbage records are not cleanup targets.
- Consolidate overlapping existing tests around public feature contracts. New test files or browser automation still require owner agreement; source extraction alone is not a reason to multiply fixtures.
- Add contract versioning or migrations only when a persisted key or endpoint truly changes. Preserve backward reads long enough to avoid silently orphaning owner data.
- Produce a deletion ledger: candidate, evidence of no active import/runtime/storage dependency, preservation location when needed, rollback method, and owner decision.
- Physical deletion happens only after quarantine has survived normal owner use and the owner explicitly approves the named targets.
- Exit gate: active dependency and stylesheet scans are clean, targeted behavior checks pass, saved records remain readable, and the deletion ledger—not intuition—defines what may be removed.

Deletion ledger:

| Candidate | Dependency evidence | Current disposition | Preservation / rollback | Owner decision |
|---|---|---|---|---|
| Superseded Workbench card, list, result-card, and orphan-inspector CSS | No TS/TSX owner remained after the P5 table renderer; focused render checks cover the replacement classes | Removed from the lazy Workbench stylesheet | Git diff restores the exact selector block; raw audit and tutorial CSS were not touched | Removal authorized by reopened P6 scope |
| `MinimalHeader.tsx` wrapper | No longer mounted, but its extracted details panel is actively reused by chart Trust State and the wrapper preserves hidden-route compatibility | Retain | Existing file and route-compatible props | Revisit only after owner use confirms no hidden-route need |
| Hidden Overview, Central Banks, Differential Calculator, Event Replay, Macro Drivers, Prototyping, and garbage routes | Still referenced by stable lazy route IDs and existing source-contract checks | Quarantined from normal navigation; do not delete | Lazy route files and garbage stylesheet remain intact | Explicit named deletion approval still required |
| `ChartsTab` / `ChartViewport` compatibility exports | Existing tests and active imports still consume their public contracts | Retain | Feature implementations live behind the compatibility surface | Remove only after all active imports migrate and a separate owner-approved pass validates it |
| Generated FMS evidence, frozen experiments/candidates, archive/private/garbage records | Deliberately excluded from cleanup; immutable provenance and saved-record reachability are product contracts | Preserve unconditionally | Existing artifact locations and bridge readers | Not a deletion candidate |
| `react-world-flags` / FlagIcon chunk | Known working dependency with a documented standalone chunk warning | Retain | Current declaration and wrapper | Revisit only on explicit owner request |

### P7 — Configurable panel placement — low priority

Milestone: implementation complete 2026-09-10; owner visual gate outstanding. `chartDockRegistry.ts` records panel identity, allowed regions, default region/order/size, minimum dimensions, and persistence version. FMS stays constrained left and Matrix/Lens/Calendar stays bottom; the Inspector has the deliberate Left/Right choice. Saved layouts are normalized, invalid regions and unknown/removed panel IDs are ignored, and incompatible versions fall back to defaults. The Inspector exposes keyboard-accessible placement and reset controls; changing its side updates drawer placement only and does not duplicate panel state or remount the chart. The existing chart-storage test now covers valid placement, invalid-region recovery, unknown IDs, version fallback, and persistence. TypeScript, 257/257 frontend checks, and production build pass; manual 1440x900 placement review remains required.

Purpose: support owner layout preferences after the panel boundaries are stable.

- Use a small dock registry with panel identity, allowed regions, default region/order/size, minimum dimensions, and persistence version.
- Keep panel content independent of left/right/bottom CSS and lifecycle assumptions.
- Start with controlled placement choices such as moving the right inspector to the left; do not begin with arbitrary drag-and-drop.
- Guard the 1440x900 minimum layout, internal scrolling, focus order, keyboard access, resize limits, and reset-to-default behavior.
- Unknown or removed panel IDs in saved layouts must fail safely after upgrades.
- Consider a general desktop/docking framework only if repeated real use proves controlled placement inadequate.
- Exit gate: changing placement cannot duplicate state, refetch data, remount the chart unnecessarily, overlap controls, or make a panel unrecoverable.

### Milestone discipline and recommended order

1. Preserve the completed P0 architecture baseline as the map and rollback reference.
2. Preserve the completed P1 market-data seams; add another seam only when a reopened phase requires it.
3. Complete the outstanding live P2 audit before promising MT5-like responsiveness across arbitrary brokers.
4. Resume Charts decomposition in P3 using the proven seams.
5. Change the visible shell in P4 only after Charts owns everything it needs.
6. Use real arrow audits and the deferred research contract above to inform P5, but do not run the campaign merely because its workbench exists.
7. Run P6 quarantine and deletion review after the replacement surfaces have survived owner use.
8. Keep P7 last.

At every milestone: establish the failing/current behavior, make one coherent batch, run only affected existing checks plus one final gate, update this handoff with reusable evidence, list exact owner visual checks, and stop if a change would cross into a later unauthorized phase.

## Concise owner visual checks still outstanding

- Restart the bridge, keep its console visible, then switch pairs rapidly and use Go to arrow several times. Confirm it selects the registered timeframe and precise arrow. Trust State may transition during normal reconnection but must recover, the bridge process must remain available, and no WebSocket traceback should print.
- Try one arrow whose candle is not initially resident and one genuinely unavailable case. The first should fetch its bounded activation window and focus; the second should end with a specific history/signal/coverage reason rather than loading forever.
- Keep Browse or Market Watch open and rapidly select several symbols and timeframes. Confirm the popover stays open and the chart does not show an intermediate zoom/axis jump.
- On any future broker/terminal change, confirm `/health` reports a fresh quote publisher with the new catalog identity and compare its symbol count/order against MT5 before trusting reused chart coverage. The current 279-symbol broker passed live quote continuity and rapid-switch review on 2026-09-09.
- Rapidly click several symbols faster than 150 ms. The browser console should no longer fill with `WebSocket is closed before the connection is established`; the final selected chart should connect normally.
- In Settings > Appearance > Viewport, change Default refocus width and use Refocus. Confirm smaller values show fewer/wider candles and larger values show more/narrower candles.
- At 1440x900 and 100% zoom, confirm Charts fills the window without a blank header gap; Trust State opens its diagnostics above the chart and reflects the currently selected chart symbol.
- Open Calendar from the chart toolbar, switch `Matrix / Lens / Calendar`, resize the bottom dock, and open a chart event into Calendar. Confirm filters, row scrolling, event focus, and inspector dismissal remain usable inside the bounded panel.
- Open Research from the chart toolbar, confirm the Workbench route appears with a compact `Back to Charts` bar, then return without losing the selected chart symbol or resident viewport.
- Compare Market Watch count/order and several Bid, Ask, and Daily Change values with MT5 after using MT5 Show All. Missing broker quotes may show an em dash, but the symbol row must remain.
- During frozen-record review, compare the selected chart arrow, Past Result table, Trade evidence, and immutable source data. Record exact IDs for every disagreement rather than correcting records manually.

## Remaining limitations

- Visual smoothness, layout, and browser-console cleanliness remain owner-verified; automated checks do not constitute browser validation.
- First-ever uncached symbols can still wait for one foreground MT5 history call until durable or background history exists. The optional quote EA removes quote refresh from that history lane; without the EA, the automatic Python fallback still shares MT5 IPC and can briefly delay Market Watch quotes. A loaded or warmed symbol/timeframe remains resident for rapid revisits.
- Live broker switching, quote continuity under slow/failed history, catalog invalidation, staged Go-to-arrow focus, and 1440x900 layout smoothness have not been manually verified in MT5/Chrome during this implementation session.
- P4, P5, and P7 automated gates are complete, but their combined 1440x900 visual approval is still outstanding. No critical automated regression remains known; browser-only layout, focus, and transition issues can still be discovered by the owner checklist.
- MT5 may expose a broker symbol without a current quote, especially when hidden or inactive. The audit table preserves the row and does not fabricate data or mutate MT5 Market Watch selection.
- One named USDJPY historical replay remains honestly unevaluable until its source interval can be resolved without violating the account-access boundary.
- The completed 12-variant research campaign is reused-history evidence, not fresh forward evidence, and does not exhaust orthogonal entry-known interactions.
