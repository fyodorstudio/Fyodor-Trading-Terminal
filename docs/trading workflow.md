# Trading workflow

Use the chart to assess price and the fundamental overlays to understand the declared interpretation of the stored releases. A direction is a thesis input, not an instruction to buy, sell, hold, or close. Evidence describes agreement between inputs, not a probability of profit.

## Roof endpoint clarity — display v6, 8 October 2026

A Roof can become available because of a publication or a change in stored
memory. The endpoint now tells you which occurred:

| Marker | Meaning | Click |
| --- | --- | --- |
| Hollow circle ○ | Earlier contributing publication(s) | Open the release, or choose between publications sharing the symbol box |
| Filled circle ● | New participating publication activates this snapshot | Open the activating release(s); open Combo details if hidden by marker filters |
| Outlined diamond ◇ | Aging or expiry changes the available relationship without a new participating publication | Open Combo details |

Memory labels carry **Aging update** or **Expiry update**. Hover the diamond or
open Combo details to see the reason and named releases removed from the
seven-day fresh-news window or whose assessments expired. A daily memory
boundary may have no news symbol beneath it; the diamond makes that explicit.
A publication happening at the same time as a removal retains its filled circle;
its explanation still lists removed evidence. Hiding a publication with marker
filters never converts that circle into a memory diamond.

Earlier dots align horizontally with the ordinary grouped release-symbol box.
Several contributing publications in that box share a source dot/chooser.
Activation keeps its own containing-candle anchor, even if its bottom symbol is
grouped with an earlier candle: grouping must not backdate availability. Read
its exact selected-display-clock time in the explanation. Labels stay centered
above their connector span, with clearance based on their actual text height.
The three lane assignments remain stable while panning at the same zoom.

Candy uses the matching terms **New publication**, **Aging update**, and
**Expiry update** for its own accumulated-context timeline. Its scope and
percentages can differ from a Roof. These display changes do not adjust votes,
weights, relationship qualification, activation times or the live polling rate.

## One display clock across the terminal — 8 October 2026

Choose **Chart settings → Universal time presentation** from the bottom-right
Settings button. Local uses the device timezone; for Jakarta, either use Local
on an Asia/Jakarta device or choose **UTC+07:00**. This selection controls chart
axis/crosshair labels, release symbols and choosers, Inspector and its date range,
publication scoring dates, Roof activation dates, Candy, Raycaster, Scatter Plot,
Notebook, Outside-event forms, Activity and Alert. Broker offset information is
shown only inside Chart settings.

A date range means calendar days in that selected clock. Changing the clock can
refresh the stored-calendar query to retrieve the correct day edges. It does not
move the release to a different chart candle or change a scoring vote. Existing
outside-event notes and pinned Notebook records keep their original stored
coordinates, identity and version; their visible dates follow the current clock.
Dates identifying a report's reference month or quarter remain economic period
labels, rather than timezone-shifted publication times.

For **July 2, 2026**, NFP and Claims are available from **19:30 Jakarta**
(**12:30 UTC**). The former 22:30 chart label applied the display offset directly
to a broker wall clock and was three hours late. That was a presentation defect;
the underlying timeline admitted the releases at their stored publication time.
Historical Elev8 chart conversion now follows the same summer/winter profile as
storage. For a source without a historical offset profile, Chart settings
explicitly discloses that chart conversion uses its supplied current offset.
An ambiguous or invalid historical chart clock shows unavailable time rather
than an invented instant.

Read **Raycaster → Read through** as the cutoff used for the result. A historical
19:00 H1 hover reads through 19:59:59, so it can include a 19:30 publication; it
does not describe information available at 19:00. **Last context update** names
the latest update time included in that reading. Live readings are capped at the
current clock. Candy's color boundary and its click explanation use the exact
activation time within the candle. M15/M30 already support finer inspection:
the bar ending immediately before 19:30 excludes that release, while the bar
starting at 19:30 can include it. Switching timeframe changes inspection
resolution, not the timestamp of news availability.

