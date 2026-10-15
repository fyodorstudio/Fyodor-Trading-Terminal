---
name: assess-trade-now
description: "Quickly assess a forex pair or Highlight using calendar, saved fundamentals and current web evidence; cover all eight currencies only when requested. Return a fundamental decision card or prepare context for a release countdown. Excludes candle analysis and historical price investigations."
---

# Assess Trade Now

Follow AGENTS.md and work in Fyodor Trading Terminal Lite. Assess the selected pair
and requested horizon; use intraday only as a stated default if none is given.
This is a current fundamental assessment, not an order or execution approval.
Default to the requested pair/Highlight. Eight-currency coverage requires the
user to request it; use the optional mode below. For an explicit request to wait
for imminent publication, hand off to
[One Minute Before Release](../one-minute-before-release/SKILL.md).

## User defaults and short invocations

- Show all user-facing dates, alarms, countdown targets and as-of times in
  **Asia/Jakarta, AM/PM only**. State Jakarta once; omit UTC, broker clocks and
  other timezones from the answer unless requested. Retain exact UTC instants
  internally for queries, conversions, deadlines and stored evidence. Date-only
  events stay date-only, and unverified hours stay unverified.
- An invocation plus event/date is sufficient. Resolve the occurrence, pair,
  candidate list and previously requested comparison scope from the conversation;
  state an assumption briefly rather than requiring a long prompt. An event-only
  request with no prepared pair/scope gives currency preparation; it does not
  silently expand to all eight. Ask only when ambiguity materially changes the work.
- "Choose the best-supported pair after [event]" requests comparison among the
  major pairs containing that event's currency. A user-specified candidate list
  narrows that comparison. Carry this scope into the countdown; do not make the
  user repeat it. Before publication give conditional candidates; choose the
  release-supported pair only after verified actuals and intervening news.
- Keep the assessment entirely fundamental. Treat the user's resistance,
  support, trend or chart comments as their execution context, not independent
  confirmation or a reason to raise confidence. Do not inspect attached candles
  or force the macro verdict to agree with the user's technical view.

## Fast evidence pass

Aim to deliver the first complete decision card in about a minute when evidence
is accessible. This is a workflow target, not a latency promise or permission to
skip verification. Do not run a broad research project before answering.

- Reuse instructions and relevant fundamental context already loaded in this
  session. Do not reread AGENTS.md, this skill, manuals or old reports on each
  invocation unless they changed or the context is missing. Prior conclusions
  retain their as-of time; refresh new information rather than assuming they
  still hold. In a fresh session, load only the relevant guidance once.
- For an exact Highlight ID, start with focused `highlights --highlight-id <id>
  --summary` and the latest relevant `journal read --scope <pair> --limit 1`.
  Without an ID, narrow Highlight discovery by currency/family and a small page;
  do not list every active/archived pin. A pair-only request can start directly
  with its focused calendar and known relevant journal. Highlight index keys are
  `release_utc` and `research`; do not infer absent release times from nonexistent
  `release_at` fields. Read archived history only when it changes the assessment.
- Query only the requested scope and relevant releases. For intraday, inspect
  today's/next trading session's readings for material updates, and scan both
  currencies' upcoming release index for at least the next seven calendar days
  for the exit/reassessment watchlist below. Extend through a longer requested
  holding horizon. Extend dates or pagination to cover material events, not to
  dump every series. Reuse known policy/data facts and verify their latest
  vintage or a subsequent update. Use existing CLI commands; custom scripts are
  optional only when they actually reduce output or repeat work.
- Batch independent local reads and focused web searches. Include a focused
  `pnpm analyst external --scope <pair>` query for
  material outside-feed news and watch items. See the
  [separate collection](../../../docs/EXTERNAL-SOURCES.md); saved interpretation
  needs refresh, and its recorded/provider/publication clocks are distinct.
  Empty records or calendar icons do not establish an all-clear. Do not turn an
  unscheduled risk into a precisely timed next opportunity.
  The first web pass should cover both currencies' latest policy/data and exceptional news in one
  batch. Open the decisive official releases and dated reporting in parallel
  where possible. Check the latest available reporting, not just an early market
  wrap; an older wrap cannot establish the current intraday backdrop.
- If a page fails, try one suitable alternative source or retrieval route, then
  mark unresolved evidence instead of repeatedly opening the same broken URL.
  Search snippets can identify leads but cannot confirm a critical claim when the
  full evidence is unavailable. Contradictory evidence needs focused resolution;
  an unresolved fact that could change direction means lower confidence or no
  clear edge. Explain which checks remain incomplete.
