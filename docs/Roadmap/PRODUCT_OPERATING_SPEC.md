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

#### Phase 1 Step 2: Overview Mission Control Spec

This is the next product-defining step after the header.

Overview should become the simplest and most trustworthy page in the app.

It is not a replacement for the specialist tabs.
It is the page that tells the user whether deeper investigation is needed.

Its purpose is fast orientation, not full analysis.

##### Overview Core Job

The Overview page should answer these questions quickly:

- Is the system healthy enough to trust right now?
- Is there an urgent macro event I need to know about?
- What is the broad macro backdrop at a glance?
- Which currencies or themes deserve more attention?
- Which specialist tab should I open next, if any?

##### Overview Design Rule

Overview should feel like:

- calm
- compact
- obvious
- trustworthy

It should not feel like:

- a dashboard experiment
- a dense analytics page
- a prettier duplicate of the other tabs

##### Overview Content Structure

The page should be built from a small number of clear sections.

Recommended sections:

1. Trust And Readiness
2. Event Horizon
3. Macro Backdrop Snapshot
4. Focus And Attention
5. Priority Next Actions

##### Section 1: Trust And Readiness

This is the first and most important section.

Purpose:

- tell the user whether the app is healthy enough to trust before they read anything else

This section should summarize:

- MT5 state
- bridge state
- calendar state
- chart/stream state
- last successful ingest if needed

This is not a duplicate of the header.
The header gives the live signal.
Overview should reinforce trust with one simple readiness summary.

Possible output style:

- `System Ready`
- `Ready with caution`
- `Data degraded`

This section should not contain:

- deep diagnostics
- long explanations
- technical clutter

##### Section 2: Event Horizon

Purpose:

- warn the user about the next important scheduled event(s)

This section should show:

- next high-impact event
- currency
- countdown
- whether it is broadly important or tied to the selected market context

If there is no urgent event:

- show that clearly
- do not invent urgency

This section should be short.
It is a tactical warning surface, not the calendar tab.

##### Section 3: Macro Backdrop Snapshot

Purpose:

- give a compact high-level summary of the current macro environment

This section should summarize only the most important things:

- central-bank resolution quality
- broad rate/inflation backdrop summary
- strongest and weakest resolved currencies if that data is reliable

This section should avoid:

- giant grids
- all-bank detail duplication
- every number from Central Banks or Differential Calculator

The user should leave this section with a simple feeling like:

- `USD still has strong relative backdrop`
- `JPY remains weak`
- `some central-bank data is unresolved`

##### Section 4: Focus And Attention

Purpose:

- help the user know where to spend attention next

This section should answer:

- what deserves review now?
- what should probably wait?

Examples:

- `Focus: EURUSD before ECB event`
- `Review: USD event reaction context`
- `Caution: calendar feed stale`

This should be a prioritization surface, not a signal generator.

##### Section 5: Priority Next Actions

Purpose:

- bridge the user into the correct specialist tab without forcing them to think too hard

Examples:

- `Open Economic Calendar`
- `Review Event Quality for EURUSD`
- `Inspect Charts`
- `Check Central Banks Data`

This section should be simple and direct.
It should feel like routing, not analysis.

##### Overview Must Not Become

Overview must not become:

- a full calendar copy
- a full central-bank dashboard copy
- a full differential matrix
- a replay engine summary page
- an everything-tab

If a block becomes too detailed, it belongs in another tab.

##### Overview Information Density Rules

- show only the minimum needed to orient the user
- prefer summary over full detail
- prefer warnings over decorative metrics
- prefer one strong statement over six weak cards

##### Overview Priority Rules

When deciding what deserves space, use this order:

1. trust and readiness
2. urgent event risk
3. broad macro backdrop
4. attention guidance
5. deep detail

If space becomes limited, deep detail should disappear first.

##### Overview Success Criteria

Overview is successful when a user can open the app and understand all of this in under 10 seconds:

- whether the system is trustworthy right now
- whether an event matters soon
- what the macro backdrop broadly looks like
- where attention should go next

##### Overview Relationship To Specialist Tabs

Overview should route the user into deeper tabs when needed:

