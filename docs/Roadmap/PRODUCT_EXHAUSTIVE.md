# Fyodor Trading Terminal Product Exhaustive

**Last Updated:** 2026-04-04 18:30

This file is the exhaustive implementation inventory and active working control sheet.

Use this file for:

- what has already been done
- what to build next
- what still needs a decision before building
- what should be manually audited after changes

Do not use this file as the short product authority.

`docs/Roadmap/PRODUCT_BRIEF.md` remains the short product brain.

## How To Use This File

When coming back after a break:

1. read `Critical` first
2. pick one item from `Build Next`, `Decide Next`, or `Audit Next`
3. ignore `Important` and `Nice To Have` unless `Critical` is clear

Meaning of the priority labels:

- `Critical` = highest-value next work or decision
- `Important` = strong next candidates, but not immediate
- `Nice To Have` = valid later ideas that should not crowd the near-term queue

## Current Product Tracks

These are broad categories only. They are not meant to be followed like rigid phases.

- `Track 1` = Overview Completion
- `Track 2` = Workflow Edge Features
- `Track 3` = Macro / Data Quality Refinement
- `Track 4` = Visual Consistency

## Done / Recent Progress

### Overview And Header

- [x] keep work inside `Overview Mission Control`
- [x] add a clearly visible trust-state question in Overview and header using a reusable shared derivation
- [x] add a clearly visible pair-attention question in Overview
- [x] add a concise `Macro Backdrop Verdict` for the selected pair
- [x] replace vague event-damage wording with event-sensitivity language
- [x] keep pushing Overview toward a stronger pair-first command-center role
- [x] make Overview expose more simplified outputs from current specialist tools
- [x] make the Overview event surface focus on events relevant to the selected pair
- [x] fix the misleading Overview status bar so it no longer implies false certainty
- [x] replace the fake status percentage with a real derived percentage
- [x] add a tooltip and centered explainer panel for `Overview Confidence`
- [x] expose weighted scoring inside the confidence inspector
- [x] move `CB Snapshots` toward truthful `Resolved Banks` wording
- [x] restore relevance transparency inside `Timeline Radar`
- [x] add urgency indicators to the radar event list
- [x] replace the current pair dropdown with a better selector pattern
- [x] implement a terminal-grade searchable pair selector popover
- [x] create shared terminology source-of-truth in `Main/src/app/config/terminology.ts`
- [x] align Overview and header wording to shared terminology
- [x] prefer `Overview Confidence` naming over `Differential Pipeline Status`
- [x] keep `Overview Confidence` as a permanent Overview surface
- [x] keep Overview single-pair for the current completion pass
- [x] add practical sorting to the pair selector popover
- [x] add a dedicated click-open `Trust State` explainer
- [x] increase the event radar to 4 visible events and add a compact summary row
- [x] add a full relevant-events inspector from the `Event Sensitivity` card
- [x] add bottom expandable `Specialist Summaries` in Overview for `Strength Meter`, `Differential Calculator`, and `Event Quality`

### Docs And Planning

- [x] rewrite the roadmap around `Critical / Important / Nice To Have`
- [x] add a cleaner progress section so completed work is easier to remember later
- [x] refresh the product brief with the recent Overview progress
- [x] export live broker symbols into `docs/Reference/MT5_BROKER_SYMBOLS.md`

### Build Safety

- [x] keep creating checkpoints before and after risky major changes
- [x] verify UI wording manually after major Overview changes
- [x] verify whether trust-state language feels natural in real daily use
- [x] verify whether any new Overview verdict feels misleading despite being technically correct

## Critical

These are the highest-value things to look at next.

### Build Next

- [ ] decide whether `Overview` needs one final completion pass or is stable enough to stop touching for now
- [ ] make Overview event clicks open Economic Calendar with the relevant date range already selected and the target event scrolled into view

### Decide Next

- [ ] lock the final shared naming for trust state, calendar timing, symbol context, macro coverage, pair attention, and event sensitivity
- [ ] confirm `Watchlist Priority Engine` as the next core feature direction after Overview stabilization

### Audit Next

- [ ] manually verify that the latest Overview surfaces still feel operationally honest after the Gemini polish
- [ ] verify that the app answers `which side is winning, why, can I trust it, and what event risk matters` fast enough in real use
- [ ] verify that `Overview Confidence` helps trust instead of feeling like decorative scoring

