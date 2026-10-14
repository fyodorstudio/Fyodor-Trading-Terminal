---
name: review-upcoming-alerts
description: "Review upcoming economic releases for a Highlight shortlist or a pair trade's fundamental exit/reassessment watchlist, using current macro evidence, central-bank concerns and expectations. Excludes candle analysis and release-time interpretation."
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

Also query the separate `pnpm analyst external --scope <pair-or-currency>`
collection for sourced missing events and unscheduled watch items. Follow its
[workflow](../../../docs/EXTERNAL-SOURCES.md) and pagination; refresh dated
interpretations and source schedules. Cross-check relevant official schedules
and fresh headlines beyond the broker feed. An empty collection/calendar is not
proof that no material news exists. Keep verified upcoming times, published
headlines and untimed risks distinct. Save verified outside-feed records only
when requested, without mixing them into Highlight or calendar observations.
Neither a saved icon/record nor this review provides live headline monitoring.

For a pair trade's holding/exit or next-opportunity question, use the focused mode below. For a
standalone shortlist, use the requested horizon/pairs. If unspecified, scan the
next 90 days across all
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

Do not fetch or analyze candles/OHLC for upcoming shortlists or preparation,
including saved price evidence. Reuse prior fundamental findings only. Candle
analysis belongs to a separately requested historical price investigation.

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

For an explicitly deferred/prompt-only request, use the already accepted shortlist
and focused calendar IDs without doing new macro research. Save prepare_prompt
and release_prompt via `pnpm analyst prompt save`; keep journal research pending.
Record known schedule/data gaps using `limitations append`. The user can request
the full investigation on release day or about an hour beforehand, then request
post-release interpretation after actuals arrive. Do not infer recurring monitoring.

## Pair trade: holding/exit and next opportunity

When asked which upcoming news could disrupt an intended or existing trade,
or which event to revisit after a weak assessment,
focus on its pair, buy/sell thesis and stated horizon. Reuse the assessment's
fundamental context and research-as-of time, refreshing developments as needed.
Scan at least the next seven calendar days for both currencies, extending through
a longer requested holding horizon. Apply the
[fundamental exit and reassessment guidance](../assess-trade-now/SKILL.md#fundamental-exit-and-reassessment-watchlist)
only for this mode; do not default to 90 days/all currencies or produce a pin
shortlist unless requested. Historical cutoffs exclude later information.

Lead with the earliest material reassessment or closing consideration. For each
material event, give verified Jakarta/UTC stages, the relevant macro mechanism,
and which outcomes support, challenge or invalidate the trade's thesis. Separate
volatility from a reason to consider reducing/closing before the event or after
verified contrary information. Include unscheduled exceptional risks. Where
complete checked coverage identifies no material scheduled threat, state that
plainly with the checked window and remaining specific risks; incomplete coverage
cannot support an all-clear. Keep technical entries, support/resistance, stops,
targets and position sizing with the user. No trades or automatic monitoring.

For a weak-bias or waiting handoff, apply Assess Trade Now's
[direction and next-opportunity guidance](../assess-trade-now/SKILL.md#direction-and-next-opportunity).
Select the next material event that could change the pair's policy outlook,
give a verified release time and suggested preparation/return time in Jakarta
and UTC, and explain the conditional directional change. A promising research
candidate is not a forecast of a bigger price move. Suggesting when to return
does not start a reminder or monitor.
