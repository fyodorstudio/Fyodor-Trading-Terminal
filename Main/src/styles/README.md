# Stylesheet Map

`Main/src/styles.css` is intentionally left as one imported file for now. It is about 6,000 lines and contains old overview/prototype styles mixed with current primary surfaces. Splitting it safely needs a visual regression pass because cascade order matters.

## Approximate Sections

These ranges are orientation hints, not exact ownership boundaries. The file still needs a visual-regression pass before any split.

- `1-302`: global shell, header, status chips, tab navigation, shared panels and tables.
- `303-1158`: older overview/terminal/narrative dashboard experiments.
- `1159-1645`: older overview brief, action cards, trust/risk/debate surfaces.
- `1646-2113`: differential calculator, strength meter v2/v3, and related secondary surfaces.
- `2114-2497`: shared table, log, chart shell, picker, and chart status styles.
- `2498-3273`: Economic Calendar toolbar, operational rail, table, event drawer, and help popovers.
- `3274-3350`: compact calendar/filter helpers.
- `3351-4151`: Event Quality and old Event Reaction surfaces.
- `4152-5059`: old Event Reaction guided/manual workflow styles.
- `5062-6606`: old Command Hub / Deprecated Overview styles.
- `6607-6994`: later polish for specialist cards, chart toolbar/drawer, and strength meter v4/v5.

Sections tied to old overview/prototype/garbage surfaces are ignored by default. Do not read or extract them unless the user explicitly asks for CSS work on those garbage-drawer screens.

## Recommended Safe Split Order

1. Extract global shell/nav/shared primitives first.
2. Extract primary feature CSS: charts, calendar, central banks.
3. Extract active secondary CSS: Event Replay.
4. Move deprecated/prototyping CSS last, preserving import order exactly.

Do not reorder selectors during the split. Create one import aggregator and run the full test/build plus manual visual smoke checks on Charts, Economic Calendar, Central Banks Data, and Event Replay.
