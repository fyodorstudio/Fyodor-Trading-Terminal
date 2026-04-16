# Fyodor Trading Terminal Terminology Guide

**Last Updated:** 2026-04-16

This file is the terminology, naming, and wording guide for Fyodor Trading Terminal.

Use this file for:

- approved product language
- naming consistency across tabs, cards, states, and docs
- wording rules for future UI work
- anti-drift guidance for multiple AI coders
- planning context to attach outside the repo, including ChatGPT Website

Do not use this file as the product constitution or active implementation ledger.

- `docs/Roadmap/PRODUCT_CONTRACT.md` is the stable product authority
- `docs/Roadmap/checklist.md` is the grounded status, backlog, and audit ledger
- `Main/src/app/config/terminology.ts` remains the runtime string source-of-truth for terms already encoded in the app

## Why This File Exists

This repo is now far enough along that terminology drift is a real product risk.

The app already has:

- a real `terminology.ts` config
- multiple tabs with different responsibilities
- several interpretive surfaces that can easily become over-worded or under-honest
- a history of multi-agent iteration

That combination makes terminology discipline important.

Without a shared wording guide, different AI coders will naturally:

- rename the same concept in different ways
- create adjacent concepts that should actually be one concept
- use more hype than the product has earned
- make the app sound more predictive than it really is
- weaken trust by mixing `unavailable`, `unresolved`, `stale`, `limited`, and `error` carelessly

This file exists to prevent that.

## Current State Summary

As of 2026-04-16, the app is a pre-trade briefing and macro triage tool.

It is not a signal bot, prediction engine, auto-trading agent, or black-box strategist.

Its current product shape is:

- `Overview` as mission control and triage
- `Central Banks Data` as macro source inspection
- `Charts` as execution and price-context surface
- `Economic Calendar` as MT5-backed event schedule and explainer surface
- `Specialist Tools` as deeper analytical modules

Current specialist tools are:

- `Differential Calculator`
- `Strength Meter`
- `Event Quality`
- `Event Reaction Engine`

The app already uses centralized terminology in code for several important concepts, but that system is not yet fully expanded across every tab. Right now the strongest terminology discipline appears in `Overview` and the header surface, where the terms below are actively reused.

## Authority Model

There are two terminology authorities in this repo, and they have different jobs.

### 1. Runtime authority

`Main/src/app/config/terminology.ts`

This is the runtime authority for labels already rendered in the app.

Use it when:

- implementing UI copy that already maps to an existing concept
- reusing a shared label or state
- checking what wording the product is actually displaying today

Do not casually bypass it by hardcoding a synonym in a component.

### 2. Editorial authority

`docs/Roadmap/terminology.md`

This file is the editorial and planning authority.

Use it when:

- naming a new surface, card, or state
- deciding whether a phrase fits the product
- drafting roadmap or planning language
- aligning multiple AI agents before implementation
- attaching repo context to external planning tools

This file may explain terms more fully than `terminology.ts`, but it should not silently contradict it.

## Core Product Language

These statements describe how the product should speak about itself.

Approved framing:

- the app is a `pre-trade briefing` tool
- the app is a `macro triage` tool
- the app helps the user decide `what deserves attention`
- the app helps the user judge `whether the current read is trustworthy`
- the app helps the user assess `macro backdrop`, `event risk`, and `readiness`
- the app supports `study`, `monitoring`, `preparation`, and `confirmation`

Discouraged framing:

- the app `predicts trades`
- the app `generates alpha`
- the app `finds guaranteed setups`
- the app `knows what will happen`
- the app `tells the user what to buy or sell`
- the app is an `AI trading engine`

The product should sound useful, disciplined, and honest, not mystical or promotional.

## Tone Rules

The app’s language should follow these tone rules:

- plain over clever
- trader-useful over market-poetic
- honest over impressive
- operational over decorative
- inspectable over mystical
- restrained over hype-heavy

Preferred tone qualities:

- compact
- serious
- readable while tired
- transparent about uncertainty
- explicit about limits

Avoid:

