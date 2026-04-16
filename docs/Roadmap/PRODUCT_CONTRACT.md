# Fyodor Trading Terminal Product Contract

**Last Updated:** 2026-04-16

This file is the stable product constitution for Fyodor Trading Terminal.

Use this file for:

- what the product is
- what the product is not
- non-negotiable product rules
- stable workflow principles
- surface-level product boundaries
- trust, honesty, and action-language guardrails
- documentation boundary rules

Do not use this file for:

- session handoff
- current implementation inventory
- active roadmap
- backlog
- open questions
- feature prioritization
- practical audit notes that may drift with the build

For living build reality, use `docs/Roadmap/checklist.md`.

For wording and naming authority, use `docs/Roadmap/terminology.md`.

## What The Product Is

Fyodor Trading Terminal is a pre-trade briefing and macro triage tool.

It exists to help the user answer, quickly and honestly:

1. Can I trust the app right now?
2. What deserves attention right now?
3. Is the macro backdrop supportive, hostile, or unclear?
4. Is event risk close enough to invalidate a clean setup?
5. Should this market be watched, studied, prepared for, or ignored for now?

The product is meant to support judgment, orientation, and preparation before trade execution.

The product should feel like a compact command tool, not a decorative dashboard.

## What The Product Is Not

Fyodor Trading Terminal is not:

- a signal bot
- a prediction engine
- a black-box trade oracle
- an auto-trading agent
- a guaranteed edge machine
- a system that tells the user what to buy or sell with false certainty

The product may summarize evidence, rank attention, and guide workflow, but it must not pretend to know the future.

## Core Workflow The Product Exists To Support

The stable intended workflow is:

1. Open the app
2. Check whether the system and inputs are trustworthy enough for use
3. Orient quickly from `Overview`
4. Decide what market, pair, or event deserves attention
5. Drill into deeper tabs only when more inspection is needed
6. Use charts and context surfaces for confirmation and preparation

This workflow may evolve in implementation detail, but the orientation-first shape should remain stable.

## Non-Negotiable Product Rules

- if trust weakens, the change is wrong
- missing values are better than guessed values
- honest unresolved states are better than false certainty
- transparent logic is better than black-box output
- operational usefulness is more important than decorative breadth
- the app must stay connection-first
- one tab should have one clear primary job
- one module alone must not decide whether a pair deserves attention
- the product should remain readable under tired real-world use

## Surface Contracts

### Overview

`Overview` is a hybrid mission-control surface.

It may contain:

- a compact shortlist of markets or pairs that deserve attention
- a selected-pair summary area
- trust/readiness context
- macro and event-risk orientation
- compact end-results surfaced from deeper specialist logic
- routing into deeper tabs

`Overview` must remain orientation-first, not deep-analysis-first.

`Overview` must not become the place where immature specialist logic is promoted into settled product truth.

`Overview` must help the user answer:

1. Can I trust the app right now?
2. Is this worth attention right now?
3. Why?
4. Where should I go next if I need deeper detail?

This contract intentionally does not over-specify exact UI layout.

### Charts

`Charts` is the execution and price-context surface.

It is allowed to claim:

- live and recent price behavior
- symbol context
- timeframe context
- stream state
- execution-adjacent visual confirmation

It is not allowed to pretend to be a predictive analysis oracle.

### Economic Calendar

`Economic Calendar` is the event schedule and event-detail surface.

It is allowed to claim:

- event timing
- event filtering
- event relevance context
- actual/forecast/previous context when available
- event explanation grounded in known event knowledge

It should remain explicit about timing freshness, missing data, and uncertainty.

### Central Banks Data

`Central Banks Data` is the macro source-inspection surface.

It is allowed to claim:

- policy and inflation snapshots derived from available event data
- source labels
- resolution status
- mapping audit visibility
- next-known macro events

It must remain honest about unresolved or partial nodes.

### Specialist Tools

`Specialist Tools` are the deeper and more exhaustive analytical surfaces.

They are allowed to:

- study one question more deeply than `Overview`
- expose methodology
- expose limitations
- produce compact end-results that can later be summarized upstream

They are not allowed to:

- hide weak evidence behind impressive UI
- imply prediction when they are only descriptive or heuristic
- silently outrank product-truth constraints around trust and uncertainty

## Specialist-To-Overview Rule

Specialist tools are the deeper tabs.

`Overview` may surface compact end-results from them.

That reuse is allowed only when the summarized output is mature enough to deserve promotion.

The default rule is simple:

- deeper nuance lives in specialist tabs
- compact orientation lives in `Overview`

## Trust, Honesty, And Uncertainty Rules

- trust language must remain explicit
- uncertainty must be visible instead of buried
- unresolved values must stay unresolved
- unavailable data must not be replaced with guessed values
- synthesis layers must not overstate what underlying data can support
- user-facing wording must make it clear when the app is limited, delayed, partial, or unavailable

The product should prefer a smaller honest answer over a larger misleading one.

## Action-Language Boundary

Workflow verbs such as the following are acceptable:

- `Watch`
- `Study`
- `Prepare`
- `Review`
- `Monitor`
- `Verify`
- `Ignore`
- `Wait`
- `Open`

`Execute` may remain allowed only when it means workflow guidance or opening the next step.

`Execute` must not imply direct trade execution instruction.

The product should stop before explicit trade-command language unless the product boundary intentionally changes in the future.

## Documentation Boundary Rules

The roadmap documentation system is intentionally split into three files:

- `docs/Roadmap/PRODUCT_CONTRACT.md` = stable constitution and product authority
- `docs/Roadmap/checklist.md` = living current-state truth, audit ledger, backlog, open questions, and practical implementation notes
- `docs/Roadmap/terminology.md` = naming, wording, and state-language authority

Boundary rules:

- if content is likely to drift with the build, it belongs in `checklist.md`
- if content defines stable product law, it belongs here
- if content defines naming or wording standards, it belongs in `terminology.md`
- avoid rebuilding overlapping parallel docs that blur these roles

## Manual Audit Philosophy

Manual audits are part of the product, not an afterthought.

The product should be checked not only for technical correctness, but also for:

- trustworthiness under real use
- clarity under tired use
- honest wording
- sensible hierarchy
- resistance to featureful slop

The active audit queue belongs in `checklist.md`, not here.

## Bottom-Line Constitution Summary

Fyodor Trading Terminal must remain a serious, transparent, pre-trade operating tool.

It should help the user decide what deserves attention, why it deserves attention, whether the current read can be trusted, and where to drill deeper next.

It must not drift into hype, fake certainty, black-box prediction, or decorative complexity masquerading as edge.
