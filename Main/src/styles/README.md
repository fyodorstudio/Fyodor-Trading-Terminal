# Stylesheet Map

`Main/src/styles.css` is intentionally left as one imported file for now. It is about 7,000 lines and contains active primary-surface styles mixed with old overview/prototype styles. Splitting it safely needs a visual regression pass because cascade order and shared responsive rules matter.

## Approximate Sections

These ranges are orientation hints, not exact ownership boundaries. The file still needs a visual-regression pass before any split.

- `1-320`: global shell, header, status chips, tab navigation, workspace wrappers, shared panels and tables.
- `321-1166`: older overview/terminal/narrative dashboard experiments.
- `1177-1663`: older overview brief, action cards, trust/risk/debate surfaces.
- `1664-2117`: differential calculator, strength meter v2/v3, and related garbage/secondary surfaces.
- `2132-2516`: shared table, log, chart shell, picker, and chart status primitives.
- `2522-3359`: Economic Calendar toolbar, operational rail, table, event drawer, and help popovers.
- `3363-4480`: archived Event Quality and Event Reaction study surfaces.
- `4481-5099`: active Event Replay styles plus shared responsive rules for active and archived event-study screens.
- `5101-6645`: old Command Hub / Deprecated Overview styles.
- `6646-7033`: later polish for specialist cards, chart toolbar/drawer, and strength meter v4/v5.

Sections tied to old overview/prototype/garbage surfaces are ignored by default. Do not read or extract them unless the user explicitly asks for CSS work on those garbage-drawer screens.

## Recommended Safe Split Order

1. Extract global shell/nav/workspace/shared primitives first.
2. Extract active primary feature CSS: Charts and Economic Calendar.
3. Extract active secondary CSS: Event Replay, keeping its responsive rules with it.
4. Move deprecated/prototyping CSS last, preserving import order exactly.

Do not reorder selectors during the split. Create one import aggregator and run the full test/build plus manual visual smoke checks on Charts, Economic Calendar, Central Banks Data, and Event Replay.
