# USD context memory v8

The shared engine consumes CPI v4.1’s standalone engine v3.2, NFP v2.2, Claims v2,
monthly ISM v3, Retail Sales v1, PCE v1, PPI v1 and GDP v1 scores. It interprets the USD side of supported
pairs. Forecasts, price outcomes and the other currency do not vote.

V8 retains missing component weights once, separates usable coverage from age,
and qualifies an available-evidence direction through aggregate coverage rather
than an individual CPI/NFP veto. Relationship derivation v3 compares preceding
features under the latest available calibration; calibration drift and renewal
cannot generate a fresh-news vote. No price enters scoring. V7/v6.2 and their
reports are historical records, not the current acceptance test. Current and
archived rules are recorded in `docs/scoring system library.MD`.
Versioned shared jobs are invalidated; hover/pan remain cached binary lookups.

## Declared policy

| Input | Base weight | Freshness | Update behavior |
| --- | ---: | --- | --- |
| CPI v4.1 (standalone engine v3.2) | 28% | 45 days | Latest inflation report replaces the previous CPI slot |
| NFP v2.2 | 30% | 45 days | Latest jobs report replaces the previous NFP slot |
| Claims v2 | 10% | 14 days | Latest weekly report replaces the previous Claims slot |
| ISM v3 | 10% | 45 days | Manufacturing then Services update one monthly ISM slot at their original times |
| Retail Sales v1 | 7% | 45 days | Latest spending report replaces the previous Retail slot |
| PCE v1 | 10% | 45 days | Latest PCE report replaces its slot |
| PPI v1 | 2% | 45 days | Latest producer-price report replaces its slot |
| GDP v1 | 3% | 120 days | New-quarter or revision assessment replaces its slot |

The inflation budget stays 40% (CPI/PCE/PPI); labor stays 40%; activity stays 20% (ISM/Retail/GDP). Turning inputs off never redistributes weight.

These priorities are prototype rules, not fitted coefficients or measured FX
impact. The base labor budget is 40%; the conditional rule below raises it to
60%. Weekly votes never
accumulate. Freshness boundaries use the recorded broker chart clock and expire
at the boundary. A new uncomputed publication replaces the previous assessment;
missing, disabled, expired and uncomputed weights are not redistributed.

Signed source magnitude totals multiply assigned weight and age retention.
Missing component weights are already retained inside each source total; usable
coverage is measured separately and never multiplied a second time. Positive supports USD; negative weakens USD. Raw
priority tie direction is retained for internal audit math, never exposed as a
combined Long/Short when quality safeguards withhold a conclusion. A usable
zero stays active, with zero contribution; missing data remains unavailable.

Every canonical result carries a decision:

- **Insufficient context:** usable components are below 60% of the configured
  enabled budget. There is no separate primary-family veto.
- **Mixed evidence:** usable unchanged/cancelling evidence, or absolute net / gross
  contributions below one third. No family priority converts this to Long/Short.
- **Directional:** completeness and agreement pass; existing evidence grades
  describe agreement, not probability. Incomplete usable coverage caps strength at
  Weak and names the missing/incomplete/expired families.
  Strong requires strong supporting NFP and CPI, net/gross at least two thirds
  and no active Weak family. Opposing NFP and Claims cap strength at Moderate.

Usable coverage excludes age; retention separately reduces votes. Off weights
remain off, so explicitly selecting a subset changes the configured coverage
denominator without redistributing its budget. These are declared experimental
safeguards, not calibrated market-probability thresholds. Use `contextResultLabel`
for public combined outputs; `contextPairLabel` remains for standalone sources.

## Conditional labor–inflation interaction

`core/interaction/` holds the separate rule and canonical source traits. Every
condition must pass on active, enabled, publication-time inputs:

- NFP is complete, Strong, USD-weakening, with hiring below its recent mean and
  unemployment rising. A weak/moderate NFP, missing traits or a recovery fails.
