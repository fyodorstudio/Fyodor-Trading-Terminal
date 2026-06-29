# App Hooks

Hooks in this folder extract app-shell side effects out of `App.tsx`.

- `useCalendarFeed.ts` owns bridge health + economic calendar polling.
- `useCurrentTime.ts` owns the app-shell ticking clock.
- `useMarketStatus.ts` owns per-symbol market status polling.
- `useTerminalTheme.ts` owns persisted theme/font CSS variable application. The Aesthetic Forge panel is hidden, but the theme plumbing remains active.

Keep hooks here focused on app-shell wiring. Feature-specific state should stay near the feature tab or its lib helpers.
