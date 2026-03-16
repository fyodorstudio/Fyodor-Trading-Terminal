# Trading Terminal Feature Checklist

## Purpose

This file is a shared implementation tracker for the next major app features.

It should help both the developer and the AI agent keep track of:
- what we decided to build
- why it matters
- what is already done
- what is blocked
- what still needs testing

This is not meant to be a product pitch.

It is a working checklist.

---

## Working Rules

- Prefer correct logic over polished UI.
- Prefer transparent outputs over vague scores.
- Prefer small, testable steps over big rewrites.
- Do not mark a feature done just because the UI looks finished.
- A feature is only done when logic, testing, and edge cases are reviewed.

---

## Current App Foundation

These are already in place and should be treated as dependencies:

- [x] New app exists inside `Main`
- [x] MT5 bridge vendored into `Main/mt5-bridge`
- [x] Root `pnpm run dev:all` workflow exists
- [x] Charts tab is functional and MT5-connected
- [x] Economic Calendar tab is using MT5-fed data
- [x] Central Banks Data tab is MT5-driven
- [x] Sync Age behavior is corrected
- [x] Calendar stale-state behavior is corrected
- [x] Central-bank next event matching improved
- [x] MT5 EA upgraded to preserve full event history

---

## Recommended Build Order

1. Policy Differential v0
2. Event Density / Event Quality Filter
3. Event Reaction Engine
4. Cross-Asset Alignment Map
5. Market Selection / Watchlist Priority Engine

Note:
- This order is based on current repository readiness
- It can be changed later if new constraints appear

---

## Feature 1: Policy Differential v0

**Priority:** Next recommended  
**Status:** Not started  
**Recommended home:** `Overview` tab

### Purpose

Show the relative macro backdrop between two currencies in a clear and honest way.

### Minimum scope

- [ ] Pair-to-central-bank mapping defined
- [ ] Current policy-rate differential implemented
- [ ] Current inflation differential implemented
- [ ] 3-month differential change implemented
- [ ] 12-month differential change implemented
- [ ] Output wording defined:
  - [ ] Widening
  - [ ] Narrowing
  - [ ] Stable
- [ ] Overview UI drafted
- [ ] Tests added
- [ ] Manual audit notes added

### Key decisions

- [ ] Use MT5-fed central-bank data only
- [ ] No fake directional trade score
- [ ] No auto buy/sell label
- [ ] Be explicit about missing or ambiguous MT5 values

### Risks

- [ ] Fed scalar-vs-range caveat documented
- [ ] JPY metric caveat documented
- [ ] AUD next inflation caveat documented

### Done when

- [ ] User can select a pair and understand rate/inflation differential clearly
- [ ] Output is readable for a beginner
- [ ] Edge cases show honest null states

---

## Feature 2: Event Density / Event Quality Filter

**Priority:** High  
**Status:** Not started

### Purpose

Help the user decide whether the event environment is clean enough to trade.

### Minimum scope

- [ ] Asset-to-event relevance mapping defined
- [ ] Next 24h event window logic implemented
- [ ] Next 72h event window logic implemented
- [ ] Event weighting/tiering logic defined
- [ ] Environment labels implemented:
  - [ ] Clean
  - [ ] Mixed
  - [ ] Dirty
- [ ] Compact UI added
- [ ] Tests added

### Key decisions

- [ ] Keep logic understandable
- [ ] No fake precision
- [ ] Use it as a filter, not a signal generator

### Done when

- [ ] User can quickly tell whether upcoming events make timing risky

---

## Feature 3: Event Reaction Engine

**Priority:** High strategic value  
**Status:** Not started

### Purpose

Measure how markets historically reacted after important economic releases.

### Minimum scope

- [ ] Event-to-asset mapping logic defined
- [ ] Surprise calculation implemented
- [ ] Surprise bucket logic implemented
- [ ] Post-event move windows implemented:
  - [ ] 15m
  - [ ] 1h
  - [ ] 4h
  - [ ] 1d
- [ ] Statistics implemented:
  - [ ] median move
  - [ ] average move
  - [ ] variability / dispersion
  - [ ] sample size
- [ ] Weak-sample warning added
- [ ] Basic UI added
- [ ] Tests added

### Key decisions

- [ ] No AI narrative layer
- [ ] No prediction claims
- [ ] Must remain interpretable

### Risks

- [ ] Event/asset mapping can become messy if scope is too wide
- [ ] Sample quality may be weak for some releases
- [ ] Needs careful historical-price alignment

### Done when

- [ ] User can tell whether an event historically matters for a specific market

---

## Feature 4: Cross-Asset Alignment Map

**Priority:** Medium  
**Status:** Not started

### Purpose

Check whether broader macro markets support or contradict the selected thesis.

### Minimum scope

- [ ] Anchor set selected
- [ ] Interpretation rules defined
- [ ] Supportive vs conflicting logic implemented
- [ ] Compact UI added
- [ ] Tests added

### Key decisions

- [ ] Keep anchor set very small
- [ ] Avoid giant heatmap behavior
- [ ] Keep output plain and interpretable

### Done when

- [ ] User can quickly see whether cross-asset context supports the idea

---

## Feature 5: Market Selection / Watchlist Priority Engine

**Priority:** Later  
**Status:** Not started

### Purpose

Reduce overload by helping the user focus on the few markets that matter most.

### Minimum scope

- [ ] Inputs from upstream features identified
- [ ] Bucket logic defined
- [ ] Output buckets implemented:
  - [ ] High Focus
  - [ ] Monitor
  - [ ] Ignore
- [ ] UI added
- [ ] Tests added

### Key decisions

- [ ] No decimal leaderboard
- [ ] No fake 0-100 macro score
- [ ] Focus on clarity, not automation theater

### Done when

- [ ] User can quickly narrow attention to a few markets

---

## Session Log

Use this section to record progress over time.

## Session Entry Template

**Date:**  
**Engineer / Agent:**  
**Feature:**  
**Goal:**  

### Planned
- [ ] Task 1
- [ ] Task 2

### Completed
- [ ] Item 1

### Decisions
- 

### Files Touched
- 

### Tests
- 

### Risks / Blockers
- 

### Next Step
- 

---

## Current Notes

- The app currently has a strong MT5-based foundation for calendar, charts, and central-bank data.
- MT5 remains the source of truth for macro-event and central-bank data in this phase.
- Some MT5 caveats should remain documented rather than hidden:
  - Fed is scalar in MT5, not a full target range
  - JPY series may differ from some manual-source interpretations
  - AUD next inflation date may be absent when MT5 does not expose a future placeholder row
