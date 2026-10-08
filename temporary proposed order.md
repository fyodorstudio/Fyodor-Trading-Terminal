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

## Roof connection visibility refinement — 8 October 2026

The user approved a small visual refinement after observing that roof connections crossed candles and competed for attention.

- Idle combo labels now have an eight-pixel stem at their available-from column. Their long roof lines and source stems appear only on hover, keyboard focus or selection.
- Leaving an unselected label hides its full connection. A selected connection stays visible through pan/zoom; previewing another label also leaves the selection visible. Chart navigation clears transient pointer previews.
- Contributing release symbols receive an accent outline. Grouped monthly ISM symbols match their underlying member IDs. Emphasis is transient, isolated to each chart, and cleared when Roofs unmount.
- Scoring, support percentages, activation clocks, density priorities, lane packing and the current More eligibility/count rules are unchanged. Pointer/focus interaction uses existing positioned snapshots without reprojection, history scoring or preference writes.
- The Roofs guide and Combo details explain the new interaction. The existing headless suite now checks default/preview/pinned connections, pointer/focus behavior, selected pan/zoom stability, grouped symbol emphasis, cleanup, chart isolation and unchanged snapshots/preferences.

Validation: the uninterrupted `pnpm --dir frontend test` passed all 60 suites. A final keyboard-focus cleanup prevents a filtered/offscreen label from reviving an old preview when it returns; `node tests/usd-context/test_sequence_ui.mjs` was rerun after that adjustment and passed. Final `pnpm --dir frontend build` and `pnpm --dir frontend lint` passed; the existing bundle-size advisory remains. Final whitespace and scope checks passed. No browser automation or live visual audit was performed.

Remaining user check: in Focused and All roofs, hover a label, move away, then select it and pan/zoom. Judge whether the reduced line clutter and symbol highlights make that combo easier to follow.

## Visible label allocation and local More — 8 October 2026

This supersedes the whole-history packing and single global More descriptions above. The user reported an isolated visible label disappearing after one zoom-out step and approved local overflow at each available-from candle column.

- Row allocation now starts with activation columns inside the chart viewport. Binary indexing selects those columns from cached source geometry; offscreen activations neither occupy rows nor add More counts. A visible combo can still connect to an offscreen source when hovered/selected.
- Row collision and Focused repetition use label boxes, independently of the full source-to-activation connection. Existing label rows are reused when they still fit, including across zoom; selected combos retain display priority. Selection/details/Candy remain open when their activation column leaves the viewport.
- Each candle column has its own More button below the labels. Its menu contains only hidden combos at that column, with original exact timestamps preserved even when multiple updates share an H1 candle. Choosing an entry promotes that combo at its original column. Pan/zoom carries local buttons with their candles and closes menus.
- Neighboring More controls use staggered footer rows so their buttons remain distinct. Extra footer rows reduce available label rows as needed. Menus open above their owning buttons, stay within the chart horizontally, and raise the active column above neighboring controls.
- Scoring, source admission, support percentages, economic clocks, weights, retention/expiry and saved preferences remain unchanged. This is a projection/layout repair; pointer events never rescore history.

Targeted terminal checks pass for the one-step zoom disappearance in both density modes, an offscreen source with visible activation, rejection of crossing-only offscreen activations, connector-independent label rows, exact-time local grouping, selected overflow promotion, neighboring footer separation, pan-following menus, row reuse and binary lookup over 100,000 entries. Headless UI checks verify per-column menus, complete access, selection, navigation dismissal and existing hover/symbol emphasis behavior.

Final validation: uninterrupted `pnpm --dir frontend test` passed all **60 suites**, exit 0. The read-only frozen replay passed **5,696 context snapshots, 24 selected relationships, 29,006 projected states, and 126 chart views across seven historical selections**; source/activation alignment, selected rows and immutable numerical history remain intact. `pnpm --dir frontend build` and `pnpm --dir frontend lint` passed, exit 0. Whitespace/scope checks passed. The existing >500 kB bundle advisory remains. No scoring modules, stored data/settings, user icon catalogue, commits or deployments were changed.