- dramatic labels
- overconfident adjectives
- fake certainty
- unexplained scores
- marketing-heavy superlatives
- metaphor-first wording when a direct term exists

## Naming Rules

When naming new product surfaces, prefer names that describe the job of the feature.

Good naming patterns:

- `Overview`
- `Central Banks Data`
- `Economic Calendar`
- `Strength Meter`
- `Event Quality`
- `Event Reaction Engine`
- `Trust State`
- `Symbol Context`
- `Action Plan`

Bad naming patterns for this product:

- `Alpha Engine`
- `Trade Oracle`
- `Macro Pulse Matrix`
- `Signal Optimizer`
- `Conviction AI`
- `Opportunity Brain`

Rule of thumb:

- if the label sounds like a marketing feature, it is probably wrong
- if the label hides the actual job, it is probably wrong
- if the label implies prediction when the feature is only descriptive, it is wrong

## Current Approved Shared Concepts

The concepts below are already real and should be treated as stable unless deliberately changed everywhere.

### Trust State

Purpose:

- answers `Can I trust the app right now?`

Approved labels:

- section label: `Trust State`
- question label: `Can I trust the app right now?`

Approved states:

- `Yes`
- `Limited`
- `No`

Current semantic meaning:

- `Yes` means core systems are reliable enough for normal use
- `Limited` means important inputs are partial, delayed, or unresolved
- `No` means the app is not reliable enough for real use

Notes:

- this is a trust/readiness concept, not a trade-confidence concept
- do not rename this to `System Confidence`, `Platform Trust Score`, or `Reliability Index` unless the product intentionally changes everywhere

### Calendar Timing

Purpose:

- communicates the current calendar-feed freshness and availability state

Approved labels:

- section label: `Calendar Timing`
- short label: `Calendar`

Approved states:

- `Live`
- `Delayed`
- `Syncing`
- `Unavailable`

Current semantic meaning:

- `Live` means current enough for normal use
- `Delayed` means available but no longer fully fresh
- `Syncing` means still refreshing
- `Unavailable` means no usable verified timing is available

Notes:

- `Calendar Timing` is better than vague alternatives like `News Feed`, `Event Feed`, or `Macro Pulse`
- use `Delayed` for stale timing, not `Broken`, unless the system is actually failing

### Symbol Context

Purpose:

- communicates whether the selected market context is open, closed, or unresolved

Approved labels:

- section label: `Symbol Context`
- short label: `Context`

Approved states:

- `Open`
- `Closed`
- `Unresolved`
- `Unavailable`

Notes:

- `Unresolved` should mean the app could not fully resolve the state
- `Unavailable` should mean the context is absent or inaccessible
- do not casually swap these two meanings

### Macro Coverage

Purpose:

- describes how complete the macro data resolution is for the tracked set

Approved labels:

- section label: `Macro Coverage`
- short label: `Coverage`

Approved states:

- `Resolved`
- `Partial`
- `Missing`

Notes:

- this concept is about data completeness, not directional bias

### Macro Backdrop

Purpose:

- describes whether the macro environment supports or conflicts with the current pair case

Approved labels:

- section label: `Macro Backdrop`
- question label: `Macro Backdrop Verdict`

Approved states:

- `Supportive`
- `Hostile`
- `Unclear`

Notes:

- `Hostile` is acceptable here because it describes a mismatch, not drama
- do not replace with `Bearish` or `Bullish` unless the logic truly becomes directional price prediction

### Pair Attention

Purpose:

- answers whether the current pair deserves user attention right now

Approved labels:

- section label: `Pair Attention`
- question label: `Is this pair worth attention right now?`

Approved states:

- `Study now`
- `Monitor later`
- `Ignore for now`
- `Wait for data`
- `Wait until event passes`

Notes:

- this is a workflow-priority concept
- it is not a buy/sell instruction
- keep the wording action-oriented and practical

### Event Sensitivity

Purpose:

- communicates whether upcoming event risk is close enough to matter for the selected pair

Approved labels:

- section label: `Event Sensitivity`
- short label: `Event Risk`

Approved states:

