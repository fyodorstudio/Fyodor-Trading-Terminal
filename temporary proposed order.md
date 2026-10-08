# Presentation first — accepted order

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

## Manual audit for the user

- [ ] On EURUSD, select a roof direction/percentage box. Confirm the draggable box shows accumulated context and a separately named selected-roof snapshot, with independent clocks and support splits.
- [ ] Check green Long / red Short percentage boxes, amber conflict, balanced 50/50 and unavailable/unchanged dashes in light and dark themes. Confirm the three roof rows remain legible when zooming and panning; use More for overflow.
- [ ] Follow Roof Candy from the final activation time onward. Its earlier connecting span must not be painted as if the combo already existed. Click a segment to compare its explanation and accumulated USD context at the same clock.
- [ ] Try a fresh-news roof that opposes accumulated Candy, an ISM sector conflict and a labor-policy roof. Confirm the scope labels explain what each split compares. A fresh relationship tracks its original changing families, not non-voting companions or every later unrelated release.
- [ ] Check a participant expiry/pending ISM sector/inactive priority rule: Roof Candy becomes insufficient instead of silently replacing the relationship with a surviving subset. A later qualifying release can restore it.
- [ ] Check a Fed relationship: its action remains separate from macro percentages; an opposing action is disclosed and the relationship strip stays amber.
- [ ] Use Show/Hide Roof Candy; drag and resize the box; expand Details and calculations only when needed. Clear the selected roof or click blank chart space and confirm the temporary selected view closes normally.
- [ ] Record price reaction from the selected roof in Raycaster, Combo details or a Roof Candy segment. Check H1 / next four / next 24 H1 observations, clear a verdict by clicking it again, and confirm records remain scoped to this broker/pair/reading. Begin comparison after the exact available-from time, even inside an H1 candle.
- [ ] Change a USD input or magnitude setting. The old selected roof must remain visibly captured and ask to be reopened; it must not silently acquire new percentages. Reopen it to refresh its relationship timeline.
- [ ] In EUR-vs-USD mode, accumulated Candy retains its existing meaning while Roof Candy and its same-clock comparison explicitly use USD inputs.

## Reporting a disagreement

Send the pair/broker, selected roof or accumulated reading, exact available-from time, mode, visible Long/Short split and whether price opposed it immediately, over the next four H1 candles or over the next 24. A note about what felt misleading is useful. Investigate the comparison baseline and magnitude first, then the retained contributions/policy and relationship scope. Keep weighting and baseline changes deferred until a concrete case is reviewed.
