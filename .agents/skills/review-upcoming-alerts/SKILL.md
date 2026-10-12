---
name: review-upcoming-alerts
description: "Review Fyodor Trading Terminal Lite's upcoming economic releases and recommend a focused Highlight shortlist using current macro evidence, central-bank concerns and market expectations. Use for deciding which releases to watch or pin across currencies or pairs, rather than interpreting one already-published release."
---

# Review Upcoming Alerts

Use the Lite repository's calendar and saved research to identify releases worth
investigating. The output is a research shortlist, not a prediction of a large
candle or an entry signal. Keep judgments current rather than embedding dated
macro conclusions or a permanent event ranking in this skill.

## Navigate the existing evidence

Work from the Lite root and follow AGENTS.md. Read the relevant brief/journal before
expanding research. README.md identifies owners; docs/HIGHLIGHT-JOURNAL.md documents
upcoming, journal and lifecycle commands. The relevant currency section of
`user manual.md` is a starting shortlist, not a substitute for the current backdrop.

Start with `pnpm analyst highlights` to identify the broker, existing pins and
research scopes. Inspect focused `journal read` entries and `highlights --visibility
all` when earlier/archived investigations matter. IDs identify exact broker
occurrences; names alone do not distinguish monthly repeats.

Use the requested horizon/pairs. If unspecified, scan the next 90 days across all
eight currencies, concentrate near-term recommendations on the next few weeks,
and maintain later major releases as a provisional watchlist. For example:

```powershell
pnpm analyst upcoming --broker Elev8-Demo2 --scope all --days 90 --category policy --category inflation --category labor --limit 40
pnpm analyst upcoming --broker Elev8-Demo2 --scope AUDUSD --days 30 --family au-cpi --family au-labor --family rba
```

Use the actual stored broker. Follow every next_offset with --offset for complete
coverage; narrow subsequent queries by family, pair, currency or dates. Summarize
the returned index instead of dumping inventories or full readings for hundreds
of releases. Broaden to growth/activity and off-calendar developments when they
could change the central bank's concern. No browser/UI automation is needed.

## Establish why an event matters now

For each currency being recommended, verify the latest policy stance and relevant
subsequent developments using official sources. Use dated reporting and identified
futures/OIS pricing for expectations. An unchanged rate can accompany a changed
future path. A survey forecast, a bank projection and market pricing are distinct.

Ask what new evidence could change that path: persistent underlying inflation,
wages, employment/slack, demand, or guidance. Examine the complete release package
and its strongest counterevidence. Distinguish an initial/flash release from a
later final estimate and account for what earlier data already revealed. Promote
a normally secondary release only when the present macro concern warrants it.

Verify official dates, timezones/DST and policy stages. Cross-check publisher
schedules for major releases absent from the feed: complete stored coverage does
not prove the broker lists every series or future occurrence. Label missing values,
unverified hours and schedule disagreements; never invent IDs or change calendar
observations. Keep broker forecasts and web surveys separately attributed.

For a pair-specific suggestion, research both currencies and material competing
events. Identify nearby releases that can overturn the setup and separate policy
decisions, statements, projections and press conferences. A broad USD event may
matter to several pairs; that does not make every cross a suitable trade.

Prior OHLC may help assess initial versus sustained reaction or reversals, using
saved evidence first. It is optional for a shortlist; do not fetch candles for
every event or present past volatility as a promise of future volatility.

## Deliver an actionable shortlist

Use plain decisions such as **pin now**, **watch/review nearer release**, and
**lower priority**, with event/date, relevant currency or pair, current evidence,
why a surprise could matter, and what would weaken the case. Identify already
pinned occurrences and avoid recommending duplicates. Include direct web citations
and local evidence paths. Explain material gaps in the 90-day schedule.

Separate policy relevance and possible volatility from fundamental direction and
entry quality. Give qualitative confidence and uncertainty; do not invent scores,
probabilities or guaranteed entries. Later-month recommendations need a fresh
backdrop and expectations check near publication.

Recommend first. Pin/archive/restore only when the user authorizes those actions.
When authorized, use the documented CLI with exact source/value IDs, verify the
result and preserve prior journals. Save Before release research only when
requested, including an occurrence-specific Copy Prompt. A request to review
alerts does not authorize trading, service restarts or recurring monitoring.
