# Fyodor Trading Terminal Lite

## Task routing

Read this file, then only the relevant owner/contract in README.md. Implementation:
left-panel summary → `frontend/src/thesis/CurrencySummary.tsx`,
`storage/thesis_summary.py`, [Thesis contract](docs/THESIS.md#left-panel-summary-and-reassessment);
manual price alarms → `frontend/src/price-alerts/`; economic Invoke reminders →
[Alert contract](docs/EVENTS-ALARMS.md). These are separate data/notification paths.
Current research uses Assess Trade Now. Findings and currency assessments live in
the Thesis research ledger; the left summary is its read-only projection with
legacy daily reviews as fallback. Read `pnpm analyst thesis summary --scope ALL`.
Thesis shows one standalone currency at a time, selected with eight currency tabs
and Month/Day navigation. Earlier currency snapshots stay in a lazy archive;
saved pair journals and their planning days were deleted at the user’s request.
Release waits use One Minute Before Release; historical moves use Review Historical
Research and must not replace the live summary. Details and comparisons stay in
bottom Thesis; the left box shows evidence age, currency, standalone pressure
and checkpoint countdown. Assessment time never redates underlying evidence.
The left Fundamentals panel is the user's primary monitoring view. Authorized
live research must save its affected assessments and verify the summary API
against the frontend contract; a chat answer or ledger-save receipt alone does
not establish a usable panel update. Follow the skill's left-panel audit and
leave visual acceptance to the user.

Market Watch, chart/drawings, raw calendar Inspector, upcoming Alert, Activity and
Settings, including agent-authored fundamental research journals and an archive
under Highlight. Research is produced in the market-analyst session; the terminal
may display saved research and provide occurrence-specific Copy Prompt actions.
Entry Trade is a manual trade journal with editable incomplete entries,
pinned arrows, sortable dates, archive/restore and one freeform journal box.
Its entries and edit history persist in the Git-tracked
`Market Analyst Workflow/entry-trade/journal.json`; preserve user technicals and
notes. The UTC event anchor (`eventAt`/`eventTitle`) controls table dating; the
chart-clock arrow time is independent and may be in future empty space. No
completeness gate, trade execution or automatic Git commit is implied. No scoring, full Notebook workflow, Scatter Plot, Fundamental
Settings, Roofs, Raycaster, Candy or Workspace backup UI belong here. Keep the copied bridge unchanged.

Read only task-relevant owners. README.md covers commands/ownership;
docs/DATA-CONTRACT.md covers calendar, clocks and recovery. Keep docs short.
Preserve currency-shared Inspector family selections, Save/Cancel and persistence, all eight currencies/28 pairs,
all series, date-only timing, unknown-ID admission, blank-chart dismissal, the
shared date viewport, future axis and saved drawing interactions.
Display defaults to Jakarta (UTC+07:00, AM/PM). Shared broker-clock rules live in
`config/broker-clock-profiles.json`; unknown broker history must not use today's
offset. Preserve publication UTC independently of chart-placement availability.
Use readable text in both themes; secondary labels must not fade into gray.
Alert impact is agent-authored, matched by exact broker/value IDs or external key,
and defaults to Unreviewed. Never substitute MT5 importance or another broker's rating.

Keep polling clocks local, unchanged data/callback identities stable and viewport
work batched by animation frame. Cancel listeners/timers and stale replies.
Run frontend suites sequentially. For dependency/extraction changes use pnpm test,
pnpm lint, pnpm build and pnpm check:repo. Performance changes need deterministic
work counts and an assembled-terminal regression. Preserve storage/data.
Leave visual audits to the user: no browser automation, computer-use or screenshot
inspection without an explicit request.

The user grants standing permission to start or restart this repo's local
development stack and services, including `pnpm run dev:all`, calendar storage
and the alarm worker, whenever needed to load or verify changes. Proceed without
asking again. Preserve stored data and alarm choices; this permission does not
authorize trades or broker account changes.

## Market analysis

Use [Assess Trade Now](.agents/skills/assess-trade-now/SKILL.md) for current
fundamentals, opportunity comparisons and requested Thesis research. A bare
invocation researches all eight currencies and selectively checks material
BRENT/WTI/GOLD candidates. Respect a narrower requested scope and research period.
The skill also surfaces exceptional clearly supported non-FX candidates encountered
in permitted news discovery, without an exhaustive extra market scan.
The user performs their own technical analysis and manual price alerts: do not
fetch candles or technical levels unless explicitly requested. Never execute trades
or change broker/account settings.

Use [One Minute Before Release](.agents/skills/one-minute-before-release/SKILL.md)
for bounded imminent-release waits, and
[Review Historical Research](.agents/skills/review-historical-research/SKILL.md)
for historical price investigations. Read the brief first; only that historical
mode requires broad H1/H4 plus measured release windows. Keep before/at/after
information sets, release vintages and intervention/news timing separate.

The research procedure has one owner: Assess Trade Now. The persistence, UI and
clock contract has one owner: [Thesis](docs/THESIS.md). Do not recreate a daily
news quota, mandatory entry payload or duplicate verdict store in prompts.

### Research quality and source coverage

Real capital may be at stake. Browse for current financial conclusions; open the
decisive source bodies, investigate contrary developments and explain the dominant
mechanism. Research both currencies before recommending a cross. Compare the
expected future policy path with prior guidance and separately attributed survey
and market pricing; a hike/hold/cut alone is not a directional signal. Components
of one release package are not independent votes. Do not invent consensus,
institutional flows, probabilities, pips or returns. Distinguish observed,
reported and inferred demand. No single currency verdict establishes strength
against all seven counterparts.
Before weighting a release, identify the bank's current stated policy concerns and
the active underlying inflation/services, wage/labour and activity evidence, even
outside the selected day. Follow the skill's causal-weighting check: explain why
the new information dominates or offsets those foundations. Do not substitute
recency, component counts, nominal credit amounts or a universal indicator ranking
for policy relevance. A minor release's potential impact need not reverse the
whole currency verdict. Saved/archived research is context, not proof of coverage;
reuse valid sources and fill decisive omissions before claiming a completed review.

During broad research cover policy/path, inflation, labour/wages, activity and
material fiscal, trade, funding, energy, haven and geopolitical developments in
the requested period. Read the saved interval, fill intervening gaps and record
new findings once. No item quota or forced new verdict when decisive evidence is
missing. Preserve old active foundations with their original dates and record
what now offsets, reinforces or supersedes them. Last Assessed and evidence age
are different clocks; neither a fresh retrieval nor a new save makes old news new.
For repeat assessments, use the skill's efficient refresh workflow: check changes
for every requested currency, reuse valid dated foundations/shared sources and
investigate material changes or gaps deeply. Do not rebuild unchanged research or
let a failed publisher consume the review. Broad scope and contrary-news checks remain.

Immediately check just-elapsed/imminent material stages and overnight remarks,
then the relevant next seven days (or longer holding horizon). USD includes
Treasury auctions, buyback announcements/windows/results and relevant Fed/NYFed
operations; offered amounts are not accepted amounts or evidence of QE. Official
schedules and dated reporting take priority over incomplete broker coverage.
Broker/web forecasts can differ by definition, provider and capture time; keep
both attributed and preserve raw observations. Unknown hours remain unknown.
Bound failed retrievals and disclose the exact gap instead of claiming full coverage.
A supported first verdict must not wait for unrelated research or bookkeeping.

### Thesis and summaries

Requested broad research and existing live-summary refreshes have standing save
permission, unless read-only/chat-only/no-save. Use `thesis research-append`; save
verified developments with currency implications and effects on the existing
thesis, plus full or focused currency assessments. The ledger deduplicates stable
keys, freezes evidence versions and preserves corrections. Entry opportunities
are optional. Do not force a same-day window or copy a prior entry forward.

Currency verdicts are standalone Strong / Moderate / Slight strengthening or
weakening pressure on one shared qualitative scale, with horizon and material
opposition. The product is potential impact: event/development → currency
strengthening/weakening → intensity → causal reason. Do not require realised flows,
live pricing or certainty. Compare same-direction currencies over overlapping
horizons and explain relative dominance; equal grades trigger comparison rather
than end it. See the skill's shared scale; do not fit grades to a chart. Known
opposition calls for judgment, not Review needed. Reserve a missing-fact gap for
genuinely unavailable decisive information, limiting only the unsupported claim.
This is not a numeric score, index measurement or private positioning data.

A focused release refresh saves affected currencies and explicit gaps; it does
not trigger a new full eight-currency investigation. A broad invocation covers
all eight. Preserve unresearched rows and identify material due/unfinished reviews.
Resolve elapsed checkpoints using actuals and subsequent guidance before choosing
the next material stage. Shared deadlines need a specific transmission channel
for each currency. Alarms and date navigation perform no research, advance no
clock and never reverse or renew a verdict automatically.
The static Jakarta Last Assessed header means the latest completed, saved live
research pass, with row gaps and focused scope preserved. An older evidence anchor
is acceptable when no newer significant finding exists; age alone does not require
a new event, changed direction or Review needed. Do not refresh that header for
a reload, initial scan or save without completed assessment work.

Thesis contains dated developments, assessments and upcoming checkpoints. Keep
publication/event/verification/recorded clocks separate. Historical reconstructions
never replace the live summary. Read back the saved range and live summary.
Earlier currency reviews, July currency reconstructions and user trade notes remain
intact. Do not recreate deleted pair journals through the Thesis UI; legacy CLI
interfaces remain available for explicit compatibility requests.

### Alert, External Sources and saved studies

Saving research does not require pinning or arming every finding. Reuse exact
calendar broker/value IDs or External Source keys when useful. Research remains
in Thesis; outside-feed events needed in Alert/chart belong in
[External Sources](docs/EXTERNAL-SOURCES.md), never invented MT5 readings. Assess
Trade Now has standing permission to pin/restore verified relevant occurrences,
request dated chart icons and select a few significant future Invoke reminders.
Preserve explicit off choices, global pause and offset. Follow
[Alert and alarms](docs/EVENTS-ALARMS.md); verify exact keys, armed state and worker
health at `/alarm-api/alarms` or `http://127.0.0.1:8003/alarms` before claiming delivery.
No recurring monitor or automatic AI invocation is implied.

External CLI writes require `external preflight` and guarded CLI mutations; never
bypass compatibility checks with direct Python shared-store writes. Verify pins
and chart requests after writes. Full Highlight research journals and AI impact
labels keep their explicit-request rules under [Highlight journal](docs/HIGHLIGHT-JOURNAL.md).
Impact is agent-authored for the exact occurrence, never inferred from MT5 importance.
A discovery receipt is a supported diagnostic/audit helper; its existence is not
proof of complete news coverage and is not a prerequisite for a Thesis save.

For requested historical-release investigations, standing authorization permits
pinning the relevant past occurrences, saving sourced studies and archiving them.
Keep upcoming candidates active and reuse existing candles/studies when appropriate.
A prompt-only request defers new research: save templates when requested without
manufacturing a pre-release conclusion. Archive/restore preserves identities,
versions and evidence; no automatic archival of unrelated records.

### Dataset commands

Run from the Lite root; `pnpm analyst` uses the existing bridge Python with no
new dependencies or API key. Calendar reads use a read-only SQLite snapshot
including WAL, work offline, and never change observations. Use `--help` on any
subcommand for options. Use `status` only when source/availability is unknown.

```powershell
pnpm analyst status
pnpm analyst reports
pnpm analyst highlights
pnpm analyst highlights --broker Elev8-Demo2 --summary --match CPI
pnpm analyst highlights --highlight-id "<pinned-id>" --summary
pnpm analyst journal read "<pinned-id>" --broker Elev8-Demo2 --scope EURUSD
pnpm analyst upcoming --broker Elev8-Demo2 --scope all --days 90 --category policy --category inflation --category labor
pnpm analyst report latest
pnpm analyst report latest --match "CPI|Interest Rate" --currency USD --limit 30
pnpm analyst report latest --summary --event-id 840030006
pnpm analyst report latest --section context --match CPI --offset 30
pnpm analyst calendar --broker Elev8-Demo2 --scope EURUSD --from 2026-09-11 --to 2026-09-11 --zone UTC --match CPI --currency USD
pnpm analyst calendar --broker Elev8-Demo2 --scope EURUSD --from 2026-09-09 --to 2026-09-17 --context-days 90 --export --name "September backdrop"
pnpm analyst ohlc --pair EURUSD --timeframe M1 --from 2026-09-11T11:30:00Z --to 2026-09-11T15:00:00Z --event 2026-09-11T12:30:00Z --report latest
pnpm analyst ohlc --input "<saved OHLC path>" --event 2026-09-11T12:30:00Z
```

`report` accepts `latest`, a report folder, or a brief path inside Lite. Old
full-table Markdown and flat reports remain readable; ambiguous filenames need
an explicit path. A folder resolves to `brief.md`; `latest` ignores analyst notes.
Index names are previews. `--match` (case-insensitive name/ID;
`|` means alternatives) or `--rows` returns full readings. `--section` is
selected/context/all; report-only `--from/--to` narrow dates. Output defaults to
20 items, maximum 500; follow `next_offset` with `--offset`. Pagination and focus
only narrow returned text: exports preserve every series for the selected pair
and dates plus preceding context, regardless of chart/Alert filters.
`--summary` returns compact readings without raw transport metadata or repeating
the brief. Use full `--rows` for provenance. Repeat `--event-id` for exact series
IDs when source names differ. Highlight reads `Market Analyst Workflow/highlights.json`
and the current SQLite values directly, including after release, without a running
storage service. `--highlight-id` focuses one pinned occurrence. Countdown output
is a query-time snapshot; requery when needed.

Calendar dates are inclusive display days; default UTC. `Asia/Jakarta` and fixed
`UTC+07:00` offsets need no timezone packages; other IANA zones need runtime zone
data. Date-only schedules retain source dates. Default database is Lite's
`storage/data/calendar.sqlite3`; `--database` selects another file inside Lite.
Coverage, capture/revision, availability and raw gap clocks remain explicit.

OHLC needs the running bridge or saved `--input` evidence, with explicit UTC
instants. Verify the release time from official sources first. The helper uses
an interprocess bridge lock: request M1/H1 sequentially, never in parallel.
With `--report`, complete saved windows for that report's broker are reused
automatically, retaining their capture time; `--refresh` forces a new capture.
An incomplete/live window is fetched again. Superseded requests get one bounded
retry; do not restart the bridge to work around conflicts. The helper uses
bounded positional seeking and overlapped paging, validates broker/generation,
and converts historical server clocks. Elev8-Demo2 has the verified EET/EEST
profile and Pepperstone-Demo has the US/New York-close profile for 2014–2031;
unregistered brokers need a verified historical
`--broker-offset-seconds`. Today's offset is insufficient; DST ambiguity fails.
M1 reactions need a complete prior minute and every completed minute in a window;
missing/forming bars yield unavailable measurements. JPY-quote pips are 0.01,
others 0.0001. Session/history gaps, requested edges and capture time stay visible.
Use H1 for broad intervals, `--symbol` for broker suffixes and `--bridge` for an
alternate endpoint (default port 8001). Limits: 50,000 slots, 32 OHLC requests
(default), up to 64 with `--max-requests`; bound failures never silently truncate.

Each new export creates `Market Analyst Workflow/report/<name>-<timestamp>/`
with `brief.md` and complete `evidence.tsv`. Share the brief path. New OHLC can be
saved beside a specific brief with `--report <path-or-folder>` (or `latest` only
when it is the intended report); otherwise it gets its own candle folder.
`--input` reuses evidence offline without moving it. Reports are Git-ignored,
never overwritten, and source notes are kept separate from analyst conclusions.
