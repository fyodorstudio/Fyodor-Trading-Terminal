# Fyodor Trading Terminal — main objective

Last clarified with the user: **10 October 2026**. This is the active project
contract and handoff for a new Codex session. Completed plans and their historical
findings are in [the archived objective](reports/Main-objective-history-through-2026-10-08.md).

## Active implementation: publication summary and EUR evidence R1

The accepted [plan](temporary%20plan.md) extends USD R1 with a prominent standalone
summary first, combined relationships and their before/after summary below,
one selected detail table, hold-action presentation, EUR
standalone/relationships and a same-clock EURUSD evidence comparison. Forecasts,
speeches and written-guidance classification remain excluded. USD formulas and
legacy Roofs/Candy and retired Raycaster views retain their separate contracts.

Canonical current policy and primary-source rationale:
[scoring design](docs/scoring%20system%20overhaul.md#currency-evidence-summary-and-eur-r1).
The [expansion audit](reports/Currency-evidence-R1-expansion-audit.md) records
coverage, Inspector/Scatter chronology and built-worker parity. Numerical shares,
boundaries and fallback lifetimes remain explicit design policies. Publication
before/after uses unrounded arithmetic and preserves missing-evidence intervals.
Verified: all 71 frontend suites, 29 storage tests, clean lint and production
build. Read-only replay checks 3,595 EUR assessments, three pair clocks and six
built-worker jobs; March Claims reproduces -17.82 to -17.61, Change +0.22.
The existing bundle-size warning remains. Visual/browser performance review
remains with the user.

Latest user refinement: Inspector family filters control visibility only; scoring
uses independent currency settings. Show EUR/USD evidence directly instead of the
pair summary. USD GDP q/q R1.1 uses 24 earlier same-stage quarterly comparisons;
manual bands remain authoritative. Stable versioned history queries, revision-
checked snapshot reuse and prepared-worker caches reduce repeated loading while
preserving selected-clock chronology. See the
[scope/GDP/loading audit](reports/R1-scope-GDP-loading-audit.md). Prior reports
retain their dated results; correcting GDP availability can change overall scores.

Latest Raycaster refinement: add **R1 Scoring System**, retaining the three older
choices as **(Retired)**. Show EUR/USD combined evidence, signed before/after
changes and dated release updates at the cursor candle cutoff. Group simultaneous
publications, retain the latest update on quiet candles and identify expiry/data
updates separately. Reuse the shared R1 snapshot reader in a background timeline;
hover/pan never rescore. See the [Raycaster audit](reports/R1-Raycaster-audit.md).

## Previous implementation: USD scoring overhaul R1

The user now authorizes autonomous implementation of the complete USD design in
[scoring system overhaul](docs/scoring%20system%20overhaul.md), including separate ISM
families and a new Scatter **Calculation** choice. Baseline: `93a6ecd`; branch:
`codex/usd-scoring-r1`. Computer use and automated visual audits remain excluded.

Implement versioned R1 family assessments, shared Inspector/Scatter arithmetic,
category relationships and overall USD evidence. Preserve CPI V5 and the existing
Extreme x4 cap. Keep available saved magnitude settings; supply separately
versioned historical calibration where R1 needs configured boundaries. Forecasts
and speeches do not vote. Missing data retains its nominal uncertainty; exact
cancellation does not invent a direction. Period selection, revisions and
freshness must respect the chosen as-of clock.

Use the existing shared scoring module and background calculation infrastructure.
The user permits reuse, redesign or removal of older application components;
initially keep older assessments available for comparison with explicit versions.
R1 relationships belong to one engine; Roofs/Raycaster/Candy must never silently
mix old and R1 scores. The implementation audit will record test/replay results
and remaining manual UI checks. Numerical weights remain explicit policies.

R1 is implemented and terminal-verified as of 10 October 2026. All 69 frontend
suites and 29 storage tests, lint and build pass. The
[read-only replay](reports/USD-R1-stored-history-audit.md) covers 1,828 publications
and three aggregate clocks, including built-worker and Scatter parity. Versioned
stored observations preserve release snapshots and apply later corrections only
at capture time. Unrecoverable original vintages retain their explicit treatment.
The later four-input Manufacturing refinement below supersedes the
missing-Production model. Missing schedules now use bounded publication
age; configured rules and expiry dates are visible in the audit. See the
[freshness refinement replay](reports/USD-R1-freshness-audit.md). Visual/browser
performance review remains with the user; older context views remain separate.

Accepted Claims refinement: `USD-CLAIMS-R1.1` retains 70/30 weights and existing
boundaries, but uses fractional magnitude through (0,0), (Small,1), (Medium,2),
(Large,4), capped at four. Band names remain visible alongside fractional points.
Other R1 families and legacy Claims v3 retain their policies. R1 relationships
consume the refined Claims evidence once. Source rationale, changed historical
cases and the 60/40 challenger are in the
[Claims fractional review](reports/Claims-R1-fractional-audit.md).

Accepted manufacturing refinement: `USD-ISM-MANUFACTURING-R1.2` uses MT5's four
readings: **New Orders 45%, PMI 30%, Employment 15%, Prices Paid 10%**, all with
Claims-style fractional magnitude and separate per-series boundaries. Production
is not required or inferred. The user accepts deliberate headline/component
overlap. Higher Prices Paid supplies input-price pressure, not stronger output
or a percent consumer-inflation reading. A−P determines direction; the level at
50 supplies state context only. Missing readings retain their nominal weights.

Allocate the existing manufacturing allowance first, then route its components
once: Orders/PMI to Activity (75%), Employment to Labor (15%), Prices Paid to
Inflation pressure (10%). Manufacturing still owns 1.5% of the full overall
budget. Effective full-scope category shares are 35.15% / 30.225% / 14.625% / 20%
for Inflation / Labor / Activity / Fed. Other families keep their global budgets;
selected-subset normalization precedes routing. Unknown/stale manufacturing
retains the same role budgets. All four inputs expose Scatter preview/Apply/Reset.
Saved Orders/unrelated settings survive; retired Production overrides remain
portable and inert. Legacy models and freshness are unchanged. See the
[four-input review](reports/Manufacturing-R1-four-input-audit.md); the
[Orders-only review](reports/Manufacturing-orders-R1-audit.md) is historical.

R1.2 verification: all **69 frontend suites**, lint and production build pass,
including assembled-terminal and mounted four-input/Scatter regressions. Read-only
replay covers 142 publications (82 fully scorable with automatic prior-history
bands), all-release future-removal parity, both built workers and all four Scatter
inputs. Five complete directions change under nearby weight alternatives; eight
under joint boundary/weight variations. October 1 remains strengthening, moderate,
raw net +57.84. Browser appearance/performance and price comparison remain user
review. The existing bundle-size warning remains.

The former standalone-development handoff below is historical context. Its
preservation-only scope and earlier interpretation rules do not override R1.

## Previous implementation: standalone scoring first

The agreed implementation order is in [temporary plan](temporary%20plan.md):
centralise existing calculations and fundamental settings, implement and validate
Claims standalone, then review other labor models, relationships and finally
Raycaster. Reuse the existing Inspector scoring views for supported USD releases.

Claims standalone has **This release** (weekly change against revised prior)
and **Four-week trend** (separate four-week periods). Each has its own calibrated
USD strength/weakness bias, evidence strength and EURUSD translation. Do not merge
them into another vote. Forecasts remain excluded; revisions and calibration must
respect publication time. Evaluate the proposed 60/40 initial/continuing split
through historical replay and sensitivity checks before accepting defaults.

Calculation definitions, weights, calibration and settings belong in the shared
`frontend/src/scoring-system/` module. The gear opens a dedicated Fundamental
Settings dock tab, including the canonical Scoring System explanation/settings
page. Inspector retains concise results and release-specific supporting numbers.

Raycaster is quarantined as experimental. Preserve its existing calculations and
those of Roofs/Candy, including Claims v2, while the new standalone models are
developed with separate versions/settings. Their redesign and migration are
deferred. Preserve Roofs View Details; no removal has been authorised.

Foundation and Claims standalone v3 are now implemented. The existing Inspector
view has two independently calibrated assessments; its Scoring explanation &
settings link opens the model in Fundamental Settings. Claims previews require
explicit Apply; weights, calibration and view selection are workspace-portable.

The [standalone Claims audit](reports/Claims-standalone-v3-audit.md) replays 607
stored publications per view. October 8, 19:30 Asia/Jakarta gives **weekly USD
weakness / EURUSD Long, weak, −0.2**, versus **four-week USD strength / EURUSD
Short, strong, +2.4**. The 60/40 weights remain a starting policy with documented
sensitivity. Claims v2 remains the context source at +2.25. Review standalone
before extending to NFP, relationships or Raycaster; visual audits remain with
the user.

Verification for this pass: all 67 frontend suites passed, with affected suites
rerun after final UI fixes; lint and production build passed. The existing bundle
size warning remains. Browser visual/performance validation has not been performed.

Historical result descriptions below refer to the models used in their dated
audits. They do not redefine the new standalone development scope.

## What the user wants

The user built this app to reduce the overwhelm of interpreting economic numbers.
The user wants a release, or relevant combination of releases, translated into
one primary directional bias and its strength. Reading numbers, weighing every
combination, studying macroeconomics, or choosing calibration settings must not
be prerequisites for understanding the primary output.

The agreed contract is:

> Resolve the evidence into a primary directional bias, however slight, while
> communicating how strongly it is supported. The work is to justify that
> weighting and resolution—not to hand the conflicting inputs back to the user.

Whenever usable evidence produces a nonzero weighted balance, report its leading
direction. Naming a slight bias does not assert certainty. Opposing inputs can
have unequal economic importance; disagreement does not imply equal support.
Historical rarity establishes magnitude; economic importance establishes weight.
The app must use both to resolve the evidence automatically.

## Direction and strength

- Give the weighted Long/Short lead when the supported balance is nonzero at the
  declared numerical precision. A narrow lead remains a direction, with Weak
  strength where appropriate.
- Conflict belongs in the strength and optional explanation. A standalone
  “Mixed” answer is incomplete when valid evidence already establishes a lead.
- Direction, evidence agreement, change size and data completeness are different
  properties. Strong agreement need not mean a large new change. Percentages
  describe weighted support, not probabilities.
- Exactly cancelling support and all-zero usable observations are distinct from
  a small nonzero lead. Do not invent a measured lead in these cases. Existing
  standalone tie priorities must remain explicit model choices; changing them
  requires a justified, separately scoped implementation.
- Invalid, unavailable or genuinely unusable data cannot supply invented votes.
  Evaluate usability independently from agreement; a low agreement score alone
  must not erase an otherwise valid nonzero lead.
- The primary result should be understandable without numerical reconstruction.
  Detailed inputs, formulas, support shares and combinations remain inspectable
  for audits, rather than mandatory steps in the normal reading flow.

The directional translation uses declared economic rules. Assess those rules,
comparison choices and weights as well as the arithmetic. The agent owns that
justification; it must not return the calibration burden to the user. These
outputs describe economic support under the rules. Predicting every price move
or optimizing agreement with market prices is outside the objective.

## Data and calibration intent

Forecasts are **deliberately excluded**, even when available in the stored feed.
The user wants Actual-versus-past interpretation and wants to avoid reconciling
broker/provider consensus values or survey methodologies. Do not reintroduce
forecast surprise, consensus comparisons or forecast-driven weights.

Actual-versus-past includes each family's documented revised-prior or historical
comparison. Some scorers use recent means or trend windows. Do not silently
replace every comparison with literal latest Actual minus the immediately
preceding supplied Previous; disclose what each directional result interprets.

- Stored usable history begins on **1 January 2015**. Admit observations by source,
  publication clock, reference period, native unit and revision provenance.
- The Scatter Plot is the historical inspection surface for how unusual a
  reading or scorer feature is. Viewport changes must not change calibration.
- **Raw A–P bands and scoring-signal bands are intentionally separate.** Earlier
  manual boundary entry became exhausting; the user asked an agent to calibrate
  automatically. Preserve saved settings and this separation. Do not ask the
  user to manually tune each release or merge the two settings systems.
- Current raw A–P UI supports Undefined or frozen manual tuples; an agent-supplied
  saved tuple can still be stored as a manual setting. Current scoring signals
  support automatic calibration and optional per-component manual overrides.
  Inspect the actual settings/provenance before claiming a saved raw tuple is
  generated by an automatic runtime algorithm.
- Automatic scoring-signal limits use nearest-rank 1/3, 2/3 and 90th percentiles
  of earlier nonzero absolute feature values. At least 24 earlier usable features
  are needed; zeros count toward usable history but not the nonzero percentiles.
- Signed magnitude points are 0–4. Above Large is **Extreme**, capped at ±4.
  Pandemic-sized values cannot generate unbounded votes. COVID observations
  remain in historical percentile samples; capping their score is not deletion.
  There is no demonstrated reason from the current review to remove them or
  replace the magnitude system merely because those years are unusual.
- Feature magnitude and family/component weight answer different questions.
  Review calibration or weights when a concrete weakness is found. Require a
  documented reason, historical replay and sensitivity checks for a change.
  Neither one surprising release nor price disagreement establishes a defect.

## Meaning of each surface

| Surface | Responsibility |
| --- | --- |
| Standalone Inspector | Resolve this family's eligible release features into a primary bias and strength using its documented comparison. |
| Roofs | Resolve a named group of eligible releases at its activation clock; identify whether it describes retained standalone support or recent changes in support. |
| Raycaster | Resolve accumulated available evidence at the selected clock and currency scope using current policy weights and retention. |
| Candy | Visualize the matching Raycaster or selected Roof interpretation over time; supply no independent model or vote. |
| Scatter Plot | Expose historical rarity, feature inputs and magnitude calibration for inspection; preserve scorer parity in scoring-signal mode. |
| Outside events | Preserve manual contextual notes; supply no inferred numerical vote or confirmed cause. |

Keep latest release changes, sustained trend and accumulated context identifiable.
A supportive trend can weaken, and an unchanged release score can renew an aged
vote. Renewal, calibration drift, availability changes and economic score change
must remain separate. Multiple overlapping combinations are explanations, not
independent confirmations or extra Raycaster votes. Fed numerical action remains
separate unweighted policy context; speeches and inferred guidance do not vote.

## What is implemented, and what is still a gap

Completed: interpretation-integrity pass (T1–T7), USD Roof expansion (R1–R6),
USD Raycaster/Candy presentation (P1–P5), and unified display-clock work. Do not
restart these implemented plans. The archive preserves their evidence and
intermediate findings; linked reports describe their actual acceptance checks.

Current USD scores use their component weights once, then assigned family weight
and age retention. Coverage is separate; there is no additional multiplication
by component coverage or individual CPI/NFP completeness veto. Base context
weights are CPI 28%, NFP 30%, Claims 10%, PCE 10%, ISM 10%, Retail 7%, GDP 3%,
PPI 2%, with existing documented conditional labor-priority transfers.

USD Raycaster/Candy presentation v1 already names a nonzero conflicted lead and
uses Weak for narrow separation. It retains the current 60% usable-budget gate.
**Legacy canonical/publication context and EUR-vs-USD still have a one-third
agreement gate that can return Mixed despite nonzero net support.** This is an
implementation gap relative to the clarified directional contract, not a reason
to redefine the user's objective or claim that every surface already satisfies it.
Existing data-usability gates have not been changed by this documentation update.

Relative/EUR behavior was deliberately preserved in the prior USD pass. EUR
scoring refinement and relative presentation changes remain deferred for a
subsequent scoped request. The current implementation authorises the standalone
Claims work above, not retuning EUR or quarantined relationship/context models.

## Current work and next reviews

| Item | Status and next action |
| --- | --- |
| Refresh active objective and remove stale completed plan | Completed in this documentation update; historical content archived. |
| 8 October Claims release review | Completed read-only at Elev8-Demo2 revision 79473 with all eight USD families and automatic signal magnitudes. |
| Scatter calibration / Extreme cap inspection | Completed for the current Claims signals, including 2020 extremes and scorer parity; relevant scatter suites passed. No magnitude or weight change was justified. |
| Next CPI/core CPI release | User plans to request a review after the release listed for **14 October 2026, 19:30 Asia/Jakarta**. Check the actual stored release when asked; no monitor or scheduled job has been requested. |
| Claims historical revision propagation | Implemented for standalone v3 with publication-time provenance and revised comparison windows; the quarantined v2 model is unchanged. Stored original-vintage limitations remain. |
| Nonzero-lead consistency across legacy publication and relative surfaces | Known contract gap for a separately scoped review; preserve quarantined context and EUR behavior during standalone development. |
| Broader weighting/calibration changes | Evidence-driven review when needed; no blanket retuning plan is active. |
| EUR scoring and EUR-vs-USD presentation | Deferred; do not automatically implement while reviewing a USD release. |

For a requested release review: capture the stored observations and actual
settings provenance, verify revised baselines and publication chronology, inspect
historical magnitude and Extreme handling, then explain the weighted lead and
its strength. Distinguish the new release from retained context and fresh-change
relationships. Report concrete defects or justified refinements without requiring
the user to interpret tables or select parameters.

Historical Claims v2 evidence for 8 October: standalone EURUSD Short, Strong agreement, total
+2.25—unchanged from 1 October. The accumulated USD-only result remains
Conflicted · Short leads, Moderate, with its stronger retained lead caused by
Claims renewal. The replay reproduces nine combinations: two Long leads and
seven Short leads. Current settings were explicit automatic defaults; browser
preferences were not read. See the detailed release report below.

## Evidence and reference map

- [8 October Claims review](reports/Claims-2026-10-08-review.md).
- [Claims standalone v3 audit](reports/Claims-standalone-v3-audit.md).
- [Interpretation integrity v8](reports/Interpretation-integrity-v8-audit.md).
- [USD Roof expansion](reports/Roof-v4-expansion-audit.md).
- [USD Raycaster/Candy presentation v1](reports/USD-raycaster-candy-v1-audit.md).
- [Unified display clock](reports/Unified-display-clock-audit.md).
- [Active scoring implementation plan](temporary%20plan.md).
- [Completed plans and historical objective](reports/Main-objective-history-through-2026-10-08.md).

Prior test counts belong to their dated passes, not a claim that the active
implementation was tested. Record fresh checks with each completed phase.

## Engineering and review guardrails

Use stored numerical observations for calculations. Official sources can verify
release values or clarify definitions without becoming an additional live scoring
feed. Preserve nominal budgets, overlap control, chronology, distinct reference
periods, revision provenance, one latest vote per family and aggregate/proxy
replacement. Missing observations are not measured zeros or agreeing votes.

Keep heavy work in existing background jobs. Pan/hover must not rescore history
or launch calculation workers; keep identities and callbacks stable, batch
viewport projection by animation frame, and clean up timers, frames, subscriptions
and stale replies. Follow the root AGENTS.md responsiveness rules.

For implementation changes, run affected frontend suites sequentially, with
lint/build and appropriate assembled-terminal checks. Performance changes need a
reproducer and deterministic work-count regression. Preserve existing user work,
settings and documentation moves. No unsolicited commits, deployments, dataset
rewrites or new external integrations.

Leave visual UI audits to the user. Do not use computer-use, browser automation
or screenshot-driven inspection unless explicitly requested. State unverified
browser performance honestly. Never describe passing arithmetic tests as proof
that economic weights are uniquely correct or price-predictive.
