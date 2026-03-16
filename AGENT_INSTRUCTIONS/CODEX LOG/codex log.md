# Trading Terminal Feature Roadmap Log

## Purpose
This file is the implementation log and progress tracker for the macro/context features being added to the trading terminal.

The goal is **not** to build more indicators or more dashboard clutter.

The goal is to build a **macro triage machine** that helps answer:

1. Is this market worth trading right now?
2. Is macro aligned with the trade idea or fighting it?
3. Is there an event that can invalidate the trade soon?
4. Which few markets deserve attention most?

---

# Core Principles

- Prioritize **fewer high-quality trades**, not more trades.
- Prefer **filters and vetoes** over prediction gimmicks.
- Prefer **transparent logic** over black-box scores.
- Avoid fake precision.
- Build features that improve:
  - market selection
  - macro alignment
  - event-risk awareness
  - noise reduction
- Do **not** overbuild UI before proving the logic.
- Codex should adapt implementation details to the actual repository structure.

---

# Current Build Priority

## Phase 1 - Highest Priority
These are the first features to build.

### 1. Event Reaction Engine
**Priority:** P1  
**Status:** Not started

**Why first**
- Highest ROI using existing data already available in the app
- Uses economic calendar + forecast/actual/previous + candle history
- Helps with trade timing, event awareness, and market focus

**Purpose**
Measure how specific events historically moved specific markets after surprise outcomes.

**Main job**
Help answer:
- Should I trade before this event?
- Should I avoid this market?
- Which assets react most to this release?
- Is the event historically important or mostly noise?

**Minimum expected capabilities**
- Match event -> relevant asset(s)
- Calculate surprise = actual - forecast
- Bucket surprise sizes
- Measure move after release:
  - 15m
  - 1h
  - 4h
  - 1d
- Show:
  - median move
  - average move
  - dispersion / variability
  - sample size
- Flag weak sample quality

**Implementation notes**
- Keep logic modular
- Later version can add regime filters
- Do not add AI commentary
- Do not overcomplicate UI

**Checklist**
- [ ] Event mapping logic defined
- [ ] Surprise calculation implemented
- [ ] Surprise bucket logic implemented
- [ ] Post-event move windows implemented
- [ ] Statistics calculation implemented
- [ ] Weak sample warning implemented
- [ ] Basic UI implemented
- [ ] Tests added
- [ ] Reviewed for future extensibility

**Codex progress log**
- Start date:
- Current branch:
- Files touched:
- Notes:
- Blockers:
- Next step:

---

### 2. Policy Differential v0
**Priority:** P1.5  
**Status:** Not started

**Why second**
- Useful background macro context
- Simpler version can be built now
- Later can evolve into full policy-path divergence

**Purpose**
Give a transparent view of relative policy backdrop for a selected pair / market.

**Main job**
Help answer:
- Is the rate differential supportive?
- Is the differential widening or narrowing?
- Is this just a static rate gap or an evolving macro backdrop?

**Minimum expected capabilities**
- Current policy-rate differential
- 3-month differential change
- 12-month differential change
- Optional:
  - 2Y yield differential
  - 1-month change in 2Y differential

**Output style**
- Widening
- Narrowing
- Stable

**Important**
- No fake bullish/bearish score
- No "rate gap = auto trade" logic

**Checklist**
- [ ] Pair-to-central-bank mapping defined
- [ ] Policy rate history connected
- [ ] Differential calculation implemented
- [ ] 3M / 12M change logic implemented
- [ ] Optional 2Y differential support evaluated
- [ ] Compact UI implemented
- [ ] Tests added
- [ ] Marked ready for future upgrade into policy-path divergence

**Codex progress log**
- Start date:
- Current branch:
- Files touched:
- Notes:
- Blockers:
- Next step:

---

## Phase 2 - High Value
Build after Phase 1 is stable.

### 3. Event Density / Event Quality Filter
**Priority:** P2  
**Status:** Not started

**Purpose**
Filter out bad timing environments.

**Main job**
Help answer:
- Is this a clean environment for this asset?
- Are there too many important catalysts soon?
- Can this setup be invalidated by upcoming events?

**Minimum expected capabilities**
- Show relevant events in next:
  - 24h
  - 72h
- Asset-specific event relevance
- Label environment:
  - Clean
  - Mixed
  - Dirty

**Checklist**
- [ ] Asset-to-event relevance mapping created
- [ ] Event tiering logic implemented
- [ ] Time-window logic implemented
- [ ] Clean / Mixed / Dirty label implemented
- [ ] UI implemented
- [ ] Tests added

**Codex progress log**
- Start date:
- Current branch:
- Files touched:
- Notes:
- Blockers:
- Next step:

