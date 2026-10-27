# Thesis dock

Thesis saves research when requested, including the user's standing permission
for focused live-summary updates during live Assess Trade Now/release invocations.
Explicit read-only, chat-only or no-save requests override this workflow. The month selector offers **JUL / OCT
2026**; the day selector uses the month's actual length. Across All Currency shows
one row each for USD, EUR, GBP, JPY, CHF, CAD, AUD and NZD:
**Currency | DD:MM:YYYY FUNDAMENTAL | SOURCE | UPCOMING CHECKPOINT**.
**TRADE ENTRY OPPORTUNITY** appears first: supported standalone currency and optional
commodity entries with active/conditional status, investor incentives, sources,
same-day Jakarta windows and invalidation. Real capital may be at stake: a
directional bias must not force an entry. An empty selection has `opportunity_gap`.
No pair scan, cross selection or numeric ranking is involved. Each Fundamental
cell starts with **POTENTIAL STRENGTHENING** or **POTENTIAL WEAKENING** for that day
and its dominant reason. Choose one: a preference for caution, opposing indicators
or a pending release must not replace a directional judgment. Verify or exclude
unsupported claims instead of withholding a verdict.

Fundamental and Source contain matching numbered lists: one summary and its
source group per item. Upcoming contains numbered scheduled news still ahead at
the saved cutoff, including later today; known released results belong in
Fundamental. No confidence grades or separate counterweight/scenario columns in this table.
SOURCE displays verified publication times (or hour unverified) separately from
source-check times. Directions are assessments at the saved cutoff, not a claim
to cover the whole day. When same-day saved assessments change direction, the
Fundamental cell includes the earlier view and each changed reassessment with its
Jakarta time, reason and corresponding sources. Unchanged refreshes add no change
line; corrections at one cutoff replace that interpretation without inventing a
reversal. Assessment times do not establish the market's turning point or an
unverified catalyst publication minute. Reconstructions do not acquire a live timeline.
The latest cutoff saved for the selected Jakarta day wins; unfilled dates stay
blank. Older assessments remain preserved and are labelled as older assessments,
without relabelling their interpretations as today's news.

**Copy fill-date prompt** asks an agent to research and save the selected date.
Aim for four or more distinct relevant same-date news items per currency when
available; use fewer rather than pad quiet days. One release package or syndicated
story is one item. Check all five research areas without requiring a five-category
payload. No research runs on date selection or automatically each day.
Use a pre-session baseline and selective checkpoint refreshes. Each saved update
names the next useful reassessment event; no twice-daily quota or monitoring is
implied. Focused refreshes preserve unaffected rows' verification clocks and
identify carried context. Read the actual saved prose for ordinary spacing and
readable times/units; a valid JSON payload does not prove readable copy.
For a past date the prompt explicitly requests a labelled historical collection;
use only information then available. Future dates stay unfilled.

Turning Across All Currency off restores the independent pair history and
**Copy assessment prompt**. Pair choice defaults to NZDCHF. Pair assessments,
July reconstructions, saved versions and raw records remain unchanged. Alert owns
reminders. An Alert firing without an invocation performs no research or save.
Live release invocations refresh an existing live ALL summary after the first
verdict, preserving carried rows and evidence ages. Body and headings retain the
same 14px type size.

**Export Markdown** downloads the selected currency date or pair/month as a portable `.md` file:
tables, schedule notes, sources, research/saved clocks, limitations, correction
history and a self-contained research handoff for another AI. It exports the
last loaded snapshot without requesting new research or changing records; an
offline export includes the load error. Export time is separate from research
time. The dock checks saved files automatically while open; no Refresh button
is needed. Exporting does not invoke an agent or authorize writes.

## Agent interface

```powershell
pnpm analyst thesis read --scope NZDCHF --month 2026-10
pnpm analyst thesis read --scope ALL --month 2026-10
pnpm analyst thesis context --scope ALL
pnpm analyst thesis summary --scope ALL
pnpm analyst thesis context --scope NZDCHF
pnpm analyst thesis review-append --scope ALL --input "Market Analyst Workflow/report/review.json"
pnpm analyst thesis append --scope NZDCHF --broker Elev8-Demo2 --input "Market Analyst Workflow/report/thesis-request.json"
```

