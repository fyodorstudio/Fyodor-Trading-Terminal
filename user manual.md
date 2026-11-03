# Research workflows

For the usual refresher, open Currency News, choose All or a currency, select a
lookback (three hours by default), and Copy refresh prompt. Paste it into your
agent chat. The agent verifies sources and saves the researched currencies.
The panel reads the saved output automatically while open. Reload saved news
only reloads local results; it does not run research.

The date revolver opens on Today. Each currency row shows its own latest saved
refresh for that Jakarta date. Select an earlier refresh inside a row without
changing the others. Empty dates still show the prescribed table. All/currency
buttons filter the same records and never request duplicate research. Only Today
offers the lookback and live refresh prompt; past/future dates are browsing only.
Export Markdown downloads the selected date, currencies and row versions. Saved
history is local ignored data included in storage backups.

Examples:

- `Use $assess-trade-now to refresh all eight currencies from the last 3 hours.`
- `Use $assess-trade-now for fresh CAD news from the last 3 hours.`
- `Use $assess-trade-now for USD news, chat only, no save.`

Each row distinguishes publication time, the check time, material coverage gaps,
and a qualitative implication with its reason. Older background is separately
labelled. No qualifying fresh story is a valid result. Aging means the saved
check is older than its own window; it does not automatically reverse its sign.
A currency implication is not a trade instruction or strength against every peer.
Changing the lookback affects the next prompt, not existing saved evidence.

| Optional skill | Use |
| --- | --- |
| [One Minute Before Release](.agents/skills/one-minute-before-release/SKILL.md) | Wait in this chat for a named imminent release, verify fresh actuals, then interpret the relevant currency. |
| [Review Historical Research](.agents/skills/review-historical-research/SKILL.md) | Investigate a named historical move using a date-range brief, calendar, dated news and H1/H4 candles. |

News refreshes do not change reminders or fetch current technicals. Calendar
Alert bells, manual price alerts, Entry Trade and chart drawings stay independent.
The [news contract](docs/CURRENCY-NEWS.md) owns persistence and timing.
[Short research rules](docs/RESEARCH-RULES.md) and focused reviewed lessons retain
prior failure context; full original records are [archived](docs/RESEARCH-ARCHIVE.md).
