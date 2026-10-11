# Currency evidence R1

The canonical design and source rationale are in
[scoring system overhaul](../../../../docs/scoring%20system%20overhaul.md#currency-evidence-summary-and-eur-r1).
This module owns R1 profiles, arithmetic, interpretation, relationships,
calibration and worker entry points. Legacy scorers retain their own settings.
`policy-arithmetic-audit.ts` projects the same routing/input metadata into
Fundamental Settings; it does not fetch history or calculate live evidence.

Inspector visibility filters do not select scoring inputs. Each currency uses its
own model settings. Standalone appears first, followed by the selected currency's
relationships and the other currency's evidence directly; the pair balance is
retained in the engine for existing consumers, not shown in this Inspector view.
Versioned history is loaded for a stable quarter horizon and reused only after
source revision/coverage validation. All evidence still respects the selected
publication clock. History/features are reused by immutable source identity.
USD GDP q/q R1.1 uses a 24-comparison quarterly calibration minimum, separately
for momentum and revisions; manual bands retain priority. See the
[scope/GDP/loading audit](../../../../reports/R1-scope-GDP-loading-audit.md).

- `analysis.ts`: selected USD/EUR publication plus overall before/after snapshots
  at its publication clock. `pair.ts` evaluates both currencies at that same clock
  and propagates uncertainty through `(EUR − USD) / 2`. Quarterly standalone
  revisions and retained momentum are separate comparisons, never extra votes.
- `changes.ts`: shared family contribution differences and display-cent totals
  for Inspector and Raycaster. Simultaneous reports share one atomic update;
  retained-family realignment remains a separate relationship adjustment.
- `history.ts`: historical standalone assessments for Scatter, using the same
  feature extractor and assessor as Inspector. Pan, hover and selection do not
  invoke this calculation.
- `features.ts`: explicit provider IDs, native units, reference periods and
  revised-prior comparisons. Continuing claims convert millions to thousands.
  Manufacturing R1.2 scores MT5 New Orders/PMI/Employment/Prices Paid at
  45/30/15/10, with deliberate headline/component overlap and no separate
  Production requirement. A newer partial report replaces the preceding slot;
  missing readings retain their assigned uncertainty.
- `vintages.ts`: preserve the earliest recoverable release snapshot; later
  corrections replace current evidence only from their capture time. Late first
  captures are retrospective, never proof of original-time availability.
  Automatic historical calibration uses those release snapshots, keeping old
  outputs stable when a later correction arrives.
- `assessment.ts`: raw contribution is weight × signed magnitude. Leaves and
  balances and all R1 standalone displays use raw / 4, bounded at ±100.
  Category and overall balances preserve signed leaves and uncertainty budgets.
  Resolve the signed sum before rounding and reconcile displayed sides to its
  net. Intermediate relationship allocations do not round individual leaf values;
  routing cannot manufacture a lead from exact cancellation.
  Jobs R1.1, Claims and all Manufacturing R1.2 inputs interpolate through zero, Small=1, Medium=2 and Large=4,
  capped at four. Size labels remain independent of fractional points; other
  USD families retain integer bands. EUR profiles use fractional magnitude. Assessor, sensitivity and Scatter preview share
  `arithmetic.ts`. See the [Claims review](../../../../reports/Claims-R1-fractional-audit.md)
  and [manufacturing review](../../../../reports/Manufacturing-R1-four-input-audit.md).
  Manufacturing explanations separate expansion/contraction at 50 from A−P
  evidence direction. Level and threshold crossings supply no additional vote.
- `relationships.ts`: allocate the existing manufacturing allowance before routing
  its activity, hiring and input-price leaves to their economic roles. No second
  full-family vote or role-specific renormalization. Full-scope manufacturing
  originates at 2% overall. Origin category shares are 30/30/20/20; with Fed
  selected, 25% of each macro budget moves into inferred context. Final category
  shares are Inflation 22.65%, Labor 22.725%, Activity 14.625%, Policy 40%.
  Categories normalize within their actual
  allowances, exposed in Inspector. Missing/stale inputs keep those budgets;
  sensitivity variants retain routing. Consumer/PPI rules remain unchanged.
- `policy-context.ts`: actual-data policy levels/trends, bounded pressure and
  hold interpretation `(current pressure − previous decision pressure) / 2`.
  Retained overall uses current pressure; an unchanged rate creates no automatic
  extra jump. Missing previous context is unknown, not zero. Fixed level scales
  are labelled separately from native calibration; Inspector's Input audit shows
  both decision baskets. Fed standalone always uses full USD scope. See the
  [canonical policy](../../../../docs/scoring%20system%20overhaul.md#fed-policy-context-and-jobs--11-october-2026)
  and [stored replay](../../../../reports/R1-policy-context-audit.md).
- `eur-profiles.ts` / `eur-relationships.ts`: EUR roles, native IDs, distinct-month
  comparisons, quarterly cadence and one composite/sector PMI activity allowance.
  A current usable composite replaces sectors for the newest reference month;
  otherwise selected same-month sectors use the existing 70/30 proxy. Missing
  selected sectors keep their allowances; older months are not substitutes.
  National reports remain standalone context; flash/final estimates replace slots.
  PMI explanations distinguish level at 50 from improvement/softening. Missing
  MT5 Actual retains its unavailable vote and an explicit reason. Same-month flash
  metadata does not invalidate the independently dated prior-month comparison.
- `presentation.ts`: shared currency direction labels. Inspector keeps its summary
  visible above one selected detail table; table/PMI assessment selection never
  rescores history. A nonzero incomplete subtotal is labelled **Available evidence
  favors strength/weakness**, with missing inputs named. Engine directions and
  intervals are preserved; no usable inputs remain **Evidence unavailable**.
- `settings.ts`: separate portable USD/EUR overrides and relationship scope. Saved
  compatible USD raw A−P bands are inherited without mutation. EUR retains separate
  overrides/calibration because its distinct-period baseline can differ from feed
  Previous. Otherwise R1 uses
  earlier-history 50/80/95% quantiles with 60 usable earlier observations; ties
  coalesce. This automatic fallback is a versioned design policy, not fitted USD
  price-impact coefficients. EUR quarterly profiles require 24 earlier usable
  comparisons; estimate updates do not multiply momentum samples. Quarter revisions
  do not inherit momentum bands.
  R1 Scatter provides chart-only previews, Apply and Reset to inherited calibration;
  Apply shares the same overrides with Fundamental Settings and Inspector. Preview
  edits reclassify the displayed component without launching a history worker.
  Retired manufacturing Production overrides remain portable but inert; old
  Scatter Production selections resolve to Orders.
- `useR1Analysis.ts`: scoped storage, stable inputs and the existing latest-job
  worker client. Storage supplies scheduled dates observed before the chosen
  clock; unknown schedules never become guessed dates.
- `freshness.ts`: known next release plus the saved allowance, otherwise bounded
  publication age (USD: Claims 10 days, monthly/GDP estimates 45, Fed 70;
  EUR: monthly 45, quarterly 120, ECB 70).
  Corrections do not restart age; new publications replace the slot. Settings
  expose all limits; the audit shows the rule and expiry in the display timezone.
  See the [freshness replay](../../../../reports/USD-R1-freshness-audit.md).

Positive means selected-currency-supportive economic evidence; negative means currency-negative
evidence. No forecast, speech, raw price index or inherited duplicate vote enters
R1. Exact cancellation is balanced; missing evidence crossing zero is insufficient.
These labels describe evidence, not an FX price prediction or probability.

Historical storage often contains later-captured/revised values rather than
original publication vintages. Replay must report this limitation explicitly;
calendar timestamps alone do not establish original-vintage availability.

Current expansion verification is in the [currency evidence audit](../../../../reports/Currency-evidence-R1-expansion-audit.md).
The earlier USD-only verification passed 69 frontend suites and 29 storage tests,
clean lint and production build. Read-only replay covers 1,828 publications, both built R1
workers, Scatter parity and three aggregate clocks. See
[the audit](../../../../reports/USD-R1-stored-history-audit.md).
Browser appearance/performance review remains manual.

Raycaster's **R1 Scoring System** uses `timeline.ts`, `timeline.worker.ts` and
`useR1Timeline.ts`. The shared snapshot reader caches family selection and
assessments within their source-publication/observation epochs; older-period
revisions invalidate current comparisons. Snapshots are built at publication,
observation, schedule and expiry clocks. Hover performs a binary lookup and
projects only the inspected candle's updates. This nominal timeline omits
sensitivity sweeps while preserving Inspector's base direction, strength and
missing-evidence intervals. See the [Raycaster audit](../../../../reports/R1-Raycaster-audit.md).

The compact signed tanks and joined release/overall-change rows are owned by
`raycaster/ui/{R1Reading,R1EvidenceTank}.tsx`. Both tanks fill from the bottom on
the same fixed 0–100 magnitude scale. Green/red liquid, prominent signed scores
and previous-level markers preserve the distinction between strength, weakness
and change. Missing inputs are named; primary tanks have no axes or hatching.
Timeline states carry compact missing-input labels
prepared in the worker; hover only projects a selected point and its updates.
See the [PMI/tanks replay](../../../../reports/R1-PMI-tanks-audit.md).

Standalone scores and combined changes use distinct labels in Inspector and
Raycaster. Timeline publication updates include normalized standalone summaries;
quarterly revisions do not reuse relationship momentum as their release score.
See the [11 October audit](../../../../reports/R1-standardized-points-PMI-audit.md).
