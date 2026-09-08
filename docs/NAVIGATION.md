# Task-to-file map

Use the relevant row only. Paths below are relative to repository root. Start with a bounded search inside the listed owner; expand only when the dependency requires it.

| Task | First owners |
| --- | --- |
| Charts loading, selection, pair switching | `Main/src/app/tabs/primary/ChartsTab.tsx`; `Main/src/app/hooks/useChartMarketData.ts` |
| Left dock tabs, resizing, panel recovery | `Main/src/app/components/ChartViewport.tsx` |
| Next/Current/Recent, no-trade visibility | `Main/src/app/components/ChartFmsActionCard.tsx` |
| A/F/P, Surprise/Momentum cards | `Main/src/app/components/FmsReleaseCards.tsx` |
| Past arrow audit | `Main/src/app/components/ChartMacroBiasAudit.tsx` |
| Registered Setups and Research docks | `Main/src/app/components/ChartMacroBiasRealtimeCard.tsx` |
| Journal, performance periods | `Main/src/app/components/ChartFmsJournalCard.tsx` |
| Knowledge UI and evidence summaries | `Main/src/app/components/ChartFmsKnowledgeCard.tsx` |
| HTTP requests, preload/in-flight caching | `Main/src/app/lib/bridge.ts` |
| FMS payload types | `Main/src/app/types/macroSignal.ts` |
| Charts/dock CSS | `Main/src/styles/15-charts.css`; consult `Main/src/styles/README.md` only for other ownership |
| FMS lifecycle, endpoint caches, registration | `Main/mt5-bridge/server.py` (authorization boundary in AGENTS) |
| Economic scoring and execution semantics | `Main/mt5-bridge/macro_signal.py` |
| Persisted observations/candles/research | `Main/mt5-bridge/research_store.py` |
| Workbench | `Main/src/app/tabs/secondary/MacroSignalLabTab.tsx` |
| Routes, active vs garbage surfaces | `Main/src/app/AppRoutes.tsx`; `Main/src/app/config/navigation.ts` |
| Startup/ports | `package.json`; `scripts/start-bridge.js`; `scripts/start-mt5.js` |

## Reference shelf: consult selectively

- `AGENTS.md`: permanent operating rules. `CONTEXT.md`: vocabulary/invariants. `docs/Development Logs/Checklist.md`: current handoff and deferred work.
- `docs/Development Logs/FMS Research Progress.md`: search for the campaign/hypothesis before research. `Fyodor Macro Signal Research.md` in the same folder is the longer evidence history.
- `docs/Development Logs/Current App Map.md`: detailed route/component history. `UI Design.md`: detailed design reference. Neither is required startup reading; latest user decisions and Checklist supersede older descriptions.
- Local folder READMEs are optional ownership indexes, not a reading chain.
- `docs/Development Logs/archive/Checklist through 2026-09-08.md`: exact preserved planning/history snapshot. Search a specific topic only if the compact handoff lacks needed detail.

## Search boundaries

Avoid `docs/Private`, `docs/IGNORE`, `docs/design-mockup`, `docs/Development Logs/archive`, generated artifact directories, and `Main/src/app/{tabs,lib,tests}/garbage` during normal orientation. Retained files are not active requirements. Do not delete or revive them without a targeted request.

Example: `rg -n "partitionFmsActivity|buildRecentFmsActivity" Main/src/app/components/ChartFmsActionCard.tsx`.
For a large reference, search headings (`rg -n "^#" <file>`) then read the relevant section. Do not dump research JSON, databases, or complete logs.