- header tells the user whether the app is healthy
- Overview tells the user what matters now
- specialist tabs answer detailed questions

That relationship should remain clean.

#### Phase 1 Step 3: Shell Hierarchy And Navigation Role Spec

This step defines how the major shell surfaces work together as one system.

The shell should answer one core UX problem:

- when the user opens the app, where should attention go first?

The answer should be:

1. Header
2. Overview
3. Specialist tabs

That order should feel natural every day.

##### Shell Hierarchy

The app shell should have four major layers:

1. Top header
2. Main navigation
3. Primary content area
4. Secondary utility panel

Each layer should have a different job.

##### Layer 1: Top Header

Role:

- live trust layer
- system heartbeat
- urgent event/timing surface

The top header is always about:

- health
- trust
- timing

It should not become:

- theme settings
- feature discovery
- large data cards

##### Layer 2: Main Navigation

Role:

- route the user between mission-control and specialist workflows

The navigation should feel like a map of functional rooms, not a menu of experiments.

Recommended primary navigation order:

1. Overview
2. Charts
3. Economic Calendar
4. Central Banks Data
5. Analysis

The current order can evolve, but the underlying logic should stay:

- mission control first
- execution context second
- source/timing tabs next
- deeper analysis grouped

The `Analysis` group is correct as a category because:

- Differential Calculator
- Strength Meter
- Event Quality
- Event Reaction Engine

are all deeper research tools, not first-glance surfaces.

##### Layer 3: Primary Content Area

Role:

- answer the main question for the currently selected module

This is where:

- Overview does orientation
- Charts does live price context
- Calendar does event detail
- Central Banks does policy backdrop
- Analysis tabs do deeper reasoning

This area should remain dominant.
It is the dining table where the actual meal is served.

##### Layer 4: Secondary Utility Panel

Role:

- optional tools
- personal preferences
- non-core utility controls

This is where the current left panel should live if it remains.

The current `UiCommandPanel` is a theme and presentation utility panel.
That is a valid secondary tool, but it should not compete with the product workflow.

##### Left Panel Decision

The left panel should remain a utility drawer, not a command center.

Its proper role is:

- fonts
- themes
- visual preferences
- optional future workspace preferences

Its improper role would be:

- system health
- market readiness
- event urgency
- routing the user to core trading decisions

Those belong in the header and Overview.

So the left panel should be treated like:

- a settings/tool rail
- not a primary workflow surface

##### First-Screen Experience

When the user opens the app, the first-screen hierarchy should feel like this:

1. header answers "can I trust the app?"
2. overview answers "what matters now?"
3. navigation answers "where do I go next?"
4. utility panel stays secondary and ignorable

That order should hold even if the user never touches the left panel.

##### Navigation Behavior Rules

- opening the app should default to `Overview`, not `Charts`
- the active tab should always feel obvious
- grouped analysis tabs should be easy to access but visually secondary to primary navigation
- navigation should remain stable and low-drama
- avoid over-animating tab movement or menus

##### Tab Role Hierarchy

The tabs should be mentally grouped like this:

Primary operational tabs:

- Overview
- Charts
- Economic Calendar
- Central Banks Data

Secondary research tabs:

- Differential Calculator
- Strength Meter
- Event Quality
- Event Reaction Engine

This grouping matters because the user should not feel that every tab is equally urgent at all times.

##### What Should Not Happen

The shell should not force the user to think:

- "Where do I look first?"
- "Why is the theme panel competing with the main workflow?"
- "Why does the header, nav, and overview all repeat the same thing?"

If those questions exist, the shell is still too noisy.

##### Duplication Rules

To keep the shell coherent:

- header shows live trust and urgency
- overview shows mission-control summaries
- specialist tabs show deep detail
- left utility panel shows preferences and non-core tools

If a piece of information appears in more than one place, each place must have a different role:

- header = live signal
- overview = summarized orientation
- specialist tab = deep inspection

##### Success Criteria For The Shell

The shell is successful when:

- the app opens into a clear, trustworthy first screen
- the user knows what matters without hunting
- the left panel feels optional, not mandatory
- specialist tabs feel like deliberate drill-downs, not competing home pages
- the whole app feels authored by one workflow mindset

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
