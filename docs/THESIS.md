# Thesis dock

Thesis is a read-only pair/month assessment table. V1 offers only **JUL 2026**
and defaults to NZDCHF, independently of the chart. Past assessments are newest
first. Upcoming contains unassessed active MT5 Highlight stages and dated
External Source pins for the pair/month, earliest first. Separate publication
times within a Highlight remain separate stages. Date-only stages retain their
source date and unknown hour; unscheduled watches are not assigned a month.
Archiving a pin removes pending rows, never saved theses.

Elapsed time only changes status to Awaiting assessment. Copy release prompt
invokes `one-minute-before-release` with the exact occurrence/stage; Copy
assessment prompt invokes `assess-trade-now`. These prompts explicitly authorize
saving a supported assessment. Missing decisive actuals leave the pending
verdict/thesis empty. No automatic AI invocation or analysis occurs in the UI.
The approved workflow also authorizes saving a supported verdict when the user
invokes `one-minute-before-release` for a resolved pair and a matching pinned
stage, including invocations from an Alert notification. Query that event's
Jakarta month and match its exact target; no matching row means no automatic
standalone save. This does not authorize saving every general chat assessment.

## Agent interface

```powershell
pnpm analyst thesis read --scope NZDCHF --month 2026-07 --broker Elev8-Demo2
pnpm analyst thesis append --scope NZDCHF --broker Elev8-Demo2 --input "Market Analyst Workflow/report/thesis-request.json"
```

Read before appending. Write a UTF-8 JSON request inside Lite. Example standalone
assessment (replace placeholder text with sourced research):

```json
{
  "scope": "NZDCHF",
  "as_of_utc": "2026-07-15T06:00:00Z",
  "title": "Daily assessment",
  "verdict": "BUY",
  "thesis": "Replace with the supported relative mechanism and material counterevidence.",
  "horizon": "Intraday",
  "sources": [{"kind":"web", "label":"Official release", "locator":"https://www.rbnz.govt.nz/", "note":"Replace with the direct release URL."}],
  "note": "",
  "provenance": "assessment",
  "target": null
}
```

Verdicts are STRONG BUY / BUY / MIXED / SELL / STRONG SELL. Use the actual
timezone-aware research cutoff, no later than now. `saved_utc` is assigned by the
writer. The selected month never authorizes backdating. A current assessment
outside July is saved under its real month and is outside the JUL-only selector.
Historical simulations use only evidence known at their cutoff and
`provenance: "reconstruction"`, with a note explaining limitations. The July
1–15 seed preserves the researched chat reconstruction at 1:00 PM Jakarta;
these were not contemporaneously saved July calls.

For a release, copy the pending row's exact `target` from `thesis read` or its
prompt: `kind` (highlight/external), `reference` (pin ID/external key), `source_id`
(MT5 broker, null for external), `event_at` (exact timezone-aware stage instant)
and `event_date` (source date for an unknown hour). Supply exactly one time/date.
The writer checks occurrence, pair and current stage and rejects a cutoff before
release. Refresh if the schedule changed. Do not save an assessment merely to
fill a row when decisive data is missing.

For a correction or reassessment, pass the returned `row_id` and its latest
`id` as `expected_version`. A matching event target resolves its existing row
automatically, but still requires the latest predecessor. Standalone assessments
create new rows unless row_id is supplied. Stale predecessors and changed
pair/target are rejected. Details exposes prior versions and separate research,
release and saved clocks. Optional `journal_id` links the full report for the
same Highlight/pair without copying its body.

## Storage and runtime

The canonical compact records live in Git-tracked
`Market Analyst Workflow/thesis/journal.json`, separately from raw observations,
External Source facts and full Highlight journals. Writers lock and atomically
replace the book while retaining every version. Preserve the complete file in
recovery and commits. No browser research-write endpoint exists.

Browser GET `/storage-api/theses?scope=NZDCHF&month=2026-07&source_id=Elev8-Demo2`
maps to storage's `/api/v1/theses`. Broker is optional for saved theses and
External Source pins. `after_revision` avoids replacing unchanged data. The dock
polls only while mounted, five seconds after each completed check. The UI renders
plain text and HTTP(S) source links, without executing report markup.

Restart calendar storage after deploying backend changes. Research saves do not
restart services or change pins, alarms, raw calendar data or Entry Trade notes.
Visual layout review stays with the user.
