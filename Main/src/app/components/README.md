# Component Map

This folder contains shared app-shell and feature support components. Keep feature-specific components close to their owning feature when they grow beyond shared use.

## App Shell

- `MinimalHeader.tsx` - global trust/status header. Active and important; avoid broad visual edits without checking Charts, Calendar, Central Banks, and Event Replay.
- `TabNavigation.tsx` - top navigation and Specialist Tools dropdown.
- `UiCommandPanel.tsx` - Aesthetic Forge side panel mounted behind the header gear. It stays closed by default and must not drive broad visual redesign without a specific plan.

## Shared Small Components

- `ChartEventOverlay.tsx` - DOM event marker rail used by the Charts surface. Keep event clustering and coordinate math in `lib/chartEventOverlay.ts`.
- `ChartSettingsSections.tsx` - Chart settings drawer tab bodies for appearance, cursor, event overlay, and cache diagnostics.
- `ChartStatusRail.tsx` - Charts connection/session/latest-candle status rail and timezone dropdown.
- `ChartSymbolPicker.tsx` - Charts symbol search, favorites, group expansion, and timeframe strip.
- `ChartToolStrip.tsx` - Charts cursor mode, refocus, events, appearance, and cache tool buttons.
- `ChartViewport.tsx` - Charts canvas frame, event overlay mounting, crosshair readout, error overlay, and terminal console rendering.
- `EconomicCalendarControls.tsx` - Economic Calendar help tooltip, freshness chip, impact summary, and clock cards.
- `EconomicCalendarEventsTable.tsx` - Economic Calendar grouped event table and row selection rendering.
- `EconomicCalendarInspector.tsx` - Economic Calendar event drawer, impact pill, and source-preserving value display.
- `EconomicCalendarToolbar.tsx` - Economic Calendar range, impact, country, search, timezone, and freshness toolbar rendering.
- `FlagIcon.tsx` - country/currency flag wrapper. `react-world-flags` works through the local declaration in `Main/src/types/react-world-flags.d.ts`; its large build chunk is known non-blocking noise unless the user asks to revisit flags.
- `LocalClock.tsx`, `Mt5Clock.tsx`, `MarketStatusPill.tsx` - small status/time display helpers.
- `OverviewPopovers.tsx` - active Overview pair release popover and pair-details modal rendering.

## Event Replay Support

- `EventReplayCandlestickChart.tsx`
- `EventReplayBriefModal.tsx` - Event Replay study/config brief modal.
- `EventReplayControlRail.tsx` - Event Replay left workflow rail for pair, event, release, and playback controls.
- `EventReplayPanels.tsx` - compact replay template button support.
- `EventReplayReleaseListModal.tsx` - Event Replay historical release list and hover-linked release calendar.
- `EventReplaySelectEventModal.tsx` - Event Replay event-template selector modal with upcoming/recent discovery columns.

These support the active Event Replay surface under `tabs/secondary/EventReplayTab.tsx`.