Remaining user check: revisit the Oct 8, 04:00 example and zoom out once; its label should remain while that candle is visible and no visible labels crowd it. At a crowded candle, open its local More and select a combo; its label should appear at that same column. Visual rendering is left to the user; no live browser or screenshot audit is performed.

### Combo details layout and dedicated Roofs dock — 8 October 2026

Implemented the approved focused UI pass. Combo details now opens in its own Roofs bottom-dock tab rather than replacing Inspector. Publication links and Return to releases open Inspector while retaining the selected roof for return through the Roofs tab. Broker/symbol isolation still clears incompatible captured snapshots.

The header combines the relationship state, leading side and evidence strength in one tinted badge; the visible Experimental label is removed. A single proportional green/red Long/Short bar sits directly below the header, outside the scrolling body. Its compact caption names the main contributors and describes shares of weighted support. Net and separation remain under Advanced calculations. Missing/zero support displays unavailable percentages rather than inventing a directional share; balanced support displays 50/50.

The body uses compact newspaper-style columns with serif section headings, thin rules, natural card heights and a full-width publication table. Narrow docks stack the columns. Existing context distinctions, Fed-action disclosure, exact activation clocks and calculation tables remain accessible. Removed the duplicated price-reaction audit from Combo details; Raycaster retains its existing audit controls and storage. Updated the relationship catalogue's explanation to point to those controls.

Collapse hides the scrolling body and summary caption, leaving the header and support percentages. The shell sizes that compact dock to its content, including wrapped headers, and omits the resize handle while collapsed. Expand returns to the existing shared expanded dock height without saving a smaller preference. Collapse state persists during this session across tab changes and selected combos; it is not a new saved workspace setting.

Targeted headless checks pass for header placement, unified shares/contributors, audit/badge removal, optional arithmetic, collapse/expand, updates while collapsed, retained advanced state, immutable snapshots, missing/zero and balanced shares, and independent Roofs navigation. Final `pnpm --dir frontend test` passed all **60 suites**, exit 0. TypeScript/Vite build, lint and whitespace checks pass, exit 0; the existing bundle-size advisory remains. No numerical scoring, weights, stored data, Raycaster layout, commits or deployment changed. No live visual UI audit was performed.

User visual checks: open a roof and check the header badge/bar in both themes; collapse, select another roof, and expand; open a participating release and return with the Roofs tab; narrow the dock/window and judge the stacked newspaper layout. Price-reaction recording should remain available in Raycaster and absent from Combo details.

### Raycaster views and independent combo selection — 8 October 2026

Implemented the approved Raycaster pass. Selecting a combo opens Roofs without forcing the draggable Raycaster box visible or changing its view. Closing Raycaster only hides the box; Clear combo separately removes the selected snapshot. Roof Candy visibility is controlled from the Roofs header, including its collapsed form. Open in Raycaster explicitly opens the selected-combo view. These view/Candy choices are session state; the existing saved Raycaster visibility and position contracts remain.

Context and Selected combo share one box with an explicit selector and only one reading displayed at a time. Context retains the last valid chart clock while the box/settings are open, uses the original candle-end/current-time cap, and never substitutes combo activation as its clock. Hide/reopen and broker/symbol/timeframe changes still clear held chart candles. Selected combo keeps its original exact clock and captured support; its price audit and own contribution table are separate from accumulated context. Relative mode retains its original direction/gates without an invented USD share bar.

The box has larger main text, a compact result/evidence badge, a single proportional share bar, a visible clock, and a short reason. Contribution tables split input, direction, evidence, and signed USD vote/effect into columns; unavailable/expired rows show unavailable values. Manual price observations and calculation disclosures start collapsed. The reusable support bar preserves the prior Roofs appearance and all support arithmetic. Roof Candy projections, timeline jobs, numerical scorers, weights, stored data and audit snapshots are unchanged.

Targeted headless checks passed for hidden selection, independent closing, manual view switching, frozen combo versus accumulated share/clock parity, controlled Candy visibility, stale snapshots, default disclosures, readable contribution columns, unavailable/balanced support, collapsed dock actions, immutable snapshots, and unchanged scoring-job counts. Final `pnpm --dir frontend test` passed all **60 suites**, exit 0. TypeScript/Vite build, lint and whitespace checks pass, exit 0; the existing bundle-size advisory remains. No browser automation or live screenshot inspection was used.

