# Fyodor Trading Terminal — Durable Context

Use this file for compact project vocabulary, architecture, ownership, and invariants. Use `AGENTS.md` for permanent operating rules, `docs/Development Logs/Checklist.md` for the active mission and settled decisions, and Charts → FMS Knowledge for detailed research evidence.

## Product and terminology

- **Fyodor** is a local manual-trading support terminal. It never sends an MT5 order or promises profit.
- **FMS** is the primary product objective: discover immutable economic-release recipes with positive chronological historical expectancy, register supported non-duplicates, show historical matches, and monitor future releases.
- **Recipe/setup/pattern** means an exact market, source family, event series or same-time package, scoring policy, direction treatment, reaction treatment, optional cohort, and execution contract.
- **Evidence direction** is the direction implied by economic scoring. **Trade direction** is the final pair direction after base/quote orientation and continuation/contrarian treatment. Never substitute one for the other.
- **Registered** means a code-owned immutable contract with evidence and an activation boundary. Research candidates never change Charts or Shadow Trader automatically.
- **Historical replay**, **recovered offline**, and **live captured** are separate provenance classes. Only a complete first-seen package observed before the frozen entry is prospectively eligible.
- **MFE/MAE** describe path excursion; neither is captured P/L. Entry arrows identify activation candles; Entry/SL/TP lines carry price geometry. Selecting an FMS arrow hides the other FMS arrows until the Past Result close control clears the screenshot-friendly focus state.

## Architecture and sources of truth

- `Main/src/`: React/Vite client. Charts is the primary daily FMS surface; the Workbench is a secondary research surface.
- `Main/mt5-bridge/server.py`: FastAPI endpoints, registered-recipe projection, prospective lifecycle, Shadow Trader, and MT5 access orchestration.
- `Main/mt5-bridge/macro_signal.py`: frozen signal definitions, scoring, candidate construction, backtest/evaluation, ATR, and path/context calculations.
- `Main/mt5-bridge/research_store.py`: durable SQLite ownership for calendar rows, first-seen observations, candles, runs, experiments, candidates, and forward ledgers. Default DB is `%LOCALAPPDATA%/Fyodor Trading Terminal/fyodor-research.sqlite3`.
- `Main/mt5-bridge/registered_reaction_profiles.json` and related registered context artifacts: generated historical research evidence. Code-owned approval maps in `server.py` decide what is active.
- `Main/src/app/config/fxPairs.ts`: canonical 28-pair Major Forex Extended universe.
- `Main/src/app/lib/fmsEntryResearchSummary.json`: compact client-facing entry-research summary; detailed artifacts remain under ignored `docs/Development Logs/artifacts/`.
- Root `scripts/fms_*.py`: resumable research/acquisition/report runners. Their manifests, hashes, checkpoints, exclusions, and negative results are part of the evidence.

## Data flow

1. The MT5 EA uploads broker calendar rows and successful cycle acknowledgements.
2. The bridge stores calendar history and immutable first-seen release observations.
3. Frozen source definitions build event/package candidates from Actual, Forecast, and Previous.
4. Pair orientation plus continuation/contrarian treatment produces final trade direction.
5. Backtests use cached MT5 OHLC, completed pre-entry H4 ATR(14), fixed SL/TP/management/expiry, and finer candles only when path ordering requires them.
6. Older history selects a fixed candidate; later chronology evaluates it without reselection.
7. Explicit code review registers a non-duplicate contract with an activation boundary.
8. Charts shows past arrows and Next/Current/Recent; Shadow Trader monitors new first-seen matches without sending orders.

## Critical invariants and semantics

- Trusted research/live inputs are MT5 OHLCV and broker/MT5 economic-calendar rows only.
- Never use future candles, revised values unavailable at decision time, eventual package completion, future pivots, or later-period outcomes during selection.
- Use release identity and shared event cases when judging breadth; the same release across several pairs is not several independent economic observations.
- Missing Forecast/Previous, missing candles, gaps, ambiguous SL/TP order, and incomplete package observation remain explicit exclusions or unavailable states.
- ATR is Wilder ATR(14) from completed H4 candles known before entry unless an immutable contract explicitly says otherwise.
- The baseline entry is the first H4 open strictly after release. Approved entry successors may use the first eligible H1 open, but prospective eligibility still requires the complete first-seen package before that boundary.
- An entry upgrade preserves the parent contract’s final H4 expiry boundary and historical H4 behavior. It receives its own evidence fingerprint and activation time.
- Historical contracts are selected by event time. Never rewrite old arrows, trades, activation boundaries, or approval evidence after a new registration.
- Development/later positivity is the practical registration basis. Confidence, stability, samples, concentration, drawdown, and omitted costs stay visible diagnostics; an academic threshold alone is not a veto.
- Historical results are gross unless recorded execution proves otherwise. Do not invent spread, slippage, commission, swap, or fills.
- Registration is explicit and immutable. No runtime auto-promotion, silent mutation, or real-order transmission.
- Entry-known H4 structure uses `fms-price-structure-ladder-v1`: completed two-bar-confirmed pivots, 0.25 ATR clustering, at least two touches, stable zones, and completed break plus later retest for role reversal. Legacy nearest-zone fields remain the source for registered directional-room overlays; ordered ladders are descriptive unless an immutable successor is approved.

## Recurring traps

- Contrarian profiles must use the frozen selected trade direction, not the raw economic evidence direction.
- A candle containing the scheduled release can open before Actual values exist; it is not a valid post-information entry.
- A chart arrow drawn above/below a bar is a visual marker, not an entry-price marker.
- Cache market H4 history before starting its four source backtests; otherwise MT5 calls contend and repeat large history reads.
- Historical chart marker caches include immutable Entry/ATR/SL/TP geometry so selecting an arrow never waits for its full path audit. The selected-arrow endpoint must remain scoped to one pattern/event and reuse its annotated outcome stream; rebuilding every market pattern causes long blocking requests and disrupts pair changes.
- Reuse completed fingerprints. Do not run M1 across the universe; acquire it only for finalist path ordering or a declared entry comparison.
- The frozen `fms-entry-known-support-resistance-execution-v1` family found no later-supported adaptive TP/SL successor across 51 recipes. Confirmed H4 zones remain descriptive chart context; do not rerun nearest-barrier target capping without a materially different declared hypothesis or expanded history.
- The frozen `fms-sequential-price-structure-execution-v1` family also found no later-supported successor across 51 recipes. Nearest full exits, 50% nearest-zone partials, and wider-zone continuation after a completed H4 break all remain rejected research; the full ladder is decision support only.
- Agent-started bridge processes can occupy port 8001 and break `pnpm run dev:all`. Run services with redirected/bounded logs and stop them before handoff.
- Do not print large JSON, candle arrays, API responses, or service logs into the conversation.
