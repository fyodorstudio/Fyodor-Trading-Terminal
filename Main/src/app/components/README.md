# Component Map

This folder contains shared app-shell and feature support components. Keep feature-specific components close to their owning feature when they grow beyond shared use.

## App Shell

- `MinimalHeader.tsx` - global trust/status header. Active and important; avoid broad visual edits without checking Charts, Calendar, Central Banks, and Event Replay.
- `TabNavigation.tsx` - top navigation and Specialist Tools dropdown.
- `UiCommandPanel.tsx` - hidden Aesthetic Forge side panel kept for possible future reuse. It is not mounted in the active app shell.

## Shared Small Components

- `FlagIcon.tsx` - country/currency flag wrapper. `react-world-flags` works; its type warning and large build chunk are known non-blocking noise unless the user asks to revisit flags.
- `LocalClock.tsx`, `Mt5Clock.tsx`, `MarketStatusPill.tsx` - small status/time display helpers.

## Event Replay Support

- `EventReplayCandlestickChart.tsx`
- `EventReplayPanels.tsx`

These support the active Event Replay surface under `tabs/secondary/EventReplayTab.tsx`.