## Important

These are strong next candidates once the `Critical` section is clear.

### Build Next

- [ ] verify the central-bank `N/A` issue is truly solved after the MT5 bridge lookahead/input change
- [ ] improve the Strength Meter beyond the current `60/40` weighting approach
- [ ] investigate EA and MT5 bridge parameters such as lookahead days, before days, and max event counts to improve central-bank derivation coverage

### Decide Next

- [ ] decide the minimum inputs for a future `Watchlist Priority Engine`
- [ ] decide whether `Tradeability Window` should be part of pair attention or a separate concept
- [ ] decide how much event-reaction output should shift toward execution preparation usefulness
- [ ] decide whether cross-asset alignment should begin inside Overview or as a separate surface

### Audit Next

- [ ] verify whether event warnings are useful in practice and not just decorative
- [ ] verify whether the pair selector is fast enough under tired real trading-day use
- [ ] verify whether the current Overview event block shows the right amount of context versus noise

## Nice To Have

These are real ideas, but they should not compete with the higher-priority queue yet.

### Build Next

- [ ] make the left-side aesthetic and theme tooling apply more consistently across the frontend
- [ ] improve visual consistency across tabs, headers, and shell surfaces
- [ ] consider dark mode after broader visual consistency is stronger
- [ ] add a right-side expandable box or panel in Overview
- [ ] add a richer diagnostics surface for data health and operational state

### Decide Next

- [ ] decide whether Overview should eventually handle more than one pair context at once
- [ ] decide whether a right-side panel should become the long-term home for secondary Overview details

### Audit Next

- [ ] verify that later visual polish still preserves the compact operational feel of the app

## Future Core Feature Directions

These are important enough to keep visible, but they are not all immediate build work.

### Workflow Edge Features

- [ ] `Watchlist Priority Engine`
- [ ] `Cross-Asset Alignment Map`
- [ ] `Tradeability Window Layer`
- [ ] `Event Reaction Engine -> Execution Prep` upgrade
- [ ] `Strength Meter v2`
- [ ] `Multi-pair Overview` panel

### Why These Matter

- `Watchlist Priority Engine` moves the app from `analyze the pair I picked` toward `show me what deserves attention first`
- `Cross-Asset Alignment Map` helps identify whether a theme is being expressed cleanly or mixed across markets
- `Tradeability Window Layer` helps answer whether the market is actually tradeable right now, not just interesting
- `Event Reaction Engine -> Execution Prep` helps make event study more useful before real decisions
- `Strength Meter v2` keeps one of the core macro ranking tools useful without turning it into a black box
- `Multi-pair Overview` stays valid, but should probably remain below watchlist and cross-asset priorities unless workflow evidence says otherwise

## Open Research / Open Questions

These are worth thinking about, but they are not direct action items until promoted upward.

- [ ] review whether ATR should remain `14D`, switch to `14H`, or expose more than one volatility context
- [ ] decide whether the app should help identify the cleaner pair or asset expression of an active macro theme
- [ ] define what `cleaner expression` should mean in practical, transparent terms
- [ ] decide which currently accessible broker symbols belong in a first cross-market context layer
- [ ] decide whether DXY and bond yields remain optional future enhancements instead of present dependencies

## Current Build Reality

### Repo And Runtime Foundation

- main frontend app exists in `Main`
- MT5 bridge is vendored in `Main/mt5-bridge`
- root workspace scripts exist for:
  - `pnpm run dev:app`
  - `pnpm run dev:bridge`
  - `pnpm run dev:mt5`
  - `pnpm run dev:all`
- frontend build passes
- frontend test suite passes
- bridge test files exist
- local MT5 bridge base is wired through `VITE_MT5_BRIDGE_BASE` with fallback to `http://127.0.0.1:8001`

### Frontend Shell

- app shell exists in `Main/src/app/App.tsx`
- default landing tab is `Overview`
- top header exists and is connection-first
- top header has collapsed and expanded states
- top header shows:
  - app identity
  - local time and date
  - primary system readiness label
  - next high-impact event summary
  - expandable diagnostics
- expanded header includes:
  - system health
  - time context
  - feed diagnostics
  - event horizon
- tab navigation exists
- navigation includes:
  - `Overview`
  - `Central Banks Data`
  - `Charts`
  - `Economic Calendar`
  - `Specialist Tools`
