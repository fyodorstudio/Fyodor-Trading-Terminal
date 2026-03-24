# Fyodor Trading Terminal Roadmap

This file is the plain-English command map for the current project direction.

It exists to answer five questions clearly:

1. What phase are we in right now?
2. What is the purpose of each phase?
3. What is already done?
4. What still needs implementation?
5. What still needs manual audit from the repo owner?

This roadmap is intentionally practical.
It is not a wishlist.
It is the working plan for turning the existing Fyodor repo into a disciplined, HunterPie-inspired trading command tool without throwing away the working MT5 pipeline.

## Current Decision

The current strategic decision is:

- Keep the existing `Fyodor Trading Terminal` repo.
- Do not start a brand new repo yet.
- Do not switch to a desktop rewrite yet.
- Improve the current app in phases.
- Prioritize correctness, simplicity, responsiveness, and disciplined workflow.
- Use HunterPie as workflow/UI inspiration, not as a codebase to morph into a trading app.

## Priority Order

The current product priority order is:

1. Correct values and correct logic
2. Simplicity
3. Smooth daily workflow
4. Snappy responsiveness
5. Beautiful UI

If a tradeoff appears later, this order wins.

## Phase 0: Stabilize The Workspace

Status: In progress

Core purpose:

- Create a safe and understandable starting point before feature work.
- Protect current work with a checkpoint.
- Reduce repo chaos.
- Make the next implementation steps clear.

What this phase is allowed to do:

- Document the plan
- Review git state
- Tighten ignore rules
- Organize docs and entry points
- Prepare a checkpoint

What this phase is not allowed to do:

- Major product redesign
- Header implementation
- Overview implementation
- Performance refactors
- Logic rewrites outside workspace hygiene

### Phase 0 Steps

#### Step 0.1 - Audit Current Working Tree

Status: Done

Purpose:

- Identify whether the dirty repo state is noise or meaningful work.

Findings:

- The modified files are not random junk.
- They form a coherent in-progress Event Reaction Engine upgrade.
- The work includes logic, types, tests, UI, and styling.

Files identified:

- `.gitignore`
- `Main/src/app/lib/eventReaction.ts`
- `Main/src/app/tabs/EventReactionTab.tsx`
- `Main/src/app/tests/eventReaction.test.tsx`
- `Main/src/app/types.ts`
- `Main/src/styles.css`

Manual audit needed from repo owner:

- Confirm that the current Event Reaction direction should be preserved in a checkpoint.

#### Step 0.2 - Define Phase Structure

Status: Done

Purpose:

- Establish a shared language for the roadmap so future work stays disciplined.

Outcome:

- The project is now organized into explicit phases with core purposes and step-level intent.

Manual audit needed from repo owner:

- Review the phase order and confirm it matches the desired pace and risk tolerance.

#### Step 0.3 - Tighten Ignore Rules

Status: Done

Purpose:

- Prevent nested virtual environments, caches, and dependency folders from polluting the repo.

Changes intended in this step:

- Ignore nested `node_modules`
- Ignore nested `.venv`
- Ignore nested `__pycache__`
- Ignore nested `.pytest_cache`
- Ignore nested `dist`

Why this matters:

- The repo contains nested app and bridge workspaces.
- Root-only ignore rules are too weak for this structure.

Manual audit needed from repo owner:

- None required unless custom local files should stay tracked on purpose.

#### Step 0.4 - Create A Central Roadmap Document

Status: Done

Purpose:

- Put the full plan in one obvious file.

Outcome:

- This roadmap file now exists under `docs/`.

Manual audit needed from repo owner:

- Read this file and flag anything that feels inaccurate or too ambitious.

#### Step 0.5 - Simplify Repo Entry Points

Status: In progress

Purpose:

- Make the repo easier to navigate.
- Reduce “where do I start?” confusion.

Target structure:

- Root `README.md` = project front door
- `Main/README.md` = frontend-specific notes
- `docs/` = active project planning and reference docs
- `docs/archive/` = historical notes and old writeups that should not clutter the root

Manual audit needed from repo owner:

- Decide which old notes are worth preserving in archive form versus staying ignored locally.

#### Step 0.6 - Create Save Checkpoint

Status: Pending

Purpose:

- Protect the current work before product-level refactors begin.

Checkpoint intent:

- Save the in-progress Event Reaction work plus Phase 0 hygiene/documentation setup.

Recommended checkpoint label:

- `phase-0 checkpoint: roadmap, repo hygiene, event reaction work-in-progress`

Manual audit needed from repo owner:

- Optional but recommended:
  confirm the checkpoint message wording before future milestone commits become more product-specific.

## Phase 1: Workflow Foundation

Status: Not started

Core purpose:

