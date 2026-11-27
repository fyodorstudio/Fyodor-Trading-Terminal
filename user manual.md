# User manual

## Charts

Select a symbol in Market Watch and choose a timeframe in the chart header.

With Pepperstone-Demo connected, **Currency indices** includes synthetic
**GBPX**, **CHFX**, **CADX**, **AUDX**, and **NZDX** alongside the broker's
**USDX**, **EURX**, and **JPYX**. Each synthetic index tracks its currency
against the other seven majors with equal geometric weights. Its base is 100
at the broker session open on 6 January 2025. Recent candles use synchronized
one-minute opens and closes. Older D1 candles use the constituent daily opens
and closes, with wicks sampled from synchronized H4 observations where available.
With only daily data, the candle shows its open and close as a body.
Synthetic price alerts monitor the live index level
calculated from all seven constituent Bid quotes. Alerts wait when any quote is
missing or stale. Synthetic charts show quote activity in the Volume pane. Inspector icons follow
the chart's own currency, such as GBP releases on GBPX.
Inspector shows saved release dates with a blank Actual when the result is
unavailable. MFDI uses grey markers for past releases without an actual on
selected series. A last known schedule may differ from the final publication time.
The Inspector release heading shows the sources for its schedule and readings.
The MFDI box tooltip identifies the forecast provider and shows Actual minus Forecast.
Pan or zoom to browse history. **Refocus** returns to the latest candles.
Timeframe changes retain the selected dates and price bounds in either direction.
Pairs remember their own price bounds; a new pair inherits proportional vertical
zoom and position in its own price units. The selected dates carry across pairs.
Very narrow views may temporarily widen at the chart's minimum candle span on a
higher timeframe; returning restores the original dates.
The drawing toolbar adds and edits chart drawings. **Inspector** opens calendar
release details; **Show events** opens recent/upcoming releases.
Display timezone and theme are available in Settings.
The chart header’s **Event icons** button cycles through Off, Wildcards only,
Inspector only, and All. It starts on Wildcards only and remembers your choice.

MFDI's currency tabs, Fit, lock and lane controls share one toolbar row.
Choose **A-P Delta** beside Series to compare filled actual and hollow forecast
markers with the release's reported Previous. Higher is green, lower is red,
and unchanged is gray.
**Invert unemployment and jobless claims in A-P Delta** in MFDI settings
makes lower values green for those series across all currencies. The release
tooltip shows the signed delta. Each box's color
continues along the following line until the next actual release. The lane after
the next forecast box is gray. Forecast markers without a comparison are gray.
**Custom Color** restores your saved styling.

## News Flow

Click the newspaper button immediately right of **Heatmap Ranking** in the chart
header. The right panel lists collected headlines; click a title to open its
source. Drag its left edge to resize it. Escape or × closes it.
Left of the calendar, the provider button opens a checkbox list with All/None.
The search button to its left searches cached headlines within the selected
providers, date and checked classifications, including results beyond the current
page. Clear the search with ×. Provider visibility shares the Settings preference.
Each provider's whole row, including its name, toggles its checkbox. Related
feeds share publisher groups: Reuters, Federal Reserve, Bank of England, Bank of
Canada, RBA and EIA, when multiple feeds are configured. A group checkbox toggles
all its feeds; a mixed checkbox means some are selected. Expand the group to
change individual feeds. This also updates the providers used for sound alerts.
The calendar icon opens the date picker directly; the selected date's × clears
that filter.

The copy icon beside the right-panel paging buttons, and beside the date controls
in Extended View, opens **Copy headlines and links**. Choose Last 1 hour/day or a
custom number of hours/days, then Copy. The range ends now; a day means 24 hours.
It uses that view's provider, classification and search filters
across all matching pages, newest first. It replaces the calendar date with the
rolling range and copies collected news only; it does not fetch missing history.
The clipboard contains only each headline and its link, separated by blank lines.
Empty/failed exports leave the clipboard alone. If clipboard permission is denied,
select the provided text and copy manually. More than 10,000 matching headlines
requires a shorter range or narrower filters; results are never silently cut off.

The tag button opens **News Flow Extended View**, a wide centered modal with
**Browse providers / Settings** tabs. Named provider tabs replace the
dropdown and arrows. Browse has its own date and Recent control; it does not
change the combined right panel's date. Provider tabs scroll horizontally.

