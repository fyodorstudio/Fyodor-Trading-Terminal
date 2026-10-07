# Trading workflow

Use the chart to assess price and the fundamental overlays to understand the declared interpretation of the stored releases. A direction is a thesis input, not an instruction to buy, sell, hold, or close. Evidence describes agreement between inputs, not a probability of profit.

## Read the chart

- **Roofs** connect the source releases behind a relationship on three levels. Their endpoints use your configured release symbols. Click a symbol to inspect its release; a counted symbol opens a release chooser. The final endpoint is tagged **Starts** when a publication activates the combo, or **Update** when a memory change activates it without a new publication. Width connects sources to activation; it does not promise how long the direction lasts. Click the direction box for **Combo details**. Focused display reduces repetition; More retains omitted roofs.
- **Context ribbon (Raycaster Candy)** shows accumulated context across time. Green means pair Long, red means pair Short; stronger shades indicate stronger evidence. Gray means unavailable. Its label identifies USD-side or EUR-vs-USD mode. Hover for the time and responsible update; click for an explanation.
- **Outside events** are your manual gray highlights on the separate thin strip immediately above Candy. With Candy visible, click **Outside events +**, enter a title, start/end in broker chart time and an optional observation/source reference, then Save highlight. Blank end means ongoing. Hover for the note; click to edit or delete it. Overlapping highlights show all active notes. Notes are saved per broker and pair and included in workspace backups.
- **Raycaster** inspects the context at the hovered candle's end, capped at the current time. A publication within that candle can change its result. The ribbon retains the publication's exact timestamp.
- Roofs, the ribbon, and the hover box have separate visibility controls near the timeframe selector. Roof relationships currently use USD inputs, even when the ribbon compares EUR with USD.
- Inspector shows **Standalone Scoring** on the left and **Context-Aware at Publication Scoring** on the right. An opposing standalone release can coexist with an unchanged combined direction.

The roof gear lists the supported relationships and their scope. Raycaster settings choose context mode and inputs. Chart marker filters control which symbols you see; they do not silently change context inputs. Filter changes apply immediately; Save preserves the filter preference across refresh.

Roofs move with their candles when you pan, preserving their lane and source symbols. Nearby symbols may group at a given zoom; the chooser retains each exact publication clock. The ordinary bottom symbol row remains the full release timeline, including events outside the displayed combos. Edges may clip a label or symbol. Zooming or changing inputs/history can rearrange lanes and clusters; More retains crowded combinations.

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

Read Candy and roofs as two different observations. Red Candy with dashed Long roofs means the accumulated context still favors pair Short while fresh USD release changes pull toward Long. A solid ISM roof describes that sector relationship. Roofs use USD inputs; relative Candy can also include EUR readings. Read a roof only from its Starts/Update endpoint onward, not from the start of its source span.

Add an outside-event highlight when you want to record a possible missing explanation for an audit discrepancy. Your chosen window marks where to investigate, not a measured impact duration or proof of causation. These notes never contribute a vote, modify evidence, or change the dataset. Historical notes may be added later: the editor keeps the actual UTC recording time separate from the broker-time highlight range. An empty strip means no saved annotation, not that no outside event occurred.

Stored values may contain revisions and missing history. Speeches and narrative guidance are not inferred from candles. An unavailable result remains unavailable. Activity shows data/bridge health; Settings workspace backup preserves supported preferences and Notebook records. Bottom docks share their saved height.

## Other tools when needed

- Timeframe buttons change the price view. The paintbrush button opens drawing tools independently of the fundamental overlays; drawings and planned levels help document your own price setup.
- Inspector's calendar limits the visible release horizon. Its filters show/hide event families and choose symbol styles. Grouped ISM and euro-area PMI tables retain their individual series and publication times.
- Scatter Plot shows the readings or scorer signals across history, with automatic calibration, optional manual boundaries and view-only zoom/appearance controls. Adjusting a calculation setting can rebuild context; changing the viewport does not.
- Alert uses the selected broker's calendar schedule and Inspector filters. It is a schedule/coverage tool, not a directional trading recommendation.
- Notebook holds drafts, pinned setup arrows and journal notes. Journal notes use Save Note / Ctrl+Enter; workflow fields save automatically. Notebook and the chart do not execute broker orders.
- Activity helps diagnose stale data or connectivity; Settings exports/imports supported workspace preferences and Notebook records. Keep a backup before an import or a large preference change.
