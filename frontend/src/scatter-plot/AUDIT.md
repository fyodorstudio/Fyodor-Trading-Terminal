# Magnitude configuration audit — October 4, 2026

Scope: the current EURUSD → USD / Quote → NFP implementation, with reusable
boundaries for future pair and family bindings. No additional trading pairs or
families are enabled by this audit.

## Findings addressed

| Finding | Change |
| --- | --- |
| Axis and crosshair values exposed six decimals during zoom/pan. | Display uses at most two decimals; detailed values, editable cutoffs, point coordinates and classifications retain precision. |
| Settings persistence and subscriptions were implemented directly inside the NFP store. | A reusable store factory accepts an explicit pair/currency/side/family scope and series catalog. The NFP binding retains the existing storage key. |
| Shared snapshots could be mutated by a consumer. | Snapshots and boundary tuples are frozen. Identical saves and empty resets do not emit updates. |
| Shared dock composition contained NFP selection, history and settings logic. | That logic now belongs to `PAIR/EURUSD/USD/NFP/NfpScatterPanel.tsx`. The dock entry point composes the supported binding; reusable plots and controls use contracts. |
| Unit labels were parsed from localized display text. | Models provide explicit native-unit metadata from the canonical Inspector formatter. |
| Untouched boundary suggestions could become stale after history refreshed. | Pristine suggestions follow baseline updates; active drafts survive polling and reset on broker/series/publication changes. |
| Malformed raw integer strings could throw during delta calculation. | Shared delta arithmetic treats these as unavailable, so both historical views can exclude them safely. |
| Custom mode still sorted samples for unused P95 source details. | That sorting is skipped for configured series. |
| Styling custom boundaries discarded additional automatic guide preferences. | Custom and automatic guide styles now persist independently, with compatible initialization for older appearance settings. |

## Contracts retained

- Signed Actual minus supplied Previous; no Forecast comparator.
- Three positive, strictly ordered independent cutoffs, mirrored around zero.
  Exact ties stay in the lower inclusive category; beyond Large is Extreme.
- Inspector's seven bands, size labels, tally and scatter guides use the same
  classifier and settings. History starts in January 2015 and excludes the
  inspected publication and later releases.
- Custom cutoffs stay fixed across dates. Unconfigured series retain P95.
- Storage failures retain session settings. Preference persistence remains on
  this device; it does not alter the calendar data source.
- Appearance preferences remain separate from scoring configuration.

## Verification

Terminal regression tests cover production Inspector/scatter parity, exact
boundaries, raw precision and malformed source values, display rounding,
scope/series isolation, existing-key compatibility, snapshot immutability,
external storage changes, failed storage, listener cleanup, invalid drafts,
polling refresh and dirty-draft preservation. The existing navigation,
inventory lifecycle and chart interaction suites remain required.

Run `pnpm --dir frontend test`, `pnpm --dir frontend lint`, and
`pnpm --dir frontend build` before committing. Visual review belongs to the
user: axis/crosshair readability, boundary form layout, Apply/reset, styles,
and agreement with Inspector's visible labels and tally.

Future family bindings still need their own admitted series, native units,
publication grouping/completeness rules and Good/Bad interpretation. The
shared settings factory does not infer those economic rules.