The expanded pack has 52 active default subscriptions, including targeted Reuters
FX/oil/equities/metals/Japan economic news, Kitco, RBNZ, SNB, regional economic
releases, Japan MOF and EIA. New public feeds add Bloomberg, WSJ, MarketWatch,
Barron's, Financial Times, CNBC, investingLive and Investing.com. Fetching
headlines is free; linked articles may have paywalls. All enabled sources merge
into the combined feed.
Some arrive directly by RSS/Atom; additions delivered through Google News say so
in their provider names. After restarting storage, the upgrade adds the new
sources while preserving your provider settings, cached headlines and keywords.
See the [source catalogue](storage/news_flow/SOURCES.md) for exact coverage.

**All / Priority / Included / Excluded** classify headlines in either reader. All shows
everything in the selected provider/date scope. **Trading relevance** in Global
settings is enabled by default. It focuses Included on eight currencies, Brent,
gold/silver and stock-index drivers. Broad terms such as Trump, Japan, earnings,
AI and stock need market context. Verified official policy/speech and economic
releases can qualify even without a keyword. Explicit Exclude always wins;
everything else is Excluded. Uncheck Trading relevance for literal matching.
Read the label on each headline for its reason; All/Excluded remain inspectable.
Included/excluded rows default to red/grey; Settings lets you choose both
colours. Text labels explain explicit exclusions versus No include match.
Colours represent relevance, not market direction.

Keywords appear as removable tags. Type a word/phrase and Enter, or paste a
comma-separated list; X removes a tag. Matching ignores case and uses word
boundaries, so AI does not match said/retail. Currency pairs such as EURUSD also
match USD/EUR tags. Each list supports 500 tags/16000 characters. A broad editable
market preset is added once to existing Include tags, covering currencies and
cross-asset drivers. Existing Exclude tags are preserved; new lists start empty.
Typing narrows the existing tags and flags duplicates. Moving to another setting
also saves a pending valid keyword. Japan matches Japanese; Democrat matches
Democrats/Democratic. These variants also apply to Exclude and sound alerts.

**P1** shows strong attention candidates and your manually starred links.
**P2** shows other relevant material with unknown importance; **Excluded**
shows irrelevant material. Check any combination to read the tiers together.
Check all three to see everything, or clear all to show nothing. A central-bank mention or
ordinary forecast does not automatically become Priority. A short label explains
why a headline was promoted. Explicit Exclude still wins. Priority is not a
prediction of volatility, direction or a suitable trade entry.

The compact toolbar includes sorting and the selected date's clear button.
Hover the information icon at the bottom for provider availability and retry details.

The sort selector offers **Newest collected / Oldest collected / Newest published /
Oldest published** on desktop and phone. Newest collected is the default so late
feed discoveries appear first. Repeated polling does not reset collection time.
Both timestamps remain visible; the calendar still means publication date, and
Wildcard drafts retain publication time. Missing/future dates use labelled fallback.
Copy's rolling window continues to use publication time, irrespective of sorting.

Settings has **Global** and **Providers** tabs. Global contains keywords,
colours and the single sound setting for all selected providers. Providers
contains provider editing, polling and visibility. The fetch interval defaults to **1 second** for every provider. Set an
individual provider to 60/120/180/300 seconds for 1/2/3/5 minutes, or another value
up to 3600 seconds, then Save provider. Rate-limit cooldowns remain respected
through Refresh, interval edits and restarts. Source errors identify retry times.
**Show this provider** affects the combined reader/alerts without stopping collection.

The **bell immediately right of Search** opens headline alarms and phone setup.
The same controls appear in Global. Choose **Off / Included headlines / All new
headlines**, Chime/Bell/Pulse and Preview / enable audio. Included headlines
covers both Priority and Included; All ignores keyword rules. Both use selected providers,
independent of displayed tab/date. New collection can alert even when publication
was earlier. Startup snapshots, first provider loads, historical imports, edits
and known URLs stay silent. Blocked audio is shown as waiting, with one coalesced
sound recoverable within one minute after a gesture; older sounds do not replay.
The bell retains matching links plus collection/publication times for the last
alert. Desktop sound works with the panel closed while the page stays open.

For Android, install **ntfy** from Google Play. `pnpm dev:all` also builds the
mobile reader and starts private local ntfy. The bell shows Server, Topic and a
concealed reader login: add your own server subscription in ntfy, allow Android
notifications and keep Instant delivery enabled. Choose the shared News alert trigger and Send
test notification, then confirm receipt on the handset. Open Phone news page in
the phone browser with the same login. It shares PC headlines and keyword rules;
phone browsing filters do not change PC alerts. Notifications continue when the
browser closes while PC/storage run. Home LAN only; no public hosting or paid API.
See [Android setup and troubleshooting](storage/news_flow/PHONE.md).