- `Clear`
- `Event-sensitive`
- `High-risk soon`

Notes:

- this should stay timing-focused
- avoid inventing dramatic replacements like `Hazard Zone`, `Red Alert`, or `Vol Shock Window`

### Overview Confidence

Purpose:

- communicates how complete and trustworthy the current synthesized overview picture is

Approved labels:

- section label: `Overview Confidence`
- legacy label: `Differential Pipeline Status`
- question label: `How complete is the current Overview picture?`

Approved states:

- `Pipeline healthy`
- `Pipeline limited`
- `Pipeline degraded`

Notes:

- this term refers to the completeness and quality of the current overview synthesis
- it is not trader conviction
- do not rename it to `Trade Confidence`, `Signal Confidence`, or `Setup Probability`

### Action Plan

Purpose:

- routes the user toward the next useful action

Approved labels:

- section label: `Action Plan`
- alternate label: `Next Steps`
- action verb: `Execute`

Notes:

- this concept is workflow guidance, not forceful instruction
- `Execute` is acceptable when it means open the linked tool or next surface, not execute a trade

## Shared Label Inventory

These labels already exist in the runtime terminology config and should be reused where they fit:

- `Bridge`
- `Market Session`
- `Symbol Context`
- `Resolved Banks`
- `Resolved Macro Coverage`
- `Last Ingest`
- `Volatility`

If a new card wants one of these concepts, reuse the term before inventing another one.

## Current Coverage In Code

As of this document, the terminology system is already active in the app, but not yet universal.

Known current usage:

- `OverviewTab.tsx` uses `TERMINOLOGY` heavily
- `MinimalHeader.tsx` uses `TERMINOLOGY` heavily
- the current terminology config lives in `Main/src/app/config/terminology.ts`

Current reality:

- terminology discipline is strongest in `Overview` and the header
- other tabs still contain more local hardcoded wording
- the app has not fully standardized every specialist-tab phrase yet

That means the terminology system is real, but still incomplete in reach.

## Wording Rules For Uncertainty And Data Quality

This product depends on honest uncertainty language.

Use the following distinctions carefully:

### `Unresolved`

Use when:

- the app attempted to derive or resolve something
- the concept exists
- the answer is not fully resolved yet

Examples:

- central-bank value not yet mapped
- symbol session state not fully resolved

### `Unavailable`

Use when:

- the required information is not accessible
- the system cannot currently provide the value
- the data is missing at the system level

Examples:

- feed not accessible
- selected symbol context missing

### `Limited`

Use when:

- the app still has partial value
- some inputs are weakened, delayed, or incomplete
- the user should proceed cautiously, not abandon the tool entirely

Examples:

- trust state with partial supporting inputs
- pipeline status with missing support factors

### `Delayed`

Use when:

- timing information exists
- it is no longer fresh enough to be treated as current

Examples:

- stale calendar feed

### `Missing`

Use when:

- a required part of a coverage set is absent
- completeness is the issue, not transport or access

Examples:

- macro coverage missing one or more required inputs

### `Error`

Use sparingly in UI-facing language.

Use when:

- an actual request or operational action failed
- the failure state matters more than user guidance

Prefer user-facing wording like `Unavailable` unless the failure itself is important to understanding the current state.

## Decision Language Rules

When the app gives user-facing workflow guidance, it should use verbs that match the product’s actual authority.

Preferred decision verbs:

- `Study`
- `Monitor`
- `Review`
- `Verify`
- `Wait`
- `Focus`
- `Prepare`
- `Open`

Use carefully:

- `Execute`

Avoid for user guidance unless the feature truly warrants it:

- `Buy`
- `Sell`
- `Enter`
- `Short now`
- `Long now`
- `Take this trade`

The app is a pre-trade tool, so its language should stop before direct trade instruction unless that product boundary intentionally changes in the future.

## Specialist Tab Language Rules

These sections document how each specialist surface should speak if expanded further.

### Differential Calculator

Preferred framing:

- pair-level arithmetic
- macro spread context
- source-backed differential
- inspectable value comparison

Avoid:

