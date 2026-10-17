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
requested pair/currencies, saved outside-feed context can be queried with
`pnpm analyst external --scope EURUSD` (`--visibility all` for history), using
focused dates/match and complete pagination when consulted. Quick assessments
are web-first; local datasets and journals are optional unless explicitly requested. Treat saved interpretation as dated context, verify fresh news and
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
- For requested historical price investigations, read the brief first, query
  focused evidence, then check the broader release index for overlooked developments. Only for explicitly requested historical
  price investigations, use H1 for broad history and short M1 windows for releases;
  reuse saved candles. Do not dump the inventory or catalog.
- For a Research Date Range report or named historical price move, use the
  [review-historical-research skill](.agents/skills/review-historical-research/SKILL.md).
  A broad OHLC check is mandatory: H1 by default, or H4 when cheaper and adequate
  for the question. Narrow windows only when timing needs them; H4 cannot establish
  exact release reactions. Keep before/at/after information sets separate.
- Upcoming preparation and live/release-time assessment must not fetch or analyze
  candles/OHLC, including saved candles, charts or technical indicators. Use current
  web evidence as the primary source, with optional calendar readings and saved
  fundamental research; skip prior price reaction sections. Candle analysis is reserved for historical price investigations
  explicitly requested by the user. For a quick pair/Highlight assessment use the
  [assess-trade-now skill](.agents/skills/assess-trade-now/SKILL.md).
- Quick assessments use the [assess-trade-now skill](.agents/skills/assess-trade-now/SKILL.md):
  research the requested currencies thoroughly on the web, including off-calendar
  catalysts; local datasets are optional. Reuse loaded guidance, batch independent
  checks and bound failed-source retries. For an explicit imminent-release wait,
  use [one-minute-before-release](.agents/skills/one-minute-before-release/SKILL.md)
  with prepared retrieval routes, verified timing and a stopping deadline. Send a
  short sourced first verdict when supported, then the compact assessment in the
  same turn. Distinguish data/observation/send clocks; no automatic timer or
  second-level response promise is implied. A pending event alone does not force
  a general pair thesis to wait. Disclose decisive gaps without guessing.
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
- Present assessments in the skill's compact [output format](.agents/skills/assess-trade-now/SKILL.md#output-format):
  assessment date/as-of time and horizon, pair verdict with a one- or two-sentence
  dominant-driver thesis, **UPCOMING EVENTS THAT COULD CHANGE THE THESIS**, then
  **FUNDAMENTAL BACKDROP — RECENT & PRIOR**. Link decisive evidence beside the
  thesis. Any material recent-event bullets go newest first; upcoming events belong in their own section,
  earliest first, with verified Jakarta AM/PM times and the outcome that changes
  the thesis. Unscheduled risks follow timed events without invented dates.
  The backdrop is a compact category-by-currency table covering monetary policy
  (including guidance, projections and expected rate paths), inflation, labor/wages,
  growth/activity and other material drivers. Research each category for both
  currencies on the web, with MT5 optional. Cells show dated latest/prior evidence,
  age and a brief implication; multiple items go newest first. Older relevant
  evidence is Background, not automatically stale. Future releases remain in
  Upcoming. A reference month, capture or retrieval time is not the news date.
  Unknown times stay unknown; historical ages use the simulated cutoff.
  Use the backdrop table by default; keep thesis/Upcoming short. No mandatory
  entry-date declaration, eligibility gate, confidence boilerplate, separate risk checklist or repetitive conclusion.
  Research depth should not inflate the answer. Keep execution timing with the user.
  Old policy decisions alone are not fresh directional evidence. If fresh news
  reactivates an older story, explain the update alongside the thesis; age alone
  does not establish irrelevance or that an event was priced in.