Read before appending. Write a UTF-8 JSON request inside Lite. Example standalone
assessment (replace placeholder text with sourced research):

```json
{
  "scope": "NZDCHF",
  "as_of_utc": "2026-10-01T06:30:00Z",
  "title": "Daily assessment",
  "verdict": "BUY",
  "thesis": "Replace with the supported relative mechanism and material counterevidence.",
  "horizon": "Intraday",
  "sources": [{"kind":"web", "label":"Official release", "locator":"https://www.rbnz.govt.nz/", "note":"Replace with the direct release URL."}],
  "note": "",
  "provenance": "assessment",
  "target": null,
  "change": "Baseline",
  "change_reason": "First documented assessment for this review interval.",
  "compared_with": null,
  "as_of_precision": "minute"
}
```

For legacy pair opportunities in the across collection, keep `scope` as the actual pair and add
`collection: "across"`; append once per opportunity using `--scope <PAIR>`.
Omitted collection means `pair` for backward compatibility. Across reads use
`--scope ALL`, contain only explicitly saved across records and no planning rows.
Do not copy all historical pair journals into this view. Each opportunity keeps
its own cutoff, conditional verdict, sources and immutable versions. Corrections
retain pair, collection and occurrence; comparisons may reference an earlier
pair-journal version for the same pair. MIXED candidates are conditional, not
executable entries. Upcoming schedules and reminders remain in Alert.

## Shared dated review

For a requested new assessment/save, start with `thesis context --scope <PAIR|ALL>`.
It returns the latest relevant review across months, up to three earlier takeaways,
up to four recent assessments and a pair's last directional assessment. Pair reads
filter the shared backdrop to two currencies, including when an eight-currency
review selected no opportunity for that pair. Optional `--as-of <UTC>` excludes
later research cutoffs; it does not reconstruct historical data vintages or prove
a later-saved reconstruction was available then. Monthly reads retain full history.
Use this bounded context instead of loading the whole archive; refresh decisive web
facts and seek opposing developments. Saved interpretation is not accumulated truth.

## Daily news save contract

### Left-panel summary and reassessment

The left dock shows **Age | CUR | VERDICT | Checkpoint** in both Market Watch and Price Alerts.
It reads the latest live `daily_news` review across months, independently of the
chart and selected Thesis date. Pair journals and labelled reconstructions cannot
replace it. It abbreviates the saved direction to Strengthening/Weakening; this
does not establish a pair entry or measure an index. Details stay in bottom Thesis.

Age measures the age of `direction.evidence_anchor`, not the save or
verification clock. Choose the decisive supporting event/development, preserving
its original `event_at` OR `event_date`, `title`, direct web `sources` and a `note`
explaining its relevance and time precision. It must precede the research cutoff
and direction verification. A publication/update clock can anchor a continuing
story only when explicitly labelled; it is not a measured market-turn time.
Rechecking or retaining an old mechanism does not reset its age. Do not substitute
the newest unrelated headline. Unknown hours display the source date, legacy
missing anchors say Unknown, and exact clocks show an elapsed duration with ago.
The header shows `<Jakarta date/time> · Last Assessed` using the saved-review clock; row tooltips show event details
and direction verification. Detailed anchor sources also appear in bottom Thesis
and its export. Checkpoint shows only a compact duration, Review due, Hour unknown or
Review not set; its event name, full date/time and note remain in the tooltip and
bottom Thesis. No automatic inference or history migration supplies anchor clocks.

For each currency in a requested save, choose `direction.reassessment` using the
checkpoint object (`title`, `event_at` OR `event_date`, `verified_utc`, `sources`,
`note`). Explain in note why this is the nearest material reassessment and what
would retain/reverse the case. Consider counterpart, energy, funding and fiscal
stages too; do not automatically skip to the next rate decision. Include this
schedule in `planning_as_of_utc` checks. It also appears in Upcoming, deduplicated
by title/clock. If no schedule is verified, omit it and explain
`direction.reassessment_gap`. Both fields are optional for older records/clients.