- CPI is complete and USD-supportive. Cooling CPI keeps the base policy.
- Latest core m/m and its latest three-month average are each at most **0.30%**.
- Annual core CPI is at most **3.50%**.
- Positive acceleration is at most **Medium (2 points)** for both the monthly
  core group and annual core. Monthly fresh/trend use their largest positive
  magnitude as one guard; their points are never added as extra confirmations.

When every condition is met, **Labor priority** shifts CPI 28→8 and NFP 30→50.
Other weights remain fixed. An active Strong USD-supportive PCE/PPI assessment
with a source total of at least 2 blocks this transfer. Otherwise **Balanced priorities** retain the
base weights. There is no additional synthetic vote, unavailable-weight
redistribution, date-specific branch, survey input or price-based override.
The rule can enter/exit on any eligible publication or source expiry. Disabling
CPI/NFP prevents it; current uncomputed data cannot retain a stale active rule.

These ceilings and weights are declared prototype safeguards, not official Fed
thresholds, estimated reaction coefficients or evidence that inflation is at
its target. The rule interprets competing data as easing pressure; it does not
claim to read Fed intentions. Strong combined evidence still requires supporting
CPI and NFP; the opposing-source Labor-priority rule can give at most Moderate.
A narrow weighted lead remains Weak. Applied magnitude settings affect the
acceleration guard, while raw level ceilings remain fixed and visible.

Overlap review: CPI's two monthly features already divide a fixed 70% source
budget (35/35), and share one evidence group. Preserve the standalone 35/35/20/10 formula rather
than silently change its meaning. The interaction assesses one monthly core
block and lowers CPI's *context* budget only in the qualified competing regime.
`ui/ContextPolicyDetails.tsx` shows every condition and its result in both views.

## Current age, coverage and weekly confirmation

`core/memory/` owns retention and Claims confirmation. Magnitude preferences are preserved. Each vote is:

`source total × assigned weight / 100 × 2^(-ageDays / halfLifeDays)`.

Age counts elapsed broker calendar date boundaries, not cursor movements or the
machine's current date. Half-lives follow release cadence: Claims 7 days, monthly
families 30, GDP 90. Existing hard expiries remain 14/45/120 days. These are
prototype defaults, not fitted market-impact estimates. `build-context-timeline`
precomputes broker midnight updates in the worker; hover remains binary lookup.
Empty/all-expired stretches do not create redundant daily points. Day-boundary
changes explicitly say Memory update, rather than implying a new release.

Coverage is the sum of usable component nominal weights divided by the sum of
all component nominal weights. NFP uses base weights so its intentional
participation qualifier is not penalized twice as missing data. ISM's integer
sector/component weights normalize to the same 0–1 fraction. Zeros remain usable;
invalid or zero coverage cannot vote. Legacy in-memory assessments without
coverage use 1; canonical source adapters always supply it.

Standalone totals retain missing component weights once. For example, a +3
annual-only CPI component with 20% standalone weight and 28% family weight
contributes +.168 before aging, not +.0336. Coverage measures completeness;
Weak/Moderate/Strong are not numeric probability multipliers. The archived v6/v7
coverage multiplication is retired.

Claims can qualify **Weekly labor priority** when three consecutive complete observed
reports agree, are 4–10 days apart, have at least 80% component coverage each,
and the latest is Moderate/Strong. They must oppose an active NFP
at least 14 broker calendar days old that is Weak or incomplete and has a
nonzero opposing vote. A standalone zero-total tie priority cannot trigger it. NFP shifts
30→20%, Claims 10→20%. Only the latest weekly report votes: the streak supplies
a condition, not an additional sum or independent confirmation. A broken,
unavailable, ambiguous or widely spaced report breaks confirmation. Fresh or
complete Moderate/Strong NFP blocks this rule. It is symmetric for USD strength
and weakness, and does not stack with the earlier labor–inflation transfer.

The shared table shows age, half-life, retained percentage, component coverage,
assigned/effective weight, current Claims confirmation and each final vote.
Enabled/active budgets are shown before retention; retained weight is separate.
Unused weight is never reallocated. CPI publication comparisons include the
age reset and changed component availability in source replacement and separate priority effects.

