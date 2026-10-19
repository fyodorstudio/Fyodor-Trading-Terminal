# Thesis dock

Thesis only documents sourced assessments the user asks an agent to save.
The month selector offers **JUL / OCT 2026**, defaulting to October for a new
preference. Pair choice defaults to NZDCHF, independently of the chart.
Saved assessments are newest first. Alert owns scheduling and notifications.
**Across All Currency** toggles a separate date-first journal of opportunities
from an eight-currency review. The same table groups pair verdicts under each
Jakarta assessment date, newest first. Turning it off restores the selected pair.
Copy Prompt and Markdown export follow the selected view; neither creates research.
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