There is no requirement to wait for the release candle to close. Live display
still depends on the publisher, calendar polling (currently ten seconds), and
context processing. This pass does not promise zero latency or measure an
end-to-end live delay.

A dashed Roof now prefixes its direction with **Change:**. It compares recent
comparable support changes; Raycaster/Candy show accumulated support. Their
percentages can differ at the same time. A solid named relationship has its own
participating-family scope. These outputs retain their existing calculations,
weights, support shares, coverage rules and versions.

## Current interpretation rules: USD presentation v1 / context v8 / relative v3 / Roofs v6

Choose **USD side** for the new Raycaster/Candy presentation. Both read the same
latest retained, policy-weighted family contributions. No Roof adds another vote.

| USD output | Candy | Meaning |
| --- | --- | --- |
| Aligned · Long / Short | Green / red | Nonzero active family contributions support one side |
| Conflicted · Long / Short leads | Amber with green / red bottom edge | Both sides contribute; the named side has more weighted support |
| Balanced conflict · No lead | Amber without an edge | Opposing support cancels at the engine's score precision |
| Unchanged · No lead | Amber without an edge | Usable votes are zero; this differs from missing data |
| Insufficient context | Gray | Usable configured evidence cannot establish a direction |

Hover shows the label, evidence, exact clock and responsible update. Click Candy
or open the Raycaster gear for Long/Short support shares, net separation, usable
coverage and leading contributors. Shares are **not probabilities**. A conflicted
lead below one-third net/gross separation stays Weak. It is a narrow lead, not
equal support. Conflicted evidence is at most Moderate; incomplete coverage is
Weak. Aligned evidence retains the existing grade. Neutral outputs have no
directional grade. Source votes already reflect incomplete components once;
coverage does not multiply the score again. Age retention remains separate.

USD presentation requires at least 60% of its configured budget to be usable.
It uses the resolved policy weights, including any qualified labor priority,
rather than Roof base weights or fresh-change scores. Publication Inspector
panels still use their existing agreement gate; they can show Mixed evidence
where the USD Raycaster discloses a Weak conflicted lead. These are different
presentations of the same auditable votes. Notebook **Record current context**
captures the current visible USD presentation and version, not a hovered candle;
older saved records keep their original labels and versions.

**EUR vs USD** retains its existing meaning: green Long, red Short, amber Mixed
evidence, gray Insufficient/unavailable. Its amber output asserts no pair
direction and has no new lead edge. This mode needs at least 60% usable components of each configured
leg's budget. There is no separate CPI/NFP veto. Incomplete usable coverage
qualifies a directional result as Weak; missing inputs do not confirm it. Usable coverage is
separate from aging. Net support must be at least one third of gross opposing
contributions. These declared prototype safeguards are not price-fitted success
guarantees. Advanced controls change the configured inputs; leave the agreed
defaults for comparisons and record any exclusions when auditing.

Roofs expose several distinct relationships:

| Roof type | What its output describes |
| --- | --- |
| ISM sectors, solid | Standalone monthly ISM sector resolution |
| Labor relationships, solid | Accumulated USD context when the priority rule qualified |
| Named macro pair, solid | Available standalone support from two families, at retained base family weights |
| Fed + macro, solid | Numerical rate action alongside macro support; Fed has no invented magnitude weight |
| Named fresh sequence, dashed | Comparable changes in interpreted support over seven days, across at least two domains, including conflict |

Every Roof is **USD-only**, even with EUR-vs-USD Candy. Open its direction label
for the type, scope, participating standalone readings and accumulated result at
activation. Do not interpret an ISM Roof as the entire pair context. A dashed
Roof is a change in evidence, not the new release's standalone bias or a second
Raycaster vote. Renewal of an old score, changed components/weights or coverage,
calibration drift, and a new source without a comparable predecessor do not create
support-change votes. Both features are graded under limits known at activation;
a Roof does not claim a native-unit economic growth estimate. Advanced details retain their replacement effects for audit.
Roofs v6 says **Conflicted · Long leads** or **Conflicted · Short leads** when both
sides contribute and one has more weighted support. A net lead below one third
of gross support is explicitly narrow and Weak. **Balanced conflict · No lead**
means exact cancellation; **Unchanged · No lead** means zero usable support;
**Insufficient evidence** means a required input or comparable predecessor is
missing. Missing evidence never counts as zero confirmation.

