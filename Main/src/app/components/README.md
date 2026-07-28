# Component Map

This folder contains shared app-shell and feature support components. Keep feature-specific components close to their owning feature when they grow beyond shared use.

## App Shell

- `MinimalHeader.tsx` - global trust/status header. Active and important; avoid broad visual edits without checking Charts, Calendar, Central Banks, and Event Replay.
- `TabNavigation.tsx` - top navigation and Specialist Tools dropdown.
- `UiCommandPanel.tsx` - Aesthetic Forge side panel mounted behind the header gear. It stays closed by default and must not drive broad visual redesign without a specific plan.

## Shared Small Components

- `ChartEventOverlay.tsx` - DOM event marker rail used by the Charts surface. Keep event clustering and coordinate math in `lib/chartEventOverlay.ts`.
- `ChartStatusRail.tsx` - Charts connection/session/latest-candle status rail and timezone dropdown.
- `ChartSymbolPicker.tsx` - Charts symbol search, favorites, group expansion, and timeframe strip.
- `ChartToolStrip.tsx` - Charts cursor mode, refocus, events, appearance, and cache tool buttons.
- `EconomicCalendarControls.tsx` - Economic Calendar help tooltip, freshness chip, impact summary, and clock cards.
- `EconomicCalendarInspector.tsx` - Economic Calendar event drawer, impact pill, and source-preserving value display.
- `FlagIcon.tsx` - country/currency flag wrapper. `react-world-flags` works through the local declaration in `Main/src/types/react-world-flags.d.ts`; its large build chunk is known non-blocking noise unless the user asks to revisit flags.
- `LocalClock.tsx`, `Mt5Clock.tsx`, `MarketStatusPill.tsx` - small status/time display helpers.

## Event Replay Support

- `EventReplayCandlestickChart.tsx`
- `EventReplayModals.tsx` - centered Event Replay modal shells for release lists and replay briefs.
- `EventReplayPanels.tsx` - compact replay template button support.

These support the active Event Replay surface under `tabs/secondary/EventReplayTab.tsx`.
