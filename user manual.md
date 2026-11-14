# User manual

## Charts

Select a symbol in Market Watch and choose a timeframe in the chart header.
Pan or zoom to browse history. **Refocus** returns to the latest candles.
The drawing toolbar adds and edits chart drawings. **Inspector** opens calendar
release details; **Show events** opens recent/upcoming releases.
Display timezone and theme are available in Settings.

## MFDI

Click **MFDI** beside RSI and Volume. Its settings gear opens Inputs and Style.

1. Tick currencies in Inputs and use **+ Add events** to select measures.
2. Create categories and arrange the selected events.
3. Use **OK** to save or **Cancel** to discard settings edits.

One configuration applies across chart symbols. Unticking a currency retains its
event list. **Reset defaults** resets styles and the selected axis, retaining events.

**Series** opens the event drawer. Its controls are eye (visibility), **F**
(forecasts), **N** (numbers) and a colour picker. The top row toggles all selected
series. The drag handle moves events within or between categories. Category
arrows collapse the drawer list without hiding plotted lines.

Click an event name to select its axis. **Fit axis** fits that measure and
**Fit axis all** fits every visible measure. The lock links movement.
**Lane view** switches between numerical plots and straight rows. In lane view,
the wheel scrolls vertically; **Lane spacing** adjusts row spacing. With the lock
off, a selected event or category can be dragged independently. **Fit all lanes**
restores the arrangement.

Hover a release dot for Actual/Forecast/Previous and its release time. Click it to
open the release in Inspector. Number arrows compare successive actual readings.
Upcoming forecast dots become actual dots when the reading arrives.

Named presets are available in Series and Inputs. **Save as** creates a snapshot;
**Update preset** replaces the selected snapshot. JSON export/import transfers
presets between browser profiles. Working edits do not overwrite named presets.
Browser data clearing removes local settings unless exported.

## RSI and Volume

RSI and Volume can be shown independently and resized with their pane dividers.
RSI settings include period, smoothing and bands.

Volume supports Raw tick counts and Relative activity. **Bars**, **Relative** and
**Average** toggle its layers. In Raw mode, **Axis** selects the draggable scale.
Relative activity compares matching session candles from earlier days. Scrolling
left loads more history for comparison. Tick volume counts broker price updates.

## Cross-Asset

Open **Cross-Asset** in the bottom dock. Switch Daily/Weekly, browse dates and
pin a column to inspect its ranking. **Instruments** edits the watchlist and order.
**Visible fields** selects O/H/L/C. **Copy Details Only** exports selected readings;
**Copy Research Prompt** adds a short request and calculation context.
**Copy range** selects several dates. **Event window** provides intraday views
between selected times. **Wildcards** stores dated notes independently of prices.

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

## Currency News

Open **Currency News**, then choose All or a currency and a date. **Add news**
opens a form for date, currencies, title, details and an optional source URL.
**Save** stores the entry; **Cancel** discards the draft. Each row has **Edit** and
**Delete** controls. Delete asks for confirmation. This collection starts empty.

## Entry Trade

Entry Trade stores manual plans, notes, pins and journal entries. Saved plans can
be archived or restored. Journals remain in their existing application data directory.
