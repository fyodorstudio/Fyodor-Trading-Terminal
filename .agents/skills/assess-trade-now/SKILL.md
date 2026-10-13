---
name: assess-trade-now
description: "Quickly assess a selected forex pair or Highlight using current calendar readings, saved fundamental research and web evidence. Return a concise fundamental trade decision card before or after a release, or after unexpected news. Excludes candle analysis and historical price investigations."
---

# Assess Trade Now

Follow AGENTS.md and work in Fyodor Trading Terminal Lite. Assess the selected pair
and requested horizon; use intraday only as a stated default if none is given.
This is a current fundamental assessment, not an order or execution approval.

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
- Query only the selected pair, relevant new releases and requested horizon.
  For intraday, inspect today's/next trading session's release index and focused
  readings for material updates; retain important next-day releases in Next
  danger. Extend dates or pagination when necessary to cover a material event,
  not to dump every series. Reuse known policy/data facts and verify their latest
  vintage or a subsequent update. Use existing CLI commands; custom scripts are
  optional only when they actually reduce output or repeat work.
- Batch independent local reads and focused web searches. The first web pass
  should cover both currencies' latest policy/data and exceptional news in one
  batch. Open the decisive official releases and dated reporting in parallel
  where possible. Check the latest available reporting, not just an early market
  wrap; an older wrap cannot establish the current intraday backdrop.
- If a page fails, try one suitable alternative source or retrieval route, then
  mark unresolved evidence instead of repeatedly opening the same broken URL.
  Search snippets can identify leads but cannot confirm a critical claim when the
  full evidence is unavailable. Contradictory evidence needs focused resolution;
  an unresolved fact that could change direction means lower confidence or no
  clear edge. Explain which checks remain incomplete.
- Stop when the card is supported: both currency stories, strongest
  counterevidence, exceptional-catalyst check, entry conditions/invalidation and
  next danger with provenance. Extra searches are justified only by a material
  gap, contradiction or newer information. Keep the final answer to the card and
  at most one short clarification; no tools chronology or long source recap.

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
  releases. An elapsed clock does not establish publication. Keep missing actuals
  explicit. For an unpublished-release interpretation, give conditional outcomes
  and wait for that release's actuals. For a general pair assessment, evaluate the
  evidence already available: an upcoming CPI or other event does not automatically
  force waiting, invalidate a supported bias, or make all currency facts unknown.
  Explain whether the pending event warrants waiting for this particular setup.
- Check both currencies' expected rate paths, using rates, inflation and labor as
  the core. Always check material off-calendar news, especially intervention,
  official warnings/rate checks, geopolitical shocks, tariffs and bond-market
  stress. Use focused, dated web searches; do not re-investigate every historical
  release or scan all 28 pairs unless requested.
- Attribute broker forecasts, web surveys and market rate pricing separately.
  Identify release-day vintages and distinguish confirmed facts, reports and
  speculation. Use only evidence available by a requested as-of cutoff; later
  updates must not leak into historical simulations.
- Speed does not justify skipping verification. If a key fact is unavailable,
  respond with the limitation and wait/no clear edge rather than filling it in.

## Decision card

Return one compact table, normally with these rows:

| Field | Required answer |
| --- | --- |
| Direction | Buy bias / Sell bias / No clear edge for the selected pair; conditional before actuals |
| Confidence | Low / Moderate / High in the fundamental interpretation |
| Reason | Two sentences covering both currencies and the strongest counterevidence |
| Extreme-move risk | Mandatory: documented exceptional catalyst, confirmed/reported/possible/unresolved status, affected direction and what evidence triggers immediate reassessment; disclose an incomplete check |
| Entry consideration | Fundamental conditions supported, wait for specified evidence, or insufficient evidence; execution not assessed when the user's entry/risk rules are absent |
| Invalidation | The evidence that would overturn the reasoning |
| Next danger | Material upcoming news/stages for either currency, with verified Jakarta and UTC times, plus relevant unscheduled risks |
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
probability. Apply the user's existing execution/risk rules if provided and
compatible with the no-candle restriction; otherwise state that they are absent.
No clear edge and waiting are valid outcomes. Fundamental support alone does not
establish an executable or profitable trade. Keep unsupported attribution explicit.

Answer in chat. Save research only when requested; use the appropriate Before or
After release journal phase and leave price_reaction empty. Do not trade, mutate
calendar observations, restart services or create recurring monitoring.