User visual checks: hide Raycaster then select a roof; the Roofs dock/Candy should appear without the box. Toggle Candy from collapsed Roofs. Use Open in Raycaster, switch between Context and Selected combo, and judge text density/width in both themes. Close Raycaster and confirm the roof/Candy remain. Record a price observation in Selected combo and check that the existing selection remains recorded when returning.

### Shared Candy control, relationship history and Roof filters — 8 October 2026

This supersedes the separate Roofs-header Candy toggle in the previous pass. The toolbar Candy button is the shared switch; Fundamental tool settings → Candy independently enables Raycaster Candy (all news) and Roof Candy (selected relationship). Selection respects the master switch. Closing Raycaster, hiding Roofs or filtering its selected label does not clear the relationship. Clear combo removes it. Existing settings remain compatible and new choices are exported/imported with the workspace.

Roof Candy now follows the selected relationship across available history before and after the clicked snapshot. Claims + Fed includes holds, cuts and increases under the same pair identity. Each segment resolves the observations/action known at that time; canonical historical publication snapshots retain their original shares. Synthetic aging/expiry snapshots contain their own earlier sources, catalogue and context, rather than inheriting selected future metadata. Missing/expired participants remain insufficient. Fed actions remain separate from macro percentages. Original labels and selected Combo details keep their frozen readings; pan/hover uses cached timeline projections.

Roofs settings expose all 36 registered pairs plus ISM sectors, labor/inflation priority, weekly labor and fresh-news categories. Search, grouped checkboxes and Show all/Hide all are display preferences. Filtering happens before label and local More allocation. It changes no weights, scoring, enabled Raycaster inputs, exhaustive catalogue or already selected Candy history. The legacy fresh-news checkbox preference remains compatible.

Terminal checks cover full Claims/Fed history across every action type, canonical share parity, no future sources, identical pair history from different selected dates, future-removal invariance, exact Fed/fresh expiry, master/configuration independence, immutable snapshots, filter label/More exclusion, restored visibility, saved preferences and invalid-import rejection. A read-only frozen replay passed 5,696 context snapshots, 24 selections, 124,715 projected states and 126 chart views. All 60 frontend test suites passed, exit 0. Build, lint and whitespace checks passed; the existing bundle-size advisory remains.

User visual checks: with Candy on, select the Sep 24 Claims + Fed roof and pan earlier; inspect prior holds/cuts/increases and their historical sources. Turn Candy off and select another roof; both strips should remain hidden. Enable each Candy settings checkbox separately, then both. In Roofs settings hide Claims + Fed and fresh news; their chart labels and More entries should disappear while any selected relationship history stays available. Confirm choices survive reload/workspace restoration. No live browser or screenshot inspection, scoring calibration, stored-data rewrite, commit or deployment was performed.

### Available-from admission and uniform labels — 8 October 2026

The Oct 8, 04:00 Asia/Jakarta fresh-news expiry snapshot was present in the canonical relationship history but silently discarded during drawing when no participating source had a drawable marker. Initial 800-candle M1/M5 history omitted the Oct 1/2/5 sources (including grouped ISM anchored at Manufacturing), while larger timeframes retained them. The user's approved correction makes the combo's real available-from candle determine label eligibility. Source visibility only controls drawable connectors; no source endpoint is guessed. Source-free labels retain a short anchor on hover/selection and remain in local More. Tooltips disclose unavailable symbols and retain every original participating source. Existing Roof filters, future-source rejection and actual candle gaps remain enforced.

Display v7 gives every chart label a fixed 220×60px box in 64px rows, with matching collision footprints. The relationship name is centered; aging/expiry and signed Fed rate annotations sit in a reserved row inside the box. Changes in support / Release support states the reading's scope. Removed the visible Aligned/Conflicted/leading-side line and its A/C abbreviations; Long/Short percentages are plain text. A light green/red box tint shows the weighted lead, balanced conflict is amber, and unchanged/insufficient support is gray with unavailable percentages retained. Full conflict, Fed opposition, evidence and provenance stay in the tooltip/details. The existing blue hover/focus/selected connections, symbol emphasis, row reuse and local More remain. Taller labels fit fewer rows per viewport; crowded labels remain accessible through More.

