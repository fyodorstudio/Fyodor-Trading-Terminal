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

1. Differential Calculator + Strength Meter
2. Event Density / Event Quality Filter
3. Event Reaction Engine
4. Cross-Asset Alignment Map
5. Market Selection / Watchlist Priority Engine

Note:
- This order is based on current repository readiness
- It can be changed later if new constraints appear

---

## Feature 1: Differential Calculator + Strength Meter

**Priority:** Completed foundation  
**Status:** Done  
**Recommended home:** Dedicated tabs

### Purpose

Restore the proven macro comparison tools from the old app, but power them with MT5-fed central-bank data instead of manual inputs.

### Minimum scope

- [x] Pair universe defined for all 28 major FX pairs
- [x] Current policy-rate differential implemented
- [x] Previous policy-rate differential implemented
- [x] Gap widening / narrowing logic implemented
- [x] Current inflation differential implemented
- [x] Strength Meter ranking logic restored
- [x] 60/40 rate + inflation weighting implemented
- [x] Dedicated `Differential Calculator` tab added
- [x] Dedicated `Strength Meter` tab added
- [x] Tests added
- [x] MT5-backed adapter layer added

### Key decisions

- [x] Use MT5-fed central-bank data only
- [x] Do not rebuild this inside `Overview`
- [x] Keep `Differential Calculator` and `Strength Meter` as separate isolated tabs
- [x] No fake directional trade score in `Differential Calculator`
- [x] Treat `Strength Meter` as a heuristic ranking, not a truth score
- [x] Be explicit about missing or ambiguous MT5 values

### Risks

- [x] Fed scalar-vs-range caveat documented
- [x] JPY metric caveat documented
- [x] AUD next inflation caveat documented

### Done when

- [x] User can compare policy and inflation gaps across the 28 major FX pairs
- [x] Strength ranking is visible for the major-8 set
- [x] Output is readable for a beginner
- [x] Edge cases show honest unresolved states

### Notes

- We intentionally pivoted away from the earlier `Overview`-tab differential concept.
- The old app logic was reused because it was already proven and easy to reason about.
- We did **not** implement 3M / 12M differential history because central-bank release timing is too irregular for a clean first-pass experience.

---

## Feature 2: Event Density / Event Quality Filter

**Priority:** High  
**Status:** Done (v1)

### Purpose

Help the user decide whether the event environment is clean enough to trade.

### Minimum scope

- [x] Pair-to-event relevance mapping defined
- [x] Next 24h event window logic implemented
- [x] Next 72h event window logic implemented
- [x] `This Week` horizon added
- [x] Event weighting / tiering logic defined
- [x] Environment labels implemented:
  - [x] Clean
  - [x] Mixed
  - [x] Dirty
- [x] Dedicated `Event Quality` tab added
- [x] Pair selector added
- [x] Methodology block added
- [x] Tests added

### Key decisions

- [x] Keep logic understandable
- [x] Use a weighted model, but expose the weights
- [x] No fake precision
- [x] Use it as a filter, not a signal generator
- [x] Keep it independent from chart-symbol selection

### Done when

- [x] User can quickly tell whether upcoming events make timing risky

### Notes

- Event Quality is now a standalone tab with its own FX-pair selector.
- It uses MT5 calendar data only.
- It is intentionally conservative and should be treated as a timing filter, not a trade signal.

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
- Feature 1 was intentionally redefined from the old `Policy Differential v0 in Overview` concept to the implemented `Differential Calculator + Strength Meter` tab pair.
- Feature 2 is now implemented as `Event Quality`.
- The next planned feature is `Event Reaction Engine`.
- Some MT5 caveats should remain documented rather than hidden:
  - Fed is scalar in MT5, not a full target range
  - JPY series may differ from some manual-source interpretations
  - AUD next inflation date may be absent when MT5 does not expose a future placeholder row
