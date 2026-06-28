# App Logic Map

This folder holds pure helpers, bridge adapters, and feature engines. Prefer editing the narrowest file that owns the behavior.

## Primary / Shared

- `bridge.ts` is the frontend HTTP/WebSocket adapter for the local MT5 bridge.
- `status.ts`, `format.ts`, `timezoneDisplay.ts`, and `calendarRanges.ts` are shared UI/data helpers.
- `centralBankDerive.ts` is primary product logic for Central Banks Data.
- `chartDisplay.ts`, `chartStorage.ts`, and `chartView.ts` support the primary Charts tab.
- `calendarDisplay.ts` owns pure date, range, freshness, and display helpers for Economic Calendar UI.
- `eventHorizon.ts` owns the small event-warning summary shown by the app shell.
- `calendarNavigation.ts`, `calendarEventExplain.ts`, `calendarEventKnowledge.ts`, and `calendarEventDefinitions.ts` support the primary Economic Calendar and Event Replay explanations.

## Event Replay

- `eventReaction.ts` contains the replay/event-template study logic used by the active Event Replay surface.
- `eventReplayStorage.ts` owns Event Replay localStorage keys and persistence helpers.
- `eventReplayView.ts` owns replay view/window helpers.

## Secondary / Deprecated

These files back Prototyping or deprecated surfaces. Do not treat them as product direction unless the user explicitly asks for those tools:

- `overview.ts`
- `strengthMeter.ts`
- `watchlistEngine.ts`
- `macroState.ts`
- `macroViews.ts`
- `currencyCandleStrength.ts`
- `eventQuality.ts`

`eventQuality.ts` is also used by calendar/event explanation classification, so change it carefully even though the old Event Quality tab is secondary.
