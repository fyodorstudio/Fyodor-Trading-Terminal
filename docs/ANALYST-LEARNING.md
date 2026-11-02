# Analyst learning

Assess Trade Now owns a foreground improvement loop: freeze the delivered call,
measure matured observations, review failures and successes, then retrieve relevant
lessons during the next invocation. This is project memory and evaluation, not
automatic model-weight training, background monitoring or an execution system.
Real capital may be at risk. Neither a green validator nor a profitable-looking
historical path establishes sound research or a reliable trading edge.

## Owners and data

`storage/analyst_learning/` owns original-call snapshots, evaluation protocols,
price observations, reviewed cases, versioned lessons and compact retrieval.
`Market Analyst Workflow/tools/learning.py` owns bounded offline/live capture and
CLI orchestration through `pnpm analyst learning`.
`Market Analyst Workflow/learning/` holds tracked evaluation records and reports.
Raw immutable OHLC captures live in ignored `storage/data/analyst-learning/`.
The authoritative live verdict remains [Thesis](THESIS.md); evaluations cannot
alter it, its evidence dates, checkpoints, alarms or user trade journals.

Preserve every delivered assessment version, including legacy corrections. Use
the actual persisted delivery proxy, never the earlier research cutoff, as the
price baseline. A correction delivered after a newer information set cannot
reactivate an obsolete call. Reconstruction is excluded from live accuracy.
Missing legacy directions, ambiguous horizons, closed-market baselines and
incomplete prices remain explicit limitations rather than fabricated outcomes.

## Measurement contract

The frozen protocol selects the first synchronized completed M1 close at/after
delivery (within 120 seconds). Primary observations end at the earliest explicit
evaluation end, precise checkpoint or superseding delivered assessment. Without
a prospective explicit horizon, checkpoint/supersession measurements are diagnostic
proxies. The checkpoint is not a promise that a direction persists until then.
Two-hour and one-day observations are separate sensitivity checks, not replacement
windows selected after seeing returns. Unknown-time stages stay unknown.

Use seven verified Pepperstone USD legs with their historical UTC conversion.
Construct geometric equal-weight currency returns against the other seven;
show individual counterpart returns and breadth. This is a transparent relative
FX proxy, not the definition of an unverified broker index or a promise against
all seven currencies. Simultaneous sampled closes support qualitative cross
preferences; they do not establish direct-cross executable returns. Do not use
Market Watch's maximum daily excursion as closing return or post-verdict accuracy.

Require completed, exact endpoints; no neighbouring candles, interpolation or
forming candles. Record missing path samples and exclude incomplete paths from
complete-path statistics. Favourable/adverse excursions use sampled closes, not
intraminute extrema. No spreads, fills, financing or realised profit are inferred.
Keep input/price/protocol hashes and capture provenance. Revisions append records.

Report declarations, distinct delivered intervals and currency-days separately.
Currencies, repeated invocations and triangulated crosses are correlated; do not
present them as independent trades or manufacture confidence intervals. Compare
direction and pair preference separately from mechanism quality and grade use.
A large move alone never retroactively establishes a Strong fundamental call.

## Prospective authoring

New assessment `evaluation` metadata freezes a precise `until_utc`, mechanism
tags, intensity rationale, strongest opposition, invalidation, lesson IDs used
and optional researched relative pair preferences. Existing records remain valid
without it and cannot be silently upgraded into prospective tests. Metadata
supports the existing assessment, never a second verdict or numeric strength score.
Equal qualitative grades require a researched comparison when relevant; no forced
distribution of Strong/Moderate/Slight and no default Slight because of uncertainty.

## Lessons and routine operation

`prepare` synchronizes snapshots and returns bounded scoped lessons and matured
case work. Current decisive facts and the first verdict take priority. After
delivery, `refresh` uses cached prices and a bounded sequential capture budget;
source failures become retryable gaps, not a reason to delay or suppress research.
Review relevant matured cases using original evidence and dated subsequent news.
Separate source omission, misweighting, obsolete assumptions, checkpoint failure,
later surprise, interpretation supported despite an adverse outcome and no lesson.

Lessons contain applicability, a decision rule, exceptions, supporting and contrary
case references. Price outcomes alone cannot establish causal explanations.
Process corrections may be adopted after a verified failure; directional hypotheses
stay in trial until prospective application and contrary cases have been reviewed.
There is no automatic promotion from wins or automatic rewriting of skill rules.
Retirement and corrections preserve history. Retrieval returns current versions
matching currency/mechanism; do not dump the full growing ledger into each prompt.

An invocation must disclose material capture/evaluation gaps and leave concrete
pending work. No unattended agent invocation, scheduled news monitor or requirement
to invent a lesson every day follows. The historical pilot diagnoses weaknesses;
future frozen cases are needed to test whether changes improve actual operation.

## Commands and review payloads

The ordinary skill runs this workflow; users need no additional invocation.
For diagnostics: `pnpm analyst learning prepare --scope EURUSD --limit 5`,
`pnpm analyst learning case --episode <id>` and
`pnpm analyst learning report --output "Market Analyst Workflow/learning/report"`.
Use `--read-only` for inspection without snapshot synchronization.
See budgets, date filters, saved inputs and observation cutoffs in
`pnpm analyst learning --help`.

Review JSON has `episode_id`, exact `outcome_id`, `classification`, `analysis`,
`known_before_cutoff`, `subsequent_information` and `source_evidence`.
Each source has `url`, `claim`, `availability_note`, optional `published_at` and
`used_as_pre_cutoff`. Unknown publication time cannot establish precise earlier
availability. Corrections need `expected_version` and `revision_note`.
Classifications are source_omission, misweighting, stale_assumption,
checkpoint_failure, later_surprise, supported_reasoning_adverse_outcome,
supported_reasoning_aligned_outcome, no_lesson or insufficient_evidence.

Lesson JSON has stable kebab-case `key`, `kind` (process/hypothesis), `status`
(trial/active/retired), `currencies`, `mechanism_tags`, `situation`, `rule`,
`exceptions`, `supporting_reviews`, `contrary_reviews` and `validation_note`.
Reference exact review IDs. Updates need the last `expected_version` and a
`revision_note`. `storage/analyst_learning/reviews.py` owns validation.

The report includes a naive previous-direction comparison on the identical current
interval. This never extends the old call's validity and is not a trading strategy.
Secondary-window capture includes matured sensitivities. Later supersession or an
open overdue interval invalidates the computation cache. Unchanged completed work
does not generate new versions. Raw captures remain reusable and budgeted.