Roofs v6 is the public release name. Relationship engine v4 and display engine
v5 are separate internal counters, not the public Roof version. This USD
presentation pass changes neither their calculations nor the EUR scorers. The
next steps are your USD audit, EUR scoring audit/refinement, and then a separate
extension of this presentation to EUR-vs-USD.

Open **direction label → USD relationship catalogue**. The catalogue registers
all **28 macro pairs plus eight Fed/macro pairs**. Select a pair or tick any
larger group; the same resolver composes all 247 macro groups and 255 groups
containing Fed. It shows eligibility and absence reasons at the selected Roof's
activation time. It does not invent 502 extra scoring formulas or context votes.
Switch between **Standalone support at activation** and **Comparable support
changes · seven days**. Release support is the available source interpretation;
fresh support is the change versus a comparable predecessor under the current
calibration. They can oppose each other. ISM compares Manufacturing with prior
Manufacturing, and Services with prior Services, within one 30/70 family budget.
Its two sector changes expire separately seven days after their own publication.

The support bar displays each side's share of weighted support, **not win
probabilities**. For example, equal-budget support of Long 1 versus Short 2
shows Conflicted · Short leads, with roughly 33% / 67% support. Unequal family
budgets or source aging can change the winner; magnitude words alone cannot
decide it. Family weights remain declared interpretation policy, not proven
empirical causal coefficients. Partial evidence stays qualified.

Fed holds add no rate-action direction. A cut or increase is named separately
from the macro support split. An opposing action exposes conflict but does not
claim a numeric winner between basis points and magnitude points. Statements
and speeches are unavailable. **USD-side Raycaster/Candy now expose conflicted leads and support shares; EUR-vs-USD retains its existing gates and presentation.**

NFP v2.2 uses valid supplied revisions for comparable preceding reference months.
Missing consecutive months prevent monthly comparisons and three-month hiring
benchmarks; raw broker fields are retained. The calendar is the currently stored
vintage, so complete original as-published reconstruction is not certified.

When a trade thesis needs directional context, distinguish an amber conflicted lead from a balanced or insufficient output. Gray supplies no direction; an amber USD lead remains qualified evidence. For an existing position, use the review
and exit rules you wrote in Notebook. It is not an automatic opposing signal or
an instruction to close. Record model/market disagreements without assuming the
release caused the price move.

## Read the chart

- **Roofs** connect the source releases behind a relationship on three levels. Hollow circles mark contributing releases; the final filled circle marks publication activation, while an outlined diamond marks aging/expiry availability. Thin connectors lead to the ordinary bottom release-symbol row. Click a dot to inspect its release, or the direction box for **Combo details**. A filled circle without a visible activating release, or any memory diamond, opens Combo details instead. Width connects sources to activation; it does not promise how long the direction lasts. Focused display reduces repetition; More retains omitted roofs. The detailed guide below explains availability and click behavior.
- **Context ribbon (Raycaster Candy)** shows accumulated context across time. Green means pair Long, red means pair Short; stronger shades indicate stronger evidence. Gray means unavailable. Its label identifies USD-side or EUR-vs-USD mode. Hover for the time and responsible update; click for an explanation.
- **Outside events** are your manual gray highlights on the separate thin strip immediately above Candy. Open the header's **Fundamental tools gear → Manage outside events**, enter a title, start/end in the selected display clock and an optional observation/source reference, then Save highlight. The editor works with Candy hidden; enable Candy to see the highlights. Blank end means ongoing. Hover for the note; click to edit or delete it. Overlapping highlights show all active notes. Notes are saved per broker and pair and included in workspace backups.
- **Raycaster** inspects the context at the hovered candle's end, capped at the current time. A publication within that candle can change its result. The ribbon retains the publication's exact timestamp.
- Roofs, Candy and Raycaster have separate icon buttons in the outlined **Fundamental tools** group on the header's right, before Bid/Ask. The waveform toggles Raycaster, upward chevrons toggle Roofs, and the candy icon toggles Candy. The timeframe selector and drawing button stay together in the center. Roof relationships currently use USD inputs, even when Candy compares EUR with USD.
- Inspector shows **Standalone Scoring** on the left and **Context-Aware at Publication Scoring** on the right. An opposing standalone release can coexist with an unchanged combined direction.