## One engine, two views

Raycaster looks up the context at the hovered candle's exclusive end. CPI v4
looks up that same engine immediately before and at the selected CPI publication.
It presents the unchanged standalone CPI interpretation alongside the combined
context and shows how the new CPI contribution replaces the preceding CPI vote.
Simultaneous updates/status changes are disclosed rather than attributed to CPI.
A coarse Raycaster candle may include later releases; equal timestamps use equal
snapshots, but a publication snapshot need not equal an entire H1 candle's end.

`storage/context-family-settings.ts` owns the shared eight-family selection.
Enabled/Off controls in Raycaster and CPI v4 update the same preference;
Inspector marker filters and date range remain independent. All eight default On.
The existing `fyodor.raycaster.families.v1` key is retained with a version-3 object.
Legacy full four-family arrays and version-2 full five-family defaults gain the expanded inputs; partial/all-off selections survive.
New deliberate Claims-Off selections remain Off on reload and workspace restore.
Magnitude settings remain shared with the existing USD standalone scorers/Scatter.

## Chronology and runtime

`core/score-publication.ts` adapts canonical scorers; `build-context-timeline.ts`
builds atomic publication/expiry snapshots; `combine-context.ts` resolves eight
slots; `context-lookup.ts` performs binary lookup; `publication-comparison.ts`
compares CPI snapshots, separating source replacement from a change of context
priorities. `ui/ContextInputTable.tsx` shows effective weights plus changed base
weights. The collapsed Raycaster identifies an active Labor-priority rule.
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
Fed-text interpretation is implemented here. Data-conditional priorities are a
prototype; guidance-aware Fed regimes remain future work.

## Verification

`tests/usd-context/test_memory_v6.mjs`, `test_context.mjs`, `test_labor_inflation_policy.mjs`, `test_raycaster.mjs`, and
`tests/inspector/cpi/test_cpi_score_v4.mjs` / `test_cpi_v4_integration.mjs` verify
weights, labor disagreement, one-slot Claims replacement, expiry, shared filters,
publication parity, future removal, standalone invariance, worker reuse/stale
replies, clock-heartbeat stability and workspace portability.

For the current source implementation, run the chronological window audit:

```powershell
node scripts/usd-context/audit-window.mjs ../storage/data/usd-menu-v5-design-snapshot.json 2025-12-16 2026-01-28 ../storage/data/usd-context-revision-integrity-audit
```

The [payroll prior-field integrity correction](../../../reports/NFP-prior-field-integrity-audit.md)
changes NFP source features and their calibration. The earlier v6 design audit
below predates that correction; its unchanged-source assertion is deliberately
strict and is not a current validation command after a source formula changes.
Reproduce it from the implementation before the correction:

```powershell
pnpm build
node scripts/usd-context/audit-memory-v6.mjs ../storage/data/usd-menu-v5-design-snapshot.json ../storage/data/usd-context-v5-baseline.json ../storage/data/usd-context-v6-design-audit
```

That archived audit compares against the captured v5 baseline at all publications,
checks unchanged standalone sources, future-removal publication/daily replays,
cadence sensitivity and compiled context worker parity. Baseline capture uses
`scripts/usd-context/capture-baseline.mjs` before a policy change; its ignored JSON
records its exact version, source and revision. The same-revision v5 baseline
must be preserved to reproduce this comparison. No price returns select defaults.
The expanded GDP/PPI runner remains available for source/Scatter checks; reports
must retain their actual current engine version rather than claiming a v5 replay.
Archived v1–v4 weights and audit results remain in the `docs/scoring system library.MD`.
The older `audit-usd-context.mjs` is retained as the previous five-family audit
runner; its v3 invariance expectations are not a current validation command.
Visual checks and price-reaction diagnostics belong to the user.

Archived v3: 1,244 snapshots and ten replay checks, with August 12, 2025 Short /
Weak combined. Archived v4 audit results are documented in the root scoring
library and local `storage/data/usd-context-v4-design-audit.*`. Source revisions
and guard sensitivity remain disclosed; agreement with two price notes does not
validate a trading predictor. Visual verification belongs to the user.

