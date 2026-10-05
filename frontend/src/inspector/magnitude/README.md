# Shared manual magnitude

Magnitude has two persisted states: Undefined (no tuple) or frozen manual
Small/Medium/Large limits. P95 has been removed; legacy P95 markers normalize to
Undefined without inventing manual limits. Existing valid tuples retain their
scope/key/value compatibility. Version: `zero-centered-ap-manual-all-dataset-v7`.

## Classification

`0 < Small < Medium < Large`, finite values in the series' native delta units.
Fed/ECB rates use basis points for both deltas and boundaries.
Both signs share these limits. Zero is Unchanged; inclusive ties remain in the
lower size; above Large is Extreme. Relative floating-point tolerance admits
ordinary decimal subtraction equality without hiding distinct source changes.
Seven signed histogram bins are three negative, exact zero, three positive.
Extreme values count in N and remain visible in scatter, outside the seven bars.

Freeze commits a valid manual draft and locks its inputs. Unfreeze opens editing
without modifying saved scoring. Valid edits preview bands and size immediately
in Scatter Plot while Inspector retains saved values. Invalid drafts keep the
last valid preview. Freeze replaces the saved tuple, Set Undefined
removes it. Reload/reopen returns to the saved frozen tuple. Color/style edits
remain independent of frozen numeric limits.

## Dataset and timing

Use all unique, observed publications with established UTC timing from January
2015 through now, including inspected and newer releases, selected broker only.
Exactly one compatible Actual/Previous reading is required per series publication.
Missing/nonfinite deltas, duplicates, foreign identity, incompatible units,
withdrawn/unobserved/uncertain rows and future schedules stay outside N. Corrections
replace samples by source identity. `Earlier / All` counts prior publications over
all admitted readings, e.g. `2 / 140`; selection does not narrow the dataset.
New usable releases grow N without recomputing frozen boundaries.

Inventory polling uses consistent revision snapshots, scoped IDs and pagination.
Historical selection preserves the query. Partial coverage/errors remain explicit.
Manual limits classify current readings without a history-derived threshold;
frequencies/plots still depend on available admitted history. Custom distributions
can exist with zero samples, and render fixed endpoints rather than deriving them
from zero-heavy data. Missing current readings remain Unavailable.

## Module responsibilities and expansion

- `settings/magnitude-settings-store.ts`: validated immutable scoped tuple snapshots,
  subscriptions, persistence and legacy normalization.
- `magnitude-families.ts`: canonical family rules, series scope, history start and
  settings binding. Add new pairs/families with independent keys/catalogs.
- `family-magnitude-history.ts`: shared admission and sample extraction.
- `magnitude-distribution.ts`: pure manual classification, bins and extremes.
- `useFamilyMagnitudeHistory.ts`: Inspector storage lifecycle and shared settings.
- `MagnitudeHistogram.tsx`, `FamilyMagnitudeCell.tsx`: accessible rendering/details.
- Histogram/tally presentation stays in this directory. Signed score presentation and
  pair/family policies live in [../scoring/README.md](../scoring/README.md).

NFP uses three primary signed 0–4 contributions: Payrolls, Unemployment (inverted
sign), and Earnings m/m. Seven supporting rows retain signed magnitudes but never
enter the USD total or gate direction. Role tooltips explain each series. Exact
cancellation prioritizes Payrolls, Unemployment, then Earnings m/m. Undefined or
unusable primaries and all-zero primaries leave direction Uncomputed.
CPI's four primary rates have equal signed 0-4 points with monthly/annual subtotals,
explicit cancellation priority and EURUSD mapping. Index scores remain separate
and do not contribute to the rate direction. See the canonical family terminology.

Settings keys encode pair/currency/side/family; series IDs validate against each
binding. Unknown IDs and invalid tuples do not enter calculations. Workspace
portability must register new scopes in its validator catalog; see
`workspace-portability/README.md` and the repository maintenance guide.

All 19 numeric filterable EUR/USD families share this engine. New family IDs and
names are explicitly admitted in [the numeric catalog](../grading/catalog/README.md).
Nonnumeric speeches/meeting commentary have no magnitude. Optional A−RevP uses the
same saved limits; histogram/scatter samples always retain supplied Previous.
Other families' default Scatter inspection follows the selected series' own
publication schedule; NFP/CPI/PPI retain complete-episode defaults.

## Verification

Frontend suites cover signed inclusive boundaries, zero/missing/extreme values,
source admission and units, selection invariance, live N growth/corrections,
per-series isolation, freeze/unfreeze drafts, migration, storage failures,
Inspector/scatter parity, NFP primary/supporting isolation, CPI scores and reactive settings. Visual acceptance
belongs to the user. Run `pnpm --dir frontend test` from the repository root.