Checkpoint scope follows the row's stated relative comparison and horizon. Its
note names the counterpart(s), transmission channel and a material retain/reverse
test. A US release can affect EUR versus USD without changing domestic EUR
fundamentals; it does not automatically expire AUD versus NZD. Shared deadlines
need a specific material link for every row. Broad global exposure or possible
volatility alone is insufficient. Routine operations and lesser execution hazards
stay visible in Upcoming/Alert without automatically becoming verdict deadlines;
do not skip a genuinely material nearer stage or force different dates merely
for variety. Requests to resolve Review due or correct saved checkpoints authorize
a focused append/read-back refresh, with unchanged rows explicitly carried.

The standing live-invocation workflow also performs this focused refresh without
another save prompt. At Jakarta midnight, use the actual new-day cutoff; preserve
prior-day news in its original snapshot and dated direction context, and retain
unaffected verification clocks and future deadlines. An operation start is not
its result publication: a requested operation-and-results wait covers the verified
close plus its declared bound, then records verified actuals or the precise gap.

Checkpoint means reassess by, not a promise that direction lasts until then. An exact
time gets a countdown, then **Review due** while retaining the selected checkpoint
and verdict. It never rolls forward or reverses automatically. Unknown hours show
the source date and become due on that Jakarta date without inventing a timed
alarm. Older records say **Review not set**; no migration supplies a guess.
Unscheduled shocks can require earlier review. Resolve elapsed stages on the next
invocation before selecting a new checkpoint. A focused save preserves carried
rows' verification clocks and deadlines; copying them does not renew the evidence.

GET `/storage-api/theses/summary` maps to `/api/v1/theses/summary`; `pnpm analyst
thesis summary --scope ALL` reads the same eight-row projection with exact review
version ID, cutoff and revision. Corrections update it; older cutoffs do not replace
newer research. No eligible review gives eight unassessed rows. The box polls every
five seconds while the left dock is visible, stops on collapse/unmount and keeps
its clock local. Failed refreshes preserve the last loaded snapshot with an error.
Read this projection back after a current save, alongside the monthly version;
historical fills must leave it unchanged. Per-row verification clocks distinguish
carried evidence from the review cutoff.

Saving this checkpoint alone never selects a bell. Assess Trade Now's separate
standing permission covers a few significant Invoke reminders under
[Alert's contract](EVENTS-ALARMS.md#reminder-selection). Preserve user choices and
verify the worker. No automatic AI invocation or analysis occurs.

### Daily payload

Read the requested month and bounded context first. Save a UTF-8 JSON file inside
Lite through `pnpm analyst thesis review-append --scope ALL --input <file>`.
Use `format: "daily_news"`, `scope: "ALL"`, `as_of_utc`, all eight `currency_views`,
`planning_as_of_utc` when checkpoints exist, and optional `limitations`/`note`.
Omit `opportunity_ids`, `backdrop`, `takeaway` and legacy interpretation fields.
New daily saves require every currency's `direction`: `verdict` (only
`POTENTIAL STRENGTHENING` / `POTENTIAL WEAKENING`), `reason`, real `verified_utc`
and direct `sources`. Explain the dominant mechanism and material opposition;
still-active older evidence retains its original date and belongs in direction
sources rather than being counted as same-day news.

Select zero or more `entry_opportunities`, strongest supported currency first. Each has
`currency`, `summary`, `starts_at`, `ends_at`, `timing_note` and `invalidation`.
Direction and sources come from its currency row. Windows need explicit offsets,
start before end, and both instants on the selected Jakarta date. Current windows
start at/after the cutoff and end by 11:59:59 PM that day. Give narrower timing only
when verified catalysts support it; otherwise describe the remaining day as the
assessment window, without inventing an execution minute. Historical windows use
only evidence known at their start, labelled retrospective. Later-date events stay
in Upcoming. Older news-only versions remain readable without invented verdicts.
The UI and export show shared timing once above the currency list; distinct windows
stay with their currency. Keep `timing_note` to a brief currency-specific catalyst
or reassessment trigger. Do not restate dates, window bounds or generic timing caveats.
Today uses the real research cutoff. Past dates require `provenance:
"reconstruction"`, a provenance note and their historical cutoff (end of Jakarta
day when no hour was specified). The writer assigns the real `saved_utc`.