---

### 4. Cross-Asset Alignment Map
**Priority:** P2  
**Status:** Not started

**Purpose**
Check whether the broader macro tape confirms or conflicts with the thesis.

**Main job**
Help answer:
- Is cross-asset behavior aligned with this trade?
- Is the market sending contradiction signals?

**Recommended anchor set**
Keep this small. Example anchors:
- USD index / DXY proxy
- US 2Y yield
- US 10Y yield
- Gold
- Oil
- One equity index

**Important**
- Do not turn this into a giant heatmap
- Keep it simple and interpretable

**Minimum expected capabilities**
- Thesis-aligned vs thesis-conflicting state
- Asset-specific interpretation rules
- Small set of anchors only

**Checklist**
- [ ] Anchor markets selected
- [ ] Alignment logic defined
- [ ] Conflict logic defined
- [ ] Compact display implemented
- [ ] Tests added
- [ ] Noise/clutter reviewed

**Codex progress log**
- Start date:
- Current branch:
- Files touched:
- Notes:
- Blockers:
- Next step:

---

## Phase 3 - Decision Layer

### 5. Market Selection / Watchlist Priority Engine
**Priority:** P3  
**Status:** Not started

**Purpose**
Narrow focus to the few best markets.

**Main job**
Help answer:
- Which assets deserve attention today?
- Which markets should be ignored for now?

**Inputs**
Should eventually combine outputs from:
- Event Reaction Engine
- Policy Differential / Path logic
- Event Density Filter
- Cross-Asset Alignment Map

**Output style**
Only 3 buckets:
- High Focus
- Monitor
- Ignore

**Important**
- No decimal leaderboard
- No fake 0-100 ranking
- The goal is focus, not over-automation

**Checklist**
- [ ] Input dependencies identified
- [ ] Ranking logic defined
- [ ] High Focus / Monitor / Ignore buckets implemented
- [ ] UI implemented
- [ ] Tests added
- [ ] Output reviewed for clarity and simplicity

**Codex progress log**
- Start date:
- Current branch:
- Files touched:
- Notes:
- Blockers:
- Next step:

---

# Later / Secondary Features

These are valuable, but not first-build priorities.

## Consider after core stack is stable
- [ ] Real Yield Differential Tracker
- [ ] Central Bank Communication Tracker
- [ ] Global Risk / Liquidity Stress Monitor
- [ ] Carry Estimator (net of swap drag / carry-to-vol)
- [ ] Correlation Breakdown / Regime Shift Alert
- [ ] Simple Macro Regime Tagger
- [ ] Bond Yield Spread Dashboard
- [ ] Inflation Surprise Tracker
- [ ] Data Freshness / Consensus Reliability Indicator

---

# Lower Priority / Mostly QOL

Do not let these delay core features.

- [ ] Volatility context panel
- [ ] ATR vs average
- [ ] Pair volatility rank
- [ ] Swap cost display
- [ ] Snapshot / export / journal handoff
- [ ] Range expansion warning

---

# Avoid / Delay Hard

These should **not** be early priorities.

- [ ] AI narrative summary
- [ ] Monolithic macro score (example: 78/100 bullish)
- [ ] Seasonal bias modules
- [ ] Big decorative heatmaps
- [ ] Session heuristics as "edge"
- [ ] Smart money / order-block / liquidity-sweep features
- [ ] Overbuilt sentiment dashboards
- [ ] Black-box regime classifier

---

# Suggested Implementation Order

1. Event Reaction Engine
2. Policy Differential v0
3. Event Density / Event Quality Filter
4. Cross-Asset Alignment Map
5. Market Selection / Watchlist Priority Engine

---

# Definition of Done

A feature is only considered done when:

- [ ] Core logic works
- [ ] Output is interpretable
- [ ] UI is simple and not cluttered
- [ ] Tests exist
- [ ] Edge use-case is clear
- [ ] No fake precision was introduced
- [ ] Feature improves actual decision quality
- [ ] Feature is documented for future iteration

---

# Session Log Template

## Work Session
**Date:**  
**Engineer / Agent:** Codex  
**Feature:**  
**Objective for this session:**  

### Planned
- [ ] Task 1
- [ ] Task 2
- [ ] Task 3

### Completed
- [ ] Completed item 1
- [ ] Completed item 2

### Decisions Made
- 

### Files Changed
- 

### Tests Added / Updated
- 

### Problems / Risks
- 

### Next Recommended Step
- 

---

# Final Reminder to Codex

Use repository context to choose the actual implementation approach.

This file defines:
- feature priority
- product intent
- what to avoid
- what "done" means

It does **not** force a rigid architecture.

Prefer implementation decisions that fit the existing codebase cleanly.
