# Stylesheet Ownership Map

`Main/src/styles.css` is a known CSS monolith. It is not the intended long-term structure.

The stack is fine: React, Vite, TypeScript, Tailwind, and targeted CSS are appropriate for this app. The debt came from repeated AI-assisted feature styling being appended to one global file.

## Current Rule

- Do not casually add new feature CSS to `Main/src/styles.css`.
- New CSS must belong to a specific active surface or to an explicitly shared primitive.
- Garbage/prototype CSS must not steer active product design.
- `Main/src/styles.css` should become the import aggregator after the split.

## First Split Policy

The first split is extraction-only.

- Preserve selector names.
- Preserve selector order through import order.
- Do not delete dead CSS.
- Do not rename classes.
- Do not redesign surfaces during extraction.
- Do not move garbage/prototype CSS into active surface files.

The goal of pass 1 is safer ownership, not prettier CSS.

## Planned Owned Files

Use these as the intended targets unless implementation evidence shows a better name:

- `base.css` - Tailwind import, root variables, reset, app shell, header, nav, workspace primitives.
- `shared.css` - shared tables, chips, status pills, popovers, drawers, and generic primitives used by multiple active surfaces.
- `overview.css` - fresh Overview and pair-detail/release popovers.
- `charts.css` - Charts tab, chart toolbar, settings drawer, event rail, cache/readout styling.
- `economic-calendar.css` - Economic Calendar toolbar, freshness/readout cards, table, event drawer, help popovers.
- `event-replay.css` - active Event Replay workspace, modals, replay controls, replay chart shell.
- `central-banks.css` - Central Banks Data surface.
- `specialist-tools.css` - active Specialist Tools shells including Differential Calculator and Macro Drivers.
- `garbage.css` - Deprecated Overview, old Command Hub, Strength Meter variants, archived Event Reaction/Event Quality, and other garbage/prototype styling.

## Approximate Current Sections

These ranges are orientation hints only. Verify before moving blocks.

- `1-320`: global shell, header, status chips, tab navigation, workspace wrappers, shared panels and tables.
- `321-1166`: older overview/terminal/narrative dashboard experiments.
- `1177-1663`: older overview brief, action cards, trust/risk/debate surfaces.
- `1664-2117`: Overview popovers/factor details plus differential/strength-meter-era styles.
- `2132-2516`: shared table, log, chart shell, picker, and chart status primitives.
- `2522-3359`: Economic Calendar toolbar, operational rail, table, event drawer, and help popovers.
- `3363-4480`: archived Event Quality and Event Reaction study surfaces.
- `4481-5099`: active Event Replay styles plus shared responsive rules for active and archived event-study screens.
- `5101-6645`: old Command Hub / Deprecated Overview styles.
- `6646-end`: later polish for specialist cards, chart toolbar/drawer, chart event rail, and strength meter v4/v5.

## Safe Split Order

1. Create owned CSS files and make `styles.css` import them in the same cascade order.
2. Extract global/shared primitives first.
3. Extract active primary surfaces: Overview, Charts, Economic Calendar, Central Banks.
4. Extract active secondary surfaces: Event Replay, Differential Calculator, Macro Drivers, Specialist Tools shell.
5. Move deprecated/prototyping selectors into `garbage.css` last.
6. Run build and screenshot smoke checks after each extraction pass.

Do not start dead-code deletion until the split is stable and visually verified.