New entries require `stage` (`active` or `conditional`), `activation`, and
`evidence`: `expected_baseline`, `new_information` (or continuing driver),
`remaining_case`, `flow_channel`, `flow_basis` (`observed`, `reported`, `inferred`),
`horizon`, `market_feedback`, real `verified_utc` and direct `sources`. Keep pricing
or feedback gaps explicit. Never fabricate private flows. A remaining-day research
window does not instruct holding until midnight. Closed-market next-session ideas
outside this date belong in chat/Upcoming.

Optional `commodity_opportunities` use those same window/stage/evidence fields
plus `instrument` (`BRENT`, `WTI`, `GOLD`), exact `symbol`, `provider`,
`instrument_type` (`spot`, `spot_cfd`, `futures`, `futures_cfd`), `contract_note`
(expiry/roll/benchmark relationship), `verdict` (BUY/SELL, optionally STRONG), and
optional scheduled `checkpoints` under the currency checkpoint clock/source rules.
Quote currency alone is not fundamental USD relevance; keep commodity sources
separate. Avoid duplicate Brent/WTI versions of one mechanism. When both entry
lists are empty require nonblank `opportunity_gap` on a new save. All eight currency
directions stay required. Old snapshots remain readable without invented status
or evidence and are never rewritten to populate these fields.

Each currency view contains `currency`, `direction`, `news`, optional `news_gap`,
and `checkpoints`. Each news item has:

- `published_on`: the original publication's Jakarta date, matching the selected
  day; `published_at`: optional verified offset-aware publication instant.
- `summary`: a concise factual summary, attributing forecasts/opinions and keeping
  actual/prior/revisions together. Do not place list numbers inside the text.
- `verified_utc`: real source-check time, which can follow the historical cutoff
  for a reconstruction; never pretend historical research was checked then.
- `sources`: direct kind/label/locator/note source objects. Each item needs at least
  one HTTP(S) web source; several sources for one item share its rendered number.

`news` may have fewer than four items; an empty list requires a specific
`news_gap` such as no verified relevant same-date releases found after searching.
Gaps can also explain incomplete source access. Do not invent news to meet a quota.
Bias/summary/counterweight/top-level sources on the currency view are omitted.
The UI uses the news array's order for both numbered lists.

Checkpoint fields remain `title`, `event_at` or `event_date`, `verified_utc`,
`sources`, and optional factual `note`. Supply exactly one scheduled clock/date;
no unscheduled risks or hypothetical trade outcomes. Events must be ahead of the
research cutoff; source-date-only items may be on the same day with hour unknown.
Use the real `planning_as_of_utc` for schedule verification, even during historical
research. Verify historical schedules were public by that historical cutoff.
A requested refresh moves known published results into news and removes them from
Upcoming; the saved snapshot does not change merely because live time passes.

After append, read the month back and verify returned version ID, selected date,
all eight currency verdicts/rows, top standalone summaries and same-day windows,
matching news/source groups and future checkpoints.
Confirm the save and material gaps briefly in chat. A short chat assessment does
not fulfil a requested table save. Write failures must be reported honestly.

## Legacy and pair review fields

Legacy/pair assessment reviews retain `format: "assessment"` (the default),
complete five-category `backdrop`, and their existing fields. These remain readable
and versioned; new dated currency tables use `daily_news` above. Assessment fields:

- `scope`: `ALL` (eight currencies) or an actual pair; `as_of_utc`, `horizon`,
  concise entry-focused `takeaway`, `opportunity_ids`, `backdrop`, optional
  `limitations`, `note`, and `provenance` (assessment/reconstruction).
