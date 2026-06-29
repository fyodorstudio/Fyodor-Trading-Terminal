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
- `eventQuality.ts` is shared by Event Replay and calendar/event explanation classification.
- `eventReplayDisplay.ts` owns Event Replay display labels, initial UI selections, and template sorting.
- `eventReplayStorage.ts` owns Event Replay localStorage keys and persistence helpers.
- `eventReplayView.ts` owns replay view/window helpers.

## Garbage

`garbage/` contains logic for old unfinished, deprecated, or ignored routed surfaces. Do not read or edit it unless the user explicitly asks for a garbage-drawer screen or its supporting logic.

The moved garbage-owned logic includes old overview, strength meter, macro state, macro views, watchlist engine, and currency-candle strength helpers.
