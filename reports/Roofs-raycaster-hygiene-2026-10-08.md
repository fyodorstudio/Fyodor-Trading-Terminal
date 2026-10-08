# Roofs and Raycaster hygiene — 8 October 2026

The user approved the current UI and requested a commit checkpoint followed by
repository hygiene. Checkpoint **39d8cec** preserves the audited Roofs/Raycaster
views, shared Candy history, display filters, available-from admission, uniform
labels and Concise menus. The cleanup is a separate commit.

## Findings and changes

- The production dependency graph, starting at the actual bootstrap entry and
  including worker URL paths, reached all 354 existing TS/TSX modules and all
  source CSS. No orphan feature folders were found or removed.
- Removed the unused `ContextRibbon.startAt` prop, activation clipping and
  activation-specific empty text. Both production ribbon callers already omit
  this prop. The old mounted fixture still supplied it; the fixture now verifies
  full relationship history, unavailable intervals, individual available-from
  clocks and empty views outside loaded candles.
- Extracted the shared per-column chooser into `chart/RoofColumnMenu.tsx`.
  `ComboRoofs` retains viewport subscriptions, frame coalescing, source emphasis,
  local chooser state and selection. The leaf renderer retains the same DOM,
  positioning, entries, counts, tooltips and handlers. Publication/update text
  is formatted once for use in both the control tooltip and popover header.
- Removed seven unused declarations after checking application, test and audit
  script references: `supportEvidenceNote`, `pmiFamilyIds`,
  `saveCpiMagnitudeLimits`, `readCpiMagnitudeSettings`, `supportsIsmV3`,
  `cpiV3MinimumHistory` and `magnitudeGuideColorIndex`.
- Removed the selected-Raycaster `.support-split` margin rule left behind when
  that view switched to the shared proportional bar. Active catalogue and
  settings support styles remain.
- Corrected subsystem documentation that called older dot controls, fixed
  three-row packing and midpoint/global-row geometry current behavior. Older
  display v4/v5/v6 descriptions are identified as historical. Current ownership,
  versions, three density choices, local menus and full Candy history are explicit.

Test/audit-facing exports, current scorers, retained version metadata, saved
preference validators, grouped ISM behavior and all supported display modes
remain. This pass adds no scoring policy, numerical change, dependency update,
data migration or live service change. Separating Manufacturing/Services release
symbols at their actual publication times remains a focused follow-up.

## Verification

- Focused mounted Roofs and relationship presentation suites passed after cleanup.
- Full frontend regression: all **60 suites passed**, exit 0.
- TypeScript/Vite build and lint passed. Every worker output filename/hash matches
  the pre-cleanup checkpoint build, including USD/relative timeline and all
  standalone analysis workers. The existing main-bundle size advisory remains.
- All **27 storage/recovery fixture tests passed** using isolated temporary data.
- Final whitespace checks passed. Visual UI verification remains with the user;
  no browser automation or screenshot inspection was performed.

Commands from the repository root:

```powershell
pnpm --dir frontend test
pnpm --dir frontend lint
pnpm --dir frontend build
bridge\.venv\Scripts\python.exe -m unittest discover storage/tests -v
git -c core.safecrlf=false diff --check
```