- Assess continuation, a possible retracement and a changed thesis against fresh
  information, following Assess Trade Now's retracement guidance. A still-hot
  inflation backdrop can coexist with reduced near-term hike urgency. Do not
  preserve an earlier direction automatically or manufacture a contrary call.
  Check nearer policy remarks/Q&A, including overnight stages, before deferring
  reassessment to the next major data release; disclose when active coverage ends.
  Distinguish a one-off surprise from continuing pressure: later trading-partner
  news, global conditions or haven demand can support a recovery without the
  original bank changing course. Name verified contrary developments; do not
  assume profit-taking/short covering or use a reported chart trend as macro proof.
  For a date range extending into the future, separate dated developments, the
  current verdict and a conditional outlook; never present future news as known.
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
  Verify that a proposed catalyst preceded the move. When helpful in an explicitly
  requested historical cross study, compare the two USD legs to distinguish base
  recovery from quote weakness; do not infer trader motives from that arithmetic.
- Lead with STRONG BUY / BUY / MIXED / SELL / STRONG SELL and explain the dominant
  relative mechanism. A verified active catalyst can outweigh weaker opposing
  indicators; do not require unanimity, count releases as votes or default to
  slight/low-confidence wording. Domestic data need not improve for a currency
  to attract haven demand against a stressed counterpart. Fresh material opposing
  evidence or a decisive gap can reduce conviction; balanced evidence remains MIXED.
  Distinguish a strong directional thesis from precision about timing or move size.
  Never invent evidence, probabilities, pip forecasts or guaranteed returns.
- For upcoming events give backdrop, attributed expectations and conditional
  stronger/in-line/weaker or hike/hold/cut outcomes including guidance. Explain
  what supports/invalidates the view; refresh expectations near release and the
  other currency's backdrop before translating it into a pair view.
- Research material events and policy stages for both currencies over at least
  the next seven calendar days, or the longer requested holding horizon, using
  official schedules and credible calendars across all five backdrop categories.
  Include a later next policy/projection event when central to the thesis, marked
  outside the scan window. Attribute available expectations and explain how a
  surprise could change the mechanism, without inventing consensus. Show only thesis-changing candidates
  in the separate Upcoming section with concise conditional implications; this
  scan horizon is not a directional forecast or mandatory holding period. Check
  nearer remarks/Q&A, overnight stages and specific unscheduled shocks. Integrate
  material invalidation/holding considerations there, without recommending closing
  before every release. Disclose material schedule/source gaps. User-facing times
  are Asia/Jakarta AM/PM; keep UTC internally. Technical execution and risk
  management remain with the user. A suggested return time, when useful, belongs
  with the next decisive event and does not create a notification.
- Cite direct web links beside claims and absolute local evidence paths. Answer
  in chat; save conclusions only when requested, beside the relevant report with
  a research-as-of time. Preserve user notes/evidence. No trades, account changes,
  service restarts or messages to others are implied by a research request.

### Highlight journal and archive scope

- Alert automatically prepares one Invoke reminder two minutes before each timed stage for
  active timed Highlights and confirmed scheduled External Sources. Research and
  pin/save in the appropriate collection; do not duplicate Windows Clock alarms.
  Date-only/unverified hours never imply an alarm time. Check `/alarm-api/alarms`
  (or loopback `http://127.0.0.1:8003/alarms`) before claiming reminders are running;
  the worker must be healthy and enabled. This does not schedule an AI invocation.
  [Alarm contract](docs/EVENTS-ALARMS.md) covers runtime and delivery limitations.

- Read relevant saved journals and archived investigations when the task needs
  saved research; quick web-first assessments need not load them. Treat earlier
  conclusions as dated context and refresh both currencies. For requested Highlight
  research, start with `highlights`, then focused `journal read`; use
  `--visibility all` for history.
  [Journal workflow](docs/HIGHLIGHT-JOURNAL.md) documents schemas and commands.
  For upcoming-event shortlist requests, use the repository's
  [review-upcoming-alerts skill](.agents/skills/review-upcoming-alerts/SKILL.md).
- Keep before-release research separate from after-release interpretation. Show
  the research-as-of time, currency/pair scope and direct thesis, with attributed
  expectations and material counterevidence integrated concisely. Use the compact
  assessment format for chat; existing journal fields remain compatible.
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
