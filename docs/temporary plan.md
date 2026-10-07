# Approved implementation plan

Scope: chart visibility and explanations, an exact-time context ribbon, and manual Notebook trading workflow. Preserve all scoring rules and broker-order behavior.

1. [x] Write trading workflow.md before implementation.
2. [x] Separate Roofs / Ribbon visibility from the Raycaster hover box; persist display settings and preserve old preferences.
3. [x] Add a roof gear guide listing the four relationship types, families, activation and span semantics. Use three lanes with overflow retained.
4. [x] Build a viewport-only context ribbon using the existing shared USD / EUR histories. Merge update boundaries atomically, clip future times, retain unavailable states, expose hover and click explanations, and follow the selected context mode.
5. [x] Add a small Notebook workflow editor: thesis, observable price and fundamental invalidation, review horizon, risk limit, exit rule and context record. Preserve old saved plans; copy the workflow into pinned setups.
6. [x] Add meaningful chronology, visibility and persistence tests; run terminal lint/build/tests. No browser or screenshot audit; user checks visual layout and chart responsiveness.
7. [x] Update scoring library / manual audit guidance and this checklist with results.

Design constraints: one context calculation per selected history; no scoring on pointer movement; RAF-coalesced viewport projection; no future releases leaking into earlier ribbon segments; gray is unavailable, not an invented neutral bias. Roofs remain USD relationships, while the ribbon can compare EUR / USD. No automated entry or exit decisions.

Implemented modules: raycaster/ribbon (timeline, geometry, explanation and viewport display); ContextViewControls / RoofGuide; trader-notebook/workflow (schema, editor and explicit shared-history capture). EUR timeline adds publication/memory metadata only; all numerical rules remain intact. Notebook's old unmounting success-message timer now cleans up.

Verification: all 47 frontend suites passed. New coverage checks atomic EUR/USD updates, within-H1 release clocks, weekend hover clocks, future clipping, unavailable states, expiry classification, binary viewport work, RAF batching, independent visibility, current-context worker reuse, pinned copy isolation and workspace restore. The final hide/reopen regression confirms an old hovered candle cannot reappear. Lint and production build pass.

Manual checks remain in manual edit.md: three-lane/ribbon placement, small docks, both themes, perceived pan/hover responsiveness, guide readability and Notebook layout. No automated broker execution or numerical calibration changes were introduced.

## Completed numerical refinement pass — context v7

This later authorized pass supersedes the earlier preserve-all-math scope:

1. [x] Freeze v6.2 baseline before edits and preserve raw dataset values.
2. [x] Correct NFP reference-gap/revision comparisons; expose v2.1.
3. [x] Add combined completeness/agreement safeguards and consistent public labels.
4. [x] Separate fresh economic changes from coverage, renewal and availability;
   require matching component basis and distinguish GDP assessment stages.
5. [x] Replay chronological blocks and 1/4/24 H1 horizons against the baseline
   and latest updating standalone. Preserve non-NFP/EUR raw parity and chronology.
6. [x] Document old/current rules and revised trading/audit workflow.
7. [x] Pass all 50 sequential frontend suites, build, lint and whitespace checks.

User visual audit is now due. Default December–January combined outputs abstain,
with 12 old fresh Roofs removed. The January rally remains unexplained; price
metrics do not establish a reliably better directional model. See
reports/Context-v7-refinement-audit.md and manual edit.md for results and checks.
