# Fyodor Trading Terminal Product Operating Spec

This is the main source-of-truth document for the product direction.

It combines four things that were previously split across multiple markdown files:

1. Product purpose
2. User workflow and usage assumptions
3. Build phases and implementation priorities
4. Feature status and audit expectations

If a future document conflicts with this file, this file should win unless the repo owner explicitly changes direction.

## Product Mission

Fyodor Trading Terminal is not meant to predict trades for the user.

It is meant to help the user answer, quickly and honestly:

1. Is this market worth attention right now?
2. Is the macro backdrop supportive, hostile, or unclear?
3. Is event risk close enough to invalidate the setup?
4. Is the data live, stale, degraded, or unavailable?
5. Is this a market to study now, monitor later, or ignore for the moment?

The app should behave like a pre-trade briefing and macro triage tool, not a signal-selling dashboard.

## Product Priorities

When tradeoffs happen, this order wins:

1. Correct values and correct logic
2. Simplicity
3. Smooth daily workflow
4. Snappy responsiveness
5. Beautiful UI

If a change looks impressive but weakens trust, it should be rejected.

## Core Product Assumptions

- The current repo is the product to continue building.
- A brand new repo is not needed right now.
- The app remains web-first for now.
- The MT5 bridge and EA pipeline are valuable and should be preserved.
- HunterPie is inspiration for workflow and product discipline, not a codebase target.
- The app should feel like a compact command tool, not a decorative dashboard.
- Missing values are better than guessed values.
- Honest unresolved states are better than false certainty.

## Beginner-Friendly Mental Model

The app has three major layers:

- Frontend: what the user sees and clicks
- Data pipeline: MT5 + EA + Python bridge
- Domain logic: the rules that turn raw data into useful market context

In simple terms:

- frontend = dining room
- backend/data pipeline = kitchen
- domain logic = recipe and restaurant rules

For this product to work well, all three layers must agree.

## Intended Daily User Flow

The ideal daily workflow should feel like this:

1. Open the app
2. Immediately see whether MT5, bridge, and core feeds are healthy
3. Check what matters now from the Overview / command-center surface
4. Decide whether a market deserves more attention
5. Drill into specialist tabs only when needed
6. Use charts for confirmation and execution context

The app should answer the important questions before it asks the user to do heavy reading.

## Connection-First Workflow

This is a major product decision and should guide the shell redesign.

The app should feel "ready and waiting" in the same spirit as a disciplined tool:

- waiting for MT5
- bridge connected
- calendar live
- chart stream live
- stale
- degraded
- unavailable

The top header should become the first operational surface, not placeholder decoration.

It should answer:

- Is MT5 open?
- Is the bridge reachable?
- Is the EA feeding calendar data?
- Is chart streaming live?
- When was the last successful ingest?
- What is degraded right now?
- What is the next major event?

## Overview Tab Philosophy

Overview should be the simplest page in the app.

It should not be the most detailed page.
It should be the most useful page at a glance.

Overview should answer:

- What matters right now?
- Is the system healthy enough to trust?
- What macro events are imminent?
- Which currencies or themes deserve attention?

Overview should avoid:

- deep methodology
- large tables
- dense replay workflows
- controls better suited for specialist tabs

## Module Roles

Each tab should have one clear job.

### Overview

Role:

- mission control
- what matters now

### Charts

Role:

- live and recent price action
- stream state
- execution context

### Economic Calendar

Role:

- event schedule
- filtering
- actual / forecast / previous timing context

### Central Banks Data

Role:

- macro policy and inflation intelligence
- current backdrop by major central bank

### Differential Calculator

Role:

- pair-level rate and inflation arithmetic

### Strength Meter

Role:

- major-8 ranking heuristic
- strongest vs weakest context

### Event Quality

Role:

- timing filter
- event-density and event-risk awareness

### Event Reaction Engine

Role:

- descriptive historical replay and reaction study
- not prediction

## Product Principles

