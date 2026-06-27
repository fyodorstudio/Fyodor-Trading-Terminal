# Component Map

This folder contains shared app-shell and feature support components. Keep feature-specific components close to their owning feature when they grow beyond shared use.

## App Shell

- `MinimalHeader.tsx` - global trust/status header. Active and important; avoid broad visual edits without checking Charts, Calendar, Central Banks, and Event Replay.
- `TabNavigation.tsx` - top navigation and Specialist Tools dropdown.
- `UiCommandPanel.tsx` - Aesthetic Forge side panel. Secondary/styling infrastructure; do not let it drive core product design.

## Shared Small Components

- `FlagIcon.tsx` - country/currency flag wrapper.
- `LocalClock.tsx`, `Mt5Clock.tsx`, `MarketStatusPill.tsx` - small status/time display helpers.

## Event Replay Support

- `EventReplayCandlestickChart.tsx`
- `EventReplayPanels.tsx`

These support the active Event Replay surface under `tabs/secondary/EventReplayTab.tsx`.
