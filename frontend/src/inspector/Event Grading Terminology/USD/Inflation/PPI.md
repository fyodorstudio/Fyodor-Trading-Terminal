# US PPI descriptive comparisons and manual magnitude

Scope: US / USD, family `ppi`. Four series: headline m/m (`840030001`), core
m/m (`840030002`), headline y/y (`840030003`), core y/y (`840030004`). Core
excludes food and energy. Rate deltas use percentage points.

Primary comparison is Actual minus supplied Previous. Positive = Higher/green,
negative = Lower/red, exact zero = Unchanged/gray, unavailable = Missing/gray.
Forecast and Revised Previous never replace the supplied Previous.

For PPI only, a finite supplied Revised Previous adds a second line, A−RevP,
below the primary delta. Compute Actual minus Revised Previous with the same
precision handling and independent sign color. Revised zero and a revision
equal to Previous are valid comparisons. Absent/nonfinite revisions omit the
line. An available revision with unusable Actual shows a missing comparison.
Raw scaled values take priority when available; malformed/unsafe raw differences
are unavailable rather than fabricated.

Example: Actual 0.5%, Previous 0.7%, Revised Previous 0.5% yields A−P −0.2 pp
(Lower) and A−RevP 0 pp (Unchanged).

Each series starts with Undefined magnitude. Scatter Plot's PPI controls set
independent positive increasing Small/Medium/Large boundaries and Freeze them.
Absolute delta above Large is Extreme; zero is Unchanged. A−RevP's optional
size label uses those same saved boundaries. Hiding histogram bars keeps both
size labels. Undefined keeps magnitude cells empty.

Histogram/Scatter points and all-dataset counts retain supplied-Previous A−P
only; revisions do not create extra events/samples. NFP/CPI grading and scoring
stay unchanged. No PPI pair-direction score is implemented.

Runtime: `grading/ppi-grading.ts`, `magnitude/ppi-magnitude-settings.ts` and the
scoped `scatter-plot/PAIR/EURUSD/USD/PPI/` binding. Verification:
`tests/scatter-plot/test_ppi.mjs`. Visual acceptance remains with the user.
