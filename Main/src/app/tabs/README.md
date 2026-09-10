# Tab Folder Map

This folder is split so future AI sessions can avoid spending context on stale surfaces.

## `primary/`

This directory retains stable route owners, but Charts is now the sole normal startup workspace:

- `OverviewPlaceholderTab.tsx`
- `CentralBanksTab.tsx`
- `ChartsTab.tsx`
- `EconomicCalendarTab.tsx`

`EconomicCalendarTab.tsx` is active inside the Charts bottom dock. Overview and Central Banks keep their route IDs and lazy rendering for compatibility but are absent from normal navigation pending the P6 deletion audit.

`OverviewPlaceholderTab.tsx` keeps its old filename for route stability, but it now owns the fresh pair-brief Overview. Do not use Deprecated Overview or garbage overview logic as its source.

## `secondary/`

`MacroSignalLabTab.tsx` renders the retained table-first **FMS Experiment Workbench** with separate Declare, Run status, Results, and Archive jobs, and is opened directly from the chart workbar. `DifferentialCalculatorTab.tsx` remains a hidden retained experiment. The general Specialist Tools navigation container is no longer mounted. Event Replay, Macro Drivers, and Prototyping retain stable lazy routes under `Garbage / Ignore` and must not steer active product design.

Keep this folder limited to active secondary surfaces and shells.

## `garbage/`

Old unfinished, deprecated, or ignored routed surfaces live here. Keep old route ids working, but do not read or edit this folder unless the user explicitly asks for one of those screens.

Current garbage drawer files are named after their Prototyping labels: `CurrencyStrengthFromCandlesTab.tsx`, `WatchlistEngineTab.tsx`, `MacroStateTab.tsx`, `SixQuestionsDraftTab.tsx`, `WipMapArchiveTab.tsx`, `StrengthMeterTab.tsx`, and `DeprecatedOverviewTab.tsx`.

Archive-only study screens live here as `ArchivedEventReactionStudyTab.tsx` and `ArchivedEventQualityStudyTab.tsx`.
