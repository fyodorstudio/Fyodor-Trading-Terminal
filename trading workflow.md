# Trading workflow

Use the chart to assess price and the fundamental overlays to understand the declared interpretation of the stored releases. A direction is a thesis input, not an instruction to buy, sell, hold, or close. Evidence describes agreement between inputs, not a probability of profit.

## Read the chart

- **Roofs** connect the source releases behind a relationship. The right-endpoint dot marks when that relationship became available. Width connects sources to activation; it does not promise how long the direction lasts. Click a roof for its sources and explanation. Focused display reduces repetition; More retains omitted roofs.
- **Context ribbon (Raycaster Candy)** shows accumulated context across time. Green means pair Long, red means pair Short; stronger shades indicate stronger evidence. Gray means unavailable. Its label identifies USD-side or EUR-vs-USD mode. Hover for the time and responsible update; click for an explanation.
- **Raycaster** inspects the context at the hovered candle's end, capped at the current time. A publication within that candle can change its result. The ribbon retains the publication's exact timestamp.
- Roofs, the ribbon, and the hover box have separate visibility controls near the timeframe selector. Roof relationships currently use USD inputs, even when the ribbon compares EUR with USD.
- Inspector shows **Standalone Scoring** on the left and **Context-Aware at Publication Scoring** on the right. An opposing standalone release can coexist with an unchanged combined direction.

The roof gear lists the supported relationships and their scope. Raycaster settings choose context mode and inputs. Chart marker filters control which symbols you see; they do not silently change context inputs. Filter changes apply immediately; Save preserves the filter preference across refresh.

## Before opening a trade

1. Check the current combined context and relevant roofs, then wait for your own price setup.
2. In **Notebook**, write the thesis: why this setup is worth considering.
3. Define invalidation: **What observable condition would make my reason for this trade no longer hold?** Write a price condition and, if relevant, a fundamental condition separately. “A release disagrees” is incomplete: identify whether you mean its standalone result or the combined context, which mode, and what evidence level matters.
4. Define entry, stop, target, risk limit, and review horizon. The chart's planned levels help record these; they do not place broker orders.
5. Choose an exit rule before entry. Save the context mode, input selection and observed bias in the Notebook plan. Pin the setup to preserve the plan as it stood at that moment.

Notebook workflow fields save automatically with the symbol's draft. **Load current context**, then **Record current context**, captures the current interpretation, broker clock, mode, selected inputs, engine version and coverage notice. It does not capture the historical candle under your cursor. Clear workflow starts fresh without deleting the chart's entry/stop/target levels. Pinned workflow fields are read-only; the journal remains available for subsequent observations.

## Review new information

A publication prompts reassessment. An aligned output alone does not justify holding. An opposing output alone does not override your written price and risk rules.

Two **paper-test candidates**, not validated exit strategies, are available in Notebook:

- Reassess when a **new publication** changes combined context against the trade, at any evidence level.
- Reassess when that change has at least **Moderate** evidence.

Record your chosen action in the exit rule. Distinguish a publication from aging, expiry, or a changed configuration. Those can change context without new news. Always apply the independent price invalidation and risk limit you wrote beforehand.

## Audit without reading every number

Record the source, activation time, mode, bias and evidence. Compare price at consistent H1, four-hour and next-day windows. Separate the immediate reaction from later moves. Use roof explanations and Inspector only when you need to investigate a disagreement; Scatter Plot exposes the numerical calibration when needed.

Stored values may contain revisions and missing history. Speeches and narrative guidance are not inferred from candles. An unavailable result remains unavailable. Activity shows data/bridge health; Settings workspace backup preserves supported preferences and Notebook records. Bottom docks share their saved height.

## Other tools when needed

- Timeframe buttons change the price view. The paintbrush button opens drawing tools independently of the fundamental overlays; drawings and planned levels help document your own price setup.
- Inspector's calendar limits the visible release horizon. Its filters show/hide event families and choose symbol styles. Grouped ISM and euro-area PMI tables retain their individual series and publication times.
- Scatter Plot shows the readings or scorer signals across history, with automatic calibration, optional manual boundaries and view-only zoom/appearance controls. Adjusting a calculation setting can rebuild context; changing the viewport does not.
- Alert uses the selected broker's calendar schedule and Inspector filters. It is a schedule/coverage tool, not a directional trading recommendation.
- Notebook holds drafts, pinned setup arrows and journal notes. Journal notes use Save Note / Ctrl+Enter; workflow fields save automatically. Notebook and the chart do not execute broker orders.
- Activity helps diagnose stale data or connectivity; Settings exports/imports supported workspace preferences and Notebook records. Keep a backup before an import or a large preference change.
