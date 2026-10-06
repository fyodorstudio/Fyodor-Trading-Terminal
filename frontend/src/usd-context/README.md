# USD context memory v3

The shared engine consumes unchanged standalone CPI v3.1, NFP v2, Claims v1,
monthly ISM v3 and Retail Sales v1 scores. It interprets the USD side of supported
pairs. Forecasts, price outcomes and the other currency do not vote.

## Declared policy

| Input | Weight | Freshness | Update behavior |
| --- | ---: | --- | --- |
| CPI v3.1 | 40% | 45 days | Latest inflation report replaces the previous CPI slot |
| NFP v2 | 30% | 45 days | Latest jobs report replaces the previous NFP slot |
| Claims v1 | 10% | 14 days | Latest weekly report replaces the previous Claims slot |
| ISM v3 | 10% | 45 days | Manufacturing then Services update one monthly ISM slot at their original times |
| Retail Sales v1 | 10% | 45 days | Latest spending report replaces the previous Retail slot |

These priorities are prototype rules, not fitted coefficients or measured FX
impact. NFP and Claims share the existing 40% labor budget. Weekly votes never
accumulate. Freshness boundaries use the recorded broker chart clock and expire
at the boundary. A new uncomputed publication replaces the previous assessment;
missing, disabled, expired and uncomputed weights are not redistributed.

Signed source magnitude totals multiply these weights. Positive supports USD;
negative weakens USD. Exact cancellation follows CPI → NFP → Claims → ISM → Retail
with Weak evidence. A source's declared zero-score tie direction remains eligible.
All unavailable/expired evidence is Uncomputed; no direction is fabricated.

Evidence describes agreement, not probability or price-move size. Missing or
reduced inputs, exact cancellation or net/gross agreement below one third give
Weak evidence. Strong requires strong supporting NFP and CPI, net/gross agreement
at least two thirds, and no active Weak family. Opposing active NFP and Claims cap
combined evidence at Moderate; Weak still takes precedence. Their agreement does
not substitute for inflation confirmation or create an extra independent domain.

## One engine, two views

Raycaster looks up the context at the hovered candle's exclusive end. CPI v4
looks up that same engine immediately before and at the selected CPI publication.
It presents the unchanged standalone CPI interpretation alongside the combined
context and shows how the new CPI contribution replaces the preceding CPI vote.
Simultaneous updates/status changes are disclosed rather than attributed to CPI.
A coarse Raycaster candle may include later releases; equal timestamps use equal
snapshots, but a publication snapshot need not equal an entire H1 candle's end.

`storage/context-family-settings.ts` owns the shared five-family selection.
Enabled/Off controls in Raycaster and CPI v4 update the same preference;
Inspector marker filters and date range remain independent. All five default On.
The existing `fyodor.raycaster.families.v1` key is retained with a version-2 object.
Legacy full four-family defaults gain Claims; partial/all-off selections survive.
New deliberate Claims-Off selections remain Off on reload and workspace restore.
Magnitude settings remain shared with the existing USD standalone scorers/Scatter.

## Chronology and runtime

`core/score-publication.ts` adapts canonical scorers; `build-context-timeline.ts`
builds atomic publication/expiry snapshots; `combine-context.ts` resolves five
slots; `context-lookup.ts` performs binary lookup; `publication-comparison.ts`
compares CPI snapshots. `ui/ContextInputTable.tsx` provides the shared breakdown.
Inspector imports the engine directly, never Raycaster UI/runtime.

The runtime queries broker history from January 2015 for required series,
independent of visible marker filters. Only observations published by the
corrected current clock enter. Each assessment and calibration use its own
publication-time history. Later data removal must preserve earlier snapshots.
Unknown/inconsistent chart timing is excluded; canonical source gates remain.
Stored values can contain provider revisions/backfills: this is reconstructed
history, not certified original-release vintage replay.

Scoped history, applied settings, selected families and admitted publications
invalidate background calculations. Pointer movement does not. Latest-job workers
reject stale replies and terminate on disable/unmount. CPI v4 also calculates its
standalone assessment in a module worker; disabling CPI/all context does not hide
that assessment. A headless environment uses the canonical pure fallback.

The engine supports EURUSD, GBPUSD, AUDUSD, NZDUSD, USDJPY, USDCHF and USDCAD with
supported broker suffixes. USD quote converts weakness to Long; USD base converts
weakness to Short. CPI v4 Inspector remains EURUSD-only. No EUR-relative assessment,
Fed-text interpretation or conditional policy-regime weighting is implemented here.

## Verification

`tests/usd-context/test_context.mjs`, `test_raycaster.mjs`, and
`tests/inspector/cpi/test_cpi_score_v4.mjs` / `test_cpi_v4_integration.mjs` verify
weights, labor disagreement, one-slot Claims replacement, expiry, shared filters,
publication parity, future removal, standalone invariance, worker reuse/stale
replies, clock-heartbeat stability and workspace portability.

After building, run the stored chronological audit:

```powershell
pnpm build
node scripts/audit-usd-context.mjs ../storage/data/cpi-v2-design-snapshot.json ../storage/data/nfp-v2-design-snapshot.json ../storage/data/ism-v2-design-snapshot.json ../storage/data/retail-v1-design-snapshot.json ../storage/data/claims-v1-design-snapshot.json ../storage/data/usd-context-v3-design-audit
```

The audit compares all five source scorers with prior stored reports, checks ten
future-removal cutoffs including August/September 2025 CPI, compares CPI v4 before/
after snapshots, and tests both actual production workers against pure functions.
Archived v1/v2 weights and audits remain in the root scoring library. Visual
checks and price-reaction diagnostics belong to the user.

Stored v3 audit: 140 CPI, 141 NFP, 284 ISM, 144 Retail and 606 Claims publications
retain canonical totals/directions/evidence/change size. The engine creates 1,244
snapshots; all ten future-removal checks and both actual production-worker parity
checks pass. One context worker run took about 9.3 seconds while the event loop
remained active. Startup/filter changes rebuild; hover does not. Full frontend
suite, lint and production build passed on 6 October 2026.

August 12, 2025 remains EURUSD Short / Weak combined versus Short / Strong
standalone CPI; disagreement with the reported rally is retained for investigation.
This implementation does not force historical price-fitting labels.
