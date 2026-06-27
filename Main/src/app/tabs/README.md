# Tab Folder Map

This folder is split into two buckets so future AI sessions can avoid spending context on stale surfaces.

## `primary/`

Primary tabs are always visible in the top navigation and represent the normal app workflow:

- `OverviewPlaceholderTab.tsx`
- `CentralBanksTab.tsx`
- `ChartsTab.tsx`
- `EconomicCalendarTab.tsx`

Treat these as active product surfaces.

## `secondary/`

Secondary tabs live under Specialist Tools or Prototyping. `EventReplayTab.tsx` is the only active experiment here.

Everything else in this folder is unstable, deprecated, archived, or ignored unless the user explicitly asks for it. Keep old route ids working, but do not treat these files as current product direction by default.