- Reuse the prior comparable release's fundamental findings when relevant to
  the bank's concern or a changed policy path. Prepare this comparison ahead of
  publication; past price behaviour is neither evidence of today's actuals nor
  a fallback for inaccessible sources. Do not launch historical research here.
- Stop when the card is supported: both currency stories, strongest
  counterevidence, exceptional-catalyst check, entry conditions/invalidation and
  the seven-day exit/reassessment watchlist with provenance. Extra searches are
  justified only by a material gap, contradiction or newer information. Keep the
  final answer to the card, short material watchlist and at most one clarification;
  no tools chronology or long source recap.

## Accuracy boundaries

- Never fetch, open, calculate or assess candles/OHLC in this workflow, including
  saved candles, charts, technical indicators and historical reaction measurements.
  Skip candle attachments and price-reaction sections of prior research. Candle
  analysis is permitted only for a separate, explicitly requested historical
  price investigation; do not add it to a live assessment for confirmation.
- Read only relevant journal fundamental sections, excluding candle attachments
  and price-reaction addenda. The [journal workflow](../../../docs/HIGHLIGHT-JOURNAL.md)
  documents CLI commands; read it only when needed to resolve an unknown command.
- Verify new actuals, revisions, components and policy guidance against official
  releases where accessible. If official retrieval fails, use fresh broker
  readings or accessible reliable reporting of this exact release, identifying
  the source and any missing official confirmation. Check occurrence, reference
  period, units, seasonal adjustment and headline/core definitions; capture time
  alone does not prove freshness. Material conflicts remain unresolved until
  checked. Do not insist on every minor component if the available package
  supports the interpretation, but missing decisive components prevent a firm
  verdict. An elapsed clock does not establish publication. Keep missing actuals
  explicit. For an unpublished-release interpretation, give conditional outcomes
  and wait for that release's actuals. For a general pair assessment, evaluate the
  evidence already available: an upcoming CPI or other event does not automatically
  force waiting, invalidate a supported bias, or make all currency facts unknown.
  Explain whether the pending event warrants waiting for this particular setup.
- Check both currencies' expected rate paths, using rates, inflation and labor as
  the core. Never infer currency strength from a higher rate, a hike or a cut
  alone. For policy events, separate the current decision versus expectations
  from changes in the projected pace, peak/terminal rate, duration and guidance
  versus the prior outlook and market pricing. An expected hike with a slower
  future path can weaken a currency; a smaller-than-expected cut or firmer future
  path can strengthen it. These are conditional mechanisms, not automatic
  reversals. Explain which new information dominates, the other currency's path
  and the strongest counterevidence. Keep economist surveys, market-implied
  pricing and conditional central-bank projections distinct; missing pricing
  means the degree of surprise is unresolved, not proof it was priced in.
  Always check material off-calendar news, especially intervention,
  official warnings/rate checks, geopolitical shocks, tariffs and bond-market
  stress. Use focused, dated web searches; do not re-investigate every historical
  release or scan all 28 pairs unless requested.
- Attribute broker forecasts, web surveys and market rate pricing separately.
  Identify release-day vintages and distinguish confirmed facts, reports and
  speculation. Use only evidence available by a requested as-of cutoff; later
  updates must not leak into historical simulations.
- Speed does not justify skipping verification. If a key fact is unavailable,
  respond with the limitation and wait/no clear edge rather than filling it in.

## Eight currencies, only when requested

Cover USD, EUR, GBP, JPY, CHF, CAD, AUD and NZD when the user explicitly says
"for 8 currencies" or requests unrestricted best-event-pair selection. An
explicit candidate list uses only those currencies and pairs. Neither mode
automatically starts a timer, pins events, saves research or expands to every pair.

- Reuse dated fundamentals, refresh material policy/inflation/labor developments
  and check exceptional news for every currency. Batch focused independent
  checks; disclose missing coverage individually rather than implying all eight
  are current. Thorough preparation may take longer than the pair-mode target.
- Show a compact table: Currency / Current evidence and meaning / Confidence /
  Strongest counterevidence or extreme-move risk / Next material news. Cite facts
  beside the relevant row, with per-currency as-of times when freshness differs.
  Use strengthening/weakening/mixed as fundamental descriptions, not measured
  performance against every other currency; no numeric currency scores.
- If an event is specified, interpret its currency once, then compare it with
  the other seven using the prepared context. Consider the seven crosses that
  contain that currency; do not produce 28 decision cards. Identify the
  best-supported pair, an alternative if supported, and important conflicts.
  Use the standard decision card for the leading candidate, or explain no clear
  edge. Distinguish currency direction from buy/sell direction for the quoted pair.
