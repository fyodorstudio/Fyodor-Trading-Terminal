# App Hooks

Hooks in this folder extract reusable side effects or bulky feature orchestration that should not live inside tab components.

- `useCalendarFeed.ts` owns bridge health + economic calendar polling.
- `useChartEventOverlay.ts` owns Charts event-overlay filtering, visible-range capping, coordinate projection, and cluster derivation.
- `useChartMarketData.ts` owns Charts symbol discovery, MT5 history loading, local candle cache updates, older-history paging, and live stream state.
- `useCurrentTime.ts` owns the app-shell ticking clock.
- `useEconomicCalendarData.ts` owns Economic Calendar bridge row loading, country-source row loading, retained-row fallback behavior, and freshness status.
- `useEventReplayPlayback.ts` owns Event Replay candle-window fetching, in-memory replay request caching, and playback timing.
- `useMacroDriverCandles.ts` owns Macro Drivers MT5 candle loading across W1, D1, and H4.
- `useMarketStatus.ts` owns per-symbol market status polling.
- `useTerminalTheme.ts` owns persisted theme/font CSS variable application. The Aesthetic Forge panel is hidden, but the theme plumbing remains active.

Keep feature-specific hooks here only when they remove substantial orchestration from an active surface and are clearly named for that surface.
