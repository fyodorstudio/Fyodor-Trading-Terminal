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


Named MFDI presets save currency/event selections, colours, eye/F/N and dot choices,
categories/order/collapse, straight-lane positions, spacing, vertical scroll,
linked movement and numerical axis placements. The working layout saves locally
and restores after refresh across every symbol. Currency ticks hide/show without
packing other lines upward; retained lane anchors restore when re-enabled.
In **Series**, choose a preset to load it, enter a name and **Save as…**, or use
**Update preset** to overwrite that saved snapshot. Working edits never silently
overwrite named presets. In **MFDI settings → Inputs → Named presets**, load,
create, update, rename, duplicate or delete presets, and export/import a JSON
backup. Settings and library edits stay drafts until **OK**; **Cancel** discards
them. Import adds copies rather than replacing existing presets. Loading a preset
keeps the price chart's date window and does not fit the MFDI lines.
Saved numerical mappings preserve pixels per unit and top placement when pane
height changes. A smaller viewport may clamp scrolling while retaining the saved
scroll for when space permits. Fit/reorder actions deliberately rearrange lines.
Storage is local to this browser/app profile; export a backup to transfer it or
protect it before clearing site data. A storage failure is shown in MFDI's status.

Click **MFDI** beside Volume and RSI on any chart symbol. Drag its divider to add
canvas space without stretching the plotted lines. MFDI uses one universal
configuration on all symbols, so changing pairs retains visibility, enabled
currencies, event styles and layout. Migration adopts the current symbol’s saved
setup and retains the older profiles. A fresh setup has no currencies ticked.

Open the gear and use **Inputs**:

1. Tick the event currencies you want. Each currency restores its saved event list,
   even after refreshing or when used on another symbol. Currency choices are not
   restricted to the chart's pair: USD, EUR or JPY events can appear on any chart.
2. Click **+ Add events**, choose an event currency and search or browse categories.
   Tick individual measures to add them. Adding a measure also enables its currency.
3. Use **− Remove** to remove a measure from that currency's remembered list. Simply
   unticking the currency keeps its event list saved for the next time you tick it.
4. Click **OK** to save, or **Cancel** to discard the draft. The same enabled
   currencies, selected axis, layout and MFDI on/off choice apply to every symbol.
   Currency event presets remain reusable, independently of Inspector filters.

**Hide Legend** in Inputs is ticked by default and hides the coloured actual/release-time
readout only. An explicitly saved unticked choice stays unticked.
**Series** opens a drawer from the pane's right edge. Eye/F/N controls are aligned
in fixed columns there, with a ✥ drag handle before the eye and a colour circle
to the right of N. Click the circle
to change the series colour. Previews update the line, dots and forecasts
with a small 80 ms interval to keep the picker responsive. The final colour is
applied immediately and saved when you finish (confirmation or leaving the
picker), rather than saving every drag sample. Event names and controls live only in the drawer.
The top **All series** eye/F/N row toggles the selected events together, including
collapsed categories. If any are on, a click turns them all off; the next turns
them all on. Unticked currencies keep their saved settings. Close the drawer with ×, Escape
or Series. Opening it does not resize the chart or change its zoom. Scroll with
the wheel anywhere over the window. Hold its **Series** title to move it around
the chart (or focus the title and use arrow keys); closing/reopening retains
that window position while the pane stays open. Drag the bottom-right grip to
resize the window horizontally and vertically, or focus the grip and use arrow
keys. The size also stays when you close and reopen it while the pane is open.
When Inspector reduces the chart height, the popover body shortens while its
title stays reachable and draggable. Closing the dock restores the chosen size.

Inputs also lets you create, rename, reorder and delete categories. Use each event's
category selector, or hold its ✥ handle in the Series drawer and drop it on a
category in either view. The destination highlights, and the plot stays still
while dragging. Rows snap into their new category on drop; dragging within a
category changes their order. Dropping outside the popover cancels. Event names
select the chart series and do not start category drags. Category headers are
not draggable; use the up/down category buttons in settings to reorder categories.
Click anywhere on a category arrow/name button
to collapse/expand its drawer list and select every child. Plotted lines stay
visible and keep their positions in both views. With the lock off, drag the plot
to move the selected category together; click an event name to return to selecting
one line. Selecting a category or event turns the lock off. Clicking blank chart
space or elsewhere outside the chart returns to linked lanes and clears the
category highlight. Series controls, MFDI settings and release-dot clicks keep
your current selection. The selected category is highlighted, including when
its list is folded.
Deleting a category keeps its events under Uncategorized. The scrollbar reveals
additional lanes. Membership follows the saved currency event lists; category/row
order, collapse, Lane view and Hide Legend use the same shared configuration
on every symbol.