Provider settings also has **Fetch diagnostics**: recent minute summaries of
successful checks, unchanged responses, HTTP 429 and errors, plus collector
starts/heartbeats. Records are retained for 24 hours without response bodies.
It helps investigate future delays; earlier feed availability cannot be recreated.

The top-right star and **Add Wildcard** icons have hover tooltips. Relative ages
update even when the feed is unchanged. A publication-to-collection gap of at
least a minute shows **Published ... ago / Collected ... ago** separately (exact
times in dated views). Hover Collected to see the previous successful check when available.
Ordering still follows publication; collection does not claim the news is fresh.
Missing or future publication times show
**First collected … ago**, using when the terminal first saw the item. This age
does not reset on polling and is not the release time. Ordering and calendar
filters use this same timestamp. A time at least one minute beyond first
collection is treated as scheduled; the fallback remains stable after that
scheduled date passes. Hover to see the original feed-supplied time and the exact
first-collection time.

**Add Wildcard** opens the existing editor with title,
source link, available feed text and the timeline timestamp. Missing or scheduled
publication times use first collection, labelled Collected at; the draft details
retain an original scheduled timestamp when supplied. This is not
Google's indexing time or proof of the underlying event's release time.
Save to place the marker automatically on the containing candle, or nearest
real candle across a market gap; equal distances choose the earlier candle.
The original timestamp stays unchanged. Nearby weekend markers can use a chart
edge, but distant missing history never snaps to an unrelated candle. Marker
tooltips retain the original time. Return from the editor to the extended view
without losing its selected date/tab/scroll position. Existing manual entries
remain editable; there is no required chart-placement click for news drafts.

The calendar fetches older headlines on demand. Heatmap's daily **News for this
date** opens News Flow using broker-session boundaries, including DST. Manual
date edits return to the display timezone. Weekly/event-window shortcuts remain
disabled. Historical coverage may be incomplete; custom unsupported feeds report
cached-only results. Refresh/Retry respects provider cooldowns. Local cache and
Priority stars survive restarts and storage backups; browser preferences remain
browser-local. No article-version archive or per-headline price-return boxes.

## MFDI

Click MFDI beside RSI and Volume. Select a currency tab, then open **Series**.
The window title identifies the currency being edited. Each currency starts with
essential policy, inflation, labor and growth events and remembers later edits.
Use **Export selected series** in MFDI settings to save the selection across the
eight currencies for a calendar audit.
Use **Copy Prompt** beside Series to ask an agent to update upcoming MFDI releases
and forecasts for the next 14 days.

**+ Events** opens that currency's searchable calendar. Check or uncheck events
there; choose a destination category when adding a numerical series. Selected
speeches and announcements share the **Speeches / Wildcards** row with global
manual Wildcards. Missing catalog series are identified in the event picker.

Drag event handles within or between categories. Drag category handles to reorder
whole groups. Focused handles also support Up/Down keys. The vertical chart order
matches the Series list. The fold arrow folds only the list; a category's eye hides
its plotted rows while retaining individual event visibility choices. Click a
category name to select it. **Empty groups** reveals unused category drop targets.

Use **+ Category** for groups such as CFTC. A custom category's **⋯** button opens
Rename and Delete. Deleting a category moves its events to Uncategorized. Category
names and colors are shared across currency tabs; order, folding and hiding are
remembered separately for each currency.

Each numerical row has an eye, **F** for all forecasts, **N** for value text, a
color picker and **⋯** for line width/removal. A category color updates its events
across currency tabs; individual event colors remain editable. **All series**
visibility includes the shared text row. Its F/N controls apply to numerical rows.

**Lane view** uses straight rows with event names at the left. With the lock on,
drag vertically to scroll all lanes; the wheel and scrollbar use the same position.
The first and last rows remain reachable. **Lane spacing** adjusts spacing;
**Fit lanes** resets scrolling and fits as many readable lanes as possible.
Click blank space to turn the lock on and clear Series selection highlights.
Selecting an event or category turns it off. In numerical view, selecting an
event chooses its right axis; the lock links numerical-axis movement.
Resizing the pane changes its height without panning or zooming the price chart.
**Fit axis** and **Fit all axes** deliberately fit visible readings.

