# Thesis research and interval updates

Use this workflow whenever the user asks to research a period and fill/update
Thesis. The user need only name the period/currencies or invoke Assess Trade Now.
The [Thesis contract](../../../../docs/THESIS.md) owns the JSON, CLI, UI and clocks;
do not reproduce those schemas or a giant copied prompt here.

1. Read `thesis research --scope ALL --from <date> --to <date>` and the live summary.
   Research all eight for a broad invocation, or the requested affected currencies
   for a focused refresh. Carrying a row is not assessing it.
2. Research the interval broadly, including policy communications, economic data
   and material off-calendar developments. Fill intervening gaps since the previous
   assessment. Open decisive sources and actively seek offsets/contrary news.
   There is no item quota; several components/syndications are one release package.
3. Store distinct developments with stable keys, factual summaries, original source
   dates/hours, sources and currency-specific implication/thesis effect. One event
   can affect several currencies differently. Link existing raw calendar/external
   identities when useful, without copying raw observations into research.
4. Reuse existing developments. A changed fact or interpretation appends an explained
   version; the tool resolves/fixes exact evidence versions for the assessment.
   Keep still-active evidence before the interval in `background_keys`, not repeated
   as today's news. Do not claim a later interpretation was made at event time.
5. Save a broad or focused assessment: standalone qualitative pressure, dominant
   remaining reason, material offsets, horizon and next relevant checkpoint. Facts
   may be saved even without a direction. A decisive gap may be saved without a
   fresh verdict; it must remain visible rather than refreshing the old clock.
6. Append through `thesis research-append`, then read back the range and live summary.
   Explain retained/changed pressure and any unresolved intervals/access gaps.

## Left-panel freshness audit

The left **Fundamentals** panel is the user's primary monitoring view. Every
authorized live research save includes checking its projection, even when the
user did not separately request a left-panel update. Save through the ledger;
the read-only panel derives its rows automatically. Do not edit labels directly
or create a duplicate verdict file.

Read `pnpm analyst thesis summary --scope ALL` before research and after saving.
Verify each affected currency's standalone verdict/intensity, assessment clock,
original evidence anchor and next checkpoint or explicit Review needed gap.
A focused refresh must preserve the other currencies and their clocks. When a
gap retains an older verdict, its supporting evidence anchor must also remain
the one assessed then; newer unassessed findings stay in Thesis as pending review.

Also check the running `http://127.0.0.1:8002/api/v1/theses/summary` endpoint, or
the UI proxy `/storage-api/theses/summary`, when available. Verify its response
against the frontend summary validator with terminal-based tooling; CLI/HTTP
success alone does not establish that the panel accepts the response. Resolve a
local runtime/contract error within authorized scope or report the exact delivery
gap. Do not claim the left panel updated while its summary is unavailable or
invalid. Leave visual acceptance to the user; no browser automation is needed.

Last Assessed is the actual currency assessment clock. Evidence age is the latest
named dated development referenced by that assessment; it does not summarize the
age of every supporting/contrary fact. The timeline exposes those dates. No save,
poll, alarm or fresh retrieval changes a source's original publication time.

A full requested refresh checks all eight. A focused release refresh resolves the
relevant actuals/guidance and affected/decisively overdue mechanisms without
starting unrelated investigations. Preserve unresearched rows and their clocks.
A checkpoint is a review deadline, not a promise of direction until then; resolve
elapsed stages before selecting a new verified stage. Shared global deadlines need
a concrete channel for each affected currency. Date-only schedules get no invented
hour or precise bell. Report unresolved decisive gaps as Review needed.

Keep live and historical information sets separate. A historical period uses
labelled reconstruction and cannot replace live verdicts. Future days stay unfilled.
The dock selects one currency/date and its archive preserves earlier currency
snapshots. Saved pair journals were deleted at the user’s request; do not recreate
them without an explicit request. New findings use the research ledger rather
than rebuilding daily blobs. Entry comparisons
are optional outputs. Saving research requires neither a pin nor a reminder for
every row; significant reminders use the separate alert procedure.
