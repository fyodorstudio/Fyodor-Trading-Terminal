# Tab Folder Map

This folder is split so future AI sessions can avoid spending context on stale surfaces.

## `primary/`

Primary tabs are always visible in the top navigation and represent the normal app workflow:

- `OverviewPlaceholderTab.tsx`
- `CentralBanksTab.tsx`
- `ChartsTab.tsx`
- `EconomicCalendarTab.tsx`

Treat these as active product surfaces.

## `secondary/`

Secondary tabs live under Specialist Tools. `EventReplayTab.tsx` is the only active experiment here, and `PrototypingTab.tsx` is only the shell that opens the garbage drawer.

Keep this folder limited to active secondary surfaces and shells.

## `garbage/`

Old unfinished, deprecated, or ignored routed surfaces live here. Keep old route ids working, but do not read or edit this folder unless the user explicitly asks for one of those screens.

Current garbage drawer files are named after their Prototyping labels: `CurrencyStrengthFromCandlesTab.tsx`, `WatchlistEngineTab.tsx`, `MacroStateTab.tsx`, `SixQuestionsDraftTab.tsx`, `WipMapArchiveTab.tsx`, `StrengthMeterTab.tsx`, `DifferentialCalculatorTab.tsx`, and `DeprecatedOverviewTab.tsx`.

Archive-only study screens live here as `ArchivedEventReactionStudyTab.tsx` and `ArchivedEventQualityStudyTab.tsx`.
