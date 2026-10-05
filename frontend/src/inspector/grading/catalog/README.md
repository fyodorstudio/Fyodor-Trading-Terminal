# Numeric family catalog

`EUR/numeric-event-catalog.ts` and `USD/numeric-event-catalog.ts` explicitly admit
stable MT5 IDs for filterable numeric series. `expanded-reading-families.ts` joins
these IDs to the canonical event-family country/currency scope. Names and missing
values never determine numeric eligibility. Meeting commentary and standalone
speeches are excluded.

The catalog covers US Claims, Retail Sales, PCE, GDP, ISM Manufacturing/Services,
Fed rates, ECB rates, euro-area inflation/GDP/labor/wages/PMIs, German inflation
and PMIs, and French PMIs. Existing NFP/CPI/PPI detailed rules retain their own
modules and settings keys. Shared rendering/calculations avoid per-family copies.

Every admitted numeric reading uses positive A−P = Higher (green), negative =
Lower (red), zero = Unchanged, missing = Missing. This describes the numeric
change, including unemployment, without interpreting trading direction. Optional
A−RevP is Actual minus supplied Revised Previous, including zero or a revision
equal to Previous. Raw scaled precision is retained when available. It shares the
same frozen magnitude boundaries; it never adds an observation or changes primary
A−P samples, counts, histogram frequencies, or existing NFP/CPI scores.

New magnitudes default to Undefined. Freeze three independent positive ascending
boundaries in Scatter Plot. Settings scope is EURUSD / currency / BASE or QUOTE /
family / series ID; workspace export/import discovers registered families.
Limits use native delta units, except policy rate deltas and limits both use bp
(25 bp = 0.25 percentage points). k and M keep their source multiplier; values
are not silently rescaled between series. Shared Small/Medium/Large colors stay
separate from Base/Quote identity colors and Higher/Lower sign colors.

These families default to the newest usable publication for the selected series.
A sibling published on another schedule does not prevent inspection or break its
line. Missing/duplicate/incompatible observations of the selected series do break
the line. NFP/CPI/PPI retain complete-episode default selection.

To extend, verify catalog IDs and country/currency, add explicit numeric entries,
then add the family to the filter catalog. Registration supplies grading, magnitude,
Scatter bindings and workspace validation. Add a separate scoring policy only
when its trading interpretation is agreed; numeric admission alone never creates
Long/Short. Tests: `tests/scatter-plot/test_numeric_families.mjs`.