V4 stored replay: all five source baselines retain parity. Labor priority is active
at 35 of 1,315 publication snapshots; 24 change direction versus v3 (6 before 2025).
All inactive-rule scores/biases remain unchanged. Thirteen full future-removal
checks and both production workers pass. The two 2025 user cases now produce
Long / Weak. Tightening monthly guards to 0.25% returns them to Short; this is a
material sensitivity, not hidden validation. Full frontend tests, lint and build
passed; applied magnitudes and counterexample regressions also pass.

## Expanded menu and policy coverage

`ui/PublicationContext.tsx` reuses the same engine beneath the registered PCE,
PPI, GDP, Retail, Claims and Fed Inspector views. Its cutoff is the selected
publication, not current market context. `now` comes from Inspector; missing
clock props cannot accidentally expose future publications.

GDP has separate calibration populations for first stored estimates of a quarter
and same-quarter revisions. A revision updates the growth slot as a revision
assessment, not as another independent macro vote. The feed does not certify
original publication vintages or the completeness of its estimate sequence.

FOMC v1 interprets the stored rate action only. A hike/cut gives Weak standalone
action evidence; a hold has no action direction. Speeches, statements, projections
and conference answers have no text in the calendar contract. The Inspector
shows this limitation and the existing publication-time economic context. Policy
tone has no context weight until timestamped content and a declared interpretation
policy exist. This is partial policy coverage, not a completed guidance scorer.

Archived v5 audit: `scripts/audit-usd-menu-v5.mjs`; local report
`storage/data/usd-menu-v5-design-audit.md`. Earlier context-v4 audit totals below
are archived results under the former five-family weights, not v5 outputs.

V5 validation: 137 GDP and 140 PPI publications passed source/Scatter and
later-data-removal checks; 1,489 timeline snapshots and 12 publication replays
were checked. Built context and expanded-release workers matched pure results
and left the main event loop active. Full frontend tests, lint and build passed.

## Claims v2 and Fed decision context

### USD relationship Roofs v4

`sequences/core/relationship-registry.ts` declares all 28 macro pairs plus eight
Fed/macro pairs. Pair annotations reuse canonical results and source age; they
never add votes. `relationship-support.ts` exposes both weighted sides, their
net/separation, lead and availability. Arbitrary larger groups are resolved on
demand in the Inspector catalogue rather than enumerated into the chart.

Release mode uses base family weights (and retention). Fresh mode uses matching
components and coverage under common current calibration, within seven days.
`ism-fresh.ts` compares each sector to its own preceding month, carries 30/70
sector changes within one ISM budget and keeps incoming replacement effects
separate from earlier retained changes. Unknown predecessors supply no vote.

Fed-only stages reuse the prior accumulated result in relationship derivation;
they do not modify `ContextTimeline.points` or renew macro sources. Fed action
is unweighted and hold is neutral. Ambiguous meetings displace earlier action
without claiming a usable numerical action. Raycaster/Candy conflict-label
changes are deferred; canonical versions/gates stay at USD v8 / relative v3.

Focused display prioritizes specialized annotations over generic pairs, keeping
every omitted Roof available in More and every pair inspectable in the catalogue.
World-space layout is cached per zoom/density; panning projects the existing plan.

Claims v2 replaces the Claims source slot without changing base family budgets or memory half-lives. Its two underlying trends use nonoverlapping four-week windows; latest-week weight is smaller. The three-release weekly confirmation additionally requires both underlying trends to agree with each report direction. Confirmation is also explained when Claims and NFP agree, without an extra vote.

Fed v2 reuses `runtime/usePublicationContext.ts` to display exactly this engine at the decision publication, including holds. A separately fetched earlier numeric decision anchors the previous-meeting comparison. Both meetings use the same enabled families/settings; no future speech, conference, minutes or macro reading is moved into an earlier result. Fed meetings add no timeline vote and do not refresh source memory. Speeches remain outside scoring. See the `docs/scoring system library.MD` for rules and limitations.
