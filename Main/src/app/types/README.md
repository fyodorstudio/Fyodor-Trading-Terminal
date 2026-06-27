# Type Domains

`../types.ts` is a compatibility barrel. Existing imports from `@/app/types` should keep working.

Prefer narrow domain imports in new code when it improves clarity:

- `navigation.ts` - route ids.
- `bridge.ts` - MT5 bridge responses, candles, symbols, and market status.
- `calendar.ts` - calendar rows, calendar navigation, date ranges, and explainers.
- `centralBanks.ts` - central-bank mapping and derived snapshot types.
- `fx.ts` - FX pair definitions.
- `dashboard.ts` - differential calculator types.
- `strength.ts`, `watchlist.ts`, `eventQuality.ts`, `eventReaction.ts` - secondary/prototype and Event Replay study types.

Do not remove the barrel until the whole app has been migrated deliberately.
