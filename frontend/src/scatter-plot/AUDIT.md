# Magnitude configuration audit — October 4, 2026

Scope: EURUSD → USD / Quote → NFP and US CPI / core CPI, with reusable
boundaries for future pair and family bindings. Additional pairs remain disabled.
The initial hygiene review found a clean working tree and no tracked generated
dependency/build/cache/local-inventory files requiring cleanup.

## Findings addressed

| Finding | Change |
| --- | --- |
| Axis and crosshair values exposed six decimals during zoom/pan. | Display uses at most two decimals; detailed values, editable cutoffs, point coordinates and classifications retain precision. |
| Settings persistence and subscriptions were implemented directly inside the NFP store. | A reusable store factory accepts an explicit pair/currency/side/family scope and series catalog. The NFP binding retains the existing storage key. |
| Shared snapshots could be mutated by a consumer. | Snapshots and boundary tuples are frozen. Identical saves and empty resets do not emit updates. |
| Shared dock composition contained NFP selection, history and settings logic. | `dock/FamilyScatterPanel.tsx`, `useFamilyScatterData.ts` and `inspection/family-scatter-model.ts` now reuse one lifecycle/model across explicit family bindings. |
| Unit labels were parsed from localized display text. | Models provide explicit native-unit metadata from the canonical Inspector formatter. |
| Untouched boundary suggestions could become stale after history refreshed. | Pristine suggestions follow baseline updates; active drafts survive polling and reset on broker/series/publication changes. |
| Malformed raw integer strings could throw during delta calculation. | Shared delta arithmetic treats these as unavailable, so both historical views can exclude them safely. |
| Custom mode still sorted samples for unused P95 source details. | That sorting is skipped for configured series. |
| Styling custom boundaries discarded additional automatic guide preferences. | Custom and automatic guide styles now persist independently, with compatible initialization for older appearance settings. |
| Identifying Small/Medium/Large colors required matching numbered Appearance guides. | Color boxes beside each cutoff edit the active mode's mirrored bands and boundary lines through the existing appearance store; numeric drafts, scoring and navigation are preserved. |
| No saved boundary silently enabled P95. | Undefined is now the default; empty Inspector cells, raw scatter points and descriptive counts remain. P95 requires an explicit saved mode. |
| Adding CPI risked copying NFP lifecycle/classification code. | Shared reading, history, settings, cells, tally and scatter engines accept registered family definitions. CPI keeps its scope/catalog/settings in isolated bindings. |
| Mixed Undefined and configured-but-unavailable series could receive misleading footer labels. | Undefined and unclassified readings are counted separately per grade. |
| Selecting an older release narrowed histogram/P95 history and refetched Inspector data. | Both views now use all usable released readings since January 2015 through now. Selection preserves the query; `Earlier / All` distinguishes chronology from calculation N. |

## Contracts retained

- Signed Actual minus supplied Previous; no Forecast comparator.
- Three positive, strictly ordered independent cutoffs, mirrored around zero.
  Exact ties stay in the lower inclusive category; beyond Large is Extreme.
- Inspector's seven bands, size labels, tally and scatter guides use the same
  classifier and settings. History starts in January 2015 and includes all usable
  readings released through now, including the inspected and newer releases.
- Custom cutoffs stay fixed across dates. Unconfigured series are Undefined;
  P95 is explicitly opt-in. Existing saved custom tuples remain compatible.
- CPI retains the chosen higher/lower inflation USD-pressure grading convention
  and rate/index native units. Its four primary rates now supply signed 0–4
  magnitude points with equal series weights, separate monthly/annual subtotals
  and a total-based EURUSD direction. A separate four-index matrix uses the
  shared classifier and saved native-point limits, with adjusted/unadjusted
  movement subtotals excluded from the EURUSD rate score.
- Storage failures retain session settings. Preference persistence remains on
  this device; it does not alter the calendar data source.
- Appearance preferences remain separate from scoring configuration.

## Verification

Terminal regression tests cover all-dataset counts, live N growth, correction
replacement, selection invariance, production Inspector/scatter parity, exact
boundaries, raw precision and malformed source values, display rounding,
scope/series isolation, existing-key compatibility, snapshot immutability,
external storage changes, failed storage, listener cleanup, invalid drafts,
polling refresh and dirty-draft preservation. The existing navigation,
inventory lifecycle and chart interaction suites remain required.
The CPI suite verifies the actual Inspector table, both families' Undefined
defaults, zero hidden-baseline requests, applied settings updating both views,
clearing classifications, family switching/cancellation, scoped queries and
independently persisted modes/boundaries. The CPI score suite additionally checks
signed magnitude points, exact cancellation priorities, unavailable readings,
index exclusions and live score updates from shared settings.

Run `pnpm --dir frontend test`, `pnpm --dir frontend lint`, and
`pnpm --dir frontend build` before committing. Visual review belongs to the
user: axis/crosshair readability, boundary form layout, Apply/reset, styles,
and agreement with Inspector's visible labels and tally.

Future family bindings still need their own admitted series, native units,
publication grouping/completeness rules and Good/Bad interpretation. The
shared settings factory does not infer those economic rules.
