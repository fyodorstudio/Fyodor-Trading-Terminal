# Current App Map

Last updated: 2026-08-27

This is the short orientation doc for future AI and human sessions. Read it with `Checklist.md` before using older roadmap, audit, or patch notes.

## Active Planning Rule

- `docs/Development Logs/Checklist.md` is the active command board.
- `docs/Private` stays on disk but should be ignored unless the user explicitly asks for it.
- Git history is the source for old implementation details.

## Product Direction

- Fyodor supports manual trading decisions; it does not produce trade calls.
- The user does technical analysis outside the app, mainly in TradingView, then uses Fyodor to inspect fundamentals, calendar risk, central-bank context, and event reaction history for the pair of interest.
- Current trusted raw data is limited to MT5 OHLCV plus broker/MT5 economic-calendar rows.
- Central Banks Data is the strongest current reference surface and should remain stable unless a targeted bug requires changes.
- Event Replay is a core study/edge surface.
- Six Questions and Work In Progress are deprecated/context-risk surfaces for now; do not use them as controlling product direction. Aesthetic Forge is mounted behind the header gear and stays closed by default.

## Current Top-Level Tabs

1. `Overview`
   - Current state: fresh pair-brief surface.
   - Uses the selected pair, active MT5 calendar rows, active central-bank snapshots, and market status.
   - Shows pair selector, Pair Driver Snapshot, next loaded pair event/countdown, base/quote macro cards, compact factor coverage, pair details popover, and recent-release popover.
   - It is a glanceable decision-support brief, not a signal or trade-call surface.
   - The older implementation is still available as `Deprecated Overview` through Prototyping.

2. `Central Banks Data`
   - Current state: primary, useful surface.
   - Uses MT5 calendar rows to derive major-currency policy/inflation snapshots.
   - Unresolved values should stay unresolved.

3. `Charts`
   - Current state: primary, useful surface.
   - Current override: `FMS-REGISTERED-REACTION-H4-v4` contains 47 immutable, pair-orientation-correct recipes across EURUSD, GBPUSD, USDJPY, AUDUSD, USDCAD, NZDUSD, and USDCHF. It supports continuation and rejection mappings plus declared past-only ordinary-magnitude filters. Every row reconciles with a current-scoring-engine experiment and chronological later-test audit; 11 marginal survivors are visibly labelled `Positive but fragile`. The three missing EURUSD legacy ideas were reconstructed under the current engine. Shadow Trader explicitly says no setup is safe to follow blindly.
   - Uses `lightweight-charts`, MT5 history/stream data, chart cache, cursor readout modes, chart settings, and clustered broker-calendar event markers.
   - Registered FMS markets have one opt-in `Macro bias` view. The scanner always uses the registered current rules; `Past arrows` merely shows or hides their hindsight history, so users no longer choose between separate Current Model and Research Replay modes. All arrows project the frozen H4 contract across the selected chart timeframe; they do not claim a native lower- or higher-timeframe backtest. A gray dot owns the release candle when release and activation occupy different displayed candles; the directional arrow represents the first strictly later H4 open used by the simulation.
   - Current `FMS-HISTORICALLY-PROFITABLE-H4-v1` is the practical Charts registry. It preserves three earlier EURUSD rules, replaces the older US-industrial-output rule with its positive walk-forward directional contract, and adds historically positive frozen recipes for GBPUSD, USDCAD, and USDJPY. The top-right `FMS Shadow Trader` is global across all four registered markets: a live scanner status strip and watchlist show what is being watched, the latest/next relevant event, the fixed trade rules, and prominent exact-setup average R plus TP-before-SL history. Its expandable research and setup rows use explicit `Show`/`View details` affordances, while actual buttons use distinct filled styling. Arrow audits follow the task reading order—triggering event/package and direction first, result second, timing third, historical benchmark fourth, disclaimer last—and leave broader diagnostics to the Workbench. Spread, commission, slippage, and swap are excluded rather than estimated; no order is sent to MT5.
   - Current Model data begins preloading at app startup, rather than waiting for Charts or the Macro Bias control. The toolbar exposes active/expired state over the frozen 30-H4-candle horizon. Clicking either marker opens sample, target-first, stress, recent, year-stability, past-only, timestamp, source-event, model-hash, and dataset-hash evidence.
   - Charts defaults to Current Model. Its separate default-on `Historical matches` control projects the exact current rules backward without relabeling them post-activation/live. Macro Signal Lab loads its heavier MFE/MAE and flexible-exit report independently so the existing research view remains usable during calculation.
   - Arrows are research classifications, not automatic orders, guarantees, or proof that the release caused the later move.