- Turn Fyodor into a connection-first command tool before redesigning deeper modules.

Why this phase exists:

- The app already has meaningful functionality.
- The bigger problem is workflow discipline, not total feature absence.

Main outcomes:

- The top header becomes genuinely useful.
- System state becomes easy to understand.
- Navigation and app shell become coherent.
- Terminology becomes consistent.

### Phase 1 Steps

#### Step 1.1 - Define Connection-First Header

Status: Pending

Purpose:

- Replace placeholder header behavior with real operational value.

The expanded top header should answer:

- Is MT5 open?
- Is the bridge reachable?
- Is the EA feeding calendar data?
- Is chart streaming live?
- When was the last successful ingest?
- What is stale, degraded, or unavailable?
- What is the next major event?

Manual audit needed from repo owner:

- Approve what exact statuses should be shown in the always-visible bar versus the expanded area.

#### Step 1.2 - Standardize System Language

Status: Pending

Purpose:

- Make all modules speak the same operational language.

Preferred shared terms:

- Connected
- Waiting
- Live
- Stale
- Degraded
- Unavailable
- Unresolved
- Synced
- Last ingest

Manual audit needed from repo owner:

- Confirm whether these words feel natural for daily trading use.

#### Step 1.3 - Clean Up Navigation And Shell

Status: Pending

Purpose:

- Make the app feel like one system, not several UI experiments stitched together.

Focus areas:

- Top header
- Main navigation
- Left command panel purpose
- Spacing and hierarchy
- Default information density

Manual audit needed from repo owner:

- Review proposed shell direction before implementation if the visual direction has non-obvious tradeoffs.

## Phase 2: Overview Mission Control

Status: Not started

Core purpose:

- Create the simplest possible daily-use home screen.

Guiding rule:

- Overview is not the place for exhaustive detail.
- Overview is the fastest answer to: "What matters right now before I trade?"

Recommended contents:

- Connection health summary
- Next major macro events
- Central-bank summary snapshot
- Strongest/weakest currency summary
- Warnings for stale or unresolved data

What Overview should avoid:

- Deep methodology
- Long tables
- Full research workflows
- Advanced controls that belong in dedicated tabs

Manual audit needed from repo owner:

- Final approval of which summaries belong in Overview and which feel too noisy.

## Phase 3: Performance And Responsiveness

Status: Not started

Core purpose:

- Make the app feel snappy and reliable enough for daily use.

Likely priority targets:

1. Event Reaction Engine
2. Economic Calendar
3. Charts
4. Central Banks
5. Global shell/header rerender behavior

Typical focus areas:

- Heavy recalculation
- Large lists
- Expensive motion
- Re-initializing charts
- Too much rerendering from shared state

Manual audit needed from repo owner:

- Subjective feel check after each optimization pass.
- Only the daily user can fully judge whether the app feels calm and fast.

## Phase 4: Module Discipline

Status: Not started

Core purpose:

- Give each tab one clear job and one clear reason to exist.

Target module roles:

- Overview = what matters now
- Charts = live price view and stream state
- Economic Calendar = event schedule and filtering
- Central Banks = macro policy intelligence
- Differential Calculator = rate/inflation arithmetic across pairs
- Strength Meter = ranking heuristic
- Event Quality = upcoming macro environment filter
- Event Reaction Engine = historical replay and descriptive study

Manual audit needed from repo owner:

- Confirm that these module purposes match real daily workflow.

## Phase 5: Visual Consistency

Status: Not started

Core purpose:

- Make the app feel authored by one mind.

Why this phase is later:

- A polished mess is still a mess.
- Workflow and responsiveness come first.

Expected work:

- Remove mixed design dialects
- Reduce ornamental UI noise
- Preserve beauty while increasing trust and clarity
- Keep HunterPie-inspired efficiency without copying game-overlay habits

Manual audit needed from repo owner:

- Strong visual review and taste approval

## Manual Audit Checklist For Repo Owner

These are the areas where owner review matters most:

- Is the Event Reaction work worth preserving in the checkpoint?
- Does the phase order feel right?
- Does the prioritized order still feel correct?
- Does the connection-first header concept match the desired real-world workflow?
- Does the future Overview concept feel simple enough?
- Which old docs should be archived versus kept as active docs?

## Immediate Next Actions

The intended next actions after Phase 0 are:

1. Create the checkpoint commit
2. Finalize root documentation entry points
3. Decide which docs move into `docs/archive/`
4. Start Phase 1 design work for the connection-first header
5. Define the Overview mission-control layout before writing implementation code

## Notes

- This roadmap should evolve as the product becomes clearer.
- It should stay readable by a beginner.
- If a future change makes the app more complex but less trustworthy or less simple, that change should be questioned aggressively.
