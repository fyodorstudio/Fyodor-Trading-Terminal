# Raycaster audit: 23 December 2025–28 January 2026

Audited 6 October 2026. Source: stored Elev8-Demo2 calendar snapshot, revision
78432. Engine: USD context memory v5. All eight families enabled, automatic
signal magnitudes. This does not capture the user's live saved filters or manual
overrides, and does not independently measure the screenshot's price returns.

This is the archived v5 baseline. The subsequent v6 implementation and updated
replay are documented in [USD-context-memory-v6-audit.md](USD-context-memory-v6-audit.md).

## Finding

The reported Long-until-9-January sequence reproduces. The arithmetic and
publication-time replay pass; the mismatch with the user's observed price path
remains an interpretation-policy finding. Reproducing a result does not validate
its usefulness or establish the cause of a price move.

| Publication | Combined EURUSD bias | Evidence | USD total |
| --- | --- | --- | ---: |
| GDP, 23 Dec 2025 | Long | Weak | −0.44 |
| Claims, 24 Dec 2025 | Long | Weak | −0.50 |
| Claims, 31 Dec 2025 | Long | Weak | −0.44 |
| ISM Manufacturing, 5 Jan 2026 | Long | Weak | −0.3735 |
| ISM Services, 7 Jan 2026 | Long | Weak | −0.2615 |
| Claims, 8 Jan 2026 | Long | Weak | −0.2515 |
| NFP, 9 Jan 2026 | Short | Weak | +0.0905 |
| CPI, 13 Jan 2026 | Short | Weak | +0.2585 |
| PCE, 22 Jan 2026; retained through 28 Jan | Short | Weak | +0.404 |

## Why earlier Long survived newer Short releases

At 8 January, the latest CPI (18 December), NFP (16 December) and PCE
(5 December) still contributed −0.168, −0.285 and −0.050 respectively. Their
combined −0.503 outweighed +0.2635 from Claims, ISM, Retail and GDP. PPI added
−0.012. The net was −0.2515, hence Long. Those are weighted source scores, not
percent probabilities or measured FX impacts.

There is no age decay: a source keeps its full assigned weight until replaced or
expired. Most families expire after 45 days. Claims replaces one weekly slot,
so consecutive positive weeks do not accumulate separate votes. This avoids
overcounting repeated, overlapping readings but also supplies no separate
interpretation of sustained weekly confirmation.

On 9 January, NFP's old −0.285 contribution became +0.045. That +0.330 swing
changed the context from −0.2395 immediately before NFP to +0.0905 afterward.
The direction change came largely from replacing an old USD-weakening vote;
the new NFP standalone score was only +0.15 with Weak evidence.

On 13 January the new CPI interpretation was Uncomputed. It replaced the prior
negative CPI contribution with no usable vote; the Short total increased by
0.168 even though CPI supplied no positive vote. This is a coverage change,
not a new inflation confirmation. Missing CPI kept combined evidence Weak.
At 28 January the other seven latest source scores were USD-supportive, with
CPI unavailable. A simple majority-of-current-sources rule would therefore still
say Short there; it cannot explain the user's reported rally by itself.

## ISM date distinction

The grouped chart marker is anchored at Manufacturing's 5 January publication.
The Inspector's final monthly summary includes Services once its 7 January
publication is available, and displays its own “As of” time. Under the audited
default magnitudes, the 5 January publication-time result was Long (−0.66);
the 7 January completed monthly result was Short (+0.46).

Auditing that completed Short against 5 January would include information not
yet published. Use the summary's As-of timestamp or the v2 publication snapshots
for chronological comparisons. A manual magnitude override could also change
the default result; this replay cannot certify the user's exact configuration.

## Confirmed explanation defect and correction

The former update sentence could say “GDP reinforces USD weakness” despite
GDP itself supporting USD strength. On 23 December, the previous GDP source
score +3.3 was replaced by +1.9. Its smaller positive vote enlarged the opposing
combined lead. The sentence conflated the direction of the release with the net
effect of replacing its prior vote.

Update explanations now state each incoming source's direction separately,
followed by the resulting combined direction and change in its weighted lead.
Simultaneous publications disclose each source instead of describing only the
last source. Unavailable and zero-net updates are explicit. No source score,
weight, expiry, interaction rule or final bias changed in this correction.

## Next research, before changing policy

1. Test whether age and missing-component coverage should reduce retained votes.
   Evidence grades mix agreement and coverage; multiplying by Weak/Moderate/Strong
   alone would discard potentially useful conflicting data without resolving that.
2. Consider a labor-domain rule for persistent Claims confirmation against an
   aging NFP assessment. Keep a bounded labor budget and avoid counting the same
   overlapping weekly information repeatedly.
3. Separate retained background context from the directional effect of new
   publications and availability changes. Make their explanations visible.
4. Compare predeclared candidate rules across older, unseen periods and the
   existing CPI interaction audits. Do not force these two windows to match
   candles by choosing weights, dates or thresholds after observing the outcome.
5. Add EUR and policy content through the deferred roadmap. The post-9-January
   rally remains unexplained by this USD-only numerical model; this replay does
   not establish that missing EUR/policy information caused it.

## Reproduction

```powershell
node frontend/scripts/usd-context/audit-window.mjs storage/data/usd-menu-v5-design-snapshot.json 2025-12-23 2026-01-28 storage/data/usd-context-dec-jan-audit
```

The snapshot and detailed contribution report stay in ignored personal storage.
Six representative publication cutoffs passed removal of all later publications;
the audit excluded no uncertain-time publication in the selected inventory.
Stored provider revisions may still contain corrections unavailable in real time;
this check does not reconstruct original publication vintages. Visual checks
remain with the user.

Verification: the full-window replay was rerun after the wording correction;
all source scores, effective weights, statuses, final directions and evidence
grades were identical to the pre-change replay. Context model regressions,
mounted Raycaster tests and CPI v4 integration tests passed. Lint and the
TypeScript/Vite production build passed. Visual review remains with the user.
