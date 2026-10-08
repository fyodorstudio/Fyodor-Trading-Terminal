# Presentation first — accepted order

**Current status — 8 October:** the follow-up repair and self-audit are complete. Combo labels now sit at their available-from candles, redundant dot buttons are gone, and rows can grow beyond three. The original pass below is historical; the follow-up section supersedes its old layout and manual checklist. Only the two judgment checks at the end remain for the user.

## Objective

Make the numerical news interpretation understandable without reconstructing the numbers. Show which side leads, its opposing support, the information driving it, what changed and when it was available. The user performs visual checks and flags disagreements with price; those observations start investigation, not automatic fitting of weights to price.

## Scope and order

- [x] 1. Readable presentation: compact Long/Short percentage boxes on roofs; selected roof snapshot alongside accumulated context in the draggable Raycaster box; shared plain explanations and optional calculations in Combo details.
- [x] 2. Selected Roof Candy: one relationship timeline from its activation onward, separate from accumulated Candy. Reuse known canonical assessments, base/policy budgets and fresh changes. Later publications, aging and expiry update the selected relationship; the original roof snapshot remains frozen.
- [x] 3. Disagreement capture: reuse manual Aligned/Opposed/Unclear observations, preserve interpretation/input/version/clock provenance, and make relevant context available without numerical reconstruction.
- [x] 4. Handoff for the user's audit: record implementation evidence, terminal verification and a focused manual checklist here. Later scoring/weight changes require concrete cases and a separate review.

## Constraints

Preserve source scores, magnitude boundaries, component/family weights, conditional policies, retention, expiry, coverage gates and EUR-vs-USD calculation/presentation. Initial support presentation and Roof Candy use USD inputs only. Keep accumulated context and fresh support change explicit. Fed actions stay separate from macro percentages. Zero, balanced, insufficient and conflicted states remain distinct. Do not paint a relationship before activation. No source scoring on hover or pan. No browser automation, screenshots, commits or deployment.

## Deferred review emphasis

- Signal comparisons must be reviewed explicitly: Actual versus Previous, recent average, index floor or same-period revision are different assumptions. Scatter magnitude describes the derived signal actually selected, not universally Actual minus Previous.
- Review the activity 20% versus inflation/labor 40%/40% budgets, conditional weight transfers and age retention using concrete disagreements.
- The 30-day half-life retains about 97.7% per day and 50% at day 30; hard expiry is separate. These are declared prototype assumptions.

## Evidence and decisions

- Current worktree inspected. Prior presentation/roof work is committed; this file was an empty untracked user artifact. It is the only Markdown plan/report maintained for this pass.
- Existing Raycaster and roof support calculations already expose the required percentages. Existing roof audit controls capture H1 / next four / next 24 H1 candles with versioned snapshots.
- Implementation and terminal validation are complete. Manual UI checks below remain the user's responsibility.

### Implemented — 8 October 2026

- Shared percentage chips and plain driver/opponent explanations are used by the draggable box, roof labels/overflow and Combo details. Conflict is amber; missing/unchanged shares use a dash rather than inventing 0/100. Raw calculations are optional.
- Selecting a roof temporarily opens the draggable box alongside the existing dock; no persistent view preference is changed. Its snapshot and activation clock remain explicit next to accumulated context at the inspected candle. Show/Hide Roof Candy controls the selected strip for this session; blank chart deselection clears the selection.
- Selected relationship timelines project existing canonical snapshots and source metadata. Generic pairs retain fixed family membership; labor-policy scopes use all active inputs and disclose inactive rules; ISM follows same-month sector assemblies; fresh comparisons retain exact independent seven-day sector cutoffs; Fed actions are separate, with action/macro opposition visible.
- Projection is cached by history/selection identity. Viewports and pointer movements reuse existing geometry/binary lookups. A changed input/history configuration keeps the captured roof visible but disables its stale timeline until reopened.
- Audit provenance now includes the actual displayed support split and roof kind. Old saved records remain readable; a changed snapshot does not inherit its old verdict. No-direction readings allow Unclear instead of an Aligned/Opposed verdict.
- Shared UI dependency boundary was repaired after the regression check caught a Raycaster-to-Inspector coupling; the navigation suite passes. Selection projection caching is independent of React render memoization. Final build, full regression, lint and diff checks pass.

### Validation checkpoints

