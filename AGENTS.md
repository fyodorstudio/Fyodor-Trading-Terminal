# Fyodor Trading Terminal Lite

## Route narrowly

Read the task-relevant owner in [README.md](README.md), then only its relevant
contract. Engineering tasks do not automatically invoke research workflows.

- Ledger: `frontend/src/currency-ledger/`, `storage/currency_ledger.py`,
  [contract](docs/CURRENCY-LEDGER.md). Preserve eight shared histories, raw browsing
  versus scoring and historical cutoffs.
- Detail: `frontend/src/currency-details/`, `storage/currency_details.py`,
  [contract](docs/CURRENCY-DETAILS.md). Routine research starts with
  `pnpm analyst details prepare --scope <currency|pair|index|ALL>`.
- News: `frontend/src/currency-news/`, `storage/currency_news.py`,
  [contract](docs/CURRENCY-NEWS.md). Preserve facts versus implications, independent
  currency clocks, publication dating and history; do not revive retired workflows.
- Current-news research uses [Assess Trade Now](.agents/skills/assess-trade-now/SKILL.md),
  [research rules](docs/RESEARCH-RULES.md) and its [global risk workflow](docs/GLOBAL-RISK-WORKFLOW.md).
  Historical investigations and imminent release waits have separate skills.
  Dataset commands: [AGENT-RESEARCH.md](docs/AGENT-RESEARCH.md).

## Preserve behavior and data

Keep the copied bridge unchanged. Preserve all eight currencies/28 FX pairs,
original series/IDs, shared Inspector selections, Save/Cancel/persistence,
date-only timing, unknown-ID admission, blank-chart dismissal, date viewport,
future axis and drawings. Display defaults to Jakarta (UTC+07:00, AM/PM).
Historical offsets come from `config/broker-clock-profiles.json`, never today's
offset. Publication UTC remains independent of chart placement.

Alert, event reminders, price alerts and News remain independent. Preserve off
choices, pause, offsets, chart hides and one bell per release package. Exact
series tiers use `config/event-tiers.json`, never broker importance. News saves
do not change alarms or markers. Entry Trade stays manual; preserve user notes,
technicals and `Market Analyst Workflow/entry-trade/journal.json`. No trades,
account changes or automatic Git commits are implied. Preserve ignored storage,
evidence and reminder choices. Generated output belongs in ignored `tmp/` or
report folders. [Legacy archive](docs/RESEARCH-ARCHIVE.md) remains intact.

## Verification

Keep clocks local, unchanged data/callback identities stable, viewport work batched
by animation frame, and cancel listeners/timers/stale replies. Text must be
readable in both themes. Use normal spacing in research prose.

Use terminal checks proportionate to the change. Docs-only work needs repository/
link checks, not builds or full test suites. Run relevant frontend suites
sequentially: `pnpm --dir frontend test -- <filename-fragments>`. Dependency/
extraction changes require `pnpm test`, `pnpm lint`, `pnpm build`, `pnpm check:repo`;
performance changes need deterministic work counts and an assembled-terminal
regression. Repeat checks only after relevant changes/failures. Leave visual
acceptance to the user: no computer-use, browser automation or screenshot
inspection without an explicit request.

Standing permission covers starting/restarting this checkout's local stack,
calendar storage and alarm worker, including `pnpm dev:all`, for verification.
Preserve stored data and alarm choices.
