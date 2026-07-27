# Stylesheet Ownership Map

`Main/src/styles.css` used to be a CSS monolith. It is now an ordered import aggregator.

The stack is fine: React, Vite, TypeScript, Tailwind, and targeted CSS are appropriate for this app. The debt came from repeated AI-assisted feature styling being appended to one global file.

## Current Rule

- Do not casually add new feature CSS to `Main/src/styles.css`.
- New CSS must belong to a specific active surface or to an explicitly shared primitive.
- Garbage/prototype CSS must not steer active product design.
- `Main/src/styles.css` must stay as the import aggregator.
- Do not put feature selectors directly back into `Main/src/styles.css`.

## First Split Policy

The first split was extraction-only.

- Preserve selector names.
- Preserve selector order through import order.
- Do not delete dead CSS.
- Do not rename classes.
- Do not redesign surfaces during extraction.
- Do not move garbage/prototype CSS into active surface files.

The goal of pass 1 was safer ownership, not prettier CSS. Some files are still cascade slices rather than perfect ownership files.

## Current Ordered Files

These files are imported by `Main/src/styles.css` in this exact order:

- `01-base.css` - root variables, reset, app shell, header, tab navigation, workspace wrappers, and first shared panels.
- `02-garbage-legacy-terminal-overview.css` - old terminal/narrative/overview experiments retained for cascade compatibility; do not use for active Overview work.
- `03-overview.css` - Overview brief, active pair release/detail popovers, and nearby legacy overview-era selectors.
- `04-shared-primitives.css` - macro/table/chart shell primitives and some strength-meter-era selectors that still sit in this cascade band.
- `05-economic-calendar.css` - Economic Calendar toolbar, operational rail, table, event drawer, and help popovers.
- `06-economic-calendar-late.css` - active Economic Calendar clock cards, filter popovers, event drawer additions, and nearby late calendar polish.
- `07-garbage-event-quality-study.css` - garbage Archived Event Quality study styles.
- `08-event-replay.css` - active Event Replay workspace, replay modals, and nearby event-study responsive rules.
- `09-garbage-archived-replay-study.css` - garbage Archived Event Reaction replay-study styles.
- `10-event-replay-late.css` - active Event Replay modal, release calendar, and responsive modal polish that originally lived in a deprecated slice.
- `11-mixed-legacy-responsive.css` - mixed responsive leftovers retained in order; review before moving.
- `12-garbage-deprecated-overview.css` - Deprecated Overview hub styles used only from the garbage drawer.
- `13-garbage-deprecated-command-hub.css` - deprecated command-hub and strength-meter v4 styles retained for cascade compatibility.
- `14-charts.css` - active Charts toolbar, drawer, event rail, and chart UI styles.
- `15-garbage-strength-meter.css` - garbage strength-meter v5 styles.

## Next Cleanup Pass

Pass 2 should improve ownership without changing selectors:

- continue separating active surface CSS from deprecated/garbage slices;
- separate active Overview selectors from legacy overview selectors in `03-overview.css`;
- separate active Event Replay selectors from archived event-study selectors where they still share a cascade band;
- review `11-mixed-legacy-responsive.css` for active shell/chart/calendar responsive selectors before moving anything else;
- review `13-garbage-deprecated-command-hub.css` for any active Specialist Tools selectors before deleting or moving pieces;
- keep import order equivalent after each move;
- run build and browser smoke checks after each extraction.

## Safe Split Order

1. Move complete selector blocks only.
2. Never split a multi-line selector list across files.
3. Never split inside an at-rule or media block.
4. Keep imports in cascade order.
5. Run `pnpm --dir Main build` after each extraction pass.
6. Use browser smoke checks for active tabs before deleting or renaming any CSS.

Do not start dead-code deletion until the split is stable and visually verified.