- `Specialist Tools` contains:
  - `Differential Calculator`
  - `Strength Meter`
  - `Event Quality`
  - `Event Reaction Engine`
- left utility panel exists through `UiCommandPanel`
- current left utility panel manages:
  - font switching
  - color palette switching
  - theme persistence in local storage

### Shared Data And App Wiring

- app fetches bridge health
- app fetches economic calendar feed
- app fetches market status for:
  - Overview selected symbol
  - Charts selected symbol
- app derives central-bank snapshots from MT5 calendar events
- app computes next high-impact event for header display
- app refreshes health and feed state on intervals
- app refreshes market status on intervals
- calendar status resolution logic exists
- chart status resolution logic exists

### Overview

- Overview tab exists
- Overview is implemented as a live surface, not a placeholder
- Overview uses a selected review symbol
- Overview shares review-symbol context with the header
- Overview includes:
  - trust and pair-attention surfaces
  - `Macro Backdrop Verdict`
  - `Overview Confidence`
  - ATR-based volatility display
  - searchable pair selector popover
  - macro story for selected pair
  - strength differential summary
  - event radar with relevance tagging and urgency visibility
  - next-step action shortcuts
- Overview computes:
  - trust state
  - relevant top high-impact events
  - macro summary from selected pair central-bank snapshots
  - strength summary from ranking logic
  - suggested actions based on readiness and event context
- Overview fetches ATR data by loading D1 history for FX pairs
- current ATR display is based on ATR14 in daily context
- Overview can navigate the user into deeper tabs via action buttons

### Charts

- Charts tab exists
- lightweight-charts integration exists
- symbol list fetch exists
- grouped symbol browsing exists
- search exists
- favorites exist
- favorite persistence exists in local storage
- timeframe switching exists
- current timeframes include:
  - `M1`
  - `M5`
  - `M15`
  - `M30`
  - `H1`
  - `H4`
  - `D1`
  - `W1`
  - `MN1`
- historical candle fetching exists
- WebSocket chart stream exists
- market session context exists
- debug log panel exists
- chart symbol is independent from Overview review symbol

### Economic Calendar

- Economic Calendar tab exists
- calendar fetch exists against MT5-backed bridge data
- MT5 server-time fetch exists
- calendar supports:
  - today preset
  - this week preset
  - custom range
  - impact filtering
  - country filtering
  - search
  - local time view
  - UTC view
- calendar shows:
  - sync age
  - ingest age
  - MT5 time
  - viewer time mode
  - grouped event rows by day
- calendar status states exist:
  - live
  - stale
  - loading
  - no data
  - error

### Central Banks Data

- Central Banks tab exists
- central-bank snapshots are derived from MT5 calendar feed
- central-bank logs are exposed
- dual viewing modes exist:
  - command-style detailed list
  - strategic focus view
- per-bank display includes:
  - bank identity
  - currency
  - policy rate
  - inflation
  - last release dates
  - next event dates
  - next event titles
  - source labels
  - node status
- global mapping audit panel exists
- resolution count display exists

### Specialist Tools

- Differential Calculator tab exists
- Strength Meter tab exists
- Event Quality tab exists
- Event Reaction Engine tab exists
- current specialist outputs already feed simplified context into Overview

### Bridge And MT5 Data Surface

- bridge client functions exist for:
  - `fetchHistory`
  - `fetchHistoryRange`
  - `fetchSymbols`
  - `fetchHealth`
  - `fetchServerTime`
  - `fetchCalendar`
  - `fetchMarketStatus`
  - `openChartStream`
- bridge server exposes:
  - `GET /health`
  - `GET /server_time`
  - `GET /symbols`
  - `GET /history`
  - `GET /history_range`
  - `GET /calendar`
  - `GET /market_status`
  - `POST /calendar_ingest`
  - `WS /stream`
- MT5 EA companion file exists
- bridge health includes last calendar ingest metadata
- current broker symbol list has already been exported to `docs/Reference/MT5_BROKER_SYMBOLS.md`

## Things Explicitly Not Present Yet

- watchlist priority engine
- cross-asset alignment map
- tradeability window layer
- fully unified visual language across all tabs
- final Strength Meter methodology beyond the current 60/40 model
- final answer on whether Overview should summarize one pair or multiple pairs
