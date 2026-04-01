# Fyodor Trading Terminal Product Brief

**Last Updated:** 2026-04-01 15:41

This is the brief product brain.

Use this file for:

- what the product is
- what already exists at a high level
- what rules must not be broken

For exhaustive implementation detail and the active session checklist, use `docs/Roadmap/PRODUCT_EXHAUSTIVE.md`.

## Table Of Contents

1. [What The Product Is](#1-what-the-product-is)
2. [What Already Exists](#2-what-already-exists)
3. [What Rules Must Not Be Broken](#3-what-rules-must-not-be-broken)

## 1. What The Product Is

Fyodor Trading Terminal is a pre-trade briefing and macro triage tool.

It is not meant to predict trades for the user.

It is meant to help the user answer, quickly and honestly:

1. Is this market worth attention right now?
2. Is the macro backdrop supportive, hostile, or unclear?
3. Is event risk close enough to invalidate the setup?
4. Is the data live, stale, degraded, or unavailable?
5. Is this a market to study now, monitor later, or ignore for the moment?

Product priorities:

1. Correct values and correct logic
2. Simplicity
3. Smooth daily workflow
4. Snappy responsiveness
5. Beautiful UI

Core assumptions:

- the current repo is the product to continue building
- the app remains web-first for now
- the MT5 bridge and EA pipeline are valuable and should be preserved
- the app should feel like a compact command tool, not a decorative dashboard
- missing values are better than guessed values
- honest unresolved states are better than false certainty

Daily workflow:

1. Open the app
2. Immediately see whether MT5, bridge, and core feeds are healthy
3. Check what matters now from the Overview surface
4. Decide whether a market deserves more attention
5. Drill into specialist tabs only when needed
6. Use charts for confirmation and execution context

Overview must answer these two questions fast and honestly:

1. Can I trust the app right now?
2. Is this pair worth attention right now?

Main tab jobs:

- `Overview` = mission control, what matters now
- `Charts` = live and recent price action, stream state, execution context
- `Economic Calendar` = event schedule, filtering, actual/forecast/previous timing context
- `Central Banks Data` = macro policy and inflation intelligence
- `Differential Calculator` = pair-level rate and inflation arithmetic
- `Strength Meter` = major-8 ranking heuristic
- `Event Quality` = timing filter and event-risk awareness
- `Event Reaction Engine` = descriptive historical replay and reaction study, not prediction

## 2. What Already Exists

High-level build reality:

- `Workspace Reset` = completed
- `Command-Center Shell` = completed enough for now
- `Overview Mission Control` = implemented and usable
- `Performance Reserve` = on hold
- `Module Tightening` = active current track
- `Visual Unification` = started, not complete

High-level current app state:

- connection-first header exists with collapsed and expanded operational states
- Overview exists as a pair-first pre-trade briefing
- Overview includes pair selection, readiness checks, ATR context, event-risk radar, macro summary, strength summary, and action shortcuts
- Charts is MT5-connected and supports symbol search, favorites, grouped browsing, timeframe switching, stream updates, and debug logging
- Economic Calendar uses MT5-fed data and supports filters, search, range selection, local-vs-UTC viewing, and stale/error/no-data states
- Central Banks Data supports derived policy and inflation views plus mapping audit logs
- `Specialist Tools` groups Differential Calculator, Strength Meter, Event Quality, and Event Reaction Engine
- Event Reaction Engine already supports upcoming-event study, manual event selection, pair-first study, pair ranking, historical context, and candle replay
- cross-asset alignment and watchlist-priority workflow features do not exist yet

## 3. What Rules Must Not Be Broken

Non-negotiable product rules:

- if trust weakens, the change is wrong
- missing values are better than guessed values
- transparent logic is better than black-box output
- specialist tabs are for deep detail; Overview is for orientation
- the app must stay connection-first
- one tab should have one clear job
- one module alone must not decide whether a pair is worth attention right now
- Overview verdicts must be transparent enough to explain why they exist
- tired or overloaded usage must be treated as a real UX target, not an edge case

Checkpoint rules:

- checkpoint before any major change begins
- checkpoint again after the change becomes stable
- major change includes shell redesign, header redesign, overview redesign, bridge-facing logic changes, trading logic changes, large CSS changes, and risky refactors

Documentation rules:

- this file is the short product authority
- `docs/Roadmap/PRODUCT_EXHAUSTIVE.md` is the detailed implementation inventory and active session checklist
- root `README.md` is the repo front door
- `Main/README.md` is frontend-specific operational documentation
- `Main/mt5-bridge/README.md` is bridge-specific operational documentation
- avoid creating overlapping planning documents unless they have clearly different roles

Manual audit rules:

- verify that Event Reaction Engine is useful in practice, not just impressive on paper
- verify that Overview stays simple enough
- verify that connection-state language feels natural for real daily use
- verify that no output looks misleading despite being technically correct
