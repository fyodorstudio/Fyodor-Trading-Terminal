# Thesis dock

Thesis is the saved fundamental research workspace. The user supplies currencies
and a period; the agent researches broadly, saves verified developments and records
its resulting currency assessments. The user supplies technical analysis and execution.
There is no automatic research or news ingestion.

## Presentation

Eight buttons (EUR, GBP, AUD, NZD, USD, CAD, CHF, JPY) select exactly one
standalone currency, remembered across reloads. JUL/OCT Month and Day selectors
choose the Jakarta date. There is no All view, pair mode or Date range control.
Only the selected currency renders its summary (direction/intensity, assessment
time, reason, horizon and coverage), then a chronological table, newest dates first:

**Date | Time · Jakarta | Development | Fundamental implication | Effect on existing thesis | Source**.

Each distinct development has one row. Several events on one day do not share a
large daily cell. Unknown publication hours say Hour unknown. A separately known
event clock is explicitly labelled Event, never passed off as a publication clock.
Source details retain verification and recorded clocks and existing calendar or
External Source references. Older still-active evidence is visible in **Active
background**. Upcoming checkpoints are separate from occurred facts. Assessment
history expands only when recorded direction, intensity or basis changes; it never
invents a verdict at every event time or a market turning point.
Dates with more than 20 developments use pages; export retains every row. Closed
development, assessment and earlier-version histories keep their bodies unmounted.
The main view requests only its selected currency, reuses stable rows and caches
visited currencies within the selected date. Scrolling performs no research/fetch.

Copy research prompt uses the selected currency/date and the same skill/contract
for every invocation. Export Markdown saves that currency’s loaded evidence, assessments,
background, checkpoints, source clocks, correction history and handoff. It does no
research or writes. Failed loads preserve the last snapshot with an error; date
changes cancel stale replies and clear the old view. Polling keeps unchanged data
stable and stops on unmount. Text uses the terminal's readable 14px typography.
Visual acceptance is the user's responsibility; tests use terminal-based component
and service contracts, not browser automation.

Earlier currency snapshots and their versions remain under an expandable archive,
loaded only when opened and filtered to the selected currency. Snapshot bodies
mount on expansion. The user requested permanent deletion of saved pair-journal
entries (including versions and pair-based opportunity rows), pair planning days
and shared-review opportunity links. Currency views, evidence, checkpoints and
review versions remain intact. Date navigation performs no research or writes.

## Agent interface

```powershell
pnpm analyst thesis research --scope ALL --from 2026-10-22 --to 2026-10-29
pnpm analyst thesis research --scope GBP --from 2026-10-22 --to 2026-10-29
pnpm analyst thesis research-append --scope ALL --input "Market Analyst Workflow/report/research.json"
pnpm analyst thesis summary --scope ALL
pnpm analyst thesis context --scope EURUSD
pnpm analyst thesis read --scope ALL --month 2026-10
pnpm analyst thesis read --scope NZDCHF --month 2026-10
```

The new workflow uses one `Market Analyst Workflow/thesis/research.json` ledger.
Developments are stored once with stable keys and immutable versions; research runs
reference exact evidence versions. The writer assigns IDs/save clocks, resolves
references, validates conflicts, writes the entire batch atomically and verifies
its local read-back. The receipt reports the saved run, interval, reused/created
evidence IDs and assessed currencies; it does not certify exhaustive coverage. A repeated
unchanged development reuses its version instead of copying the story each day.
No item quota, mandatory eight-row payload for focused updates, entry window or
opportunity payload is required. Read back the returned ID, interval and summary.

### Research request

`thesis research-append` takes a UTF-8 JSON file inside Lite with:

- `as_of_utc`: offset-aware information cutoff, no later than now. Live research
  uses its actual cutoff; reconstruction uses the historical cutoff on period_end.
  Verification/assessment clocks remain their real later times, never backdated.
- `period_start`, `period_end`: inclusive Jakarta dates, ordered and ending by cutoff.
- `currencies`: requested scope; defaults to all eight. A full research refresh
  investigates all eight; focused releases save affected currencies only.
- `developments`: newly verified findings/corrections, possibly empty on an update.
- `assessments`: researched currency conclusions or explicit gaps, possibly empty
  when saving findings alone. Never copy unresearched rows to make them look current.
- `provenance`: assessment or reconstruction; `note` explains a reconstruction's
  historical information set. Past-period/cutoff saves require reconstruction.