The shared gear opens three tabs: **Raycaster** for the inspected result, input contributions and advanced input controls; **Roofs** for saved Focused/All density, experimental combinations and the relationship guide; **Candy** for colors and update timing. The context mode selector applies to Raycaster and Candy together. Inspect a candle with Raycaster visible to retain its breakdown while the popover is open. Opening settings turns on no view and starts no calculation job. Changing inputs or mode can rebuild an already active calculation. Escape/Close restores gear focus; clicking outside dismisses it. Broker, pair or timeframe changes close it.

Chart marker filters control which symbols you see; they do not silently change context inputs. Filter changes apply immediately; Save preserves the filter preference across refresh.

Roofs move with their candles when you pan, preserving their lane, contributing points and activation anchor. Publications in the same chart candle can share a dot; publications in different candles are not merged onto the activation dot merely because you zoom out. The ordinary bottom symbol row remains the full release timeline, including events outside the displayed combos. Its own nearby-symbol grouping is separate from roof dots. Edges may clip a roof label or dot. Zooming or changing inputs/history can rearrange lanes; More retains crowded combinations.

## Read a roof step by step

A roof is a dated interpretation of a relationship between releases. It tells you which information participated and when that interpretation first became available. It does not measure a price move or predict how long a move will continue.

```text
         Earlier input       Earlier input       Activation
               ○-------------------○----------------●
                       [Claims + NFP · Long]
               :                   :                :
Release row   [☁]                 [☁]              [★]
──────────────────────────────────────────────────────── Time
```

The three roof levels are space for labels and connecting lines. Their height is not confidence, importance, or a price level. Solid and dashed styling distinguish established relationships from the experimental fresh-news sequence. Evidence is given in Combo details; a longer line or higher roof does not mean stronger evidence.

### Focused and All roofs

Set **Fundamental tools gear → Roofs → Display density**:

- **Focused** prioritizes specialized ISM/labor/fresh relationships before generic pair annotations, then Strong over Moderate over Weak evidence. Within the same evidence level it prefers nonexperimental relationships, then newer activation times, with a stable identity tie-breaker. It also removes overlapping repetitions with the same relationship type, direction and participating family set. This makes a crowded chart easier to scan; it is a display choice, not a claim that omitted roofs are invalid.
- **All roofs** does not apply the Focused ranking or repeated-relationship suppression. It tries to show the eligible roofs in chronological order using the same three levels and collision avoidance.
- **+N more** retains eligible roofs omitted because of repetition or insufficient room. Open it to inspect their direction, evidence and activation time, then click an entry for Combo details. All roofs still has a physical space limit; it does not promise every label can be drawn at once.

Neither mode changes scores, qualification, selected inputs, Candy, or Raycaster. Zooming may change which labels fit. Panning translates a fixed plan rather than moving each combo to a newly available row.

### What each click opens

| Target | Meaning | Click behavior |
| --- | --- | --- |
| Hollow dot **○** | One or more earlier contributing publications at that chart candle | Opens the contributing release in Inspector. If several publications share the point, opens a chooser with their individual names and exact clocks. |
| Filled circle **●** | A new participating publication makes the complete combo available | Opens the actual activating publication(s), or Combo details if hidden by marker filters. Earlier data in the same candle is not substituted. |
| Outlined diamond **◇** | An aging/expiry memory update makes the snapshot available | Opens Combo details, including the removed evidence when applicable. |
| Direction label, such as **Claims + NFP · Long** | The relationship interpretation captured at activation | Opens Combo details: direction and evidence, why it formed, what changed, exact availability clock, participating releases and their standalone interpretations, and combined context at activation. Advanced calculations are optional. |
| Bottom release symbol | A release on the full event timeline | Opens Inspector or the normal grouped-release chooser. The row also includes releases that are not part of any visible roof. |