- `currency_views`: one entry for every reviewed currency. Each has `currency`,
  a short descriptive `bias`, concise `summary`, strongest `counterweight`, direct
  `sources` and `checkpoints`. This is standalone fundamental interpretation, not
  a measured currency index or a universal verdict against every counterpart.
  Confidence language is optional and must be supported; no numeric score or
  habitual low-confidence boilerplate. Dates in the user's example are not evidence.
- Each checkpoint has `title`, `event_at` (UTC instant) or `event_date` (hour unknown),
  `verified_utc`, direct `sources` and a short `note` with material supporting/opposing
  outcomes. Supply neither clock only for an explicitly unscheduled risk with a note.
  No invented hours, forecast figures or actuals. Keep timed stages earliest first.
- `planning_as_of_utc`: the real checkpoint-preparation cutoff. It may follow the
  original research cutoff when adding schedules to an earlier saved assessment;
  the UI shows both clocks. Source verification must not exceed preparation.
  Keep original verification/capture clocks when reusing saved schedules, explain
  provenance in source/review notes, and never claim a fresh web check. Historical
  context queries omit checkpoints prepared after their chosen cutoff.
- `backdrop`: one cell for each reviewed currency and each category `policy`,
  `inflation`, `labor`, `growth`, `other`. Each cell has `currency`, `category`,
  `evidence` and optional `gap`. Empty evidence requires an explicit gap.
- Evidence: `published_on` (source publication date, not reference month),
  `summary` (result/prior and implication), `verified_utc` and direct `sources`
  in the usual kind/label/locator/note format. Unknown publication dates use null
  plus `publication_note`. Dates/verification cannot follow the review cutoff.

Example cell (illustrative only):
```json
{"currency":"NZD","category":"growth","gap":"","evidence":[{"published_on":"2026-10-19","summary":"Replace with verified result, prior and implication.","verified_utc":"2026-10-19T08:00:00Z","sources":[{"kind":"web","label":"Official release","locator":"https://businessnz.org.nz/","note":"Use the exact release URL."}]}]}
```

Research all categories; carry still-relevant evidence into the complete new snapshot
with its original publication date and verification clock. Advance the verification
clock only after actually checking that source. Record material gaps explicitly.
Do not copy a backdrop into every pair or require routine daily edits: maintenance
happens when the user invokes an assessment. An empty opportunity list is allowed
when the review finds no directional entry; never manufacture a trade to fill it.

When linked, each review freezes exact opportunity versions; a later pair reassessment cannot
silently rewrite that dated review. A fresh cutoff creates new rows and a new review.
Corrections use `review_id` and latest `expected_version`, retaining the original
scope/cutoff and all versions. Corrected reviews may relink corrected assessment
versions at that cutoff. Review corrections do not change unrelated pair entries.
The tracked `thesis/reviews.json` stores shared reviews separately from the compact
assessment journal; preserve both files. Markdown exports include all dated review
evidence and limitations. Pair exports retain frozen linked assessments/history;
the all-currency export follows the selected date and includes agent context.

The existing pair-journal storage verdicts are STRONG BUY / BUY / MIXED / SELL /
STRONG SELL. Conversational pair assessments use BUY / SELL, with qualitative
STRONG BUY / STRONG SELL when supported by the dominant mechanism. Standalone
currencies use STRENGTHENING BIAS / WEAKENING BIAS. For an authorized pair save,
retain the supported pair label; map strengthening/weakening wording to BUY/SELL
only when that pair comparison is established. Daily currency-table saves retain
POTENTIAL STRENGTHENING / POTENTIAL WEAKENING. Preserve all old records, enums
and versions without migration. A decisive evidence gap is explained
in chat, not resolved by inventing a directional saved row. Use the actual
timezone-aware research cutoff, no later than now. `saved_utc` is assigned by the
writer. The selected month never authorizes backdating. A current assessment
outside the available months is saved under its real month and is not yet selectable.
Historical simulations use only evidence known at their cutoff and
`provenance: "reconstruction"`, with a note explaining limitations. The July
1–15 seed preserves the researched chat reconstruction at 1:00 PM Jakarta;
these were not contemporaneously saved July calls.

