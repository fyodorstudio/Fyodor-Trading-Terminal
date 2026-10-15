# Fyodor Trading Terminal Lite

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

Keep polling clocks local, unchanged data/callback identities stable and viewport
work batched by animation frame. Cancel listeners/timers and stale replies.
Run frontend suites sequentially. For dependency/extraction changes use pnpm test,
pnpm lint, pnpm build and pnpm check:repo. Performance changes need deterministic
work counts and an assembled-terminal regression. Preserve storage/data.
Leave visual audits to the user: no browser automation, computer-use or screenshot
inspection without an explicit request.

## Market analysis

Outside-feed events/headlines/watch items belong in **External Source** records,
not invented MT5 calendar readings. The Alert dock's **Highlight** view
combines active pins from MT5 Calendar and External Source without merging their
storage or occurrence identities. Active external records are pinned; archive/restore
preserves their immutable history and alarm choices. For the
requested pair/currencies, query `pnpm analyst external --scope EURUSD` (use
`--visibility all` for historical work), with focused dates/match and complete
pagination. Treat saved interpretation as dated context, verify fresh news and
both currency stories, and distinguish event/provider/publication/recorded clocks.
The collection is not a complete live news feed. When saving outside events is
authorized, use the [External Sources workflow](docs/EXTERNAL-SOURCES.md); preserve
versions, timing uncertainty and raw data. No ingestion/monitoring is implied.

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
  index for overlooked developments. Only for explicitly requested historical
  price investigations, use H1 for broad history and short M1 windows for releases;
  reuse saved candles. Do not dump the inventory or catalog.
- For a Research Date Range report or named historical price move, use the
  [review-historical-research skill](.agents/skills/review-historical-research/SKILL.md).
  A broad OHLC check is mandatory: H1 by default, or H4 when cheaper and adequate
  for the question. Narrow windows only when timing needs them; H4 cannot establish
  exact release reactions. Keep before/at/after information sets separate.
- Upcoming preparation and live/release-time assessment must not fetch or analyze
  candles/OHLC, including saved candles, charts or technical indicators. Use calendar
  readings, saved fundamental research and current web evidence; skip prior price
  reaction sections. Candle analysis is reserved for historical price investigations
  explicitly requested by the user. For a quick pair/Highlight assessment use the
  [assess-trade-now skill](.agents/skills/assess-trade-now/SKILL.md).
- Quick assessments follow that skill's focused evidence pass: reuse already
  loaded instructions and dated fundamentals, query only the requested pair or
  exact Highlight (all eight currencies only on request), batch independent
  checks and bound failed-source retries. For an explicit imminent-release wait,
  use [one-minute-before-release](.agents/skills/one-minute-before-release/SKILL.md)
  to reuse prepared context, verify the clock/schedule and await fresh actuals
  within a stated deadline. Prepare direct retrieval routes and decisive fields
  beforehand; send a short sourced first verdict in commentary once supported,
  then the full decision card in the same active turn. Separate observed data/
  interpretation/send timestamps without promising second-level latency.
  No automatic timer is implied by preparation.
  Include the mandatory Extreme-move risk row. A pending release does not by
  itself force a general pair assessment to wait; explain the setup-specific
  reason. Verify material gaps or disclose them without guessing.
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
  A higher rate or a hike alone does not establish currency strength. Compare
  the decision and projected pace/peak/duration with prior guidance and separately
  attributed expectations/pricing: an expected hike with a slower future path
  can weaken a currency, and a less dovish cut can strengthen it. Explain the
  dominant surprise and counterpart; do not assume either reaction mechanically
  or claim something was priced in without evidence.
  Headline/core/components form one release package, not independent votes.
  Do not sum signals across weeks: later information can change the backdrop.
  Include both currency stories and the strongest counterevidence.
- Verify release-day vintages: stored data can contain later revisions. Do not
  treat later minutes/data as information available at the event. Label
  retrospective evidence. Upcoming simulations use only their chosen as-of time.
- In requested historical price investigations, measure from the complete
  pre-release candle; separate initial and
  sustained windows and call out reversals. OHLC cannot establish intrabar order,
  executable fills or a single headline's causal effect. Separate measured moves
  from plausible explanations and unresolved attribution.
- Requested historical price studies use the first 15 minutes, through two hours, the
  rest of the trading day and the next 3–5 trading sessions. Two hours is a
  checkpoint, not a conclusion. Use M1 initially, M15/M30 for the intraday path
  and H1 for follow-through; report extrema, giveback, baseline crossings and
  reversals at the available candle resolution. Keep gaps explicit.
- Emphasize intervening news: use the Research Date Range brief and complete
  calendar evidence, check both currencies beyond visible chart filters, and
  browse dated reporting for material off-calendar developments. Name the time,
  source, information and possible effect on the original thesis. Separate later
  releases and policy stages using their own pre-release baseline; an overlapping
  window or a news article's publication time does not establish causal timing.
