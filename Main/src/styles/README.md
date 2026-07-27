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
- `03a-garbage-legacy-overview-brief.css` - old unused overview brief / decision / story selectors retained for cascade compatibility.
- `03b-overview.css` - active Overview release popover, pair-detail modal, factor chips, and pair macro detail styles.
- `03c-garbage-legacy-overview-responsive.css` - responsive rules for old unused overview brief / decision / story selectors.
- `03d-overview-responsive.css` - active Overview responsive rules.
- `03e-garbage-legacy-overview-mobile.css` - mobile rules for old unused overview brief / event/action selectors.
- `04-macro-differential-primitives.css` - active macro cards, Differential Calculator layout, and related shared macro primitives.
- `05-garbage-strength-v3.css` - garbage strength-meter v2/v3 styles.
- `06a-garbage-legacy-chart-picker.css` - unused legacy chart picker/status selectors retained outside active Calendar and Charts ownership.
- `06-economic-calendar.css` - Economic Calendar toolbar, operational rail, table, event drawer, and help popovers.
- `07-economic-calendar-late.css` - active Economic Calendar clock cards, filter popovers, event drawer additions, and nearby late calendar polish.
- `08-garbage-event-quality-study.css` - garbage Archived Event Quality study styles.
- `09-garbage-event-quality-reaction-study.css` - garbage Archived Event Quality / Event Reaction continuation styles that were previously mislabeled as Event Replay.
- `10-garbage-archived-replay-study.css` - garbage Archived Event Reaction replay-study styles.
- `11-event-replay.css` - active Event Replay modal, release calendar, and responsive modal polish.
- `12a-active-responsive.css` - active/shared shell, chart, tab, time-pill, and macro responsive rules.
- `12b-garbage-strength-responsive.css` - garbage strength responsive leftovers.
- `12c-garbage-archived-study-responsive.css` - garbage Archived Event Quality / Event Reaction responsive rules.
- `12d-active-mobile-responsive.css` - active/shared mobile shell, nav, chart, and macro responsive rules.
- `12e-garbage-strength-mobile-responsive.css` - garbage strength mobile responsive leftovers.
- `13-garbage-deprecated-overview.css` - Deprecated Overview hub styles used only from the garbage drawer.
- `14a-garbage-deprecated-command-hub.css` - deprecated command-hub styles retained for cascade compatibility.
- `14b-garbage-strength-v4-legacy.css` - garbage strength-meter v4 legacy styles that previously lived inside the deprecated command-hub slice.
- `15-charts.css` - active Charts toolbar, drawer, event rail, and chart UI styles.
- `16-garbage-strength-meter.css` - garbage strength-meter v5 styles.

## Next Cleanup Pass

Pass 2 should improve ownership without changing selectors:

- continue separating active surface CSS from deprecated/garbage slices;
- keep active Overview work in `03b-overview.css` or `03d-overview-responsive.css`;
- continue separating active Event Replay and Overview selectors from older cascade bands if new evidence shows they are still mixed;
- review active shell/chart/calendar responsive selectors in the `12a` / `12d` responsive files before moving anything else;
- `14a-garbage-deprecated-command-hub.css` and `14b-garbage-strength-v4-legacy.css` are garbage-only; do not use them for active Specialist Tools work;
- `06a-garbage-legacy-chart-picker.css` is garbage-only; active Charts work belongs in `15-charts.css`;
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