Tooltips explain purpose and clock. Memory labels carry compact Aging/Expiry badges; publication labels retain their compact name and direction. Marker filters can hide a contributing symbol without removing its calculation input. Hidden contributors remain disclosed in the roof tooltip and Combo details. If no participating marker is visible, the roof is not drawn; the underlying context calculation is unchanged.

Dot clicks and participant links inspect a release temporarily. They **do not change your date range, selected families, symbol visibility, or preferred Table/Scoring view**. A hidden or out-of-range participant can be loaded separately for its detail panel; this does not replace the chart's release query or shrink its symbol timeline.

Click blank chart space to deselect the release or combo and dismiss an open roof release chooser or More list. Inspector remains open with its normal unselected prompt; chart symbols retain your current range and filters. This does not enable families you intentionally hid, change scoring inputs, or reset the chart viewport. During an active drawing tool, chart clicks retain their drawing purpose; exit drawing mode before using blank-click deselection. Clicking an existing Notebook arrow retains its selection behavior.

### Availability is not an entry instruction

The **final endpoint (filled publication circle or memory diamond) marks the earliest point at which this snapshot can inform a trading thesis**. The earlier span explains where its inputs came from. Do not interpret a Long/Short roof as if its final output were already known at the first hollow dot.

Use the exact clock in the tooltip or Combo details. For example, a combo activated at **19:30 in the selected display clock** may be drawn over the H1 candle beginning at **19:00**. It was unavailable during that candle's first 30 minutes. Multiple publications in one candle may also arrive at different times. A visual anchor at the candle does not backdate knowledge.

Raycaster's hover result is evaluated at the candle's **end**, capped at now. Therefore, hovering the 19:00 H1 candle can include the 19:30 release. Candy retains exact update boundaries. When auditing a potential entry within that candle, use the exact activation/update clocks rather than assuming the hovered output describes the candle open.

An activation can also occur when stored evidence ages and a relationship condition changes, without a new release. An **outlined diamond** marks that availability, with an Aging/Expiry badge and **no new participating publication** explanation in Combo details. This is different from a fresh surprise in the dataset.

### A roof is a snapshot; Candy is the changing context

A roof records what its relationship said when it activated. It is not a continuously renewed approval to trade in that direction. Later publications, memory decay, expiry, or changed inputs may alter the combined context. Check Candy or Raycaster at the time you actually intend to enter or review a position.

A dashed Long roof can coexist with red Short Candy: recent comparable economic score changes favor Long, while the accumulated eligible context still favors Short. That disagreement is information to inspect, not a display error by itself. Roof relationships currently use USD inputs; EUR-vs-USD Candy also includes the selected EUR side, so their directions can differ for that reason too.

The roof ends at activation, not at a calculated expiry time. Its width is neither an active-output period nor a recommended holding period. A roof disappearing when you pan, hide markers or change density is not fundamental invalidation. Those actions change visibility, not the economic inputs.

### From interpretation to a trading decision

```text
Final circle/diamond: snapshot becomes available
                 ↓
Read its reason and evidence; check current Candy context
                 ↓
Wait for your own price setup
                 ↓
Write entry, invalidation, risk and exit rules in Notebook
                 ↓
Consider opening if your written conditions are satisfied
```

You may begin considering the thesis from the final endpoint onward. The marker itself is not a buy/sell signal, and evidence is not a win probability. An aligned release alone does not justify holding; an opposing release is a reason to reassess under the rules written before entry.

For a usable fundamental invalidation condition, name the **output**, **mode**, **inputs**, **evidence threshold** and **trigger** you intend to watch. For example, a paper-test condition might be: “Review my Long thesis when a new publication changes accumulated EUR-vs-USD context to Short with at least Moderate evidence, using the input selection saved at entry.” This is more precise than “close when news is opposite”: a standalone release or experimental roof can oppose the trade while accumulated context remains unchanged. Write separately whether a memory-only change should also prompt review, and what action follows. This example is an audit rule to evaluate, not a validated exit strategy.