- Lead event preparation with a short conditional shortlist: stronger-than-
  expected package → [pair/direction]; weaker → [pair/direction]; in line →
  [remaining backdrop lean or unresolved edge]. Different outcomes can favour
  different counterparts. Do not hard-code today's pairs or numeric thresholds
  into future assessments. After publication give one leading pair, confidence,
  why it outranks the alternative and its main reversal risk; do not repeat the
  full overview unless material changes warrant it or the user requests it.
- Prefer opposing fundamental pressures when supported, but judge changes
  relative to priced expectations. Two strengthening currencies need not cancel:
  their expected policy paths and relevant shocks can change by different amounts.
  Avoid choosing from absolute rates, past performance or "momentum" alone.
- Distinguish **best-supported direction** from **potential volatility**. When
  asked for the biggest move, name plausible catalyst-sensitive candidates and
  explain rates, risk sentiment, commodities or intervention channels. Label
  qualitative rankings as inference and disclose missing current implied-volatility
  evidence. Do not claim the highest volatility, pip distance or profitability
  from macro alignment; never add candle analysis to make that ranking.
- Without a specified event, give the eight-currency overview and only the
  clearest supported pair comparisons. Do not invent an event or force a trade.
- Fundamental alignment does not predict pip distance or profit. Compare policy
  surprises and expected paths, not just the absolute rate level. Include
  commodity/risk-sentiment and intervention counterweights where material.

## Context for the countdown skill

For event preparation, retain a concise handoff in the conversation: exact
Highlight/event identity, broker and reference period; verified publication
instant and separate policy stages (UTC internally, Jakarta AM/PM in chat); preserved broker forecasts
and separately attributed web expectations; both currencies' fundamentals (or
all eight when requested), as-of times, counterevidence and exceptional risks;
conditional outcomes, invalidation, next news and direct evidence references.
Identify any gaps and the critical fields needed for a verdict. This may be
the assessment itself; do not duplicate it in a second long report.

Prepare the release retrieval path before the countdown: exact local occurrence/
series query, direct official endpoint and one usable fallback, with reference
period, units and seasonal adjustment. Identify the minimum decisive package
(including material revisions/components), simultaneous releases that could
change the counterpart choice, and what can wait until after a first verdict.
Preserve attributed expectations and why each conditional pair outranks its
alternatives. These are contextual scenarios, not a field-count score or an
automatic rule that fixes the winner before actuals. Resolve known source access
problems during preparation where possible; do not discover the retrieval route
or rebuild the seven-day watchlist after publication.

The countdown reuses this evidence and checks only intervening developments and
the new release package. It must not assume that a prepared bias is the verdict
after publication. It sends a short, sourced first verdict in commentary as soon
as sufficient evidence arrives, then the complete decision card in the same
active turn; preparation should make that possible without another broad scan.
Context carries forward in the same conversation; another
session needs this handoff or explicitly saved research. Save only on request.

## Fundamental exit and reassessment watchlist

Every pair assessment, including No clear edge, checks at least the next seven
calendar days from its research-as-of instant for both currencies; use a longer
requested holding horizon when given. Keep the directional horizon explicit:
a seven-day news scan does not turn an intraday bias into a week-long forecast.
Use only information public by a requested historical cutoff. Scan the complete
pair release index, focus readings/research on material candidates, and verify
major official schedules and stages beyond the broker feed. Complete pagination
as needed; no need to investigate every minor reading or all eight currencies.
Use this focused pass directly; the broader Review Upcoming Alerts shortlist is
optional and must not automatically expand a pair assessment to 90 days.

Return a short watchlist: verified Jakarta AM/PM time or explicitly unverified
hour, event/stage, why it matters to this particular buy/sell thesis, and the
outcome that would support, challenge or invalidate it. Include material
unscheduled risks separately with immediate reassessment triggers; do not assign
them invented dates. Keep imminent policy stages visible. Reuse this watchlist
near publication and refresh intervening changes rather than repeating the scan.

Give a plain fundamental holding/exit consideration, with a reason:

- Thesis remains supported: no fundamental closing trigger identified now.
- Reassess before a named release; reassess after actuals/guidance if a specified
  outcome would challenge or invalidate the thesis.
- Consider reducing or closing before a named event when its unresolved outcome
  could reset the core premise or a documented exceptional catalyst makes the
  current conviction insufficient; explain why waiting for publication matters.
- Consider closing/reassessing promptly when verified new information has already
  invalidated the thesis; identify that information.

Do not recommend closing before every high-impact release just because it may
cause volatility. Distinguish volatility from a change in fundamental direction.
Do not manufacture a closing deadline, holding period, future surprise or risk
preference. Where holding through news depends on the user's risk tolerance,
state the fundamental tradeoff without inventing their execution rules. Technical
entries/exits, support/resistance, stops, targets and position sizing belong to
the user; no candles or technical confirmation enter this workflow.

