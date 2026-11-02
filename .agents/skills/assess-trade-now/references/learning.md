# Learning during an ordinary assessment

The user wants one invocation to research, update Thesis and carry forward tested
experience. This loop is foreground work in the active invocation, never a news
monitor or automatic model training. Real capital may be at risk. The
[learning contract](../../../../docs/ANALYST-LEARNING.md) owns measurements/storage.

## Before research

Run `pnpm analyst learning prepare --scope ALL`, or the requested currency/pair.
Use `--tag policy --tag risk` when the dominant mechanisms are already known;
omit tags when not. This freezes newly found original assessment versions and
returns a bounded lesson set, material case queue and grade-calibration warnings.
For a no-save/read-only request add `--read-only` and do not run mutations below.
Read relevant lessons with their exceptions, including trial status. Their case
evidence is not today's news and never supplies a fresh evidence date. An empty
lesson set is valid; do not invent experience or treat an unreviewed hypothesis
as a discovered trading edge. Do not load the whole growing evaluation ledger.

Confront `daily_excursion_feedback`, not only prior narrative lessons. It pairs
each original call with the largest observed post-delivery excursion, adverse
movement, timing, coverage and separate active-window result. Aligned calls are
supporting/reward cases to preserve; opposed calls are refinement candidates to
investigate and report when material. Review relevant returned successes and
failures with exact outcome IDs before claiming the invocation's learning work
complete. No daily quota, forced lesson or automatic causal conclusion follows.
Already-reviewed cases remain visible as evidence. Do not reward a late call for
a daily high reached before delivery or hide a useful intraday move behind its
closing return. Partial sampled paths and obsolete/unknown-basis calls stay labelled.

## Make the live judgment

Research current decisive and contrary facts under the parent procedure. Lessons
can challenge attention and weighting; they do not dictate direction. Do not fit
grades to outcomes. Strong/Moderate/Slight describes dominance of the mechanism,
not discomfort, probability or realised candle size. When grades match, compare
the researched currencies over the same horizon and explain relative dominance
or the genuine lack of an edge. No forced grade distribution or pair quota.

Alongside each new currency assessment, add its prospective `evaluation` metadata:

```json
{
  "until_utc": "<precise future end, no later than the next material checkpoint>",
  "mechanism_tags": ["policy", "risk"],
  "intensity_reason": "Compare Strong/Moderate/Slight and justify the selected dominance.",
  "strongest_opposition": "The strongest verified competing mechanism.",
  "invalidation": "What concrete change defeats the current judgment.",
  "lesson_ids": [],
  "review_ids": [],
  "relative_preferences": []
}
```

These are supported tags: policy, inflation, labour, activity, fiscal, funding,
energy, risk, trade, haven, guidance. Use only applicable ones. A researched pair
preference can be `{pair: AUDUSD, verdict: SELL, reason: ...}` with both sides
investigated; it is frozen evaluation context, not a recreated pair journal.
Lesson IDs name the exact versions actually considered, not every returned item.
Review IDs name exact completed case-review versions considered before this
information cutoff. Never backdate a review performed after first delivery into
that call's metadata. Such reviews improve the next invocation instead.
Record `analyst_model` at request level only when known; otherwise leave unknown.
The writer captures skill hashes and attempts automatic original-call freezing.
Check its `learning` receipt; a failure is recoverable work, not permission to
withhold the current verdict. Older records without metadata stay diagnostic.

## After the supported decision and normal panel verification

Run `pnpm analyst learning refresh --scope ALL --capture --max-symbols 2 --max-days 2`, or the
requested scope. It processes matured windows, reuses verified cached M1 evidence
and bounds new sequential OHLC captures. These are outcome measurements authorised
by the learning workflow, not an unsolicited current technical-analysis scan.
Never delay imminent actuals or the first supported verdict for this bookkeeping.
A disconnected bridge or bounded capture failure leaves a precise retryable gap.
The daily budget reuses native read-only seven-leg day captures; it does not scan
current technical levels. `learning daily-backfill --from <date> --to <date>
--max-days <budget>` completes authorised historical backfills. The terminal's
price projection refreshes developing numbers and finalizes broker days without
an AI invocation. Research judgments/lessons still require the active invocation.

Review relevant newly matured cases with `learning case --episode <id>`; use the
original evidence and properly dated subsequent news. `--blind` omits the old
label and outcomes for a retrospective evidence replay, not a claimed independent
forward test. Classify discovery, weighting, stale assumptions, checkpoint failure,
later surprise, supported reasoning or insufficient evidence. Directional outcome
alone cannot establish the causal diagnosis. Record the review through
`learning review --input <JSON>`; do not overwrite original calls or their grades.
Its `outcome_id` may reference the exact `daily_excursion.id` returned by `case`.
Compare whole remaining-day opportunity and the earlier checkpoint/supersession
window separately. State whether a claimed improvement is retrospective or a
genuinely prospective application. Report material newly found limitations to
the user; rewarding an aligned path must not cement an unsupported explanation.

For a reusable finding, append a scoped lesson with situation, decision rule,
exceptions, supporting/contrary review IDs and a candid validation note through
`learning lesson --input <JSON>`. Process fixes may become active on verified
failures. Directional hypotheses start in trial; prospective applications across
distinct dates and reviewed contrary cases are required before promotion, and
still do not prove a profitable edge. Retire/revise lessons through their expected
version. Never manufacture a daily lesson, change global skill rules on one price
outcome, or silently promote a winning example. Include supported successes and
counterexamples, not just the user's challenged trades.

Summarize material new limitations/lessons briefly; routine healthy learning need
not add clutter to the trading answer. `learning report --output <directory>`
exports descriptive JSON, CSV and Markdown. Checkpoint gaps, incomplete candles,
legacy basis and ambiguous horizons remain visible. No automatic Git commit or
background scheduling is implied.
