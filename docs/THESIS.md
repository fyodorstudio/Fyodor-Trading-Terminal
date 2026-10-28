# Thesis dock

Thesis is the saved fundamental research workspace. The user supplies currencies
and a period; the agent researches broadly, saves verified developments and records
its resulting currency assessments. The user supplies technical analysis and execution.
There is no automatic research or news ingestion.

## Presentation

Across All Currency keeps the JUL/OCT month and day selectors and adds a **Date
range** option with inclusive From/To Jakarta dates, including ranges across months.
Each of the eight currencies has a summary (direction/intensity, assessment time,
reason, horizon and coverage), then a chronological table, newest dates first:

**Date | Time · Jakarta | Development | Fundamental implication | Effect on existing thesis | Source**.

Each distinct development has one row. Several events on one day do not share a
large daily cell. Unknown publication hours say Hour unknown. A separately known
event clock is explicitly labelled Event, never passed off as a publication clock.
Source details retain verification and recorded clocks and existing calendar or
External Source references. Older still-active evidence is visible in **Active
background**. Upcoming checkpoints are separate from occurred facts. Assessment
history expands only when recorded direction, intensity or basis changes; it never
invents a verdict at every event time or a market turning point.

Copy research prompt uses the selected interval and the same skill/contract for
every invocation. Export Markdown saves the loaded interval, evidence, assessments,
background, checkpoints, source clocks, correction history and handoff. It does no
research or writes. Failed loads preserve the last snapshot with an error; range
changes cancel stale replies and clear the old view. Polling keeps unchanged data
stable and stops on unmount. Text uses the terminal's readable 14px typography.
Visual acceptance is the user's responsibility; tests use terminal-based component
and service contracts, not browser automation.

Earlier daily snapshots, opportunity selections and their versions remain under
an expandable archive, loaded only when opened. Turning Across All Currency off
retains the independent 28-pair journal and its historical planning days. Neither
the new view nor date navigation rewrites old research or raw calendar data.

## Agent interface

```powershell
pnpm analyst thesis research --scope ALL --from 2026-10-22 --to 2026-10-29
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
independent developments. No forced direction per event or invented institutional
flow is implied. Older material findings may be saved as active background.

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

A direction references recorded evidence/background, uses standalone qualitative
pressure and an explicit horizon. Strong/Moderate/Slight is a shared causal-pressure
scale, not probability, confidence score, pip forecast or institutional positioning.
Equal grades alone do not establish a finer pair ranking. Cross recommendations
require both currency stories and overlapping horizons and remain optional chat
output. A decisive unresolved fact can be saved with `direction: null` and a
nonblank `gap`; the live summary retains an earlier supported verdict with Review
needed and its original assessment clock, rather than manufacturing a fresh call.

### Left-panel summary and reassessment

The left dock is a read-only projection: **Evidence age | CUR | VERDICT | Checkpoint**.
It derives live assessments per currency from the research ledger, with legacy
daily reviews as fallback. There is no separately authored summary verdict file.
Reconstructions and future cutoffs cannot replace live directions. A focused
update leaves other currencies' assessment/evidence clocks intact.

Last Assessed in the header is the latest saved research cutoff; each row's actual
currency assessment time remains in its tooltip and Thesis summary. Evidence age
comes from the latest named dated development referenced by that assessment, not
its retrieval or save time. A date-only source gives approximate day age without
an invented hour. No dated anchor says Undated. This one number does not establish
complete evidence coverage or show every offset: the timeline does that.

Checkpoint is reassess by, not promised direction until. It counts down, then
shows Review due, retaining the chosen event and verdict. A precise unresolved gap
shows Review needed; absent legacy schedules show Review not set. A source date
without an exact hour stays date-only. No alarm, polling clock or calendar navigation
renews evidence, rolls a deadline forward or reverses a verdict. Live invocations
resolve relevant elapsed stages and choose the next material checkpoint. Shared
global deadlines need a specific mechanism for each affected currency.

Reads: `/api/v1/theses/research?from=YYYY-MM-DD&to=YYYY-MM-DD` and
`/api/v1/theses/summary` (UI proxy `/storage-api`). Range reads include older active evidence and bounded earlier assessment context. They
preserve both unknown hours and exact cited versions, without background research.
Unchanged replies retain revisions; the header does not certify an all-eight scan.

## Compatibility and shared dated review

Existing `journal.json`, `plan.json` and `reviews.json` remain unchanged. The old
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
Preserve old journals, user notes and raw observations. Alert owns significant
Invoke reminders under [the alarm contract](EVENTS-ALARMS.md); research saves and
checkpoints alone do not arm bells or schedule AI work.