Each development has `key`, `title`, `facts`, `published_on`, optional
`published_at` and `event_at`, `timing_note`, real `verified_utc`, direct `sources`,
and `impacts`. Unknown publication hours need a timing explanation. Each impact
contains `currency`, `implication` and `thesis_effect`; one fact may affect several
currencies differently. Do not treat release components/syndications as separate
independent developments. For a material directional development, `implication`
states potential strengthening/weakening, intensity and causal channel; this does
not require realised FX flows or a trade entry. Unrelated facts need no invented
currency direction. Older material findings may be saved as active background.

Optional `references` link existing identities, not new observations:
`{kind: external, key: <stable-key>}` or
`{kind: calendar, key: <exact-reference>, broker: <actual-broker>, value_ids: [...]}`.
These references do not pin events, request chart markers or arm reminders.
Optional commodity-only findings use `instruments` (BRENT/WTI/GOLD),
`instrument_note`, `commodity_implication`, `commodity_thesis_effect` and may have
empty currency `impacts`. The dock shows them in a separate optional section;
no artificial USD impact, eight-row assessment or entry window is required.
Sources have `kind: web|local`, `label`, `locator`, optional `note`; local evidence
must be an existing absolute file inside Lite. At least one direct HTTP(S) source
supports each development and direction. Preserve attributed survey/market pricing,
publication timing uncertainty and original release vintages.

A correction repeats the development's full content with the latest
`expected_version` and a nonblank `revision_note`. Facts and earlier interpretations
are never overwritten. A stale changed write fails before the ledger changes.
An unchanged recheck can reuse the development while recording a new assessment.

Each assessment has `currency`, `evidence_keys` (findings inside the interval),
`background_keys` (active evidence before it), optional `gap`, and `direction`:

```json
{
  "currency": "CHF",
  "evidence_keys": ["chf-example-current-development"],
  "background_keys": ["chf-example-older-policy"],
  "gap": "Describe any material uncovered interval or failed source.",
  "direction": {
    "basis": "standalone",
    "review_status": "complete",
    "stage_note": "Name the delivered package and guidance reviewed through cutoff.",
    "verdict": "POTENTIAL WEAKENING",
    "intensity": "slight",
    "reason": "Explain the dominant remaining mechanism and what offsets it.",
    "horizon": "Current session through the selected material checkpoint.",
    "verified_utc": "<actual completed assessment UTC>",
    "sources": [{"kind": "web", "label": "Direct evidence", "locator": "https://example.com/release", "note": "Replace this illustrative source."}],
    "reassessment_gap": "Use this only when no next material schedule can be verified."
  }
}
```

This is a field illustration, not executable research. Use real facts, keys,
clocks and sources. Choose a sourced `reassessment` instead of a gap whenever
available: `title`, `event_at` OR `event_date`, `verified_utc`, `sources`, `note`.
The note explains why this stage can challenge/reinforce the current mechanism.
Optional assessment `checkpoints` lists other relevant upcoming stages with the
same shape, distinct from the chosen nearest reassessment deadline. Elapsed
stages must be resolved as developments/gaps, not carried as future events.

New `research-append` directions require `review_status: complete|provisional`
and a nonblank `stage_note` (up to 700 characters). Complete describes the named
reviewed information set, not exhaustive news coverage or guaranteed direction.
Use provisional when a material subsequent guidance stage remains unresolved;
name both the verified and pending stage. A checkpoint-only audit with no new
decisive evidence saves `direction: null` and the exact gap, preserving the old
direction clock. Prior saved runs and legacy interfaces remain readable without
these fields; do not migrate their historical completion claims. Validators enforce
the declaration, not the truth of the financial reasoning. A direction has at most
eight source links; select its decisive sources while retaining the full source
set on the referenced developments rather than duplicating every link here.

A direction references recorded evidence/background, uses standalone qualitative
pressure and an explicit horizon. Strong/Moderate/Slight is a shared causal-pressure
scale, not probability, confidence score, pip forecast or institutional positioning.
Research completes relevant same-direction comparisons using both currency stories
and overlapping horizons, following the skill's shared scale. Equal grades alone
are insufficient; explain any supported relative preference in reasons/chat.
Pair journals are not recreated. These are potential impacts, not proof of realised
flows, certainty or execution suitability. Known conflicting mechanisms must be
assessed; they are not missing facts. A genuinely unavailable decisive fact can
be saved with `direction: null` and a
nonblank `gap`; the live summary retains an earlier supported verdict with Review
needed and its original assessment clock, rather than manufacturing a fresh call.
Use this exception only for the claim depending on that fact. Missing live pricing,
routine opposition or indecision over a grade do not justify it. Give supported
event impacts and the researched currency verdict without a neutral/mixed fallback.
Its evidence anchor also stays with that retained assessment; pending newer
findings remain in the ledger and must not make an old verdict look freshly supported.

