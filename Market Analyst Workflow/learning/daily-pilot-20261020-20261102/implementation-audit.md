# Daily verdict excursion implementation audit

Implemented November 3, 2026, Jakarta. This is an engineering and measurement
audit, not a claim of improved predictive performance or automatic weight training.

| Requirement | Authoritative evidence |
| --- | --- |
| Every dated verdict carries signed maximum excursion | Production Thesis heading, every earlier assessment row and lazy legacy review use AssessmentExcursion. Unchanged same-day calls remain separate. Frontend Thesis tests cover missing, developing, final and malformed values, historical rows and exports. |
| Daily context and available opportunity stay separate | daily.py normalizes the seven USD legs by broker D1 opens, then evaluates synchronized M1 closes. Each delivered version has remaining-day and active-window excursions, adversity, peak and timing. Earlier highs cannot reward a later call. |
| Correct day close and live/final handling | Historical Pepperstone clock profile; tests distinguish October 4 AM and November 5 AM Jakarta rollover, exclude forming observations and force a reread after completion. Native reads are bounded and account/source checked. |
| Historical backfill | October 20–November 2 contains 400 directional versions: 392 have sampled day measurements and eight lack usable day history. Missing samples remain Partial. Records without a standalone basis cannot become clean rewards. November 2 remains Developing until November 3 at 5 AM Jakarta. |
| Reproducible frozen prices and calls | All 398 current completed active/day records replayed exactly against 11 immutable protocol-v2 price documents. Day, active-window and remaining-day metrics matched. Earlier prototype versions and original call hashes remain preserved. |
| Future invocations confront rewards and limitations | learning prepare returns scoped supporting/refinement evidence, coverage, timing and a bounded balanced case queue. case exposes exact outcome versions; review accepts those IDs. Reviewed-case references must predate a new assessment cutoff. EUR's opposed early call and GBP's contrasting short-window/full-day outcome have recorded reviews. |
| Deferred grading/source refinements | Standalone reference explicitly tests Strong/Moderate/Slight and requires an explanation for marginal Slight. Ordinary uncertainty, absent realised flows and no prior rally are not intensity caps. Source-access and judgment gaps are distinguished, with manual help for an exact inaccessible decisive link. |
| Preserve financial state | No edits to original Thesis research/reviews, Entry Trade journal or copied bridge. Price projections have their own API revision and cannot renew Last Assessed, evidence dates, verdicts, checkpoints or alarms. |

Verification: all 37 frontend suites passed, with the changed Thesis and assembled
terminal suites rerun after UI refinements. All 220 backend tests passed. Lint,
TypeScript/build, repository navigation/hygiene checks and skill validation passed.
Visual acceptance remains with the user; no browser automation or visual audit ran.

Real API payloads for all eight currencies passed the frontend validator and
rendered through the production Thesis component in a terminal-only check. Repeat
revision requests returned unchanged. Initial selected-currency calls took about
0.21–0.66 seconds in this local run; this is an observation, not a performance SLA.
A 40-assessment deterministic test shares one basket and one outcomes-store batch
plus one archived price document. Unchanged polling performs no persistence writes.
Repeat backfill added zero observation versions; closed price days were reused.

Limitations remain explicit: sampled maxima are not broker-index wick highs;
partial paths do not prove an unseen exact maximum; neither excursion alignment
nor a stronger grade establishes causal correctness, fills or profit. The growing
case record must be tested prospectively rather than relabelling earlier calls.