- Prefer fewer high-quality decisions over more noisy outputs.
- Prefer filters and vetoes over fake certainty.
- Prefer transparent logic over black-box scores.
- Prefer stable workflows over endless UI novelty.
- Prefer one coherent voice over mixed agent aesthetics.
- Do not overbuild UI before the logic is trustworthy.

## Checkpoint Policy

Every major change should be protected by a git checkpoint.

Major change means:

- shell or navigation redesign
- top header redesign
- overview redesign
- changes to bridge-facing logic
- changes to trading logic or calculation logic
- large CSS or component architecture changes
- risky refactors

Default rule:

- checkpoint before the major change begins
- checkpoint again after the major change becomes stable

The last three known checkpoints at the time of writing are:

1. `df7be6c` - `repo cleanup: normalize docs layout and clear workspace clutter`
2. `b2e7e76` - `phase-0 checkpoint: roadmap, repo hygiene, event reaction wip`
3. `dc55820` - `Checkpoint: save current app state before experiments`

## Current Strategic Decision

The current strategic direction is:

- keep the existing repo
- keep the existing MT5 data pipeline
- improve the current app in phases
- fix workflow discipline before broadening features
- use HunterPie-inspired product discipline to shape Fyodor's shell and workflow

## Build Phases

### Phase 0: Stabilize The Workspace

Purpose:

- create a safe and understandable starting point
- clean up docs and repo hygiene
- preserve current work in a checkpoint

Status:

- completed

Current Phase 0 progress:

- dirty working tree audited
- current Event Reaction work preserved via checkpoint
- ignore rules tightened
- docs structure cleaned and consolidated

Still needed:

- none required before Phase 1 work begins

### Phase 1: Workflow Foundation

Purpose:

- turn the app into a connection-first command tool

Main outcomes:

- useful top header
- coherent shell
- standardized state language
- clearer left-panel purpose

#### Phase 1 Step 1: Connection-First Header Spec

This is the immediate next product step.

The top header should become the operational heartbeat of the app.

Its purpose is not decoration.
Its purpose is fast trust and orientation.

The user should be able to glance at it and answer:

- Can I trust the app right now?
- Is the system connected and healthy?
- Is there an event or degraded state I need to care about immediately?

##### Header Structure

The header should have two layers:

1. Collapsed header
2. Expanded header

The collapsed header is the 2-second glance layer.
The expanded header is the command-and-diagnostics layer.

##### Collapsed Header Requirements

The collapsed header should always show:

- app identity
- current time context
- primary connection health
- one most-important market/event alert if present
- a clear way to expand into detail

Recommended collapsed layout:

- left:
  - app name
  - local time
  - optional MT5/server time if compact enough
- center:
  - primary health state
  - example: `MT5 Connected`, `Bridge Live`, `Calendar Stale`
- right:
  - next major event or top warning
  - expand/collapse control

The collapsed header should avoid:

- too many mini-cards
- decorative pills with unclear meaning
- duplicate metrics
- too much animation
- status words without source/context

##### Expanded Header Requirements

The expanded header should show only operationally useful detail.

Recommended information groups:

1. System Health
2. Time Context
3. Feed Diagnostics
4. Event Horizon

##### Expanded Header Group 1: System Health

This group should clearly show:

- MT5 app state
- bridge state
- calendar feed state
- chart stream state

For each item, show:

- current state label
- last successful activity if useful
- degraded reason if available

Preferred state vocabulary:

- Connected
- Waiting
- Live
- Stale
- Degraded
- Unavailable

Avoid ambiguous labels like:

- good
- bad
- okay
- operational

unless they are backed by specific meaning.

##### Expanded Header Group 2: Time Context

This group should show:

- local time
- MT5/server time
- timezone context if needed

Purpose:

- remove confusion about when events and candles are being interpreted

##### Expanded Header Group 3: Feed Diagnostics

This group should show:

- last calendar ingest time
- event count or feed freshness if meaningful
- whether the chart stream is active for the current symbol
- whether market status is inferred or directly supported

Purpose:

- help the user know when the app is healthy but stale versus fully live

##### Expanded Header Group 4: Event Horizon

This group should show:

