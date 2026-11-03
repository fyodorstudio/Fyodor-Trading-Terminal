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
`daily.py` owns the synchronized daily basket and excursion protocol;
`daily_worker.py` reads seven visible USD legs from the already-connected terminal;
`daily_market.py` owns the bounded cache and Thesis projection. It shares one day
read across currencies, runs at most one native job, checks account/source identity
before and after reads, and never selects symbols, logs in or changes the bridge.
`daily-outcomes.json` appends completed active-window and final-day evaluation
versions, separate from calls. Live day progress does not repeatedly duplicate a
completed active interval; rollover appends its final remaining-day observation.
Protocol v2 archives exact price documents under ignored `days/versions/` for
each new completed observation. The record names its immutable evidence file and
measured-as-of cutoff so day and window metrics can be replayed after the live
cache advances. Older prototype protocol versions remain intact.
Protocol v3 additionally separates verdict-signed closing returns from excursion
alignment, requires the exact terminal minute and preserves the raw currency
return. Older records are retained; their unverified closing basis is not scored.
Protocol v4 uses all seven verified, completed broker D1 closes at the day endpoint
when rollover has no M1 candle. Intraday endpoints still require exact synchronized
minutes. The close source is explicit; missing M1 samples remain partial and never
become fabricated extrema. A read started before rollover cannot supply a final
D1 endpoint. Original protocols, observations and archived prices stay intact.
The authoritative live verdict remains [Thesis](THESIS.md); evaluations cannot
alter it, its evidence dates, checkpoints, alarms or user trade journals.

Preserve every delivered assessment version, including legacy corrections. Use
the actual persisted delivery proxy, never the earlier research cutoff, as the
price baseline. A correction delivered after a newer information set cannot
reactivate an obsolete call. Reconstruction is excluded from live accuracy.
Missing legacy directions, ambiguous horizons, closed-market baselines and
incomplete prices remain explicit limitations rather than fabricated outcomes.

## Measurement contract

### Daily opportunity (primary)

Every dated Thesis judgment shows a mandatory signed Day max, its Developing/Final
state and a labelled sampled relative FX basket. All eight use the same geometric
equal-weight basis against the other seven currencies, derived from seven USD
legs and their broker D1 opens. This is not GBPUSD alone or a broker index clone.
Do not combine independently timed leg highs/lows into a synthetic wick extreme.
Use synchronized completed M1 closes; display partial paths and missing history.

The largest absolute open-to-sampled-high/low excursion supplies the sign, with
upward winning ties. It is daily context, not post-verdict credit. For each exact
delivered version separately record favourable/adverse excursion, adverse movement
before its best peak, peak time and time-to-peak after delivery. Retain the whole
remaining broker day and the active interval through the earliest checkpoint,
declared end, supersession or day close. A late verdict cannot claim earlier moves;
post-checkpoint movement never renews a call. Historical reconstructions, obsolete
versions and unknown legacy bases remain contextual, not clean forecast rewards.

The UI displays broker D1 open-to-close context, delivered-verdict-to-D1-close
alignment, and the separate active-window closing result. Excursions remain visible
alongside them. A favourable excursion can coexist with an opposed close. Exact
closing endpoints permit that comparison even when an internal gap makes sampled
extrema partial; a missing endpoint supplies no substituted close. Developing
results are explicitly unfinished. Learning retrieval includes closing results
and queues opposed closes alongside excursion refinement cases.

Pepperstone's historical NY-close profile determines the date and boundaries.
November 2, 2026 ends November 3 at 5 AM Jakarta; US DST days end at 4 AM. Jakarta
midnight is not rollover. Associate by actual delivery time, show broker-day dates
and exact close times, and reread a previously developing day after completion.
Never substitute neighbouring days on weekends/holidays. Current snapshots update
while the terminal runs; a later read finalizes a closed day after downtime.

An aligned observed remaining-day maximum is a supporting/reward case, an opposed
one a refinement candidate. Their coverage is always explicit; a partial path
does not establish the true unseen maximum. Active-window feedback separately
requires a complete path. Neither label proves the economic explanation or profit.
Future invocations must confront relevant successful and adverse cases with dated
source checks, preserve corrections and report material newly identified limits.
No automatic model-weight update or promotion of directional rules follows.

### Terminal-return diagnostic (secondary)

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

The user's trading target is a pair's native D1 candle color, distinct from this
currency basket and a post-delivery return. Optional `relative_preferences[].daily_close`
freezes that target and the observed open/current prices without mapping qualitative
grades to percentages. A later probability feature needs independently dated
pair-close outcomes, unchanged forecast snapshots, time-ordered validation and
reliability checks against simple baselines; repeated correlated currency calls
are not independent daily forecasts.

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
`review_ids` optionally freezes exact case-review versions considered before the
cutoff; future references are rejected. The skill requires an explicit grade
comparison and a concrete explanation for a marginal Slight advantage. Routine
uncertainty and missing realised flows/price confirmation do not cap intensity.

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
`pnpm analyst learning daily-backfill --scope ALL --from 2026-10-20 --to 2026-11-02
--max-days 20` backfills bounded native daily captures. Routine `refresh --capture`
uses `--max-days 2` in addition to the existing OHLC symbol/request budget. Completed
raw days are reused. Prepared context includes bounded daily feedback and a queue;
`case` includes the exact daily outcome ID for case review. Report exports include
`daily-excursions.csv`. Price calculations never mutate saved research or alarms.
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
