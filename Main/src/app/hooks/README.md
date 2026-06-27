# App Hooks

Hooks in this folder extract app-shell side effects out of `App.tsx`.

- `useCalendarFeed.ts` owns bridge health + economic calendar polling.
- `useMarketStatus.ts` owns per-symbol market status polling.
- `useTerminalTheme.ts` owns Aesthetic Forge theme/font preference persistence and CSS variable application.

Keep hooks here focused on app-shell wiring. Feature-specific state should stay near the feature tab or its lib helpers.