### Left-panel summary and reassessment

The left dock is a read-only projection: **Evidence age | CUR | VERDICT | Checkpoint**.
Its keyboard-accessible Fundamentals heading collapses/expands the contents and
remembers the preference. Collapsing changes no assessment, evidence or deadline.
It derives live assessments per currency from the research ledger, with legacy
daily reviews as fallback. There is no separately authored summary verdict file.
Reconstructions and future cutoffs cannot replace live directions. A focused
update leaves other currencies' assessment/evidence clocks intact.

The static Jakarta Last Assessed header marks the latest completed, saved live
assessment/research pass, represented by its information cutoff. A reload, initial
scan or save alone is not completed research; agents set that cutoff when finishing
the pass. Each row's currency assessment time remains in its tooltip and Thesis
summary, with explicit gaps and focused scope preserved. Read-only research does
not change this saved timestamp.

Evidence age comes from the latest significant named dated development referenced
by the assessment, not its retrieval or save time. Fresh research can retain an
older anchor when no newer significant finding exists; age alone neither requires
a replacement anchor nor makes a supported verdict overdue. A date-only source
gives approximate day age without an invented hour. No dated anchor says Undated.
This number does not establish complete coverage or show every offset: the timeline
does that. Review needed is a missing-fact exception, not a completed judgment of
known opposing evidence; see the research rules above.

Checkpoint is reassess by, not promised direction until. It counts down, then
shows Passed, retaining the chosen event and verdict. A precise unresolved gap
shows Source gap; absent legacy schedules show a dash. A source date
without an exact hour stays date-only. No alarm, polling clock or calendar navigation
renews evidence, rolls a deadline forward or reverses a verdict. Live invocations
resolve relevant elapsed stages and choose the next material checkpoint. Shared
global deadlines need a specific mechanism for each affected currency.
All eight rows fit the Fundamentals section without an internal vertical scroller;
Market Watch uses the remaining dock height. The verdict stays compact. An asterisk
with an accessible label and tooltip qualifies a provisional call, elapsed stage or
specific source gap without repeated status headings. Original pressure, evidence
and assessment clocks remain; presentation performs no research. The reviewed-stage
note also appears in bottom Thesis and Markdown exports. A newer header from a
focused pass cannot renew another row's checkpoint or imply conference completion.
An invoked live refresh must do the substantive research and update affected rows,
then verify the live projection. Do not clear markers by redating old evidence or
moving an unresolved decisive stage into the future. A routine introduction or
general conference is not automatically a decisive checkpoint for every currency;
select stages that can materially change that currency's active mechanism.

Reads: `/api/v1/theses/research?from=YYYY-MM-DD&to=YYYY-MM-DD` and
`/api/v1/theses/summary` (UI proxy `/storage-api`). Range reads include older active evidence and bounded earlier assessment context. They
preserve both unknown hours and exact cited versions, without background research.
An optional `currency=GBP` (any of the eight currencies) limits range reads and
their revision to that currency; shared findings retain full identities, impacts
and versions. Unscoped CLI/API reads remain available for broad research. A slim UI
response does not limit which dated foundations the agent must investigate.
CLI `research --scope GBP` uses that projection; `research-append` still requires
`--scope ALL`, with affected currencies selected in its JSON request.
Unchanged replies retain revisions; the header does not certify an all-eight scan.

## Compatibility and shared dated review

The saved pair entries in `journal.json` and planning days in `plan.json` were
cleared at the user’s request. Matching `opportunity_ids` were removed from shared
review versions; all other review content and `research.json` were preserved. The old
`thesis append` pair interface, `thesis review-append` and `format: daily_news` read/
write contract remain available for compatibility and earlier copied prompts.
Their validation, release vintages, same-day opportunity windows, exact linked
pair versions and optimistic correction chains are preserved. The normal new
research workflow does not rebuild these daily snapshots. Old prose is projected
as saved; missing event implication/effect is explicitly unrecorded, never inferred
from a later verdict. Legacy interpretations remain available in the archive/export.

For pair saves use `thesis context --scope <PAIR>`, read the pair/month, then append
through the existing schema with direct sources, real as-of time, target identity
when relevant and change/compared_with/change_reason. Pair enums remain BUY/SELL/
STRONG BUY/STRONG SELL/MIXED; they do not define standalone currency pressure.
Do not recreate deleted pair records without an explicit request. Preserve currency
research, user trade notes and raw observations. Alert owns significant
Invoke reminders under [the alarm contract](EVENTS-ALARMS.md); research saves and
checkpoints alone do not arm bells or schedule AI work.