Actual rectangles are filled; forecasts are outlined. Dense views retain dots
where value boxes overlap. Hover for values and release time; click an actual to
open Inspector. Number arrows compare successive actual readings. Hover shared
text dots for their contents; click to keep their tooltip open.

The settings gear opens **Appearance**: value placement, value readout and line
width across all currencies. OK saves the draft; Cancel discards it. **Reset
appearance · all currencies** restores category colors, line widths and value
markers while retaining event selections and visibility. Series edits save
immediately. Working settings live in the browser profile; clearing browser data
removes them.

## ATR, RSI and Volume

ATR, RSI and Volume can be shown independently and resized with their pane dividers.
Click **ATR**, immediately left of Volume in the chart header, to show or hide its pane.
The ATR gear opens settings for length, line color and thickness. ATR defaults to
14-period Wilder smoothing (RMA) of true range, including gaps from the previous
close. Values use price units and the active chart timeframe, and update with the
current candle. Hover over a candle for its ATR value. Visibility and settings
are saved across reloads and shared across symbols and timeframes.
RSI settings include period, smoothing and bands.

Volume supports Raw tick counts and Relative activity. **Bars**, **Relative** and
**Average** toggle its layers. In Raw mode, **Axis** selects the draggable scale.
Relative activity compares matching session candles from earlier days. Scrolling
left loads more history for comparison. Tick volume counts broker price updates.

Select **Tick Delta** in Volume settings, then turn on **Volume** in the chart header.
On a synthetic index, **Volume** opens Tick Delta directly in the pane below the
price chart. In the Bars view, upticks plot above zero and downticks below. Visible history loads
automatically as you pan.
Hover a candle to see its exact upticks, downticks and unchanged quotes. With the
pointer away from the chart, the readout follows the latest candle. Broker symbols
use the Bid/Ask midpoint. Synthetic indices use the basket's
Bid inputs and group updates that share a millisecond. These counts describe quote
movement. Trade sizes and aggressor sides are separate data.

Switch between **Uptick / Downtick Bars** and **Delta Line** in the pane. In
**Delta Line**, **Total Ticks** counts all observed updates, including unchanged
and unclassified ticks. Delta plots upticks minus downticks. Its dots use the
line colour except when positive delta meets a down candle or negative delta
meets an up candle. Both divergence colours default to yellow and can be set
independently in **Volume → Style**. The same tab has separate dot switches for
Delta and Total Ticks. Use the pane checkboxes to show and hide lines. Select a line
and drag the right y-axis to resize it.
Double-click the axis to return the selected line to the shared automatic scale.
With both count lines on the shared scale, crossings show where their counts
meet. The pane saves the visibility and axis selection. In
**Volume → Style → Candle delta numbers**, choose **Above candle** or
**Below candle** to see signed delta on the price chart. Set the positive and
negative colours separately. At tight zoom, hover a candle to show its number.

On Pepperstone-Demo, **Currency Activity** ranks all eight major currencies by the
sum of broker ticks in each currency's seven FX pairs over the selected candle.
A pair's count contributes to both currencies. A currency with missing pair data
shows **Unavailable**.

Select **VP** beside **MS** to show the Tick Volume Profile on the price chart.
**Follow Mode** shows a moving box with a saved lookback in chart minutes. Pan
the chart to move candles through the box and use its handles to adjust the
lookback or its position in the viewport. The box counts each candle's timeframe
and keeps its width across session gaps at the same zoom. Zoom changes the
box's width in pixels. The last profile stays visible while the new range loads.
For **Fixed Range**, select **Draw range** and drag a box over the candles. Its
left and right edges set the time window. Right-click inside the box to clear it.
For **Vertical Line**, select **Place line** and click a candle. Choose **Left**
to calculate from the earliest loaded candle up to the line, or **Right** to
calculate from the marked candle through the latest loaded candle. The marked
candle belongs to the right side. Drag the line to move the boundary.

Use the gear beside **VP** to open **Inputs** and **Style**. **Inputs** controls
the range and calculation. **Style** controls placement and the colours of
profile bars, **POC**, **HVN**, and **LVN**.

**Exact Ticks** counts MT5 ticks in each price band. Bid-based charts use quote
ticks, including updates where Bid stays flat. Last-based charts use trade
ticks. Custom currency indices count changes reconstructed from the seven
constituent Bid feeds, grouped into one observation per millisecond.

**POC** marks the busiest band, while **HVN** and **LVN** mark prominent local
peaks and dips.

