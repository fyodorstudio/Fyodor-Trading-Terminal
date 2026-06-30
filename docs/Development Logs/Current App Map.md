# Current App Map

Last updated: 2026-06-30

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
   - Shows pair selector, next pair-relevant event/countdown, upcoming pair events, base/quote macro cards, and route buttons to deeper specialist surfaces.
   - It is a glanceable decision-support brief, not a signal or trade-call surface.
   - The older implementation is still available as `Deprecated Overview` through Prototyping.

2. `Central Banks Data`
   - Current state: primary, useful surface.
   - Uses MT5 calendar rows to derive major-currency policy/inflation snapshots.
   - Unresolved values should stay unresolved.

3. `Charts`
   - Current state: primary, useful surface.
   - Uses `lightweight-charts`, MT5 history/stream data, chart cache, cursor readout modes, and chart settings.
   - This is price-context and inspection support, not a prediction surface.

4. `Economic Calendar`
   - Current state: primary, useful surface.
   - MT5-backed event schedule with range/filter/search, freshness wording, and a right-side event inspector.
   - Event explanations should remain cautious and concise.

5. `Specialist Tools`
   - Current state: short grouped drawer with Differential Calculator, active Event Replay, and the Prototyping garbage drawer.
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

2. `Active Experiment` / `EVENT REPLAY`
   - Primary pair-first replay surface for studying scheduled event reactions.
   - Shows base/quote event types first, major global movers separately, past releases, replay controls, and descriptive replay notes.

3. `Garbage / Ignore` / `PROTOTYPING`
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
- `Main/src/app/tabs/secondary/` contains Event Replay, Differential Calculator, and the Prototyping shell.
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
   - Current owners: Central Banks Data and active Differential Calculator. Macro State remains a prototype only.

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