**Style** changes each selected measure's colour, width, dots, forecasts and numbers.
**Reset defaults** restores styles and the selected axis, keeping your selected events
and currency ticks. Missing numeric history stays blank; choose another measure or
scroll to earlier loaded candles. No events selected means no macro calendar polling.

Each event has its own scale, including separate Headline and Core CPI scales:

- Click its drawer label to select its right axis. The eye shows/hides the line.
- The colour circle after N opens a native colour picker; the saved colour updates the line.
- **F** shows/hides its forecast curve; a slash means hidden.
- **N** shows/hides actual values above release dots. ↑ and ↓ compare to the previous
  available release. First and unchanged values have no arrow. Event units are retained.
- **Fit axis** fits the selected scale; **Fit axis all** fits every visible scale.
- The **lock** links all visible axes, selecting them together while keeping the
  Series popover free of persistent selection highlights. Dragging/scaling moves
  the group in numerical view. In Lane view, drag the plot to move all rows
  vertically together. Wheel input scrolls the pane vertically with the lock
  either on or off, without changing spacing or horizontal zoom. Use **Lane
  spacing** in Series to change spacing. Hover and dot selection still work.
- With Lane view on and the lock off, click an event name in Series, then drag
  the plot to place that line freely. Other lines stay put; original numerical
  scales are retained. Dropping its ✥ handle into a category restores its row position.
- In the Series drawer, **Fit all lanes** restores the category arrangement and
  brings expanded rows into view; **Lane spacing** adjusts their spacing.
  Group offset, spacing and individual placements survive refresh across all symbols.
- The **three-line button** switches to perfectly straight category lanes.
  Vertical position identifies the event row; values and dates are unchanged.
  Click again to return to the numerical plot.

Click a plotted dot to open its exact release package in Inspector, using the event's
own currency. Its selected measure is highlighted, without changing Inspector's saved
filters or the chart date window. Hover any actual release dot for an anchored
card with Actual, Forecast, Previous and the release date/time in your selected
clock. Previous is the release's supplied previous value. Missing values show a
dash; zero remains a value. This works in both views and for every selected event. Only released numeric actuals with verified chart timing appear. Monthly lines
join releases; the Fed rate is held between decisions. MFDI calculates no composite score.

Historical forecasts join their own values with a lighter solid line and hollow rings.
Upcoming releases use faint value dots instead of vertical schedule lines, with
connections at 25% opacity. These release previews stay visible with F off, and
follow the series eye/dot choices. A displayed pending dot keeps its forecast
until the observed actual arrives; then it becomes solid and displays the actual
value inside. Those newly published dots remain clickable for Inspector.
Missing forecasts break connections. Lane view can show a dash; numerical view
leaves the unknown-height marker blank. No values or actuals are inferred.
Existing USDX payroll forecasts remain enabled;
newly added event forecasts start hidden. Saved official Fed upper bounds and survey
consensus apply only to the exact Fed rate series. Its card uses that saved primary
consensus in the Forecast column where available.
See the [Fed consensus reference](docs/MFDI-FORECASTS.md).

All scale bounds survive scrolling, backfill, live updates and axis switches. Linked
axis movement, numerical bounds and saved lane/category settings survive refresh. Successful
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

## Cross-Asset heatmap

Click **Cross-Asset** beside Ledger in the bottom bar. Drag horizontally, vertically
or diagonally through the timeline to browse
daily winners and losers; hover a date to see its ranking. Click a date or cell to
pin it while researching, then **Unpin date** to resume hover. **Weekly** changes
each column into a trading week; the current week shows week-to-date readings.
**Today**, the date input and year arrows navigate independently of your chart.