- acting like the differential alone decides the trade
- using it as a hidden directional oracle

### Strength Meter

Preferred framing:

- ranking heuristic
- major-8 relative strength
- current structural ranking
- focus aid, not trade signal

Avoid:

- `signal engine`
- `conviction score`
- implying that rank alone is a trade trigger

### Event Quality

Preferred framing:

- timing filter
- event-risk filter
- tradeability context
- macro noise environment

Avoid:

- language that sounds like volatility prediction certainty
- vague labels that do not help the user decide whether the environment is tradable

### Event Reaction Engine

Preferred framing:

- historical reaction study
- descriptive replay
- event-prep context
- sample-backed reaction behavior

Avoid:

- prediction language
- pretending historical behavior guarantees future reaction
- calling it a `signal engine`

## Recommended Future Terms

If these concepts get built, the following names are currently recommended because they fit the existing product language.

Recommended:

- `Watchlist Priority Engine`
- `Tradeability Window`
- `Cross-Asset Alignment`
- `Multi-pair Overview`
- `Execution Prep`

Use caution before renaming them to something more dramatic.

## Discouraged Vocabulary Bank

The following terms are discouraged unless the product intentionally changes in a major way:

- alpha
- oracle
- genius
- sniper
- killer setup
- secret edge
- hidden signal
- perfect trade
- certainty
- guaranteed
- AI conviction
- auto bias
- predictive engine
- neural trader

These terms usually make the product sound less trustworthy, not more.

## UI Copy Rules

When writing UI copy:

- prefer one clear noun phrase over two stacked buzzwords
- prefer short state labels and slightly fuller inspector explanations
- prefer sentence case in descriptions
- keep labels scan-friendly for tired real-world use
- let uncertainty be explicit

Good examples:

- `Wait for data`
- `Calendar timing is available but no longer fully fresh.`
- `The selected symbol session state is not fully resolved yet.`
- `This tab is a macro timing filter built from MT5 calendar rows.`

Bad examples:

- `Conviction level is aggressively bullish.`
- `This signal engine identifies the highest alpha setup.`
- `The neural model strongly prefers this trade.`

## Rules For Docs, Planning, And External Attachments

When sharing repo context with external tools like ChatGPT Website:

- attach this file together with `docs/Roadmap/checklist.md` when possible
- use this file for wording and concept consistency
- use `checklist.md` for product state and direction
- use `PRODUCT_CONTRACT.md` if the external tool needs the stable product constitution

If only one file can be attached:

- `checklist.md` is better for current-state planning
- this file is better for naming, wording, and product-language discipline

Best external-planning bundle:

1. `docs/Roadmap/checklist.md`
2. `docs/Roadmap/terminology.md`
3. optionally `docs/Roadmap/PRODUCT_CONTRACT.md`

## Expansion Protocol

This file is meant to be scalable.

When adding a new shared product concept, extend this document with:

1. concept name
2. purpose
3. approved labels
4. approved states if relevant
5. semantic meaning
6. wording notes
7. discouraged alternatives
8. whether the term already exists in `terminology.ts`

When a term becomes stable enough for runtime reuse:

1. add or update it in `Main/src/app/config/terminology.ts`
2. refactor relevant UI to consume the shared term
3. update this document to match

This order helps prevent docs drift and code drift from moving in different directions.

## Immediate Recommendations

The repo should treat terminology as a product system now, not as incidental copy.

Recommended next documentation / implementation discipline:

- keep `Main/src/app/config/terminology.ts` as the runtime string authority
- use this file as the editorial guide for future AI sessions
- consult this file before naming any new tab, card, or scoring concept
- gradually migrate more hardcoded tab wording to shared terminology where the concepts are truly shared
- avoid centralizing every single piece of copy too early; only centralize terms that are genuinely reusable product concepts

## Bottom Line

Fyodor Trading Terminal should sound like a disciplined pre-trade operating tool:

- not a prediction machine
- not a hype dashboard
- not a black-box signal vendor

Its wording should reinforce trust, workflow clarity, and honest limitations.

That is the standard future changes should preserve.