Under **VP → Inputs**, preload the current symbol or all 36 instruments. Open
**View all 36 preload symbols** for the eight currency indices, seven USD majors,
and 21 crosses among the eight currencies. The bridge processes broker history
from newest to oldest. It saves exact
price counts by minute and day, so different historical windows can reuse the
same cache across symbol changes and restarts. Reopen settings to check
progress, pause, resume, or cancel. A bridge restart preserves the position
of a saved preload. Missing broker history appears as a coverage gap. **Retry**
rechecks it. The live end continues to refresh from MT5.

Choose **Arm alert** on the VP or open **VP Alerts** beside Market Watch and
Price Alerts. Choose the level and trigger for the current symbol. A live
lookback can alert on a new level, price reaching a level, or both. A selected
fixed window can alert when price reaches one of its levels. The terminal
needs to stay open to monitor armed alerts.

## Replay and sessions

Open **Replay** in the bottom dock. Drag the playhead to a completed candle or
press **Play** to start near the end of the loaded history. Use **Load earlier
candles** to extend the timeline and **Return to live** to leave replay. Use the
speed selector for 0.25× through 2×. You can pan, zoom, and hover while replay
runs. Use **Refocus chart** to follow the playhead again. Candle indicators,
MFDI, and VP follow the playhead. Opening an MFDI release pauses replay for
inspection. Armed alerts keep monitoring the live market.

The chart axis shows the year at its right edge. Hover a candle to see its
abbreviated weekday, full date, and time in the display timezone. In the rightmost **Settings** popover,
**Session cursor** adds a dashed line for the hovered candle to the header's
Jakarta session timeline. The solid line marks the current time. **Session
breaks** adds the regional opens and closes as vertical guides on intraday charts.

## Heatmap

Open **Heatmap** in the bottom dock. Daily/Weekly shows one month at a time;
use the month picker or previous/next buttons to browse, or jump with Date.
Weekly columns retain the full weeks overlapping that month. Click a date header
to select a column and inspect its ranking. **Instruments** edits the watchlist and order.
**Visible fields** selects O/H/L/C. **Copy Details Only** exports selected readings
with the copy date and time, including seconds, in WIB (Asia/Jakarta, UTC+07:00).
**Copy Research Prompt** ranks potential incomplete-repricing opportunities across
all selected asset classes, preferring FX when setups are comparable, and adds
calculation context.
Click an instrument cell to select just that instrument/date. **Ctrl-click** adds
or removes individual cells, including scattered dates. **Shift-click** selects
whole date columns between the original selection and the clicked date.
**Clear** or **Escape** clears highlights. Dragging still scrolls the heatmap.
Highlights determine exactly which readings are copied; **Copy options** controls
fields and the default instruments used when no cells are highlighted.
**Copy range** also lets you enter date boundaries within the displayed month.
Changing months clears highlights. **Event window** provides
intraday views between selected times; highlights override its default summary
or candle-sequence export format.

Ranking offers **Details** (O/H/L/C), **Bars** (net C return), and **Note**, with the same
remembered choice in the bottom dock and standalone **Heatmap Ranking** panel.
In **Note**, click an instrument or basket to expand its text box. Notes save
automatically in this browser for the broker, instrument, and selected period.
Bars share a symmetric scale around zero. The default **Largest moves** sort ranks
gainers and losers by the size of their net percentage return, without a multiplier.
Other sort choices are remembered after this default is introduced.
Sorting by **Largest unusual moves**
keeps bars measured in return percent and shows unusualness separately in ×.
Ranking follows the active period and group, independently of highlighted cells;
**Copy displayed ranking** copies its visible fields in displayed order.
It adds one copy timestamp in UTC+7 and omits repeated per-instrument Baseline/Through dates.
Use the arrows beside the date in the standalone panel to pin the previous or
next day or week. Change the period mode and other ranking settings from the
bottom dock. Click a ranking block in either Details or Bars
to open that instrument's chart. Synthetic currency baskets open Market Watch
with the currency code already entered in its search and the category set to All.
Double-click a basket in Details or Bars to open its currency index chart
when the symbol is available in Market Watch. Shift+Enter also opens the chart.
Only the right panel flashes the whole instrument block when a displayed number
changes: gray in light mode and pale gray in dark mode, fading out in 450 ms.
Changing dates, filters, sort or view does not trigger flashes. Reduced-motion
settings disable these effects. The refresh frequency is unchanged.
**More** in the bottom dock contains news, Wildcards and
method controls. The **Wildcards** row shows the same global entries as the
Wildcards dock and chart icons. Click a wildcard cell to view, edit or add entries.

