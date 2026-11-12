# Research workflows

For the usual refresher, open Currency News, choose All or a currency, and Copy
refresh prompt. Paste it into your agent chat. The agent prioritizes the newest
material developments, checks sources and saves the researched currencies.
There is no fixed lookback cutoff. Reload saved news only reloads local results.
A plain `$assess-trade-now` also reviews global ongoing risks and seven days ahead,
prioritizing 48 hours. It maintains sourced global custom stars/notices and new
verified high-impact reminders, respecting off choices, pause and lead time.
These risks appear across pairs and supported currency indices, with separate
currency implications. Unpredictable updates receive an ongoing notice; uncertain
hours never receive a fabricated alarm. See [global risk discovery](docs/GLOBAL-RISK-WORKFLOW.md).

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

Currency News saves do not change reminders; the skill's separate risk review
curates them. The agent leaves technical levels, entries and chart scans to you,
including when you mention JPYX/USDX resistance or reversal. Calendar
Alert bells, manual price alerts, Entry Trade and chart drawings stay independent.
The [news contract](docs/CURRENCY-NEWS.md) owns persistence and timing.
[Short research rules](docs/RESEARCH-RULES.md) and focused reviewed lessons retain
prior failure context; full original records are [archived](docs/RESEARCH-ARCHIVE.md).


Manual price-chart zoom and position are remembered per broker/pair/timeframe
during the session. Returning to a pair restores its bounded vertical view. New
pairs inherit relative zoom in their own price units; the shared date window and
horizontal zoom remain unchanged. Refocus explicitly resets the current view.

## MFDI

Click **MFDI** beside Volume and RSI on any chart symbol. Drag its divider to add
canvas space without stretching the plotted lines. New symbols start with no
currencies ticked; your existing USDX setup is preserved.

Open the gear and use **Inputs**:

1. Tick the event currencies you want. Each currency restores its saved event list,
   even after refreshing or when used on another symbol. Currency choices are not
   restricted to the chart's pair: USD, EUR or JPY events can appear on any chart.
2. Click **+ Add events**, choose an event currency and search or browse categories.
   Tick individual measures to add them. Adding a measure also enables its currency.
3. Use **− Remove** to remove a measure from that currency's remembered list. Simply
   unticking the currency keeps its event list saved for the next time you tick it.
4. Click **OK** to save, or **Cancel** to discard the draft. Each symbol remembers
   its own enabled currencies, selected axis and MFDI on/off choice. Saved currency
   event lists and styles are shared between symbols, independently of Inspector filters.

**Hide Legend** in Inputs hides the coloured actual/release-time readout only.
Eye/F/N controls stay beside each line label, rather than in top toolbar blocks.

Inputs also lets you create, rename, reorder and delete categories. Use each event's
category selector, or drag its inline label into a category in Lane view. Rows snap
into the category; drag within a category to change their order. Drag a category
header to move all its rows together, or use its arrow to collapse/expand it.
Deleting a category keeps its events under Uncategorized. The scrollbar reveals
additional lanes. Membership follows the saved currency event lists; category/row
order, collapse, Lane view and Hide Legend are saved separately for each symbol.

**Style** changes each selected measure's colour, width, dots, forecasts and numbers.
**Reset defaults** restores styles and the selected axis, keeping your selected events
and currency ticks. Missing numeric history stays blank; choose another measure or
scroll to earlier loaded candles. No events selected means no macro calendar polling.

Each event has its own scale, including separate Headline and Core CPI scales:

- Click its label to select its right axis. The eye shows/hides the line.
- **F** shows/hides its forecast curve; a slash means hidden.
- **N** shows/hides actual values above release dots. ↑ and ↓ compare to the previous
  available release. First and unchanged values have no arrow. Event units are retained.
- **Fit axis** fits the selected scale; **Fit axis all** fits every visible scale.
- The **lock** links all visible axes, selecting them together. Dragging/scaling moves
  the group. Unlock to adjust individual scales. Hover and dot selection still work.
- The **three-line button** switches to perfectly straight category lanes.
  Vertical position identifies the event row; values and dates are unchanged.
  Click again to return to the numerical plot.

