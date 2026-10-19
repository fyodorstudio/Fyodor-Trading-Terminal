# Thesis dock

Thesis only documents sourced assessments the user asks an agent to save.
The month selector offers **JUL / OCT 2026**, defaulting to October for a new
preference. Pair choice defaults to NZDCHF, independently of the chart.
Saved assessments are newest first. Alert owns scheduling and notifications.
**Across All Currency** toggles a separate date-first journal of opportunities
from an eight-currency review. The same table groups pair verdicts under each
Jakarta assessment date, newest first. Turning it off restores the selected pair.
Copy Prompt and Markdown export follow the selected view; neither creates research.
Each saved review leads with a short opportunity takeaway. Directional entries
remain visible; MIXED/conditional or weakened cases are expandable. The shared
**Fundamental backdrop · Sources** starts collapsed, showing the selected pair's
currencies or all reviewed currencies. Source dates and ages use that review's
cutoff, never today's date. July/older standalone records remain unchanged.
An explicitly requested planning table follows the assessments, earliest first;
it contains blank days and sourced schedule notes, with no bias or thesis.

Copy assessment prompt invokes `assess-trade-now` and explicitly requests a
save. A direct user request to document an assessment also authorizes saving.
Invoking `one-minute-before-release` or receiving an Alert alone does not
implicitly save a Thesis record. No automatic AI invocation or analysis occurs.

**Export Markdown** downloads the selected pair/month as a portable `.md` file:
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

For an Across All Currency save, keep `scope` as the actual pair and add
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

Save new standalone opportunities at one real cutoff, then `review-append` a complete
snapshot linking their exact returned version IDs. ReviewRequest fields:

- `scope`: `ALL` (eight currencies) or an actual pair; `as_of_utc`, `horizon`,
  concise entry-focused `takeaway`, `opportunity_ids`, `backdrop`, optional
  `limitations`, `note`, and `provenance` (assessment/reconstruction).
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

Each review freezes exact opportunity versions; a later pair reassessment cannot
silently rewrite that dated review. A fresh cutoff creates new rows and a new review.
Corrections use `review_id` and latest `expected_version`, retaining the original
scope/cutoff and all versions. Corrected reviews may relink corrected assessment
versions at that cutoff. Review corrections do not change unrelated pair entries.
The tracked `thesis/reviews.json` stores shared reviews separately from the compact
assessment journal; preserve both files. Markdown exports include all dated review
evidence, limitations, frozen linked assessments and prior review versions.

Verdicts are STRONG BUY / BUY / MIXED / SELL / STRONG SELL. Use the actual
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
