---
name: assess-trade-now
description: "Quickly assess a selected forex pair or Highlight using current calendar readings, saved fundamental research and web evidence. Return a concise fundamental trade decision card before or after a release, or after unexpected news. Excludes candle analysis and historical price investigations."
---

# Assess Trade Now

Follow AGENTS.md and work in Fyodor Trading Terminal Lite. Assess the selected pair
and requested horizon; use intraday only as a stated default if none is given.
This is a current fundamental assessment, not an order or execution approval.

## Evidence and speed

- Never fetch, open, calculate or assess candles/OHLC in this workflow, including
  saved candles, charts, technical indicators and historical reaction measurements.
  Skip candle attachments and price-reaction sections of prior research. Candle
  analysis is permitted only for a separate, explicitly requested historical
  price investigation; do not add it to a live assessment for confirmation.
- For a Highlight, start with `pnpm analyst highlights`, identify its exact ID and
  broker, then query `--highlight-id <id> --summary`. Read the relevant same-scope
  journal's fundamental sections; use archived context when material. Otherwise
  query the selected pair's focused calendar. See the
  [journal workflow](../../../docs/HIGHLIGHT-JOURNAL.md) for commands. Reuse dated
  context, then refresh what can change today's view.
- Verify new actuals, revisions, components and policy guidance against official
  releases. An elapsed clock does not establish publication. Keep missing actuals
  explicit; before publication give conditional outcomes and wait for actuals.
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
| Entry consideration | Fundamental conditions supported, wait for specified evidence, or insufficient evidence; execution not assessed when the user's entry/risk rules are absent |
| Invalidation | The evidence that would overturn the reasoning |
| Next danger | Material upcoming news/stages for either currency, with verified Jakarta and UTC times, plus relevant unscheduled risks |
| Evidence checked | Research-as-of timestamp, data freshness/missing values and direct web/local sources |

Do not invent a price entry, stop, target, position size, expected profit or win
probability. Apply the user's existing execution/risk rules if provided and
compatible with the no-candle restriction; otherwise state that they are absent.
No clear edge and waiting are valid outcomes. Fundamental support alone does not
establish an executable or profitable trade. Keep unsupported attribution explicit.

Answer in chat. Save research only when requested; use the appropriate Before or
After release journal phase and leave price_reaction empty. Do not trade, mutate
calendar observations, restart services or create recurring monitoring.
