# Current mission and handoff

Updated 2026-09-21 after the FMS v2 scope-drift incident.

Fyodor's immediate objective is simple: restore a trustworthy, fast application; preserve every immutable FMS v1 record; then provide a clear historical comparison of v1 arrows against separately computed v2 candidate arrows informed by the owner's audit notes. Stability, research, and repository hygiene are separate projects. Do not combine them.

Rules: [AGENTS](../../AGENTS.md). Durable facts: [CONTEXT](../../CONTEXT.md). Owner observations and research background: [FMS v2 Research](FMS%20v2%20Research.md#owner-audit-ledger).

## Current status — do not mistake this for a working baseline

- `90aac0f` (`bridge haul`) was the owner's intended last bridge-stability point.
- Only two commits followed it: `4e04979` (`v2 research goal mode 0.5`) and `3e3c208` (`v2 research goal mode done, result drifted too far`). Together they changed 46 files by roughly +12.8k/-326 lines.
- The only post-`90aac0f` MQL change was `FyodorCalendarBridge.mq5` in `4e04979`; it added diagnostic clock fields to the existing cycle acknowledgement. `FyodorQuoteBridge.mq5` did not change. The old backend ignores those additional fields.
- Current `master` is `3e3c208`. Automated tests previously passed, but the owner has directly observed a runtime FMS dock crash (`Cannot read properties of null (reading '0')` in `ChartMacroBiasRealtimeCard`), slow/blank startup, Trade initially or persistently showing only the selected pair, and chart/503 failures during rapid switching. Live owner evidence outranks old completion text.
- Checking out an older source commit does not reset the running Vite/bridge processes, browser storage, caches, durable SQLite data, generated local data, or the compiled EA attached inside MT5. An older checkout must be tested in a clean, explicitly recorded runtime before it can be called good or bad.
- There are 31 known saved arrows in the inspected durable snapshot and all are FMS v1. The newest predates the published v2 activation boundary. Therefore the existing runtime-version filter naturally shows no v2 arrows; that filter is not the historical v1/v2 comparison the owner requested.
- The **only current implementation priority** is the bounded left-panel repair described below. Every other recovery, research, v2, bridge, startup, chart, UI, and repository-hygiene phase in this document is deferred and must not be implemented unless the owner explicitly authorizes that specific phase.

## Current authorized priority — two left-panel defects only

Scope is limited to:

1. Fix the Setups dock crash: `Cannot read properties of null (reading '0')`.
2. Fix `TP rate unavailable` only where valid stored TP-before-SL evidence already exists.

Allowed boundary: left-panel FMS presentation/projection files and directly necessary existing tests. Forbidden without new owner authorization: bridge/server behavior, database schema, clock/time logic, startup, chart history or rendering, research generation, recipe publication, v1/v2 implementation, routes, broad refactoring, and repository hygiene. First confirm the cause and exact file list; then make the smallest coherent repair. Honest missing evidence must remain unavailable rather than being fabricated.

Implementation checkpoint, 2026-09-21:

- Setups crash cause confirmed: some current runtime patterns carry `groups: null`, while decision-scenario and setup-detail rendering assumed an array and indexed/joined it. The three left-panel reads now tolerate absent groups and use the pair currency or `Registered package definition` fallback without inventing evidence.
- TP-rate cause confirmed: Trade treated any partial canonical `historicalEvidence` object as complete, even when its TP fields were null, thereby hiding valid stored active-successor, reviewed execution/entry, or registered-benchmark evidence. Fallback is now used only when that partial object exists and lacks a TP rate; already complete canonical evidence and patterns without that object retain their prior source behavior.
- Scope touched only `ChartMacroBiasRealtimeCard.tsx`, `ChartMacroBiasSetupCatalog.tsx`, `ChartFmsActionCard.tsx`, and the existing `chartsTab.test.ts` regression file. No bridge, server, data, startup, chart, research, time, or repository-structure code changed.
- Automated evidence: focused Charts test file passes 37/37 and `pnpm run typecheck` passes. Owner visual gate remains: open Setups and confirm it renders; inspect previously unavailable EURCAD/EURJPY/AUDUSD/GBPUSD/USDCAD/USDJPY/NZDUSD rows and confirm a rate appears only when stored evidence supports it. Genuine missing evidence must still say unavailable.

## The product request, without reinterpretation

The owner wants:

1. The app to start quickly and remain usable.
2. Rapid pair/timeframe switching without chart crashes, stale candles, mixed price scales, 503 walls, or bridge instability.
3. Trade to show registered setups across all pairs at cold start, not only the selected pair.
4. Go to arrow, Review, Journal, notes, and dock state to behave consistently and preserve the owner's place.
5. FMS v1 and v2 historical arrows to be comparable over the same historical events.
6. V2 candidates to reference the v1 contract and use the audit-note catalogue as declared hypotheses, while preserving v1 arrows/results unchanged.
7. A tidy repository with bounded, owner-specific modules instead of expanding long-running files—but only in a separate hygiene phase after behavior is stable.

This does **not** mean “build a second prospective registration platform,” “change time provenance,” “rework the bridge,” or “publish new live contracts” unless the owner explicitly asks for that separate work.

## Permanent scope guardrails

These rules exist specifically to prevent another goal-mode drift.

- One authorization equals one named surface and one outcome. “Left panel only” means left-panel components, their owned styles, and directly necessary existing tests. It excludes bridge, clock/time, chart history, startup, registration, database schema, research scripts, generated artifacts, routes, and general cleanup.
- Before implementation, report the confirmed cause, the exact proposed files, the behavior that must remain unchanged, and the smallest validation. Do not edit first and explain later.
- If the confirmed fix requires crossing the authorized boundary, stop and ask. Do not treat an architectural dependency as implied permission.
- Never mix a bug fix, research campaign, UI redesign, bridge hardening, performance pass, and repository cleanup in one batch.
- Establish a reproducible failing case before fixing it. Re-run that exact case afterward. Passing tests alone never proves the browser workflow works.
- Prefer deletion or reuse over a new framework, script, registry, artifact family, or compatibility layer. Any new subsystem requires explicit owner agreement.
- No speculative “while here” changes. No drive-by time handling, bridge lifecycle, caching, schema, route, or naming changes.
- Preserve user changes and immutable FMS records. New historical comparison output must be additive and separately versioned.
- Keep diffs reviewable. If the task stops being understandable as one coherent change, stop and split it before proceeding.
- At handoff, distinguish verified facts, automated evidence, manual checks still required, and hypotheses. Never call an untested live flow complete.

## Deferred grand recovery plan — owner authorization required

Every phase below is deferred. No phase begins unless the owner explicitly authorizes implementation of that named phase. Complete and verify one authorized phase before proposing the next.

### Phase 0 — Pause and preserve

Status: deferred; the two-defect left-panel priority above supersedes it.

- Make no source, bridge, data, configuration, or generated-artifact changes.
- Preserve `master`, `90aac0f`, `4e04979`, and `3e3c208` as evidence. Do not rewrite history or delete the current work.
- Keep this checklist as the single active handoff. Old details remain recoverable from Git history and dedicated research documents.

Exit: owner chooses to resume with a bounded read-only diagnosis.

### Phase 1 — Establish a genuinely clean baseline

Purpose: determine which source revision works when runtime state is controlled.

- Use a separate worktree or otherwise isolated checkout; do not overwrite the owner's main working directory.
- Record source commit, bridge process/version, MT5 attached EAs, durable database path, browser storage/cache state, and frontend process for every comparison.
- Test `90aac0f` first, then only the minimum later commit needed to bisect a confirmed regression.
- Use one short smoke sequence: cold start, all-pair Trade population, rapid common/unusual pair switching, timeframe switching, Go to arrow, and FMS dock open.
- Do not fix anything during the baseline pass. The deliverable is a small evidence table and the last genuinely working source/runtime combination.

Exit: the owner confirms the baseline behavior and selects the recovery base.

### Phase 2 — Recover usability one defect at a time

Order is fixed unless the owner changes it:

1. FMS dock null crash.
2. Cold-start shell and all-pair Trade population.
3. Rapid pair/timeframe switching and newest-selection-wins behavior.
4. Go to arrow/Review correctness and configured refocus parity.
5. Journal/Trade/Past Result state and audit-note continuity.

For each defect:

- Confirm one cause from the selected baseline.
- Name the smallest file boundary before editing.
- Do not touch the bridge unless evidence proves the defect is in the bridge and the owner separately authorizes bridge work.
- Run only the targeted existing check plus the exact owner-visible reproduction.
- Commit or checkpoint before moving to the next defect.

Exit: the owner completes the five-step smoke sequence without a crash, long UI freeze, selected-pair-only list, stale chart, or lost dock state.

### Phase 3 — Define FMS v2 comparison before writing runtime code

Purpose: deliver what the owner originally asked for.

- V1 is the immutable historical baseline: its arrows, entries, SL, TP, expiry, outcome, IDs, notes, and provenance never change.
- V2 is a separately declared counterfactual replay over the same eligible historical events. Every v2 row must point to its v1 parent and state exactly what changed.
- The comparison toggle changes the rendered research dataset, not the immutable registration version on prospective records.
- Candidate dimensions come from the audit ledger: event-specific TP/SL/duration, release-near entry, support/resistance-aware placement, trend/role-transition context, overlap clustering, and intervening scheduled events.
- Declare training/selection versus untouched chronological evaluation before calculating a preferred recipe. Report exact denominators, missing/ambiguous paths, years/regimes, and clustered release episodes.
- Produce one small human-readable comparison first: same event, v1 geometry/result, v2 geometry/result, reason, and evidence. The owner reviews it before any chart integration.
- No automatic promotion, no rewriting v1, no live-registration activation, and no bridge dependency.

Exit: the owner approves the comparison semantics and a frozen, reviewable v2 dataset.

### Phase 4 — Add the smallest v1/v2 arrow UI

- One left-panel selector and chart overlay source: `FMS v1`, `FMS v2 candidate`, or optionally `Compare` if visual clarity permits.
- Go to arrow operates on the selected dataset and exact event identity.
- Marker text states version and whether it is immutable/live or counterfactual/research.
- Audit notes remain attached to the event/parent identity and are readable from either version without duplication.
- No changes to bridge lifecycle, source clocks, startup architecture, or live registration.

Exit: the owner can switch versions on the same event, inspect both arrows, and return to the same dock/scroll/expanded state.

### Phase 5 — Continue the owner-led audit loop

- The owner adds notes; Codex reads only new/unreviewed notes, discusses them, records the conclusion, and marks them documented when requested.
- Aggregate observations by event episode, not by pair row alone. Several pairs reacting to one US release are correlated evidence.
- Classify each case as presentation defect, data/cache defect, evaluator defect, correct-but-unintuitive behavior, genuine recipe weakness, or unresolved.
- Accumulated observations may nominate a later v3 hypothesis; they never silently alter v1 or v2.

Exit: enough independent evidence exists for an explicitly authorized successor study.

### Phase 6 — Repository hygiene, separately authorized

- Map ownership and dependencies before moving code.
- Split long files along real feature boundaries, preserving behavior and public contracts.
- Keep market data, chart rendering, FMS docks, audit notes, research, and bridge lifecycle isolated.
- Consolidate duplicate adapters and tests only after proving equivalence.
- Quarantine old routes/pages before deletion. Physical deletion requires explicit owner approval for named targets.
- Do not mix visual redesign or functional changes into extraction commits.

Exit: smaller owner-focused modules, unchanged behavior, clean dependency checks, and owner-confirmed startup/chart/FMS smoke tests.

## Deferred research catalogue

These ideas are preserved, not authorized for implementation.

### Event–pair behavior catalogue — primary research direction

- Build a menu of economic-event families and the pairs they materially affect.
- For each event/pair/direction cohort report sample size, release episodes, years/regimes, objective result direction, follow/reject frequency, median/quantile move, MFE/MAE, and missing/ambiguous coverage.
- Include exact TP-before-SL rates for predeclared TP1/TP2/TP3 levels, not only average movement. Keep eventual touches separate from tradeable TP-before-SL outcomes.
- Compare continuation and rejection explicitly. “High TP” means a repeatable event/pair/contract result, not a large target selected after seeing winners.
- Cluster co-released indicators and same-release cross-pair arrows so correlated rows are not counted as independent proof.
- Preserve `Needs Codex Review` as a bounded queue with explicit decisions and evidence; do not imply that an old declined row is unfinished.
- Publish readable research articles containing the question, declared recipe, data lineage, result table, limitations, and decision.

### Candidate execution hypotheses from audit notes

- Entry at/near release versus first later H1/H4 open; M1 is only for justified finalist ordering.
- Event-specific SL, TP, and maximum duration rather than one universal medicine.
- TP1/TP2/TP3 ladders, target buffers, partial exits, runners, and trailing exits.
- Multi-scale H4/D1/W1 support/resistance bands as probabilistic zones, not deterministic lines.
- Entry inside/near a zone, breakout versus rejection, and support/resistance role transitions.
- Near-target sensitivity, wider-stop geometry, slower follow-through, and the changed R ratio those choices create.
- Intervening scheduled economic releases while a trade remains open.
- Overlapping signals/exposures and one-macro-episode clustering.
- Event-aware open-trade management is late-game only, after the baseline catalogue is reliable.
- FXStreet/unscheduled headline analysis remains outside current trusted inputs and is deferred; it must never be presented as deterministic causation.

### Deferred product/UI work

- Remove the universal header from the normal workflow; retain only genuinely needed chart controls such as Trust State.
- Keep Charts as the primary product. Overview and Specialist/legacy tools stay quarantined and reachable through explicit archive/prototype pages with `Back to Charts`.
- Keep the bottom workspace concept `Matrix / Lens / Calendar`; Calendar belongs there rather than in a universal header.
- Modernize the right inspector and Lens using TradingView/MT5 as references only after stability.
- Configurable panel placement, including right-to-left inspector movement, remains low priority.
- Preserve a compact universal activity log in Trust State, but do not expand diagnostics while repairing unrelated behavior.

### Deferred bridge/broker adaptability

- Broker symbol counts and naming vary; Market Watch and caches must adapt to catalog identity rather than assume the current 279-symbol broker.
- Quote ingestion and chart history must remain separate lanes so unusual-symbol history cannot freeze all Bid/Ask updates.
- Bridge lifecycle, source clocks, history scheduling, and EAs are frozen unless a reproduced defect specifically implicates them and the owner authorizes that work.
- Never promise “impossible to break.” Require bounded failure, honest status, recovery, and logs.

## Minimal owner acceptance sequence for future implementation

This replaces the previous sprawling manual checklist. Run it only after a bounded change affects these behaviors.

1. Cold start: shell appears promptly; Trade shows registered setups across all expected pairs.
2. Rapid switching: alternate common, unusual, JPY, metal/crypto/stock symbols and H4/M1; newest selection wins with one price scale and no 503 wall.
3. FMS docks: open Trade, Journal, Setups, and Past Result; no null crash or multi-second click freeze.
4. Navigation: Go to arrow and Review select the correct pair/timeframe/event, use configured refocus, and preserve the originating dock state.
5. Notes: create/edit one labeled note and confirm the same note appears consistently in Trade, Journal, and Past Result after refresh.
6. Bridge: Trust State remains honest and stable; ordinary client disconnects or deferred background history do not restart the process.

## Non-negotiable financial/data behavior

- Local manual-trading support only; Fyodor sends no orders and promises no profit.
- Trusted inputs remain MT5 OHLCV and the broker economic calendar unless the owner explicitly authorizes another source.
- Preserve immutable first-seen provenance, no-lookahead semantics, frozen contracts, unresolved outcomes, and original records.
- A correction is a new explicit version with the original retained; no silent rewrite or retrospective relabeling.
- Gross results stay gross and must expose missing coverage, ambiguity, overlap, and uncertainty.
- No setup promotes itself from research into runtime.

## Known limitations and unresolved facts

- Current `master` is not owner-validated and has at least one confirmed runtime crash.
- The precise last clean source/runtime combination is unknown because earlier checkout tests reused persistent external state.
- Existing published “FMS v2” successor infrastructure is not the historical comparison UX the owner intended. Preserve it as evidence until the owner chooses whether to retain, quarantine, or remove it.
- Direction-only event-respect research has no challenge-supported candidate yet; provisional rows are not established edge.
- Automated tests, typecheck, and production build do not substitute for the six-step owner acceptance sequence.
- Profitability remains an empirical question. The purpose of this workflow is to make evidence trustworthy enough to answer it without rewriting failures.