- Final uninterrupted `pnpm --dir frontend test`: all 60 registered suites passed. The updated `node tests/usd-context/test_raycaster.mjs` was also rerun afterward from `frontend/`: temporary selected-view visibility, stale selection, independent Roof Candy toggle and no additional scoring jobs/preference writes pass.
- New core fixtures cover activation parity, fixed pair membership, unrelated releases, latest-source replacement, age retention, participant expiry, exact seven-day fresh cutoff, non-voting fresh companions, policy inactivity, pending ISM sectors, Fed action separation, future removal and audit provenance.
- New headless fixtures cover different accumulated/roof percentages, plain leader/opponent explanations, balanced/unchanged/insufficient chips, selection/history caching, stale snapshots, exact activation-only strip placement, conflict lead edges, coalesced hover, recorded displayed shares and listener cleanup. No browser or screenshot inspection was used.
- Read-only historical replay command: `node frontend/scripts/usd-context/audit-relationship-presentation.mjs storage/data/context-v8-integrity-input.json` from the repository root. It reconstructs the previously frozen calendar input without writing data, preferences or reports. Passed against 5,696 USD context snapshots, sampling 24 roofs across all six kinds and checking 29,006 projected states. Aggregate projection work took 1,767 ms across those 24 histories; projections are cached after selection. This timing is not a visual responsiveness certification.
- The audit replay initially attempted one giant JSON string for the full shared history and exceeded Node's string limit. Its verification now hashes snapshots incrementally. This was an audit-script issue; app selection compares only the individual captured roof.
- Final `pnpm --dir frontend build`: TypeScript and Vite passed (384 modules). Vite reports its >500 kB bundle advisory: main application bundle 530.16 kB / 154.20 kB gzip. No unrelated bundle refactor was introduced.
- Final `pnpm --dir frontend lint`: clean. `git -c core.safecrlf=false diff --check`: clean. Direct diff inspection confirms no changes to standalone scorers, policy weights, combine-context arithmetic, retention/expiry modules or EUR context engines. No dataset, saved user preference, commit or deployment changes were made by this pass.

### Completion audit

1. Percentage chips: shared `usd-context/ui/SupportSplit.tsx`; roof labels and overflow entries mount them; draggable box and Combo details use the same support. Existing roof/candidate layout remains bounded with extra vertical clearance for the chips.
2. Plain explanations: shared `usd-context/core/support-reading.ts` names the largest leading and opposing contributor. Combo details and Raycaster expose separate scope/clock labels; calculations are optional. Existing component scores and votes are reused unchanged.
3. Selection integration: `FyodorTerminalShell` passes its captured combo to `Raycaster`; the box compares accumulated context against that snapshot and provides session Roof Candy controls plus Record price reaction. The updated controller test verifies this wiring without rescoring or persisting visibility.
4. Selected timeline: `relationship-timeline.ts` and cached `roof-ribbon-timeline.ts` reuse canonical context/fresh snapshots and the existing sector/action assessments. `ContextRibbon` clips to activation and uses original chart projection/coalescing. Fixtures and historical replay verify chronology, scope, arithmetic and expiry; stale input/history snapshots cannot silently refresh.
5. Audit: `roofAuditScope` records `support-display-v1`, displayed direction/support/qualification, relationship kind, exact clock and existing input/version provenance. Controls are available in the box, bottom dock and relationship segment explanation. Headless save/clear and existing portability/snapshot-isolation checks pass.
6. Handoff: this file is the single maintained Markdown plan/report, with review assumptions and manual checks. No visual verification is claimed. The accepted implementation is complete; weight, baseline and aging refinement remain deferred to the user's concrete disagreements.

## First audit feedback — preserved

The original long checklist is retired. Its technical cases are covered by the follow-up tests below; it is no longer homework for the user. These are the user's original responses:

