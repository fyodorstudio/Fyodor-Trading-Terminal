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