**Instruments** adds/removes broker-visible symbols and the eight synthetic
currency baskets. Use category/search controls to find FX majors/crosses, equity
indices, XAUUSD, SpotBrent and other instruments. In the grouped **Selected** list,
use arrows beside a category heading to move the whole category (for example
Metals above Energy), and arrows beside a symbol to reorder within that category.
Save named watchlists for reuse; **Save** commits all draft edits,
while **Cancel** discards them. These choices do not change Market Watch favourites.

Adding an instrument loads its missing history while keeping existing readings
visible. After the first opening, the heatmap keeps updating in the background
when closed or while another dock is open. Reopening restores the warmed data,
pinned date, category collapse and browsing position immediately.

**Copy Details Only** copies the selected date (or full week range), categories and
O/H/L/C percentage changes only. It includes every selected instrument with an available
reading, sorted highest to lowest within each category, regardless of ranking
filters or collapsed groups.

To copy several dates, enable **Copy range** and set **From / Through**, or click
the first date then Shift-click the last date/cell. The inclusive range is
highlighted. **Copy Details Only** includes each date separately, earliest first,
omitting dates without readings. Weekly mode copies each week with its full date
range. Selection uses the displayed year's loaded columns; it does not load other
years or add research commentary. **Single date** or a normal date/cell click
returns to copying one date. Changing year or Daily/Weekly clears the range.

**Copy Research Prompt** copies the same selected changes plus a short prompt and
definitions for a fresh agent chat. Paste it into your agent when you want current
opportunities: the prompt focuses on remaining repricing and asks for the affected
market, buy/sell bias, a brief catalyst explanation and the decisive source. It
includes the broker, copy time, return calculation and synthetic basket method.
Copying does not run research or save anything; the receiving agent researches
current conditions when you submit it.
Both copy buttons mark unfinished dates **In progress (day to date)** and
unfinished weeks **In progress (week to date)**. The research prompt explains
that those changes are provisional readings, not final closing returns, and
distinguishes the time of copying from the last market update.

**O · H · L · C appears side by side** in each timeline cell and ranking entry,
and in both copy buttons. These are percentage changes from the same previous
close: opening, highest, lowest and closing price. C is the net return and uses
the latest available reading while in progress. O includes the opening gap; H/L
includes the wicks. A small net loss can appear alongside a much deeper L reading
after a recovery. Weekly uses its first available opening, whole-week high/low
and last available close versus the prior week's final close. Shading and ranking
still use C. Synthetic baskets show C with O/H/L dashes because this model does
not construct a synchronized basket OHLC path. No extra requests are needed.

Scroll to **Wildcards** at the bottom and click **+ Add wildcard**. Enter a short
story title and your own paragraphs or source links, then **Save**. Each story
keeps the usual row height; click its dated cells to add or edit notes. Filled
cells have a note icon and hover preview. In Weekly mode, a cell shows its note
count and opens that week's daily notes in date order. Notes retain their dates;
the editor's date field can add another day, and blank details remove that day's
note on Save. **Copy note** copies your current title/date/details.

**Manage Wildcards** (also opened by clicking a story label) renames/reorders rows,
archives/restores stories and exports saved notes as Markdown, including archived
stories. Archive preserves all notes. Delete explicitly confirms removal of the
whole row and its notes, then requires **Save**. **Cancel**, Escape or closing the
editor discards drafts. Failed saves keep your draft. If another tab saved first,
copy your draft, Cancel, **Reload Wildcards**, and reapply the edit.
Wildcards are stored per broker in the terminal's durable storage and included in
storage backups. Watchlists do not replace them. Notes never invoke research or
change your chart, calendar, News, reminders or alarms.

Cells show net change from the previous close, including gaps. Weekly compares
against the prior week's last close. **Shading** can highlight the raw percentage
or movement relative to each instrument's earlier volatility. Hover a cell for
its dates and calculation details. Missing candles or incomplete seven-currency
coverage stay blank. **Method** explains the basket construction, timing and
limitations. **Refresh** rereads the selected instruments. This is price evidence
for your catalyst/risk-appetite research, not a measurement of capital-flow amounts.
See [Cross-Asset](docs/CROSS-ASSET.md).

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