## Direction versus thesis change

The four columns are Date / Time, Pair bias, Thesis change and Explanation.
`change` describes evidence for the previous directional case: Baseline,
Materially strengthened, Strengthened, Unchanged, Weakened or Reversed.
`change_reason` explains the magnitude/mechanism. Non-baseline changes require
`compared_with`, the exact earlier assessment **version ID**, for the same pair
and an earlier cutoff. The read projection resolves its date and verdict, even
across months. After MIXED, compare a newly dominant buy/sell case with the last
supported directional assessment; Unchanged MIXED can compare with MIXED.
This is an ordinal evidence judgment, not a cumulative score,
percentage, expected move or probability. Weaker BUY need not become SELL;
Reversed requires an established opposite direction. MIXED can acknowledge a
lost edge without inventing the opposite trade.

Use actual invocation times for current assessments. Historical reconstruction
rows follow verified publications and material updates, with no fixed daily hour
or forced one-row-per-day quota. A date-only source uses `as_of_precision: "date"`
and an explicit conservative internal cutoff note; the UI does not present that
cutoff as a verified publication hour. No row on a day does not establish absence
of news. October 1–17 contains NZDCHF assessments only; the original July records
remain unchanged and unscored. Legacy absent change fields display a dash.

An explicitly requested release assessment may retain an optional `target`:
`kind` (highlight/external), `reference` (pin ID/external key), `source_id`
(MT5 broker, null for external), `event_at` (exact timezone-aware stage instant)
and `event_date` (source date for an unknown hour). Supply exactly one time/date.
The writer checks occurrence, pair and current stage and rejects a cutoff before
release. Refresh if the schedule changed. Do not document a release result when
decisive data is missing.

For a correction or reassessment, pass the returned `row_id` and its latest
`id` as `expected_version`. A matching event target resolves its existing row
automatically, but still requires the latest predecessor. Standalone assessments
create new rows unless row_id is supplied. Stale predecessors and changed
pair/target are rejected. Details exposes prior versions and separate research,
release and saved clocks. Optional `journal_id` links the full report for the
same Highlight/pair without copying its body.

## Storage and runtime

The requested NZDCHF October 18–31 planning rows live in `thesis/plan.json`
beside the journal. Each day has `scope`, Jakarta `date` and an `events` list;
events have `title`, optional timezone-aware `at`, `note` and `sources`. The book
has `version: 1` and the real schedule-check time `checked_utc`. Date-only events
keep `at: null`; blank days have no events. Plans contain no research verdict,
future assessment cutoff or automatic invocation. Broker-only times and timing
uncertainty stay attributed in notes. Schedules are a saved snapshot, not a live
feed; recheck before assessment. Do not add pins or alarms merely for these rows.

GET and `thesis read` return planning days separately as `planned`. A saved
assessment on the same pair/Jakarta date replaces that blank day's display;
all assessment versions and the original plan remain stored. Fill a day by
appending a real assessment through the existing agent interface, using its
actual cutoff after invocation. Passing midnight or a release time fills nothing.
Other pair/month views do not inherit this requested plan.

The canonical compact records live in Git-tracked
`Market Analyst Workflow/thesis/journal.json`, separately from raw observations,
External Source facts and full Highlight journals. Writers lock and atomically
replace the book while retaining every version. Preserve the complete file in
recovery and commits. No browser research-write endpoint exists.

Browser GET `/storage-api/theses?scope=NZDCHF&month=2026-07` maps to storage's
`/api/v1/theses`. Reading saved assessments needs no broker or active pins.
`after_revision` avoids replacing unchanged data. The dock
polls only while mounted, five seconds after each completed check. The UI renders
plain text and HTTP(S) source links, without executing report markup.

Restart calendar storage after deploying backend changes. Research saves do not
restart services or change pins, alarms, raw calendar data or Entry Trade notes.
Visual layout review stays with the user.