4. `Economic Calendar`
   - Current state: primary, useful surface.
   - MT5-backed event schedule with range/filter/search, freshness wording, and a right-side event inspector.
   - Event explanations should remain cautious and concise.

5. `Specialist Tools`
   - Current state: `FMS Experiment Workbench` is the sole Active Tool; Differential Calculator is an Active Experiment; Event Replay, Macro Drivers, and Prototyping are retained under Garbage / Ignore.
   - Six Questions and WIP Map are no longer direct Specialist Tools children.

## App Loading

- Heavy route tabs are lazy-loaded from `App.tsx`.
- `OverviewPlaceholderTab` remains eager because it is the initial top-level surface. Despite the file name, it now contains the fresh pair-brief implementation.
- `FlagIcon` currently uses `react-world-flags`; the large production chunk and missing TypeScript declaration are known non-blocking noise. Do not revisit flags unless explicitly requested.

## Specialist Tools Children

Current direct children under `Specialist Tools`:

1. `Active Tool` / `DIFFERENTIAL CALCULATOR`
   - Active arithmetic view for policy-rate and inflation differentials across major FX pairs.
   - Keeps route id `dashboard` for compatibility.

2. `Active Tool` / `MACRO DRIVERS`
   - Active current-data-only driver map for forex and gold.
   - Uses MT5 OHLCV, broker/MT5 calendar rows, and central-bank snapshots.
   - Explains trend state, current macro snapshot, coverage summary, and missing data without producing trade calls.
   - Detailed pair-level calendar factor coverage now belongs in Overview, not in Macro Drivers.

3. `Active Experiment` / `EVENT REPLAY`
   - Primary pair-first replay surface for studying scheduled event reactions.
   - Shows base/quote event types first, major global movers separately, past releases, replay controls, and descriptive replay notes.

4. `Active Tool` / `FMS EXPERIMENT WORKBENCH`
   - Bounded EURUSD/H4 FMS Experiment Workbench with one setup entry per directionless package, explicit Long/Short/Both-direction variants and N counts, plainly named Single/Combined Contracts, live R-to-ATR TP conversion, inline Forecast Guard disclosure, recorded experiments, frozen review candidates, and a full-screen raw A/F/P/S/M plus trade-outcome audit.
   - New durable identifiers are E (recorded experiment), C (frozen review candidate), and reserved M (reviewed Charts model). Freezing never changes Charts; there is intentionally no promotion API or UI.
   - Uses durable bridge calendar storage and cached MT5 H4/M1 candles.
   - Reports gross historical Long/Short bias cases, explicit ambiguity, holdout results, and paper-eligibility checks without placing orders.
   - Historical backfill and v1/v2/v3/v5/v7 source runs are complete. The upgraded EA's successful cycle acknowledgement activates immutable first-seen capture. Charts v13 consumes registered source observations prospectively, enforces exact package identities where declared, carries a frozen execution contract per setup, applies the past-only Forecast guard, keeps unregistered candidates in hindsight research, and never uses context as an unstated signal filter.
   - Legacy v1-v13 definitions and runs remain reproducible but no longer occupy primary Lab navigation. V11/v12 artifacts inform guarded catalog treatments when their durable cache exists; opening the Lab does not recalculate them.

5. `Garbage / Ignore` / `PROTOTYPING`
   - Garbage drawer for old unfinished surfaces, deprecated planning drafts, and ignored tools.
   - This is not the final workflow surface.
   - Contains Six Questions Draft and WIP Map Archive.

## Secondary Routes

Garbage drawer routes:

- `Currency Strength From Candles`
- `Watchlist Engine`
- `Macro State`
- `Six Questions Draft`
- `WIP Map Archive`
- `Strength Meter`
- `Deprecated Overview`