Record your independent price invalidation and risk limit alongside that fundamental condition. The Notebook guidance and these overlays support your review; they do not place orders or automatically decide whether to enter, hold or close.

## Before opening a trade

1. Check the current combined context and relevant roofs, then wait for your own price setup.
2. In **Notebook**, write the thesis: why this setup is worth considering.
3. Define invalidation: **What observable condition would make my reason for this trade no longer hold?** Write a price condition and, if relevant, a fundamental condition separately. “A release disagrees” is incomplete: identify whether you mean its standalone result or the combined context, which mode, and what evidence level matters.
4. Define entry, stop, target, risk limit, and review horizon. The chart's planned levels help record these; they do not place broker orders.
5. Choose an exit rule before entry. Save the context mode, input selection and observed bias in the Notebook plan. Pin the setup to preserve the plan as it stood at that moment.

Notebook workflow fields save automatically with the symbol's draft. **Load current context**, then **Record current context**, captures the current interpretation, exact read-through instant, mode, selected inputs, engine version and coverage notice. It does not capture the historical candle under your cursor. Clear workflow starts fresh without deleting the chart's entry/stop/target levels. Pinned workflow fields are read-only; the journal remains available for subsequent observations.

## Review new information

A publication prompts reassessment. An aligned output alone does not justify holding. An opposing output alone does not override your written price and risk rules.

Two **paper-test candidates**, not validated exit strategies, are available in Notebook:

- Reassess when a **new publication** changes combined context against the trade, at any evidence level.
- Reassess when that change has at least **Moderate** evidence.

Record your chosen action in the exit rule. Distinguish a publication from aging, expiry, or a changed configuration. Those can change context without new news. Always apply the independent price invalidation and risk limit you wrote beforehand.

## Audit without reading every number

Record the source, activation time, mode, bias and evidence. Compare price at consistent H1, four-hour and next-day windows. Separate the immediate reaction from later moves. Use roof explanations and Inspector only when you need to investigate a disagreement; Scatter Plot exposes the numerical calibration when needed.

Read Candy and roofs as two different observations. Red Candy with dashed Long roofs means the accumulated context still favors pair Short while fresh USD release changes pull toward Long. A solid ISM roof describes that sector relationship. Roofs use USD inputs; relative Candy can also include EUR readings. Read a roof only from its filled activation dot onward, using the exact clock rather than the containing candle's open, not from the start of its source span.

Add an outside-event highlight when you want to record a possible missing explanation for an audit discrepancy. Your chosen window marks where to investigate, not a measured impact duration or proof of causation. These notes never contribute a vote, modify evidence, or change the dataset. Historical notes may be added later: the editor keeps the actual recording instant separate from the chosen highlight range; both display in your selected clock. An empty strip means no saved annotation, not that no outside event occurred.

Stored values may contain revisions and missing history. Speeches and narrative guidance are not inferred from candles. An unavailable result remains unavailable. Activity shows data/bridge health; Settings workspace backup preserves supported preferences and Notebook records. Bottom docks share their saved height.

## Other tools when needed

- Timeframe buttons change the price view. The paintbrush button opens drawing tools independently of the fundamental overlays; drawings and planned levels help document your own price setup.
- Inspector's calendar limits the visible release horizon. Its filters show/hide event families and choose symbol styles. Grouped ISM and euro-area PMI tables retain their individual series and publication times.
- Scatter Plot shows the readings or scorer signals across history, with automatic calibration, optional manual boundaries and view-only zoom/appearance controls. Adjusting a calculation setting can rebuild context; changing the viewport does not.
- Alert uses the selected broker's calendar schedule and Inspector filters. It is a schedule/coverage tool, not a directional trading recommendation.
- Notebook holds drafts, pinned setup arrows and journal notes. Journal notes use Save Note / Ctrl+Enter; workflow fields save automatically. Notebook and the chart do not execute broker orders.
- Activity helps diagnose stale data or connectivity; Settings exports/imports supported workspace preferences and Notebook records. Keep a backup before an import or a large preference change.
