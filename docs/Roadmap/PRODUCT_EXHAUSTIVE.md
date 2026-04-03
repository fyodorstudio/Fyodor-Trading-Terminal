# Fyodor Trading Terminal Product Exhaustive

**Last Updated:** 2026-04-03 11:35

This file is the exhaustive implementation inventory and active working document.

Use this file for:

- current execution priorities
- completed progress you may need to remember later
- research questions that still need decisions
- future ideas that are intentionally not current work

Do not treat this file as the short product authority.

`docs/Roadmap/PRODUCT_BRIEF.md` remains the brief product brain.

## Table Of Contents

1. [Current Tracks](#1-current-tracks)
2. [Done / Recent Progress](#2-done--recent-progress)
3. [Critical](#3-critical)
4. [Important](#4-important)
5. [Nice To Have](#5-nice-to-have)
6. [Research / Decisions](#6-research--decisions)
7. [Current Build Reality](#7-current-build-reality)
8. [Things Explicitly Not Present Yet](#8-things-explicitly-not-present-yet)

## 1. Current Tracks

- `Track 1` = Overview Completion
- `Track 2` = Left Panel Aesthetic Consistency
- `Track 3` = Cross-Tab Visual Consistency
- `Track 4` = Macro / Data Quality Refinement

## 2. Done / Recent Progress

### Overview Completion Progress

- [x] keep work inside `Overview Mission Control`
- [x] stay inside `Module Tightening` and avoid reopening the whole app at once
- [x] keep `Visual Unification` active, but secondary to trust and workflow clarity
- [x] add a clearly visible trust-state question in Overview and header using a reusable shared derivation
- [x] add a clearly visible pair-routing question in Overview: `Is this pair worth attention right now?`
- [x] add a concise `Macro Backdrop Verdict` for the selected pair
- [x] replace vague event-damage wording with event-sensitivity language
- [x] keep pushing Overview toward a stronger pair-first command-center role
- [x] make Overview expose more simplified outputs from the current `Specialist Tools`
- [x] make the Overview event surface focus on events relevant to the currently selected pair or pairs
- [x] fix the misleading Overview status bar so it no longer implies false certainty
- [x] replace the fake status percentage with a real derived percentage
- [x] add a tooltip and centered explainer panel for `Overview Confidence`
- [x] expose weighted scoring inside the confidence inspector
- [x] fix the overstated `CB Snapshots` metric by moving toward truthful resolved-bank wording
- [x] restore relevance transparency inside `Timeline Radar`
- [x] add urgency indicators to the radar event list
- [x] replace the current pair dropdown with a better selector pattern
- [x] implement a terminal-grade searchable pair selector popover
- [x] create shared terminology source-of-truth in `Main/src/app/config/terminology.ts`
- [x] align Overview and header wording to shared terminology
- [x] prefer `Overview Confidence` naming over `Differential Pipeline Status`

### Manual Follow-Up Already Done

- [x] verify UI wording manually after major Overview changes
- [x] verify whether trust-state language feels natural in real daily use
- [x] verify whether any new Overview verdict feels misleading despite being technically correct
- [x] create git checkpoints before and after risky major changes

## 3. Critical

These are the items most likely to shape the next session.

### Track 1: Overview Completion

- [ ] decide whether `Track 1: Overview Completion` is actually done or still needs one final cleanup pass
- [ ] finalize shared naming for trust, calendar timing, symbol context, macro coverage, pair attention, and event sensitivity
- [ ] decide whether the current `Overview Confidence` wording and inspector structure are final
- [ ] verify that all Overview surfaces remain operationally honest after the latest Gemini polish

### Track 4: Macro / Data Quality Refinement

- [ ] investigate and reduce `N/A` central-bank rate outcomes without weakening trust rules

## 4. Important

These are strong next candidates, but not more urgent than the Critical list above.

### Track 1: Overview Completion

- [ ] inspect how much specialist-tool output should be surfaced into Overview
- [ ] inspect how the Overview event block should choose relevant events
- [ ] decide whether Overview should stay strictly single-pair for now or prepare for broader pair context later
- [ ] add sorting options inside the pair selector popover such as volatility, alphabetical, or favorites-first

### Track 4: Macro / Data Quality Refinement

- [ ] improve the Strength Meter beyond the current `60/40` weighting approach
- [ ] inspect which extra metrics should strengthen the Strength Meter without turning it into a black box
- [ ] investigate EA and MT5 bridge parameters such as lookahead days, before days, and max event counts to improve central-bank derivation coverage

## 5. Nice To Have

These are valid ideas, but they should not crowd the immediate queue.

### Track 2: Left Panel Aesthetic Consistency

- [ ] make the left-side aesthetic and theme tooling apply more consistently across the whole frontend

### Track 3: Cross-Tab Visual Consistency

- [ ] improve visual consistency across tabs, headers, and shell surfaces
- [ ] consider dark mode after whole-app theme consistency is stronger

### Future Overview Ideas

- [ ] add a right-side expandable box or panel in Overview
- [ ] use that panel to drive pair selection through a clickable table
- [ ] consider making Overview capable of handling more than one pair context
- [ ] consider a right-side panel for data health and operational diagnostics

## 6. Research / Decisions

These are not implementation tasks yet. They need a decision first.

- [ ] review whether ATR should remain `14D`, switch to `14H`, or expose more than one volatility context
- [ ] decide the exact state labels for trust, pair-worth-attention, macro backdrop, and event sensitivity
- [ ] decide whether `Overview Confidence` should remain a permanent concept or stay a temporary Overview-only explanation layer
- [ ] decide the final minimum specialist-summary set that belongs in Overview v1

## 7. Current Build Reality

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
- theme changes are applied through CSS variables at app level
- current UI theme state is persisted in local storage

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
  - macro backdrop verdict
  - `Overview Confidence`
  - ATR-based volatility display
  - searchable pair selector popover
  - macro story for selected pair
  - strength differential summary
  - event radar with relevance tagging
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
- chart status handles:
  - loading
  - ready
  - no data
  - error
- market session context exists
- chart overlay states exist for unavailable or no-data conditions
- debug log panel exists
- debug log copy action exists
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
- stale, error, and no-data alert panels exist
- country flag display exists
- event impact stars exist
- range popover exists
- help hint popovers exist
- successful sync timestamp persistence support exists through app state

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
  - country flag
  - policy rate
  - previous policy rate
  - inflation
  - previous inflation
  - last release dates
  - next event dates
  - next event titles
  - source labels
  - node status
- global mapping audit panel exists
- resolution count display exists

### Differential Calculator

- Differential Calculator tab exists
- current data source is MT5-derived central-bank snapshot data
- supports currency exclusion toggles
- supports separate sort modes for:
  - rate differential cards
  - inflation differential cards
- rate cards include:
  - current gap
  - previous gap
  - gap change
  - widening or narrowing state
- inflation cards include:
  - current bias
  - explanatory copy
- status dimming exists for unresolved cards

### Strength Meter

- Strength Meter tab exists
- current ranking heuristic exists
- ranking logic is based on:
  - 60 percent current policy-rate position
  - 40 percent current inflation position
- supports currency exclusion toggles
- supports suggestion sort modes
- shows:
  - live currency rankings
  - strength scores
  - rate and inflation breakdown
  - strongest/weakest context
  - suggested trading pairs
  - methodology block
- unresolved currencies can be excluded instead of being force-scored

### Event Quality

- Event Quality tab exists
- pair selector exists
- horizon selector exists
- current horizons include:
  - `24h`
  - `72h`
  - `this_week`
- weighted event-quality scoring exists
- summary label states include:
  - clean
  - mixed
  - dirty
- immediate dirty override exists for certain near-term high-impact events
- weighted breakdown exists
- relevant event table exists
- methodology panel exists
- family weights exist
- impact multipliers exist
- thresholds exist by horizon
- local storage persistence exists for selected pair

### Event Reaction Engine

- Event Reaction Engine tab exists
- current task flows include:
  - study an upcoming event
  - study a pair
- template discovery exists from MT5 event history
- event-family filtering exists
- pair-family filtering exists
- usable versus weak template handling exists
- upcoming-event shortcut list exists
- manual event selector exists
- pair-first study flow exists
- relevant pair ranking preview exists
- historical replay sample selection exists
- replay timeframe selection exists
- replay play/pause animation exists
- custom SVG candle replay chart exists
- pair switching inside reaction study exists
- local storage persistence exists for:
  - task
  - selected pair
  - event currency
  - selected family
  - weak-template toggle
  - selected template
  - replay timeframe
- event-reaction calculation helpers exist for:
  - pip-size handling
  - replay windows
  - sample quality
  - beat/inline/miss bucketing
  - event-first study summaries
  - asset-first study summaries

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
- bridge payload normalization exists
- market session-state normalization exists
- calendar event normalization exists
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
- in-memory calendar ingest store exists
- asset-class inference exists on the bridge
- forex session-window logic exists on the bridge
- crypto always-on session handling exists on the bridge

## 8. Things Explicitly Not Present Yet

- cross-asset alignment map
- market selection or watchlist priority engine
- full dark mode system across the whole app
- fully unified visual language across all tabs
- final Strength Meter methodology beyond the current 60/40 model
- final answer on whether Overview should summarize one pair or multiple pairs
- resolved solution for all central-bank `N/A` cases
