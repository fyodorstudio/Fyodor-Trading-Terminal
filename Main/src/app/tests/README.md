# App Test Map

Use this folder to find the narrowest proof for a change before running the whole suite.

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

## Shared Infrastructure

- `status.test.ts` covers trust/calendar/chart status derivation.
- `timezoneDisplay.test.ts` covers timezone formatting and preference helpers.
- `flagIcon.test.tsx` covers the current `react-world-flags` wrapper. Leave this alone unless the user explicitly asks to revisit flags.

## Secondary / Prototyping

These tests protect archived or unstable surfaces that remain routable:

- `dashboardTabs.test.tsx`
- `eventQuality.test.tsx`
- `macroState.test.ts`
- `macroStatePrototypeTab.test.tsx`
- `macroViews.test.ts`
- `overview.test.ts`
- `strengthMeter.test.ts`
- `terminalQuestionsTab.test.tsx`
- `watchlistEngine.test.ts`
- `watchlistEnginePrototypeTab.test.tsx`
- `workInProgressTab.test.tsx`

Run `pnpm --dir Main test` before committing behavior-adjacent frontend changes, and `pnpm --dir Main build` before checkpoint commits that touch routing, imports, or lazy-loaded surfaces.