- [YES] On EURUSD, select a roof direction/percentage box. Confirm the draggable box shows accumulated context and a separately named selected-roof snapshot, with independent clocks and support splits.
- [personally i dont like the "Conflict" yellow text showing after the long %, short%. as for the "More overflow" the box is overlapping and is hidden behind the candy itself ] Check green Long / red Short percentage boxes, amber conflict, balanced 50/50 and unavailable/unchanged dashes in light and dark themes. Confirm the three roof rows remain legible when zooming and panning; use More for overflow.
- [im not sure how to check this, i'll just attach a pic for you to see, what i know is zooming and panning the chart makes roofs behave weirdly as in some connecting dashes are gone ] Follow Roof Candy from the final activation time onward. Its earlier connecting span must not be painted as if the combo already existed. Click a segment to compare its explanation and accumulated USD context at the same clock.

## Reporting a disagreement

Send the pair/broker, selected roof or accumulated reading, exact available-from time, mode, visible Long/Short split and whether price opposed it immediately, over the next four H1 candles or over the next 24. A note about what felt misleading is useful. Investigate the comparison baseline and magnitude first, then the retained contributions/policy and relationship scope. Keep weighting and baseline changes deferred until a concrete case is reviewed.

## Follow-up repair and self-audit — 8 October 2026

This section supersedes the previous three-row, midpoint-label and blank-click-deselection descriptions above. The user explicitly requested a refactor and self-audit, supplied three screenshots, and then requested combo labels at the release columns with more rows when needed.

### Plan

- [x] Inspect the supplied images and trace selection, Candy placement, grouped ISM symbols, connector projection, label packing and popup stacking.
- [x] Put combo labels at the candle where the combo became available; remove duplicate clickable dots and their release chooser. Ordinary release symbols continue to open individual releases. Aging/expiry updates keep their actual update column and explanatory badge.
- [x] Let rows grow beyond three according to chart height. Keep every hidden combo in More, give the selected combo priority after zoom, and highlight its connector.
- [x] Keep the selected combo when blank chart space is clicked. Scope Hide Roof Candy to the selected combo, so selecting a different one shows its strip.
- [x] Shorten the strip/box wording and explain empty or gray areas. Remove the repeated yellow Conflict badge after the percentages.
- [x] Complete the final full regression/build/lint/whitespace checks and record their actual outcomes.
- [x] Replace the technical user checklist with the small remaining judgment checks below.

### Findings and repairs

- The June 3 boundary in image 1 is the selected combo's **start**, not an early stop. The other strip combines all enabled news. A later gray section means the selected combo no longer has enough usable inputs; it is not a prediction of a sideways market. The implementation now names these **Selected combo** and **All news**, shows the combo's start time, and exposes the reason when hovering/clicking gray.
- Selection could previously disappear after a blank-chart click. That click now clears only individual-release inspection. Close the combo using its ×, select another combo, or open an individual release. Hiding affects the current selection only; switching or clearing the selection resets it, so the next selection starts visible.
- Both Candy strips were previously positioned at fixed distances above the bottom of the chart. A short chart could clip the selected strip entirely. They now stay at the top: Selected combo above All news when both are shown. Manual outside-event highlights sit below All news, and their editor opens downward.
- ISM display grouping places the monthly symbol at Manufacturing even when it represents Services. The old plan indexed later Services before moving its connector toward the earlier symbol; viewport culling could discard a connector that should cross the screen. The plan now includes the real symbol anchor **before** packing/culling. The combo's availability clock remains the actual later publication/update; the geometry change does not backdate its reading.
- Labels no longer float at the middle of a bracket. Their horizontal position is the available-from candle. Source connectors point at displayed symbol groups. A grouped earlier symbol does not receive a false vertical stem at the later Services column. There are no clickable hollow/filled dots.
- Roof rows are no longer capped at three. The chart uses as many rows as fit below Candy; More contains repetition and overflow. The selected combo is placed first, so another candidate cannot displace it on zoom. Opening More raises its parent layer above Candy; Escape or chart navigation closes the menu.
- The compact support chips retain green Long / red Short percentages and their amber side cue, without repeating a yellow Conflict word. Details still explain opposing support and exact balance.
- Deleted the unused roof-release chooser and its old styles/tooltips. Updated the in-app Roofs/Candy guides and the bottom dock's shape explanation.
- A separate workspace change made Inspector start with its release list closed during this pass. That change was preserved. Its regression fixture now opens the actual release list before selecting a release and uses the specific release-list selector. This repair did not change Inspector behavior.

### Self-audit evidence

- Targeted headless tests pass for activation-column labels, no duplicate dot buttons, monthly-symbol connectors across several zooms, offscreen-source clipping, six-row expansion, short-chart overflow, selected-combo priority and More's owning-layer class/Escape behavior.
- Selection/controller fixtures pass for temporary box visibility, no saved visibility changes or extra scoring jobs, per-combo Candy hiding, a newly selected combo showing its strip, stale-input notice and explicit clearing.
- Shared presentation fixtures pass for different combo/all-news splits, plain leading/opposing drivers, no repeated Conflict badge, exact start clipping, an explicit message before the combo's start, gray/stale states, coalesced hover, saved actual shares and listener cleanup.
- Existing timeline/core tests cover fresh seven-day expiry, missing participants, pending ISM sectors, inactive labor rules, unweighted Fed action/expiry, fixed scope, future removal and original-snapshot preservation. These technical checks no longer need to be performed manually.
- Read-only frozen replay passed again: **5,696 context snapshots, 24 selected roofs, 29,006 projected states**. Added **126 chart views over seven historical selections**, including the July 6 ISM roof, at three zooms, two row limits and repeated pans. Checked correct activation-column labels, displayed grouped-symbol targets, row bounds and selected-roof stability. Candle times were synthetic; no prices were fitted or user data/settings written.
- Final uninterrupted `pnpm --dir frontend test`: **all 60 suites passed**, exit 0. Final `pnpm --dir frontend build`: TypeScript and Vite passed, exit 0 (383 modules). Final `pnpm --dir frontend lint`: clean, exit 0. Final `git -c core.safecrlf=false diff --check`: clean. The existing >500 kB main-bundle advisory remains (529.83 kB / 154.35 kB gzip). Direct diff checks show no edits to standalone scorers, weighting/combination arithmetic, retention/expiry modules or EUR engines.
- Reviewed only the three images supplied by the user. No live browser automation or new screenshots were used. Headless and projection checks verify behavior/geometry; they do not certify pixel rendering in the running app or this broker's current saved configuration.

### Only these checks remain for the user

- [ ] **Comfort/readability:** in your normal chart layout, are the combo labels, percentages and the two named strips easy to read? No need to find expiry, policy or Fed test cases. If anything is still clipped, send that view.
- [ ] **Interpretation against price:** when a reading feels misleading, send the selected combo (or All news), the displayed time and what price did afterward. I can then inspect that specific input/baseline/weight combination. No need to reconstruct the numbers or complete a terminology checklist.

Scoring, magnitudes, comparison baselines, family weights, retention, expiry rules and EUR numerical outputs are unchanged. No dataset/preference rewrite, commit or deployment is part of this repair.
