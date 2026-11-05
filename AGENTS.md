# Fyodor Trading Terminal Lite

## Route narrowly

Read this file, then the task-relevant owner in [README.md](README.md).
Core terminal: chart/drawings, Market Watch, raw calendar Inspector, calendar
Alert/reminders, Entry Trade, price alerts, Activity and Settings.
Currency Detail: `frontend/src/currency-details/`, `storage/currency_details.py`,
[Detail contract](docs/CURRENCY-DETAILS.md). Routine refresh starts with
`pnpm analyst details prepare --scope <currency|pair|index|ALL>`; reuse evidence
for News and Detail, preserving independent clocks and raw MT5 conflicts.

Currency News replaces the left Fundamentals panel and bottom Thesis. Owner:
`frontend/src/currency-news/`, `storage/currency_news.py`, and
[the news contract](docs/CURRENCY-NEWS.md). Research runs in the agent chat on
demand; the terminal displays saved results and copies scoped refresh prompts.
Prioritize newest material news and relevant earlier context without a fixed
lookback. Do not revive Thesis verdicts, pair rankings, D1 forecasts, outcome
scoring, checkpoint renewal or the automatic learning loop. Refresh only
researched currencies, preserving other clocks. Shared stories appear once with
currency-specific bullish/bearish implications; opposing mechanisms use explicit
bullish_if/bearish_if scenarios, not a bare Mixed label. Neutral is valid.
News Fundamentals contains source facts only; agent commentary belongs in
Implication. Material follow-ups get distinct stable story IDs and dated rows.
The date revolver filters by publication date. Date-only stories keep their date
and use last assessment time for sorting/age; wholly undated stories use the
assessment date. Assessment age never becomes an invented publication instant.
All/currency filters reuse records. Today alone offers the live refresh prompt.
Date and earlier-assessment browsing perform no research. Preserve immutable
history; do not routinely load raw archives during refreshes.

For current news use [Assess Trade Now](.agents/skills/assess-trade-now/SKILL.md).
Read [research rules](docs/RESEARCH-RULES.md), then the schema only when writing.
Every invocation also follows [global risk discovery](docs/GLOBAL-RISK-WORKFLOW.md):
ongoing risks and seven days ahead across currencies, prioritizing 48 hours.
Maintain sourced global custom stars/notices and new confirmed high-impact
reminders; preserve explicit off choices, pause, offset and existing chart hides.
Leave technical levels and price scans to the user unless explicitly requested.
Retrieve compact relevant lessons through `pnpm analyst news lessons --scope CAD`;
do not read full raw archives routinely. Historical investigations and imminent
release waits remain optional separate skills. Dataset work reads only the
relevant section of [AGENT-RESEARCH.md](docs/AGENT-RESEARCH.md).

## Preserve terminal behavior and data

Keep the copied bridge unchanged. Preserve all eight currencies/28 FX pairs and
all series, currency-shared Inspector family selections, Save/Cancel/persistence,
date-only timing, unknown-ID admission, blank-chart dismissal, shared date
viewport, future axis and saved drawing interactions. Display defaults to
Jakarta (UTC+07:00, AM/PM). Broker historical clocks come from
`config/broker-clock-profiles.json`; never guess old offsets from today's offset.
Publication UTC remains independent of chart-placement availability.

Calendar Alert, event Invoke reminders, manual price alerts and Currency News
are separate paths. News saves do not change alarms or chart markers. Keep one
bell per release package, high-impact-only agent curation through the skill, and
explicit off choices. Agent impact is sourced by exact broker/value IDs or an
external key; never substitute MT5 importance or another broker's rating.

Entry Trade is manual. Preserve user technicals, notes and edit history in the
tracked `Market Analyst Workflow/entry-trade/journal.json`. Event UTC controls
table dating; chart-clock arrow time is independent and may be in future space.
No completeness gate, trade execution, broker/account changes or automatic Git
commit is implied. Keep ignored storage, raw evidence and reminder choices.
Legacy research is preserved per [the archive note](docs/RESEARCH-ARCHIVE.md).
New generated payloads, logs and downloads belong in ignored `tmp/` or report
folders; do not add them to Git.

## Engineering and verification

Keep clocks local, unchanged data/callback identities stable and viewport work
batched by animation frame. Cancel listeners/timers and stale replies. Text,
including secondary labels, must remain readable in both themes. Research prose
uses normal spacing: `JPY 330 bn`, `GBP 3.9 bn`, `128 bp`, `November 4`.

Use terminal-based checks; leave visual acceptance to the user. No computer-use,
browser automation or screenshot inspection without an explicit request.
Run frontend suites sequentially. Focused suites:
`pnpm --dir frontend test -- currency_news` (multiple filename fragments allowed).
Dependency/extraction changes require `pnpm test`, `pnpm lint`, `pnpm build` and
`pnpm check:repo`. Performance changes need deterministic work counts and an
assembled-terminal regression.

Standing permission covers starting/restarting this checkout's local stack,
calendar storage and alarm worker, including `pnpm dev:all`, for verification.
Preserve stored data and alarm choices; no trades or account changes.
