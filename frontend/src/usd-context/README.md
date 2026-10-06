# USD context memory v2

The context engine consumes unchanged signed magnitude scores from CPI v3.1,
NFP v2, monthly ISM v3 and Retail Sales v1. It interprets the USD side of a pair. It neither
scores the other currency nor learns weights from price reactions.

## Policy

| Input | Weight | Update behavior |
| --- | --- | --- |
| NFP v2 | 40% | Latest jobs report replaces the previous jobs assessment |
| CPI v3.1 | 40% | Latest CPI report replaces the previous inflation assessment |
| ISM v3 | 10% | Manufacturing then Services replace the same ISM slot; each uses its original publication time |

| Retail Sales v1 | 10% | Latest Retail Sales report replaces the spending assessment |

These are explicit prototype interpretation weights. Inflation and labor retain
40% each; the activity budget is split between surveys and nominal spending. Scores are existing signed
0–4 component magnitudes, weighted within each source scorer. Evidence labels do
not multiply scores. We retain score size, component exclusions and qualifications.
ISM publication scores are never added together. Raycaster has one ISM switch
controlling both sectors; Inspector filters do not select this context inventory.

The latest assessment persists until replaced or 45 days after its publication
on the broker chart clock. This expiry is a prototype monthly-data freshness
rule, not an estimated economic half-life. A new uncomputed assessment replaces
the old vote, with an incomplete-context explanation; an older favorable vote
is not silently carried forward. Disabled/missing/expired weights are not
redistributed. Initially absent families remain missing. Current-month releases
do not erase still-active earlier-month CPI or NFP assessments.

Positive totals mean stronger USD; negative totals mean weaker USD. Exact net
cancellation uses CPI → NFP → ISM → Retail Sales direction priority, with weak evidence. A source
scorer's declared zero-score tie direction remains available to that priority.
All unavailable or expired evidence is Uncomputed; no direction is fabricated.

Evidence is descriptive agreement, not probability. Missing or incomplete inputs,
exact cancellation or net/gross agreement below one third give weak evidence.
Strong requires strong supporting NFP and CPI assessments, net/gross agreement
at least two thirds, and no active family with weak evidence. Remaining directional
cases are moderate. Correlated family inputs are not asserted to be statistically
independent confirmations. Source change size is retained for inspection; the
context box does not conflate evidence strength with predicted price-move size.

## Chronology and scope

`core/score-publication.ts` adapts canonical scorers to currency-level votes.
`core/build-context-timeline.ts` builds atomic publication snapshots and expiry
boundaries; `combine-context.ts` resolves four active slots; `context-lookup.ts`
does a binary lookup. Same-time publications enter together. Chart clock ordering
and all rows' chart-time consistency are validated. Unknown chart timing is
excluded; original source timestamps and existing ISM official-date gates remain.

The worker receives broker history from January 2015, scoped to the required
series and independent of Inspector's visible date range. Only observations
published by the corrected current clock enter. Each assessment and its calibration
use its publication-time history. Removing later observations preserves earlier
snapshots. Stored provider values can contain later revisions/backfills; this is
reconstructed history, not certified original-release vintage replay.

Existing EURUSD signal magnitude settings are intentionally shared by the USD
engine, including on other supported pairs. Original A−P settings, menu view
selection and chart symbol visibility do not select different scoring policies.
Raycaster's own saved family filters select inputs independently of Inspector.
All four are enabled by default. Other event families currently have no effect. Pair conversion supports EURUSD, GBPUSD, AUDUSD, NZDUSD, USDJPY,
USDCHF and USDCAD, plus dot/underscore/hyphen broker suffixes and lowercase suffixes.
USD quote converts weakness to Long; USD base converts weakness to Short.
Metals, crypto, crosses and unrecognized symbol formats are excluded.

## Runtime and verification

`runtime/` owns the scoped storage hook and a module worker. Stable inventories,
applied component settings, supported filters and publication admission invalidate
the calculation. Pointer coordinates and symbol inversion never do. The shared
latest-job client drops obsolete results and terminates the worker on disable or
unmount. A headless environment without Worker uses the canonical pure fallback.
Hovering performs only a binary search over prepared snapshots.

The CPI v3 prior-reference lookup now uses the existing immutable-history index;
its math, duplicate gates and earlier-history rules are unchanged.

Tests: `tests/usd-context/test_context.mjs` and `test_raycaster.mjs`. The chronological
audit script checks stored scorer parity, eight June/July/August/September future-removal replays, exact
publication boundaries, and the actual Vite-built worker against the pure engine
while the main event loop continues running:

```powershell
pnpm build
node scripts/audit-usd-context.mjs ../storage/data/cpi-v2-design-snapshot.json ../storage/data/nfp-v2-design-snapshot.json ../storage/data/ism-v2-design-snapshot.json ../storage/data/retail-v1-design-snapshot.json ../storage/data/usd-context-v2-design-audit
```

V2 audit: 140 CPI, 141 NFP, 284 ISM and 144 Retail assessments retain their
standalone totals, directions, evidence and change size. The engine builds 703
snapshots; eight replay cutoffs preserve the full snapshot after future removal.
Both the pure engine and actual production worker match. One run took about
4.4 seconds in the worker while the main event loop remained active. Startup or
filter changes rebuild the timeline; hover only performs a lookup.

V1's 40/40/20 policy and 570-snapshot report remain archived in the root scoring
library and `storage/data/usd-context-v1-design-audit.*`. New v2 priorities were
set without fitting the user's Retail price notes. In particular, July 16 still
resolves to EURUSD Long with Moderate combined evidence; incorporating other US
releases does not force that observation into a matching price label.

No automated visual inspection is used.