If the current thesis remains supported and the checked seven-day window
contains no material scheduled threat, say
"No material scheduled threat to this thesis identified in the next seven days
within the checked sources; no fundamental reason to close identified now."
Add any specific unscheduled risk. Do not imply nothing can go wrong. If schedule
or source coverage is incomplete, name the gap instead of issuing that all-clear.
Give attributed forecasts only when available; farther-out events can be flagged
with a refresh-near-release instruction, without a full advance forecast study.

## Direction and next opportunity

The user's default preference is the best-supported buy/sell lean, even when
slight. State its strength and confidence separately from whether this release
adds a new signal or supports entry. An in-line release can preserve a weak
backdrop bias; do not automatically replace that bias with No clear edge.
Use No defensible direction only when verified evidence is genuinely balanced
or a decisive gap prevents choosing a side. Never invent a lean to fill the row.
Before actuals, keep the backdrop lean conditional; missing actuals do not become
a confirmed release verdict because the user prefers a direction.

When the bias is weak, entry evidence is insufficient, or waiting is appropriate,
name the next best-supported reassessment opportunity from the seven-day scan.
Give the event, pair, verified release date/time in Jakarta AM/PM, and a
suggested preparation time (normally ten minutes before, earlier for missing
context). Explain which outcomes could strengthen, reverse or establish the
direction. Say "Return at [time] before [event] for a fresh assessment," rather
than stopping at Wait/No clear edge. Distinguish Next opportunity from Next danger:
one event can be both. Prioritize new policy-relevant information, not guaranteed
larger moves, fixed event rankings or the eventual historical price outcome.
If no suitable scheduled candidate is verified, say so and give the evidence
trigger for reassessment; unknown hours remain unknown. Suggesting a return time
does not schedule a notification or extend the active countdown.

## Decision card

Lead with one sentence stating pair direction, confidence and the dominant
reversal risk. Say whether that risk qualifies the bias, reduces conviction to
No clear edge, or warrants waiting for specific evidence. Distinguish documented
reversal risk from evidence that a reversal is becoming the base case, and name
the new information that would change the verdict. Return one compact table,
normally with these rows, followed by the short watchlist when needed:

| Field | Required answer |
| --- | --- |
| Direction | Best-supported buy/sell lean, including slight, with its strength; conditional before actuals; disclose when no direction is defensible |
| Confidence | Low / Moderate / High in the fundamental interpretation |
| Reason | Two sentences covering both currencies and the strongest counterevidence |
| Extreme-move risk | Mandatory: documented exceptional catalyst, confirmed/reported/possible/unresolved status, affected direction and what evidence triggers immediate reassessment; disclose an incomplete check |
| Entry consideration | Fundamental conditions supported, wait for specified evidence, or insufficient evidence; execution not assessed when the user's entry/risk rules are absent |
| Invalidation | The evidence that would overturn the reasoning |
| Holding / exit consideration | Whether the thesis still supports holding, what warrants considering closing/reducing before news, or what verified information would warrant closing/reassessment after news; fundamentals only |
| Next danger | Earliest material threat from the at-least-seven-day watchlist for both currencies, with verified Jakarta AM/PM stages; include unscheduled risks and disclose incomplete coverage |
| Next opportunity | When the present evidence is weak or waiting is appropriate: next material event, suggested return/preparation time, verified Jakarta AM/PM release time and what could produce a clearer fundamental direction |
| Evidence checked | Research-as-of timestamp, data freshness/missing values and direct web/local sources |

Always include Extreme-move risk, even with No clear edge. Distinguish routine
directional conviction from exposure to a sudden shock: mixed direction can
coexist with serious reversal risk. Check relevant intervention/warnings/rate
checks, emergency policy changes, geopolitical/energy shocks, tariffs and bond
stress. Do not infer that intervention occurred from old warnings, or treat a
confirmed past operation as a new current operation. If no specific catalyst is
identified, say so within the checked sources/as-of time; do not claim no risk.
Do not predict an 800-pip move, assign an invented probability, or imply the full
historical high-to-low move was an achievable return.

Do not invent a price entry, stop, target, position size, expected profit or win
probability. Leave technical execution and risk management to the user; do not
require technical rules to deliver the fundamental assessment. Use stated
holding-through-news preferences when explaining the fundamental tradeoff.
No clear edge and waiting are valid outcomes. Fundamental support alone does not
establish an executable or profitable trade. Keep unsupported attribution explicit.

Answer in chat. Save research only when requested; use the appropriate Before or
After release journal phase and leave price_reaction empty. Do not trade, mutate
calendar observations, restart services or create recurring monitoring.