- Lead with the best-supported buy/sell direction and confidence in words, even
  when the lean is slight. The user prefers a weak bias to an undifferentiated
  “no clear edge”: distinguish backdrop direction, a fresh release signal and
  entry quality. An in-line release can preserve a weak bias. Do not invent a
  direction when verified evidence is balanced or a decisive gap prevents it.
  Explain the main mechanism simply: “Rates stay unchanged today, but the future
  looks higher than previously thought.” Avoid scores, invented probabilities or
  guaranteed entries. Usually a few paragraphs or one small scenario table suffice.
- For upcoming events give backdrop, attributed expectations and conditional
  stronger/in-line/weaker or hike/hold/cut outcomes including guidance. Explain
  what supports/invalidates the view; refresh expectations near release and the
  other currency's backdrop before translating it into a pair view.
- Every pair assessment includes a fundamental holding/exit watchlist covering
  at least the next seven calendar days from its as-of instant, or a longer
  requested holding horizon. Verify both currencies' material news and policy
  stages and check off-calendar risks. Show user-facing times only in Asia/Jakarta
  AM/PM unless requested otherwise; retain UTC internally for evidence and clocks.
  Explain what merely adds
  volatility, challenges or invalidates the thesis, and when to consider reducing/
  closing before news or reassessing/closing after verified contrary information.
  Do not turn the scan horizon into a forecast or recommend closing before every
  major release. If complete checked coverage finds no material scheduled threat,
  say so with the window/source limits and remaining specific unscheduled risks;
  disclose gaps instead of declaring an all-clear. Agents assess fundamentals
  and macro only; technical entries/exits and risk management remain with the user.
  Near release, reuse the prepared watchlist and refresh changes. Defer detailed
  upcoming forecasts until preparation; historical research is dated context.
- When a bias is weak, entry evidence insufficient, or waiting warranted, include
  a Next opportunity: the next material event that could establish, strengthen
  or reverse the direction, its verified Jakarta AM/PM release time, and a suggested
  return/preparation time, normally ten minutes before publication. Explain why
  its new information matters; do not promise a bigger move. Use the pair's
  seven-day scan, distinguish opportunity from exit risk, and state missing
  candidates/timing honestly. Historical suggestions use only what was knowable
  at the cutoff. A return-time recommendation does not schedule a notification.
- Cite direct web links beside claims and absolute local evidence paths. Answer
  in chat; save conclusions only when requested, beside the relevant report with
  a research-as-of time. Preserve user notes/evidence. No trades, account changes,
  service restarts or messages to others are implied by a research request.

### Highlight journal and archive scope

- Alert automatically prepares 10-minute and 1-minute reminders for
  active timed Highlights and confirmed scheduled External Sources. Research and
  pin/save in the appropriate collection; do not duplicate Windows Clock alarms.
  Date-only/unverified hours never imply an alarm time. Check `/alarm-api/alarms`
  (or loopback `http://127.0.0.1:8003/alarms`) before claiming reminders are running;
  the worker must be healthy and enabled. This does not schedule an AI invocation.
  [Alarm contract](docs/EVENTS-ALARMS.md) covers runtime and delivery limitations.

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
  expectations. Preparation and live interpretation omit price reaction; measure
  it separately only for an explicitly requested historical price investigation.
- Preserve append-only research versions, captured readings, release vintages
  and direct web/local evidence references. Corrections append a labelled update.
  Journal text is read-only in the UI and written through the agent interface;
  preserve user notes separately. Saving research still requires a user request.
- Archive removes an occurrence from the active shortlist while preserving its
  identity, broker, timing, research versions and evidence; support restoration.
  Keep fundamental interpretation, price reaction and any user-provided trade
  outcome separate. Do not infer account access or trading authorization.
- Standing user authorization for requested historical-release studies: pin
  relevant available past occurrences, save their sourced investigation and
  archive them. Keep the upcoming shortlist active. Read archived findings and
  reuse complete saved candles before repeating research; refresh dated
  expectations, revisions or unresolved evidence when the new question needs it.
- Copy Prompt identifies the exact Highlight occurrence, broker, time/timezone,
  chosen currency/pair and relevant prior investigation. It requests fresh evidence
  and separates fundamental direction from price reaction. An elapsed release
  time is not proof actuals have arrived. Recommend upcoming candidates by policy
  relevance and new information; pin/archive only with user authorization.
- For prompt-only requests, defer new macro/web/OHLC investigation. Store separate
  preparation and after-release templates with `prompt save`; do not manufacture
  Before release research. Same-day/hour-before investigation refreshes expectations
  and saves conditional scenarios; direction after actuals needs a post-release check.
  Persist verified schedule/data issues through `limitations append` for the
  Discovered Limitations view. Preserve raw data and report missing occurrences.

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