Do not read, delete, or promote these unless the user explicitly asks for garbage-drawer work.

Archive candidates not currently routed as the main workflow:

- `ArchivedEventReactionStudyTab.tsx`
- `ArchivedEventQualityStudyTab.tsx`

Current Event Replay implementation entrypoint:

- `tabs/secondary/EventReplayTab.tsx`
- `EventReplayCandlestickChart.tsx`
- `EventReplayPanels.tsx`
- `eventReplayStorage.ts`
- `eventReplayView.ts`

## Tab Folder Map

- `Main/src/app/tabs/primary/` contains always-visible primary workflow tabs.
- `Main/src/app/tabs/secondary/` retains the stable route components, but only FMS Experiment Workbench and Differential Calculator are active product surfaces. Event Replay, Macro Drivers, and Prototyping are navigation-level Garbage / Ignore surfaces.
- `Main/src/app/tabs/garbage/` contains old unfinished, deprecated, or ignored routed surfaces. Ignore it unless the user explicitly asks for one of those screens.
- `Main/src/app/lib/garbage/` contains supporting logic for garbage-drawer routes. Ignore it unless the user explicitly asks for that logic.
- `Main/src/app/tests/garbage/` contains tests for garbage-drawer routes and logic. Ignore it unless the user explicitly asks for garbage-drawer work.

## Test Policy

- Do not create new tests unless the user explicitly agrees.
- Before creating a test, explain in plain English what behavior it protects.
- Prefer targeted verification. Do not run broad/full test suites after every small pass.

## Six Questions And Current Owners

1. Can I trust the app right now?
   - Current owners: header/status surfaces, Economic Calendar freshness, bridge health, Central Banks resolution.
   - Current Overview owner: selected-pair market session and pair context only; broader trust still belongs to the header/status surfaces.

2. What deserves attention right now?
   - Current owner: Overview shows the selected pair's next loaded event and upcoming pair-relevant events.
   - Do not revive Watchlist Engine or Strength Meter for this unless the user explicitly asks.

3. Is the macro backdrop supportive, hostile, or unclear?
   - Current owners: Central Banks Data, active Differential Calculator, and Macro Drivers. Macro State remains a prototype only.

4. Is event risk close enough to invalidate a clean setup?
   - Current owners: Economic Calendar, Event Replay primary surface.
   - Future owner: shared event explainer knowledge base should deepen the selected-event explanation.

5. Which side is winning, and why?
   - Current owner: no active surface makes a promoted strength claim.
   - Overview shows base/quote policy and inflation context only. It must not infer winners from deprecated strength logic.

6. Should I watch, study, prepare, wait, or ignore?
   - Current owners: selected specialist surfaces; Six Questions remains only as deprecated planning context.
   - Future owner: Overview only after the underlying specialist outputs are mature enough.

The six-question list is no longer the active product framework. Keep it as a historical scaffold until each useful surface is remapped to the user's actual workflow.

## Event Replay

Event Replay is the current primary pair-first event reaction study surface.

Current v1 behavior:

- pair-first workflow;
- Event Replay owns and remembers its selected pair;
- base/quote events shown first;
- major global movers shown separately;
- user can choose an event type and prior release sample;
- chart replay shows how candles reacted around release time;
- selected releases reuse the same concise event explainer pipeline as Economic Calendar;
- actual-vs-forecast is the main comparison;
- actual-vs-previous is used only when the broker feed has no numeric forecast;
- language stays descriptive and avoids trade calls.

Replay history depth should use the current broker calendar/history window for v1, while leaving room for a configurable history-depth setting later.

Recent UI polish:

- Event Replay follows pair -> event -> release -> replay setup -> playback.
- Select Event, Past Releases, and Replay Brief use centered overlay panels.
- The main chart-first cockpit should fit more comfortably on normal desktop viewports.

## Docs Noise Rule

Older docs may be historically useful, but they are not current truth unless the user says so.

Default read order:

1. `docs/Development Logs/Checklist.md`
2. this file
3. root `README.md`
4. `Main/README.md`
5. relevant source files

Avoid reading `docs/Private` by default.
