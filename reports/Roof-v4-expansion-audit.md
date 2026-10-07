# USD Roof expansion v4 — 7 October 2026

The pass registers all 28 macro pairs and eight Fed/macro pairs, exposes weighted
conflict leads, and repairs ISM sector fresh comparisons. Raycaster/Candy label,
color and accumulated-context gate changes remain deferred.

## Numerical replay

Source: Elev8-Demo2, storage revision 78619. The frozen input contains 41,559 USD
and 35,412 EUR rows, with explicit automatic magnitude settings. This is the
current stored vintage, not certification of original as-published values or a
claim to read browser-local custom preferences. No prices, forecast surprise,
outside-event notes or geopolitical data are scoring inputs.

The full integrity replay checked 5,696 USD and 8,299 EUR snapshots, 15,750
fresh-effect decompositions, 15,484 ribbon parity comparisons and nine
future-removal checks. Manual calibration preserved 140 CPI feature sets while
changing 84 scores. The canonical family arithmetic, decision distributions,
point counts, excluded-timing counts and calibration feature checks match the
prior v8 report. Accumulated budgets and public direction gates are unchanged.

The final Roof replay produced 12,467 dated annotations: 9,053 macro pairs,
2,031 Fed/macro pairs, 1,229 fresh sequences, 113 ISM sector resolutions,
30 weekly-labor interactions and 11 labor/inflation interactions. Every one of
the 36 registered pairs has an eligible historical snapshot. These are
annotations reusing source snapshots, not 12,467 additional votes or discovered
causal coefficients. The resolver classified 7,541 as aligned, 4,896 as
conflicted, 26 as unchanged and four as exactly balanced.

## September example

At **Sep 3, 2026, 19:30 Asia/Jakarta** (15:30 broker chart time), the new
**ISM + Jobless Claims** pair says **Aligned · Long**, qualified as Weak because
the ISM month has only Manufacturing's 30% sector coverage. Claims standalone
score is -0.65; the retained Manufacturing-only monthly ISM score is -0.285.
Its source was published Sep 1, 21:00 Jakarta. Services is not backdated into
the Claims snapshot.

At **Sep 3, 21:00 Jakarta**, Services completes the monthly assembly. Comparable
Manufacturing change is -0.051 and Services change +0.0525, for aggregate ISM
fresh support +0.0015. The incoming Services replacement uses +0.0525, without
charging the earlier Manufacturing change again. Both sectors compare with
their own preceding month under current calibration, and retain their own
seven-day expiry clocks. Custom magnitude settings may change these scores.

## Verification and responsiveness

- All 54 frontend suites passed. Affected relationship, Inspector, workflow,
  ribbon and Fed suites were rerun after the final edge-case repairs.
- Tests enumerate all 36 pairs and all 502 selectable USD groups (247 macro,
  255 including Fed), using an independent weighted arithmetic oracle.
- Conflict, narrow lead, zero, missing/disabled/expired/future inputs, sector
  calibration drift, reference gaps, sector expiry, duplicate publications,
  Fed-only clocks, ambiguous meetings and chronology inconsistency are covered.
- Headless interactions verify the catalogue's 36 rows, larger selections,
  fresh/release switching and unavailable-input reasons. These are terminal DOM
  tests, not browser automation or visual audits.
- Build and lint pass. Vite retains a nonblocking advisory for the main bundle
  exceeding 500 kB; this pass does not claim to measure browser painting.
- The pure projection benchmark used 103,162 synthetic H1 bars and all 12,467
  annotations. Initial anchor/layout preparation took 137 ms; 100 cached pan
  projections took nine ms total, with at most 11 positioned Roofs and 154
  overflow entries in a tested viewport. Synthetic timing is not an end-user
  UI measurement. Layout is reused across pans; no release rescoring occurs.

Reproduce the numerical Roof replay:

```powershell
node frontend/scripts/usd-context/audit-roof-expansion.mjs storage/data/context-v8-integrity-input.json storage/data/new-roof-audit.json
```

The script requires a new output path and preserves earlier reports. Final
selected results and pair counts are in `Roof-v4-expansion-results.json`.

## Manual audit

Open a direction box, then **USD relationship catalogue**. Inspect Sep 1–3,
2026; use More if Focused hides the pair. Check both conflict leads, exact
balance, eligibility reasons and Fed hold/action separation. Audit dense pan,
label wrapping, dot navigation, narrow/dark docks and saved preferences using
`docs/manual edit.md`. Catalogue selections are previews; the audit controls
record the original Roof displayed at the top. Visual verification remains
with the user. No dataset/preferences were overwritten or changes committed.
