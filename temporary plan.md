# Scoring system implementation plan

## Active USD R1 overhaul — 10 October 2026

Baseline: `93a6ecd`; implementation branch: `codex/usd-scoring-r1`.
The user resumed autonomous implementation. The canonical design is
[scoring system overhaul](scoring%20system%20overhaul.md#usd-evidence-design-r1).

- Shared R1 family, relationship and historical calculation engines are implemented.
  Inspector and Scatter have separate R1 choices; ISM publications display separately.
- R1 settings preserve compatible raw A−P bands and the existing Extreme x4 cap.
  New manual overrides and earlier-history calibration are separately versioned.
- Stored-history replay now covers 1,828 publications, with production-worker
  and Scatter parity. Golden and mounted R1 tests and the assembled-terminal
  pan/hover/clock regression pass. Versioned stored observations preserve release
  snapshots and apply corrections to current slots only at capture time. Three
  real aggregate snapshots match future-removal and the built R1 worker.
- All 69 frontend suites and 29 storage tests pass; lint/build pass. The final
  audit is in [USD R1 stored-history replay](reports/USD-R1-stored-history-audit.md).
  Historical vintages captured late remain explicitly unverified. Missing
  manufacturing Production and unverified schedules retain their uncertainty.
- Visual review belongs to the user. Older Roofs/Raycaster/Candy calculations
  remain separate while R1 relationships are available inside the new view.

The earlier Claims implementation record below is historical context.

## Scope and order

Implementation started in the subsequent goal-mode request. Phases 0–2 are
implemented; phase 3 has a reproducible Claims history audit and automated
integration coverage. Final checks are recorded below. User visual and standalone
model review remain before extending labor scoring. Phases 4–5 are deferred.

### Implementation record — 9 October 2026

- Shared calculations moved to `frontend/src/scoring-system/`; Inspector keeps
  its existing standalone UI. The gear opens the Fundamental Settings dock with
  Scoring System, Raycaster, Roofs and Candy sections.
- USD methodology/calibration now has a canonical settings page. Claims v3 adds
  independent This release/Four-week trend views, weights, magnitude settings,
  selected-release preview, Apply, Reset and workspace portability.
- Roofs/Raycaster/Candy retain Claims v2 and their existing calculations/settings.
  Roofs View Details remains. Scatter uses the selected standalone Claims view.
- The [Claims audit](reports/Claims-standalone-v3-audit.md) replays 607 publications
  per view with future-removal, provenance, Scatter and built-worker parity.
  October 8 resolves weekly USD weakness (−0.2, weak) and four-week USD strength
  (+2.4, strong). Sensitivity is reported for 50/50 through 70/30; 60/40 remains an
  explicit starting policy, not a uniquely proven economic weight.
- Verification: `pnpm --dir frontend test` passed all 67 suites. Affected settings,
  Claims, publication-layout and assembled-terminal suites were rerun after the
  final UI fixes. Lint and production build passed; the existing >500 kB bundle
  warning remains. Calculation worker bundles are unchanged by the final UI edits.
- Remaining manual review: dock layout/navigation, both Claims views, settings
  preview/apply/reset and real-browser responsiveness. Do not begin NFP,
  relationship migration or Raycaster redesign automatically.

The standalone scoring UI already exists in Inspector for the supported USD releases selected through Filters. Reuse those views and their navigation; do not create a replacement standalone page. The new dedicated page is for scoring explanations and settings.

Agreed order: update the objective, organise the existing scoring system and settings, implement the two Claims assessments, validate standalone labor scoring, develop relationships, then revisit Raycaster.

## 0. Update the main objective

Update `fyodor trading terminal main objective.md` before implementation to record:

- Standalone scoring is the current priority, beginning with US Jobless Claims.
- Claims standalone will contain two separate assessments: **This release** and **Four-week trend**. Each resolves its own inputs into a USD strength/weakness bias and evidence strength; they are not combined into another vote.
- Forecasts remain excluded. Comparisons use stored observations and revisions available at the selected publication.
- General methodology belongs in the dedicated Scoring System page. Inspector retains the result, a short explanation and the contributing numbers.
- Relationships are a later phase. Raycaster is experimental and quarantined from scoring development until the standalone models and relationships are established.

Quarantine means preserving existing Raycaster behavior while deferring its redesign and validation. It does not mean deleting the tool, disabling it or using its output to justify standalone weights. Candy and existing context consumers remain on their current calculations too.

## 1. Organise the existing calculations and build the settings page

Complete this foundation before changing Claims mathematics.

### Shared calculation folder

- Establish `frontend/src/scoring-system/` as the shared home for active scoring formulas, model definitions, weights, calibration, settings and calculation entry points.
- Move existing calculations out of Inspector ownership. Keep Inspector presentation, chart drawing and dock layout in their existing UI modules.
- Organise family-specific logic separately from shared utilities and relationship/context calculations. Reuse existing helpers rather than adding duplicate engines.
- Update Inspector, Scatter, workers, Roofs, Raycaster and other consumers to use the shared calculation modules.
- Preserve formulas, numerical results, settings keys, model versions, data availability rules and saved workspace preferences during this move. Existing consumers still receive the same assessments.
- Handle shared EUR dependencies without changing EUR interpretation rules. Preserve historical reports and user changes; do not restore deleted documents merely to satisfy old links.

### Dedicated explanation/settings page

- Replace the fundamental-tools gear popup with a full **Fundamental Settings** tab in the existing dock. The gear opens that tab.
- Add a **Scoring System** section with a family selector covering the implemented USD models. Show the active model's comparisons, weights, magnitude rules and a worked example.
- Populate explanations and supported controls from the same model definitions used by calculations. Do not maintain a second manually copied set of formulas or display controls that do nothing.
- Bring existing scoring calibration controls into this page, preserving automatic defaults, manual overrides and the distinction between raw Actual-minus-Previous bands and derived scoring-signal bands.
- Move existing Raycaster, Roofs and Candy settings into separate sections of the same tab without changing their behavior. Preserve outside-event access.
- Move general methodology out of the Inspector scoring views, leaving the result and release-specific supporting numbers. Provide a direct link to the relevant scoring explanation/settings section.
- Preserve Roofs combo contents and **View Details** for now. Relationship explanation cleanup belongs to its later phase.

### Foundation acceptance

All currently supported standalone scoring views still work. Existing numerical results and downstream consumers match the pre-move baseline. The gear opens the dedicated tab, current controls persist correctly, and the methodology has one canonical home.

## 2. Implement two Claims standalone assessments

Extend the existing Claims Inspector scoring view. Use **This release** as the default, with **Four-week trend** as a second selectable view.

| Assessment | Initial claims | Continuing claims |
| --- | --- | --- |
| This release | Revised previous week minus current Actual | Revised previous week minus current Actual |
| Four-week trend | Reported average for the preceding separate four-week period minus the latest reported four-week average | Mean of the preceding four weeks minus mean of the latest four weeks |

- Use supplied Revised Previous when available. Otherwise use a verified prior-week observation; do not fabricate a baseline from missing or ambiguous history.
- Initial and continuing claims have different reference weeks. Compare each within its own series and reporting period.
- Resolve revisions for all affected historical weeks using only information available at the assessment's publication time. Keep provenance limitations inspectable when the stored data cannot establish an original publication vintage.
- The reported initial four-week average is a trend input, not a third weekly vote. Remove the separate latest-initial vote from the new trend assessment.
- Calibrate each signal from its own earlier history. Weekly changes and four-week changes have separate thresholds and settings; existing v2 overrides must not silently grade the new signals.
- Retain the existing bounded historical magnitude approach: signed 0–4 points, earlier-only calibration and no forecast inputs. Keep valid zero changes distinct from missing data.
- Evaluate **60% initial / 40% continuing** as the starting weight split for each assessment. Document the rationale and replay alternative weights before accepting the defaults.
- A nonzero weighted balance determines the leading USD direction. Opposing components affect evidence strength. Declare exact-cancellation behavior explicitly; all-zero and unavailable evidence cannot invent a measured lead.
- Keep the two assessments independent. Each displays its own USD bias, evidence strength, EURUSD translation, one short explanation and two component rows with the actual comparison numbers.
- Add Claims explanation, separate settings, preview on the selected release, explicit Apply and Reset to defaults to the dedicated page. Preview changes must not modify live settings until applied.

### Isolation from existing consumers

Roofs, Raycaster and Candy retain the current Claims v2 calculation until their own migration. Version the new standalone models and settings separately. New standalone tuning must not change those existing outputs. Keep Scatter inspection consistent with the selected new Claims assessment, while preserving the existing raw-table view.

## 3. Validate Claims standalone before extending labor scoring

- Reproduce the October 8, 2026, 19:30 Asia/Jakarta example, including the revised weekly comparisons and the four-week inputs.
- Replay all usable stored Claims history. Review disagreements, reversals, revisions, exact cancellation, zeros, missing weeks and extreme readings.
- Compare plausible weight splits and document which examples change direction or strength. Do not choose weights merely to obtain a preferred answer for one release.
- Verify publication-time cutoffs and historical calibration cutoffs. Later publications must not alter earlier assessments.
- Verify agreement between the calculation engine, Inspector, settings preview, Scatter and production workers.
- Preserve unchanged data identities and background calculations. Hidden views and chart pan/hover must not trigger historical rescoring; cancel stale work and subscriptions.
- Verify genuine data corrections, settings changes and selected-release changes still propagate through the assembled terminal.
- Run affected frontend suites sequentially, followed by lint/build and relevant assembled-terminal checks. Leave visual UI audits to the user and report remaining manual checks.

Claims is ready to extend when its comparisons, revision handling, calibration, weights and directional resolution are explainable and reproducible. Arithmetic tests alone do not establish economic validity.

Then review NFP separately, using its monthly structure and existing Inspector view. Do not automatically copy Claims formulas or weights into NFP or other families.

## 4. Develop relationships from established standalone models

Only after standalone acceptance, update combo relationships to consume the appropriate established assessments. Keep release-change relationships distinguishable from trend relationships, anchored to the selected publication time. Earlier participating releases retain their own publication-time assessments.

Keep release-specific evidence in Roofs; link to the canonical scoring page for general methodology. Retain **View Details** until its useful content has been accounted for and its removal is separately requested.

## 5. Revisit Raycaster last

After standalone models and relationships are established, separately design and validate Raycaster's broader aggregation, weights and retention. Aging a weekly-change score does not turn it into a trend. Choose its inputs explicitly, avoid duplicate votes, and verify Candy parity.

This phase is deferred; the Claims standalone implementation does not authorize a Raycaster redesign.