Click a plotted dot to open its exact release package in Inspector, using the event's
own currency. Its selected measure is highlighted, without changing Inspector's saved
filters or the chart date window. Hover readouts show the release time in your selected
clock. Only released numeric actuals with verified chart timing appear. Monthly lines
join releases; the Fed rate is held between decisions. MFDI calculates no composite score.

Forecasts join their own values with a lighter solid line and hollow rings. Upcoming
forecasts continue with faint dashed lines/rings in the existing future axis. Missing
forecasts break the connection and retain only the schedule line. Forecasts follow the
eye/dot choices and never refit scales. Existing USDX payroll forecasts remain enabled;
newly added event forecasts start hidden. Saved official Fed upper bounds and survey
consensus apply only to the exact Fed rate series. Hover a Fed dot for consensus values.
See the [Fed consensus reference](docs/MFDI-FORECASTS.md).

All scale bounds survive scrolling, backfill, live updates and axis switches. Linked
axis movement lasts while the pane is open; saved lane/category settings survive refresh. Successful
charts show no static source caption; loading/error/empty messages appear as needed.

## Volume

1. Click **Volume** beside RSI in the chart header. Drag the divider to resize
   its pane. RSI and Volume can be shown independently.
2. The pane controls are **Axis: Volume / Relative**, then
   **Bars**, **Relative**, **Average**. The last three buttons independently
   show/hide the histogram, exact Relative line and raw-tick SMA. Their pressed
   states show which layers are visible. All controls remain available with
   every layer hidden. The Average applies in Raw mode and is disabled in
   Relative mode. Visibility persists across symbols/reloads and matches the
   Volume gear's **Style** tab. Use **Inputs** for average length and baseline
   settings, including choosing Raw or Relative mode.
3. In Raw mode, the axis button chooses which visible series the right axis
   resizes; the other uses an independent hidden automatic scale. When only
   one kind remains visible, the axis follows it. Relative bars and the Relative
   line share the right × scale. In Raw mode, clicking the axis selector reveals
   the chosen layer if hidden. Choose bar mode through **Inputs → Mode**.
   Double-click the right axis to restore automatic
   scaling. The Relative line joins exact candle values without smoothing, stays
   above the bars and has a dashed **1×** reference for normal activity. The
   optional raw average does not smooth this Relative line.
4. The upper-right readout keeps stable fields:
   `| Ticks 13,261 | Relative 0.90x | Matches 19/20 |`.
   All four session names stay visible below it: active names are red, inactive
   names grey. Hover follows the selected candle; leaving hover returns to now.
   Sessions match the header's indicative regional hours, including overlaps
   and historical daylight saving. Both indicator legends have transparent
   backgrounds behind their text. Broker holidays may differ.
5. Relative activity compares a candle with matching candles in up to **20 prior
   sessions**, requiring at least **5** matches by default. Matching uses the same
   session combination and elapsed time within that period. Multi-hour candles
   match the same session mix without splitting ticks. D1 uses earlier broker
   daily bars. Hovering never changes the plotted baseline. If Relative is a
   dash, scroll left to load earlier history. Future candles and the current
   session never enter their own baseline. Unknown broker clocks stay unavailable.
6. Readouts keep genuine zero ticks as zero. Missing counts remain unavailable.
   Without a loaded candle covering now, the readout says **No current candle
   loaded**. Tick counts measure updates on this broker's feed, not lots traded.
   Bar colours follow candle direction, not buy/sell volume. No entry, direction
   or reversal signal is generated.

## Currency Detail

Click **Detail** beside Show events for S/A/B/C fundamentals of the active pair.
EURX, JPYX and USDX show only their currency. Full-width tier subheaders group
equal-width currency columns. Equal-height event blocks contain the
Previous reading, Latest actual and Next upcoming forecast in labelled cells,
then Released at, Next Release and the original Source link. Missing values show
a dash; the forecast is for the next release, not old consensus. Hover ⚠ for a numeric
conflict. Tier List Info shows the general reference and your active currencies'
tier table; its Close button returns to the comparison. Alert uses the same tiers.
Copy refresh prompt runs no research until invoked in the agent chat; the skill
refreshes News and Detail together. See [Currency Detail](docs/CURRENCY-DETAILS.md).