Headless regression coverage verifies all seven timeframes with an 800-candle memory-update fixture, absent or unprojectable sources, source-free More, grouped ISM, real activation gaps, future rejection and immutable snapshots. UI contracts cover common dimensions, contained expiry/rate annotations, green/red/balanced/unchanged/insufficient states, scope labels, plain percentage text, retained Fed opposition explanations and source-free hover anchors. The read-only frozen audit passed 5,696 context snapshots, 24 selections, 124,715 projected states, 126 chart views and seven timeframe checks using the reported Oct 8 expiry snapshot. All 60 frontend test suites passed, exit 0. Build, lint and whitespace checks passed; the existing bundle-size advisory remains. No scoring rules, weights, stored calendar/price data, commit or deployment changed.

User visual checks: revisit Oct 8, 04:00 on M1/M5 and M15/M30/H1 while that candle is visible; check its label or local More, then hover and inspect the original source list. In both themes compare ordinary, fresh, expiry and Fed labels for equal size, centered names, contained annotations, plain percentages and readable tint. Check an opposed Fed action's tooltip; the rate remains separate from macro percentages. Pan/zoom and verify that cables still follow drawable symbols and each More remains attached to its own candle. No live browser or screenshot audit was performed.

### Concise Roofs display — 8 October 2026

Implemented the approved Concise option in Fundamental tool settings → Roofs → Display density. Focused and All roofs retain their existing behavior; saved legacy settings retain their previous mode. Display version is now 8. The new choice is saved and included in workspace export/import.

Concise replaces the label stacks with one **+N Combo** control per visible available-from candle. Its count and existing popover include every enabled combo at that candle, including those that formerly occupied label rows. Offscreen activations and hidden relationships do not contribute. Exact update times remain separate in the list when several updates share a containing candle. Nearby buttons stagger vertically while retaining their owning candle's X coordinate. A short horizontal tick and thin vertical stem terminate at the measured time-axis boundary; no relationship cables or source emphasis appear in Concise.

The existing popover entries retain their names, original shares, evidence, exact clocks and selection behavior. A compact header adds counts of Long-leading and Short-leading readings, with balanced, unchanged and insufficient readings reported separately. These are counts of overlapping relationship snapshots, not a new combined vote or percentage. The header names publications actually available at each exact update clock. The Oct 5, 21:00 Asia/Jakarta update therefore identifies ISM Services even though the grouped monthly ISM symbol remains at the Oct 1 Manufacturing release. Aging and expiry updates explicitly say **No new release**.

Selecting an entry still opens Combo details and chooses the relationship for Roof Candy, respecting the existing shared Candy settings. Its column gains a selection outline, while the chart remains compact. No selected label or long blue connection is restored until the user chooses an existing density mode. Opening, closing and selecting in the popover use existing snapshots; cached reading classification avoids repeated support arithmetic during navigation.

Terminal verification covers complete per-column inventories, visible-candle admission, source-free updates, local selection, no stacks/cables while selected, immutable snapshots, exact clocks, Roof filters, adjacent-button separation, navigation dismissal, neutral counts, actual Services publication names, saved mode/export/import, bounded lookup over 100,000 entries and cached support readings. All **60 frontend test suites passed**, exit 0. An additional headless check for the measured time-axis boundary and its resize behavior passed afterward. The read-only frozen replay passed **5,696 snapshots, 24 selections, 124,715 projected states, 126 ordinary chart views, 126 Concise chart views and seven timeframe checks**, preserving the canonical history. Final TypeScript/Vite build and lint passed; the existing bundle-size advisory remains. Whitespace checks passed. No scoring rules, weights, stored calendar/price data, commit or deployment changed. No browser automation or live visual audit was performed.

User visual checks: select Concise and judge button/stem readability in both themes; pan/zoom and narrow the chart to check each control follows its candle. Open the Oct 5 control and confirm the header identifies Services at 21:00. Check an aging/expiry column's No new release wording. Select a popover entry, verify Combo details/Candy and the compact chart, then hide a relationship and check the local count changes. Existing Focused and All roofs remain available for detailed connections.
