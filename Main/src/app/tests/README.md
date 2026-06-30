# App Test Map

Use this folder to find the narrowest proof for a change. Do not create new tests unless the user explicitly agrees; first explain in plain English what the test protects.

Prefer targeted tests. Do not run the full suite after every small pass unless the change touches routing, shared contracts, or multiple active surfaces.

## Primary Surfaces

- `centralBanksTab.test.tsx` and `centralBankDerive.test.ts` cover Central Banks Data rendering and MT5 calendar-derived snapshot logic.
- `chartsTab.test.ts`, `chartView.test.ts`, and `chartStorage.test.ts` cover Charts UI shell behavior, chart display helpers, preferences, and local candle cache behavior.
- `economicCalendarTab.test.tsx`, `calendarNavigation.test.ts`, and `calendarRanges.test.ts` cover Economic Calendar rendering, event drawer behavior, navigation intents, freshness labels, and date ranges.
- `overviewPlaceholderTab.test.tsx` covers the intentionally blank rebuild Overview surface.
- `navigationTruth.test.tsx` covers top navigation and Specialist Tools grouping.

## Event Replay

- `eventReaction.test.tsx` covers pair-first event grouping, release samples, replay range sizing, and the Event Replay shell.
- `eventReplayDisplay.test.ts` covers Event Replay status labels, initial display helpers, and event-template sorting.
- `eventReplayView.test.ts` covers replay window/view calculations.
- `eventReplayStorage.test.ts` covers Event Replay localStorage persistence.
- `eventHorizon.test.ts` covers the app-shell next high-impact event summary.
- Differential Calculator render coverage currently lives in `garbage/differentialCalculatorAndStrengthMeterTabs.test.tsx` as legacy mixed coverage; do not split it into a new active test file without explicit user approval.

## Shared Infrastructure

- `status.test.ts` covers trust/calendar/chart status derivation.
- `timezoneDisplay.test.ts` covers timezone formatting and preference helpers.
- `flagIcon.test.tsx` covers the current `react-world-flags` wrapper. The flag package works; its TypeScript declaration warning and large build chunk are known non-blocking noise. Leave this alone unless the user explicitly asks to revisit flags.

## Garbage Tests

`garbage/` contains tests for old unfinished, deprecated, or ignored surfaces and supporting logic. Do not read or run these for normal active-surface work unless the user explicitly asks for garbage-drawer behavior.

Garbage tab tests use the renamed Prototyping labels, for example `differentialCalculatorAndStrengthMeterTabs.test.tsx`, `macroStateTab.test.tsx`, `watchlistEngineTab.test.tsx`, `sixQuestionsDraftTab.test.tsx`, `wipMapArchiveTab.test.tsx`, and `archivedEventQualityStudyTab.test.tsx`.

Run `pnpm --dir Main build` before checkpoint commits that touch routing, imports, or lazy-loaded surfaces.
