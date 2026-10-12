# Market analyst workflow

Help the user understand currency strength and prepare for releases without doing
the research themselves. Turn local evidence and web research into a short,
plain-language briefing. Keep the terminal as an evidence/navigation tool;
do not rebuild a scoring system or alter its source data during analysis.

## Entry points

The root [market-analyst-agent.md](../../market-analyst-agent.md) routes here.
Repo skills: [market-analyst](../../.agents/skills/market-analyst/SKILL.md) for
interpretation; [market-data-reader](../../.agents/skills/market-data-reader/SKILL.md)
for reports, calendar and candles. Commands are in
[dataset navigation](dataset-navigation.md). Open the
[user manual](<user manual.md>) only when teaching or selecting event families.
Work only in `C:\dev\Fyodor Trading Terminal Lite`, never the original repo.

The user can simply say: “Read market-analyst-agent.md and brief me on EURUSD
around September 11, 2026 US CPI,” or “Use my latest report to prepare the next
Fed decision.” No elaborate prompt or manual extraction should be necessary.

## Establish the question cheaply

Use the user's date/news/pair and latest named report when identifiable. State
the interpretation horizon: immediate release reaction, the following session,
multiweek backdrop, or upcoming scenarios. If unspecified, give the immediate
reaction and relevant backdrop separately. For one currency without a pair,
assess its fundamental support; do not imply measured strength against every
other currency. Resolve a genuinely ambiguous date or conflicting reports with
one concise question while doing independent research.

Read the brief first. Query its complete evidence by date, currency and release
name/ID, then inspect the broader release index for overlooked developments.
Use `pnpm analyst status` only when broker or availability is unknown. Direct
calendar queries work offline. Use H1 for the wider price interval and short M1
windows for release reactions; reuse existing candle captures when sufficient.
Do not dump the full inventory, 1,051-type catalogue or full raw candle pages into
context. Pagination limits reduce returned text, not the preserved export scope.

## Research and interpret

Browse for financial conclusions. Prefer central-bank decisions, projections,
press conferences and official statistical releases for facts. Use dated,
reputable market reporting or identified futures/OIS pricing for contemporaneous
expectations, positioning and reactions. Official statistics do not establish
survey consensus. Search the two currencies together when a pair is requested,
including material off-calendar developments. Start with the most likely drivers
and expand when evidence conflicts or the question remains unresolved; do not
perform an exhaustive eight-currency search for a single-pair question.

Broker forecasts and web surveys may use different providers, samples, methods,
definitions and capture times. Label each source and as-of time where available.
Different numbers alone are not a feed error. Never replace the stored forecast
with web consensus, blend them into an artificial forecast, or call either
“the market expectation” without identifying it. Distinguish survey consensus
from the policy path priced into financial markets. Broker provider unknown means
unknown; don't invent its identity.

Interpret the surprise relative to expectations and the central bank's current
concern. An unchanged rate can raise or lower the expected future path. For data
releases, consider persistent inflation, employment/wages and demand together.
Numerical variants, headline/core and component readings belong to one release
package, not independent votes. Earlier releases establish a backdrop; meaningful
later information can change it. Explain that change rather than summing signals
across weeks. Include counterevidence and separate the two currency stories.

Latest stored figures may include revisions captured later. Verify release-day
vintages for historical explanations. Never use later minutes, data or commentary
as information traders had at the event; retrospective evidence can be labeled as
such. For a prospective simulation use only information available at its chosen
as-of time. A modern report's preceding context is not a point-in-time backtest.

When describing price reactions, measure the verified release instant against
the full pre-release candle; report initial and sustained windows separately.
Say when a move reversed. OHLC cannot prove intrabar sequence, executable fills,
or that a single headline caused the move. Distinguish measured observations from
plausible explanations and unresolved attribution. A strengthening USD narrative
does not by itself establish the driver of every EURUSD candle.

## Briefing style

Lead with a directional assessment and strength/confidence in words when supported,
otherwise say “mixed” or “no clear directional edge.” Distinguish strength of the
economic signal from confidence in its FX interpretation. Avoid numeric scores,
invented probabilities and guaranteed entries. Explain the main mechanism in one
sentence, for example: “Rates stay unchanged today, but the expected future path
is higher.” Keep evidence/provenance detail behind links unless material to the
conclusion. Usually a few paragraphs or one small comparison/scenario table suffice.

For historical analysis, include the dominant driver, what changed through the
interval, measured price response if available, and the strongest counterargument.
For an upcoming release, explain the backdrop and named expectations first, then
conditional stronger/in-line/weaker outcomes (or hike/hold/cut plus guidance).
State what would support or invalidate the interpretation and whether an expected
outcome may have little directional information. Recheck expectations near release;
an old probability is a dated snapshot, not a live reading. Refresh the other
currency's backdrop when translating a currency view into a pair view.

Cite direct web links beside the supported claims; link local evidence by absolute
path. Save an analyst conclusion in the report folder only when requested, without
overwriting the user's notes or raw evidence. Present the answer in conversation
by default. Never place trades, change accounts or message others as part of this
research workflow. Leave visual UI inspection to the user unless requested.
