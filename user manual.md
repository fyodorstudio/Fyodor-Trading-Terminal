# User manual

## Charts

Select a symbol in Market Watch and choose a timeframe in the chart header.
Pan or zoom to browse history. **Refocus** returns to the latest candles.
Timeframe changes retain the selected dates and price bounds in either direction.
Pairs remember their own price bounds; a new pair inherits proportional vertical
zoom and position in its own price units. The selected dates carry across pairs.
Very narrow views may temporarily widen at the chart's minimum candle span on a
higher timeframe; returning restores the original dates.
The drawing toolbar adds and edits chart drawings. **Inspector** opens calendar
release details; **Show events** opens recent/upcoming releases.
Display timezone and theme are available in Settings.

## News Flow

Click the newspaper button immediately right of **Heatmap Ranking** in the chart
header. The right panel lists collected headlines; click a title to open its
source. Drag its left edge to resize it. Escape or × closes it.
Left of the calendar, the provider button opens a checkbox list with All/None.
The search button to its left searches cached headlines within the selected
providers, date and classification tab, including results beyond the current
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
It uses that view's provider, classification, search and Priority/currency filters
across all matching pages, newest first. It replaces the calendar date with the
rolling range and copies collected news only; it does not fetch missing history.
The clipboard contains only each headline and its link, separated by blank lines.
Empty/failed exports leave the clipboard alone. If clipboard permission is denied,
select the provided text and copy manually. More than 10,000 matching headlines
requires a shorter range or narrower filters; results are never silently cut off.

The tag button opens **News Flow Extended View**, a wide centered modal with
**Browse providers / Priority / Settings** tabs. Named provider tabs replace the
dropdown and arrows. Browse has its own date and Recent control; it does not
change the combined right panel's date. Provider tabs scroll horizontally.

The expanded pack has 34 default subscriptions, adding targeted Reuters
FX/oil/equities/metals/Japan economic news, Kitco, RBNZ, SNB, regional economic
releases, Japan MOF and EIA. All enabled sources merge into the combined feed.
Some arrive directly by RSS/Atom; additions delivered through Google News say so
in their provider names. After restarting storage, the upgrade adds the new
sources while preserving your provider settings, cached headlines and keywords.
See the [source catalogue](storage/news_flow/SOURCES.md) for exact coverage.

**All / Included / Excluded** classify headlines in either reader. All shows
everything in the selected provider/date scope. Included requires an Include
keyword match and no Exclude match. Everything else is Excluded, including
headlines matching neither list. Empty Include makes everything Excluded.
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

**Priority** organizes central-bank policy, expectations candidates and your
starred links from selected providers. Its All / Central banks / Expectations /
Starred filters are independent of Include/Exclude and retain relevance colours.
Currency buttons narrow to the associated central banks; clicking a USD/Fed or
other bank badge does the same. These badges identify policy coverage, not a
claim about which instruments will move. Stars sort first.

Hawkish/Dovish/Mixed wording labels quote explicit language in the headline or
supplied feed summary, with the supporting excerpt highlighted. Qualified or
missing wording stays unclassified; a rate hike/cut alone does not establish a
stance or a market surprise. Check the linked source for timing and context.
No article-body extraction, invented odds or automated trade direction. Old
expectations previews are dated snapshots, not current pricing.

Settings has **Global** and **Providers** tabs. Global contains keywords,
colours and the single sound setting for all selected providers. Providers
contains provider editing, polling and visibility. The fetch interval defaults to **1 second** for every provider. Set an
individual provider to 60/120/180/300 seconds for 1/2/3/5 minutes, or another value
up to 3600 seconds, then Save provider. Rate-limit cooldowns remain respected
through Refresh, interval edits and restarts. Source errors identify retry times.
**Show this provider** affects the combined reader/alerts without stopping collection.

In Global, choose the sound trigger: **Off / Included keywords / All new
headlines**, choose Chime/Bell/Pulse and use Preview to unlock browser audio.
Included keywords respects Include/Exclude; All new headlines ignores keyword
rules, including an empty Include list. Both use the selected providers and ring
once per arriving batch, independent of the displayed tab/date. Startup, first
provider loads, historical imports and duplicate headlines stay silent. Stale
publications stay silent; undated/scheduled live arrivals use first collection,
which does not prove the article was just published. Alerts work with the panel
closed while the terminal page is open. Existing enabled alerts retain keyword
mode when upgrading.

The top-right star and **Add Wildcard** icons have hover tooltips. Relative ages
update even when the feed is unchanged. Missing or future publication times show
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

## RSI and Volume

RSI and Volume can be shown independently and resized with their pane dividers.
RSI settings include period, smoothing and bands.

Volume supports Raw tick counts and Relative activity. **Bars**, **Relative** and
**Average** toggle its layers. In Raw mode, **Axis** selects the draggable scale.
Relative activity compares matching session candles from earlier days. Scrolling
left loads more history for comparison. Tick volume counts broker price updates.

## Heatmap

Open **Heatmap** in the bottom dock. Switch Daily/Weekly, browse dates and
pin a column to inspect its ranking. **Instruments** edits the watchlist and order.
**Visible fields** selects O/H/L/C. **Copy Details Only** exports selected readings;
**Copy Research Prompt** adds a short request and calculation context.
**Copy range** selects several dates. **Event window** provides intraday views
between selected times. The **Wildcards** row shows the same global entries as the
Wildcards dock and chart icons. Click a cell to view, edit or add entries.

## Calendar and alarms

**Alert** displays releases for the selected date. Expand a row for details and
source links. A bell selects a reminder for a timed release package.
**Alarm Settings** controls delivery, pause, offset, sound and history.
The local worker and Windows must be running for delivery.
Price alerts and calendar reminders have separate controls.

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