- next high-impact event
- its currency
- countdown
- whether it affects the currently selected pair or not

Purpose:

- give the user a tactical warning surface without making them open the calendar tab first

##### Header Behavior Rules

- collapsed header should remain calm and compact
- expanded header should open quickly but not feel heavy
- expanded content should be readable in one short scan
- if there is no urgent event, the header should still be useful because health status remains visible
- if the system is degraded, degraded state should win over decorative market information

##### Priority Rules

When space is limited, the header should prioritize:

1. system trust
2. live/degraded state
3. next major event
4. secondary descriptive metrics

##### Success Criteria For The Header

The header is successful when a user can open the app and answer all of these in under a few seconds:

- Is MT5 connected?
- Is the bridge healthy?
- Is the calendar trustworthy right now?
- Is there a major event coming soon?
- Do I need to worry before drilling into other tabs?

### Phase 2: Overview Mission Control

Purpose:

- build the simplest possible daily-use home page

Main outcomes:

- fast orientation
- essential summaries only
- no clutter

### Phase 3: Performance And Responsiveness

Purpose:

- make the app feel calm, fast, and reliable

Likely focus areas:

1. Event Reaction Engine
2. Economic Calendar
3. Charts
4. Central Banks
5. shell/header rerender behavior

### Phase 4: Module Discipline

Purpose:

- make every tab feel purposeful and internally coherent

### Phase 5: Visual Consistency

Purpose:

- make the app feel authored by one mind

## Current Foundation Status

These are already present and should be treated as product foundation, not optional experiments:

- [x] Existing app lives in `Main`
- [x] MT5 bridge is vendored in `Main/mt5-bridge`
- [x] Root `pnpm run dev:all` workflow exists
- [x] Charts tab is functional and MT5-connected
- [x] Economic Calendar uses MT5-fed data
- [x] Central Banks Data is MT5-driven
- [x] Differential Calculator exists
- [x] Strength Meter exists
- [x] Event Quality exists
- [x] Event Reaction Engine exists in active development

## Feature Status

### Differential Calculator + Strength Meter

Status:

- implemented foundation

Purpose:

- compare policy-rate and inflation backdrop across major FX pairs
- provide a relative ranking heuristic

Important assumptions:

- uses MT5-fed central-bank data only
- avoids fake directional scoring
- should remain interpretable by a beginner

### Event Quality

Status:

- implemented v1

Purpose:

- act as a timing filter
- tell the user whether the near-term event environment is clean, mixed, or dirty

Important assumptions:

- it is a filter, not a trade signal
- it must remain explainable

### Event Reaction Engine

Status:

- implemented, pending manual audit and future cleanup

Purpose:

- measure how markets historically reacted to important releases
- help with descriptive understanding, not prediction

Important assumptions:

- no AI narrative layer
- no prediction claims
- sample quality must be shown honestly

### Cross-Asset Alignment Map

Status:

- not started

Purpose:

- check whether broader macro markets support or conflict with the thesis

Important assumptions:

- keep the anchor set small
- avoid giant heatmap clutter

### Market Selection / Watchlist Priority Engine

Status:

- not started

Purpose:

- reduce overload by helping the user focus on the few markets that matter most

## Manual Audit Expectations

These areas need manual judgment from the repo owner at key points:

- whether the Event Reaction direction feels genuinely useful in practice
- whether connection-state language feels natural for real daily use
- whether Overview is simple enough
- whether performance actually feels better after refactors
- whether any output looks misleading despite being technically correct

## Documentation Rules Going Forward

To keep docs sane:

- this file is the main product-spec document
- root `README.md` is the repo front door
- `Main/README.md` is frontend-specific operational documentation
- `Main/mt5-bridge/README.md` is bridge-specific operational documentation
- `docs/Reference/` is for archived concepts and reference material
- avoid creating multiple overlapping planning/checklist/guideline files again unless they have clearly different roles

## What Happens Next

After docs consolidation is complete, the next recommended product step is:

1. define the exact content and behavior of the connection-first header
2. define the exact content of the Overview tab
3. then implement those two before wider visual cleanup