News Flow's Trading relevance preset contains 471 editable terms and shared
aliases for currencies, policy, macro, energy, metals, indices and systemic risks.
Broad terms require context. Official policy/speech and economic releases have
source-verified protection; explicit Exclude still wins. All and Excluded keep
rejected headlines inspectable. Uncheck Trading relevance for literal matching.
A one-time upgrade preserves custom tags and Off, backs up prior settings locally,
and changes enabled old All alerts to Included. You can choose All again afterward.
Provider settings can pause collection without deleting cached history.
Relevance is not a volatility or trade-direction prediction; free feeds can lag
or omit stories. See [filter details](storage/news_flow/RELEVANCE.md).

## Calendar and alarms

**Alert** displays releases for the selected date. Expand a row for details and
source links. A bell selects a reminder for a timed release package.
**Alarm Settings** controls delivery, pause, offset, sound and history.
The local worker and Windows must be running for delivery.
Price alerts and calendar reminders have separate controls.

Select a **Trend Price Alert** on the chart to move the line or drag either
endpoint. An alert can be edited from another timeframe. Crossings still use the
candle spacing from the timeframe where the alert was created. Moving an endpoint
earlier may require loading more candles from that timeframe before the edit saves.

## Ledger and Detail

**Ledger** shows calendar readings in currency lanes. Dragging browses dates;
selecting a date changes the historical cutoff. **Today** restores the current
cutoff. Filters change visible events. Currency labels open Detail; release cards
open Inspector. Detail shows four categories of calendar readings for the selected currencies.

**Detail**, beside Show events, displays a Category / currency comparison table.
The four rows are Monetary policy, Inflation, Labor and Growth; values show the
previous reading and latest actual at the selected Ledger date.

In Detail, **Follow chart cursor** updates the four-category table as you hover
candles. Click a candle to pin its exact time; Escape stops following. **Today**
returns to current readings. Wildcards appear below the table: the selected day's
entries up to the cursor time while hovering, or the preceding seven days up to a
pinned candle. Entries after the selected time stay excluded.

## Wildcards

Wildcards are manual events shared globally across instruments and brokers.
Use **Add wildcard** in the dock, or **✦ Add wildcard** in the drawing toolbar and
click a candle. Enter a title, details and an optional source link, then Save.
Chart placement fills the candle's precise time; dock entries can have an optional
Jakarta time or remain date-only. Cancel leaves saved entries unchanged.

Click a chart wildcard icon or a Heatmap wildcard cell to view and edit the same
entries. Several entries can share a candle or day. **Edit / Delete** in the dock
opens the editor; deleting removes the entry from every view. Archived entries
remain accessible through **Include archived**. **All dates** and Search help browse
older entries. Existing manual News and wildcard notes migrate automatically.

## Entry Trade

Entry Trade stores manual plans, notes, pins and journal entries. Saved plans can
be archived or restored. Journals remain in their existing application data directory.

Phone notifications show each headline once, without raw Google News URLs in the
body. Open article opens a single story; Open News Flow opens your authenticated
phone reader. Batches show a count and up to eight compact previews, with the rest
available in the reader. Publication and collection times use Jakarta/WIB with AM/PM; Android
notification urgency is separate from the market Priority label. Existing ntfy
subscriptions and credentials need no change. Old notification cards are unchanged.

News Flow alarms now have one **News alerts - desktop + phone** trigger. Off
stops both, **Priority 1 only** covers important headlines, **Priority 1 + Priority 2**
includes both tiers, and **All new headlines** covers every relevance level.
**Only alert on recent publications** defaults to 24 hours. Enter hours
or days, choose the sound and Windows popup preference, then use **Save settings**.
Older/unknown/scheduled publications stay
readable but silent; disabling the limit allows any age. Desktop sound selection
is local; ntfy/Android chooses the phone sound. Saved delivery cursors recover
unprocessed live collections from the last 15 minutes after restart, subject to
the trigger and age limit. Historical imports and consumed arrivals stay silent.
Use **Preview sound** to unlock browser audio. Expand **Phone connection and
delivery test** for ntfy setup and a phone test.

Price alert crossings now retain pending sound until it starts, for up to five
minutes. Interaction can unlock browser audio; a notice remains visible outside
the dock when playback is pending or missed. Each row shows sound state. Silence
acknowledges delivery without rearming the price level. Missing custom sounds
fall back to Thin for actual alerts. Keep the terminal open with live quotes;
Windows/browser mute, sleep and audio-device settings still affect audibility.
