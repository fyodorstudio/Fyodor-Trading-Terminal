# Fyodor Trading Terminal Lite

Market Watch, chart/drawings, raw calendar Inspector, upcoming Alert, Activity and
Settings, including agent-authored fundamental research journals and an archive
under Highlight. Research is produced in the market-analyst session; the terminal
may display saved research and provide occurrence-specific Copy Prompt actions.
No scoring, Notebook, Scatter Plot, Fundamental Settings, Roofs, Raycaster, Candy
or Workspace backup UI belong here. Keep the copied bridge unchanged.

Read only task-relevant owners. README.md covers commands/ownership;
docs/DATA-CONTRACT.md covers calendar, clocks and recovery. Keep docs short.
Preserve currency-shared Inspector family selections, Save/Cancel and persistence, all eight currencies/28 pairs,
all series, date-only timing, unknown-ID admission, blank-chart dismissal, the
shared date viewport, future axis and saved drawing interactions.

Keep polling clocks local, unchanged data/callback identities stable and viewport
work batched by animation frame. Cancel listeners/timers and stale replies.
Run frontend suites sequentially. For dependency/extraction changes use pnpm test,
pnpm lint, pnpm build and pnpm check:repo. Performance changes need deterministic
work counts and an assembled-terminal regression. Preserve storage/data.
Leave visual audits to the user: no browser automation, computer-use or screenshot
inspection without an explicit request.

## Market analysis

Work only in this Lite repo. Explain interpretation in the analyst conversation;
saved, agent-authored Highlight journals are also in scope. Keep journal records
separate from raw calendar observations; do not add currency scoring or change
calendar observations. The user can ask
“Explain EURUSD around September 11 US CPI” or “Use my latest report to prepare
the next Fed decision.” The [user manual](<user manual.md>) covers learning and
all eight currencies; read it only when relevant. Helper code and personal report
folders live together under `Market Analyst Workflow/`.

### Research and explain

- Infer the pair, dates and horizon from the request/report. Separate the initial
  release reaction, following session, multiweek backdrop and upcoming scenarios.
  One currency alone does not establish measured strength against every other.
- Read the brief first, query focused evidence, then check the broader release
  index for overlooked developments. Use H1 for broad price history and short M1
  windows for releases. Reuse saved candles. Do not dump the inventory or catalog.
- When the user refers to Highlight, start with `pnpm analyst highlights`; use
  its pinned ID, broker and timeline to identify the occurrence, then query its
  current readings with `--summary`. Recheck values after publication. Pins are
  preserved after release; only the user decides when to archive them.
- For policy events distinguish the decision, statement, projections and press
  conference times before measuring a move. Verify missing stages against the
  official schedule; do not anchor a press-conference move to the earlier decision.
- Browse for financial conclusions. Prefer official releases, decisions,
  projections and press conferences for facts. Use dated market reporting and
  identified futures/OIS pricing for contemporaneous expectations and reactions.
  Research both currencies and material off-calendar developments for a pair.
- Broker forecasts and web surveys can differ in provider, sample, methodology,
  definition and capture time. Attribute them separately; a difference alone is
  not a feed error. Never overwrite or blend forecasts. Survey consensus and the
  policy path priced into markets are different evidence; unknown providers stay
  unknown. Official statistics alone do not establish consensus.
- Explain changes in the expected rate path and the bank's current concern.
  Headline/core/components form one release package, not independent votes.
  Do not sum signals across weeks: later information can change the backdrop.
  Include both currency stories and the strongest counterevidence.
- Verify release-day vintages: stored data can contain later revisions. Do not
  treat later minutes/data as information available at the event. Label
  retrospective evidence. Upcoming simulations use only their chosen as-of time.
- Measure price from the complete pre-release candle; separate initial and
  sustained windows and call out reversals. OHLC cannot establish intrabar order,
  executable fills or a single headline's causal effect. Separate measured moves
  from plausible explanations and unresolved attribution.
- Lead with strength/direction and confidence in words, or “mixed/no clear edge.”
  Explain the main mechanism simply: “Rates stay unchanged today, but the future
  looks higher than previously thought.” Avoid scores, invented probabilities or
  guaranteed entries. Usually a few paragraphs or one small scenario table suffice.
- For upcoming events give backdrop, attributed expectations and conditional
  stronger/in-line/weaker or hike/hold/cut outcomes including guidance. Explain
  what supports/invalidates the view; refresh expectations near release and the
  other currency's backdrop before translating it into a pair view.
- Cite direct web links beside claims and absolute local evidence paths. Answer
  in chat; save conclusions only when requested, beside the relevant report with
  a research-as-of time. Preserve user notes/evidence. No trades, account changes,
  service restarts or messages to others are implied by a research request.

### Highlight journal and archive scope

- Read relevant saved journal entries and archived investigations when available.
  Treat earlier conclusions as dated context; refresh expectations, material
  developments and both currencies before issuing a new pair view. Start with
  `highlights`, then focused `journal read`; use `--visibility all` for history.
  [Journal workflow](docs/HIGHLIGHT-JOURNAL.md) documents schemas and commands.
  For upcoming-event shortlist requests, use the repository's
  [review-upcoming-alerts skill](.agents/skills/review-upcoming-alerts/SKILL.md).
- Keep before-release research separate from after-release interpretation. Show
  the research-as-of time, currency/pair scope, direction and confidence, backdrop,
  attributed expectations, strongest counterevidence and relevant prior release.
  After release, assess actuals, revisions and components against the preserved
  expectations, then report initial and sustained price reactions separately.
- Preserve append-only research versions, captured readings, release vintages
  and direct web/local evidence references. Corrections append a labelled update.
  Journal text is read-only in the UI and written through the agent interface;
  preserve user notes separately. Saving research still requires a user request.
- Archive removes an occurrence from the active shortlist while preserving its
  identity, broker, timing, research versions and evidence; support restoration.
  Keep fundamental interpretation, price reaction and any user-provided trade
  outcome separate. Do not infer account access or trading authorization.
- Copy Prompt identifies the exact Highlight occurrence, broker, time/timezone,
  chosen currency/pair and relevant prior investigation. It requests fresh evidence
  and separates fundamental direction from price reaction. An elapsed release
  time is not proof actuals have arrived. Recommend upcoming candidates by policy
  relevance and new information; pin/archive only with user authorization.

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
profile for 2014–2031; other brokers need a verified historical
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
