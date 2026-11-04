# Research workflows

For the usual refresher, open Currency News, choose All or a currency, and Copy
refresh prompt. Paste it into your agent chat. The agent prioritizes the newest
material developments, checks sources and saves the researched currencies.
There is no fixed lookback cutoff. Reload saved news only reloads local results.

The date revolver opens on Today and filters stories by publication date in
Jakarta. An older headline discovered today belongs to its original date.
Date-only stories show that date and an Assessed age, using last assessment time
for ordering. A wholly undated story uses the assessment date too. This does not
claim the story was just published. A single Last updated age shows when saved
content for the selected date last changed.

The feed has currency tags and sources, News Fundamentals, and Implication.
Shared stories appear once. Source facts stay in News Fundamentals; agent
reasoning and coverage caveats stay in Implication. Bias is bullish/bearish when
supported, or explicit bullish-if/bearish-if scenarios when mechanisms compete.
No direction is forced. Material follow-ups get their own dated rows.

All/currency buttons reuse the same records without running research. Scroll or
Show more news to load further rows. Where multiple assessments exist, select an
earlier one inside Implication; other currency views and story ordering stay
unchanged. Today alone offers the live refresh prompt and polls saved results.
Past/future dates are browsing only. Export Markdown downloads the selected date,
currencies and assessments, including rows beyond the current scroll batch.
History is local ignored data included in storage backups.

Examples:

- `Use $assess-trade-now to refresh all eight currencies, prioritizing the freshest news.`
- `Use $assess-trade-now for fresh CAD news and relevant policy context.`
- `Use $assess-trade-now for USD news, chat only, no save.`

A currency implication is conditional pressure, not a trade instruction or
strength against every peer. A failed source route is not proof of no news.

| Optional skill | Use |
| --- | --- |
| [One Minute Before Release](.agents/skills/one-minute-before-release/SKILL.md) | Wait in this chat for a named imminent release, verify fresh actuals, then interpret the relevant currency. |
| [Review Historical Research](.agents/skills/review-historical-research/SKILL.md) | Investigate a named historical move using a date-range brief, calendar, dated news and H1/H4 candles. |

News refreshes do not change reminders or fetch current technicals. Calendar
Alert bells, manual price alerts, Entry Trade and chart drawings stay independent.
The [news contract](docs/CURRENCY-NEWS.md) owns persistence and timing.
[Short research rules](docs/RESEARCH-RULES.md) and focused reviewed lessons retain
prior failure context; full original records are [archived](docs/RESEARCH-ARCHIVE.md).
