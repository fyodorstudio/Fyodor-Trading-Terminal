# Fyodor Trading Terminal — main objective

Last clarified: **11 October 2026**. Start with [the repository map](docs/REPOSITORY-MAP.md)
and [AGENTS.md](AGENTS.md). The previous full handoff is preserved in the
[historical objective](reports/Main-objective-history-through-2026-10-11.md).
Dated reports record the formulas and tests used at that time; they do not
supersede the current design below.

## Goal

Interpret numerical economic news from the connected MT5 dataset into currency
strength/weakness evidence, so the user does not need to read and weigh the
numbers. Current scope is **USD and EUR**. Price prediction and fitting individual
exchange-rate moves are outside this objective.

Lead with the direction and strength supported by the evidence. Conflict does
not mean equal weights or justify hiding a valid nonzero lead. Missing inputs
must not become measured zeros, fabricated values or extra votes.

With incomplete data, expose a nonzero known subtotal as **Available evidence
favors strength/weakness**, visibly qualified **Incomplete** with the missing
input named. This presentation does not change the engine's missing-evidence
interval or promote an uncertain subtotal to a complete direction. With no usable
inputs, say **Evidence unavailable**; a partial zero subtotal has no directional
lead. Exact complete cancellation remains balanced.

## Active implementation and ownership

[Currency evidence R1](frontend/src/scoring-system/r1/README.md) owns profiles,
features, chronology, arithmetic, relationships and workers. Its canonical
[source-backed design](docs/scoring%20system%20overhaul.md#currency-evidence-summary-and-eur-r1)
includes the latest [Fed policy model](docs/scoring%20system%20overhaul.md#fed-policy-context-and-jobs--11-october-2026).

- **Inspector:** standalone summary first, combined relationships below, other
  currency evidence at the same clock. One selected detail table. Inspector
  filters control visibility only; currency settings independently select the
  relationship inputs. The combined summary exposes each family's change and
  any relationship adjustment, adding up to the batch total. Assessment/detail
  choices do not rescore history.
- **Raycaster R1:** EUR/USD combined evidence at the cursor candle's end; bottom
  fill on the same fixed 0–100 magnitude scale. Green means strength, red means
  weakness; the prominent signed score and previous-level marker distinguish
  current magnitude from change.
  Keep summary positions stable, points together and horizontal content within
  the panel. Compact dated rows distinguish standalone release points from
  overall changes, group simultaneous publications and retain the last update on
  quiet candles. Missing inputs are named without primary tank hatching. Hover only looks up
  the prepared timeline.
- **Scatter Plot:** raw A−P and scorer comparisons remain distinct. R1 native
  signal previews, Apply and Reset share calibration with Inspector/settings.
  Viewport changes never alter calibration or rescore history.
- **Fundamental Settings:** the audit surface for implemented weights, arithmetic,
  magnitude provenance and freshness. Its descriptions must match the engine.
- **Retired Raycaster, Roofs and Candy:** retain their separate legacy models and
  settings. Do not mix legacy votes into R1 or remove retained views implicitly.

The accepted current pass removes unused worker entries, fixes the EUR PMI
sector fallback, clarifies incomplete summaries and compacts Raycaster with
signed tanks. The user confirmed MT5's October PMI Actual fields are blank.
No replacement feed or dataset rewrite is authorized by this refinement.

## Calculation contract

Standalone R1 points are bounded at **−100/+100**: component weight × signed
magnitude / 4. Magnitude is capped at four. Component importance and historical
rarity remain separate. Preserve saved compatible bands and native units;
Continuing Claims converts millions to thousands.

USD CPI V5 retains 50/20/15/15 core-monthly/core-annual/headline-monthly/headline-annual.
Jobs R1.1, Claims R1.1, Manufacturing R1.2 and EUR use fractional magnitude through
zero, Small=1, Medium=2, Large=4. Other ordinary USD profiles retain categorical
bands. Automatic fallback uses earlier-history 50/80/95 percentiles, at least
60 usable comparisons; quarterly profiles use 24 and separate revisions.
Manual native overrides remain authoritative. Do not calibrate to the viewport
or ask the user to manually tune every release.

USD relationships preserve consumer-anchor/PPI period alignment and manufacturing
role routing. Origin shares are 30/30/20/20; with Fed selected, 25% of macro
allowances goes into inferred policy context. Fed R1.3 holds compare current
actual-data pressure with the previous decision, divided by two. Factual hold
action is zero; overall retains current pressure without inventing a hold jump.
Standalone Fed interpretation uses the full USD basket independently of the
selected relationship subset.

EUR national reports remain standalone context, without duplicate area votes.
A **current usable composite** owns PMI's allowance for the newest reference
month. Otherwise selected same-month services/manufacturing use the existing
70/30 proxy. Missing selected sectors retain uncertainty; do not borrow an older
month or silently include excluded sectors. A measured unchanged composite is
usable and still replaces its sectors. The proxy is not S&P's official composite.

## Data, chronology and review

- MT5 is the numerical scoring source. Official publications can verify values
  and definitions without becoming additional votes or a new live feed.
- Forecasts, speeches, written guidance and projections remain excluded.
- Interpret each family's documented actual-versus-past comparison, including
  revised priors, distinct months and trend windows. Do not silently reduce
  every feature to literal supplied Actual minus Previous.
- Retain publication time, reference period, native unit and revision/capture
  provenance. Late captures are not proof of original-time availability.
- New reports replace slots. Only schedules known at the selected clock determine
  scheduled expiry; otherwise use configured bounded publication age. Corrections
  do not restart freshness. Rules, ages and dates remain auditable.
- Economic sources support roles, not uniquely optimal coefficients. Change
  weights/calibration only for a documented weakness with replay and sensitivity
  checks; one price disagreement is not sufficient evidence.

## Verification and navigation

Follow [AGENTS.md](AGENTS.md) for responsiveness and repository hygiene. Keep
heavy work in background jobs; stable identities, corrections and paging must
propagate correctly. Performance changes need deterministic work-count checks
and assembled-terminal verification. Run frontend suites sequentially, plus
lint/build for implementation changes.

Leave browser/visual audits to the user unless explicitly requested. Report
unverified layout/performance honestly. No unsolicited commits, deployment,
feed rewrites or external integrations.

Recent evidence: [PMI fallback and Raycaster tanks](reports/R1-PMI-tanks-audit.md),
[Fed arithmetic and holds](reports/R1-policy-context-audit.md),
[April reversal/data review](reports/R1-April-30-reversal-review.md),
[standalone standardization/PMI](reports/R1-standardized-points-PMI-audit.md),
[Raycaster chronology](reports/R1-Raycaster-audit.md), and
[scope/GDP/loading](reports/R1-scope-GDP-loading-audit.md).
