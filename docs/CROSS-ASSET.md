# Cross-Asset heatmap

Owner: `frontend/src/cross-asset/`, `storage/cross_asset.py` and its isolated
`storage/cross_asset_worker.py`. The inherited bridge remains unchanged.

## Interaction and independence

Cross-Asset opens a resizable bottom dock beside Ledger. Daily/Weekly changes
column granularity, using the same D1 history. Drag horizontally, vertically or
diagonally to browse dates and instrument rows; native scroll remains available.
Both drag axes share one animation-frame update and clamp at the tape edges.
Dragging only browses and suppresses the following click. Hover highlights a period and updates its ranking until a date is pinned;
click pins, Unpin resumes hover, Today restores the current broker date. Date input
and adjacent-year buttons navigate 2015 through the current broker year. A weekly
column belongs to the Monday on which it starts, including year-crossing weeks.
Hovering such a column never silently switches the viewed year. Current periods
are incomplete; unavailable days stay blank, including FX weekends. Crypto may
have weekend candles. Calendar dates are broker session labels; Checked timestamps
follow the app display clock, defaulting to Jakarta AM/PM.

Rows are grouped and groups collapse independently. Instruments offers search,
broker categories and individual selections. Its Selected list has category
sections matching the timeline. Category-header up/down arrows reorder whole
groups (for example Metals above Energy); symbol arrows reorder only within their
group. The chosen category order applies to timeline headers and ranking filters.
There are at most 96 selected rows, including synthetic baskets. Named watchlists
save row selections/order and category order (up to 20); an existing name updates
its draft snapshot. Existing saved selections/watchlists retain their prior order
until category ordering is explicitly changed.
All instrument/watchlist edits remain drafts until Save. Cancel, Escape, outside
click and close discard the draft; failed saves remain open. Empty lists persist.
Preferences live under `fyodor.cross-asset.v1:<broker>`, independently of Market
Watch favourites. Date pinning and tape position survive dock changes in this
session; reload starts Today. Only broker-visible symbols are selectable; the
feature never adds native Market Watch selections.

Rankings filter by group and sort highest/lowest percentage return or largest
absolute move relative to prior volatility. Signs remain price direction. Several
correlated rows are not independent evidence of capital flows. The dock does not
assign a risk-on/off score or execute research, trades, chart navigation or alarms.
Ledger, Detail, News, chart selections, viewports, drawings and reminders remain
independent. The removed Ledger summary does not move into this dock.

## Copy details and manual Wildcards

**Copy Details Only** copies the selected daily date or Monday–Sunday weekly range,
category names, instrument labels and raw O/H/L/C percentage changes only. All selected
instruments participate, independent of ranking filters and collapsed groups.
Categories use the saved order; instruments sort highest to lowest within each.
Unavailable readings and empty categories are omitted. No commentary, relative
volatility, notes or research instructions enter this clipboard output. An empty
selection disables the button; clipboard failure is reported.
Both clipboard formats explicitly mark the broker's current date as
`In progress (day to date)` and its current Monday–Sunday week as
`In progress (week to date)`. Older period headings remain unchanged. The
current-period check uses the same broker session date as the timeline, not the
UTC/display date of copying; year-crossing weeks retain this status correctly.

**Copy range** enables From/Through date controls for the displayed year. Click a
date then Shift-click another date (or instrument cell) to select the inclusive
range directly; repeated Shift-click keeps the initial anchor. Highlighted columns
show the copy range while the ranking still follows its own selected date.
Copy Details Only exports each day/week separately, earliest first, without summing returns.
Whole periods without readings are omitted. Weekly inputs normalize to Mondays;
year-crossing weekly headings retain their full Monday–Sunday dates. Ranges stay
within the displayed year's loaded columns and exclude future periods. Reversed
ranges disable copying. **Single date**, a normal date/cell click, or changing year
or Daily/Weekly clears the range. Range selection never fetches history or changes
the chart; copy output remains changes only.

**Copy Research Prompt** uses the same selected dates, instruments and grouped raw
changes, preceded by an instruction to research current FX opportunities across
all eight currencies whose repricing may still be unfolding. Other assets remain
macro context only. Fresh research includes unscheduled headlines, policymaker
remarks and changes in expectations, including which driver dominates conflicting
news. Output is at most three concise currency/pair buy-or-sell ideas explaining
what happened, with a verified time where available and decisive source link,
and why it matters now: the reaction and evidence of possible remaining repricing.
Unclear remaining potential is stated rather than invented; no supported idea
means WAIT. There are no mandatory scenario, invalidation or confidence sections.
The initial prompt establishes that later pasted snapshots request fresh browsing
and an updated assessment, emphasizing material changes and retaining relevant
conclusions from the same conversation. Copy Details Only remains data-only.
Research uses original sources and reporting directly without repository research
workflows. Assessment/catalyst times and the export clock use Jakarta AM/PM.
The context includes the broker, copy-time Jakarta timestamp, Daily/Weekly return definition,
broker session dating, incomplete periods/missing readings, and the custom
all-seven geometric basket definition distinct from USDX/EURX/JPYX. Copy time is
not a market freshness timestamp; the prompt explicitly explains that In progress
figures are provisional returns to the latest available reading rather than final
closing returns. Selected periods can be historical; their O/H/L/C does not establish
intraday chronology, current prices or the latest market-update time. It requests
opportunities current when the receiving agent runs it. Both buttons disable when there are no selected
readings and report clipboard failures. Text is assembled only on click; copying
performs no fetching, research, saves or alarm changes.

**Wildcards** is always the final timeline category. **+ Add wildcard** creates a
story row with a one-line title (up to 120 characters, ellipsis/full-title tooltip)
and optional plain-text details for the selected date. The row and its cells use
the same 30px height and date columns as instruments. Click a cell to edit its
date-only note; paragraphs and pasted links are retained as text without HTML
execution. Filled cells show a neutral note icon/preview, never return shading.
Future cells also accept notes. Each row can have one note per date; weekly
cells show the number of that Monday–Sunday week's daily notes and open them in
date order, including year boundaries. Editing another date in the editor retains
the current draft; saving blank details removes only that date's note.

**Manage Wildcards** edits titles/order and archive/restore choices as a draft.
Clicking a story label opens this manager. Archive hides the story but retains
every note. Deleting requires an explicit row-and-all-notes confirmation and still
only applies after Save. Export saved notes downloads Markdown including archived
stories. **Copy note** copies the current title/date/details, separately from
Copy Details Only. Cancel, Escape, outside click or closing the dock discard unsaved
edits; failed saves retain drafts. The editor prevents dismissal during a save.

GET/POST `/api/v1/cross-asset/wildcards` reads/replaces a broker-specific snapshot.
Schema 1 has `source_id`, integer `revision` and ordered `rows`; each row has a
stable ID, title, `archived` and a date-to-text `notes` map. POST requires
`expected_revision`; a stale writer receives 409 and must reload/reconcile rather
than overwrite newer notes. Source IDs map to hashed filenames, not paths.
Atomic, flushed replacement and the writer lock preserve the prior snapshot on
write failure. Invalid stored content blocks replacement rather than resetting
it. Limits: 128 rows including archived, 3660 dated notes per row, 20000 characters
per note, 8 MB per broker snapshot, dates 2015–2100.

Snapshots live in ignored `storage/data/cross-asset-wildcards/` (or the configured
storage data directory), included in backup/restore and independent of browser
preferences, account connection generations, watchlists, calendar, News and alarms.
Loading happens once per dock instance; **Reload Wildcards** explicitly rereads
saved notes. Reads/writes have 15-second timeouts and abort on true unmount;
obsolete replies cannot replace another connection's view. Saving notes performs
no price fetching or basket calculations. Timeline virtualization also applies
to stories; a visible weekly cell uses at most seven date lookups regardless of
the story's historical length. There is no agent invocation or automatic research.

## Calculations

Daily net price return is `100 * (close / previous_available_close - 1)`, including
opening gaps. A day without its own candle has no return. A previous-close gap
longer than ten calendar days stays unavailable. Weekly is the final available
close of a Monday–Sunday broker week divided by the immediately preceding week's
final available close, minus one. It is not a sum of daily percentages or rolling
five-day change. An absent preceding week stays unavailable. A live period uses
its latest D1 reading. Tooltips expose comparison dates, raw endpoints and range.
O/H/L/C is visible by default as one horizontal row in each available instrument
cell and ranking entry. Every field is `100 * (field_price / previous_close - 1)`;
C is the net return and remains the ranking/shading metric. Both clipboard formats
use the same O/H/L/C order. Daily uses its own candle opening, high, low and close.
Weekly uses the first available day's opening, lowest low/highest high across
that week's available D1 candles and final available close, all versus the previous
week's final close. O includes the opening gap. H/L includes wicks; they are prices
reached, not simultaneous readings, a path chronology or current returns. Live C
uses the latest available reading and live extrema are provisional. Missing
comparisons remain unavailable rather than zero. Cells retain 30px rows with
276px date columns for the four inline fields; C is emphasized without stacking.
Different markets have different closing hours; matching dates do not imply
simultaneous trading. Broker price returns exclude dividends, financing and
contract adjustments and are not converted into a common investor currency.

All eight synthetic currency rows use one custom method: express each of the
currency's seven pair returns in its own direction, average their log returns,
then transform back with `100 * expm1(mean_log_return)`. Inverse quotes negate log
returns, not simple percentages. The conventional 28-pair catalogue resolves
recognized broker suffixes, preferring an exact symbol when available. Seven valid
counterparts and matching baseline/end dates are mandatory. Missing or mismatched
coverage produces a blank with a coverage explanation, never a reweighted basket.
These are custom equal-weight FX baskets, distinct from broker USDX/EURX/JPYX and
trade-weighted indices; they measure appreciation/depreciation against peers, not
an absolute currency value or the amount of capital entering a market.
Basket O/H/L displays `—` in cells, ranking and exports; the basket model computes
net C from the seven pair endpoints and does not construct an intraday OHLC path.
Individual pair wicks can occur at different instants and cannot establish exact
basket extremes. Synchronized intraday prices are not fetched by this D1 feature.
The research prompt explains that distinction. Net baskets,
shading, rankings and all-seven coverage rules remain unchanged; extremes use
the existing loaded OHLC without extra requests.

Optional relative shading is signed net return divided by the sample standard
deviation of prior returns. Daily uses up to 60 earlier observations, minimum 20;
weekly uses up to 26 earlier weeks, minimum 12. The selected period and later prices
never enter their own baseline. Zero/insufficient volatility stays unavailable and
unshaded; the number in each cell remains the raw percentage. Raw shading saturates
at a 2% absolute return, relative shading at 3 times volatility. Tooltips explain
coverage; fresh reads and stale retained data are distinguished.

## Data and bounded work

POST `/api/v1/cross-asset/history` accepts `source_id`, `generation`, `year`,
`symbols` (at most 128) and optional `retry`. Schema 1 returns the source/generation,
year, broker `today`, response observation clock, revision, pending count and
per-symbol availability, last successful check time and D1 OHLC bars. The connected
Pepperstone-Demo terminal/account/path/generation is checked before and after every
native batch. No credentials, account identifiers or native paths are returned.
D1 date labels remain native broker session dates; the current broker date uses
the existing clock profile rather than a hard-coded offset.

The worker attaches to the already running terminal without login, symbol selection
or account/trade writes. One service lock, an 18-second subprocess timeout, a
three-second native batch deadline and twelve instruments per batch bound work.
Readers load the calendar year plus 400 earlier days for baselines and the final
week's spill into January. Current-year refreshes read a seven-day tail; historical
reads cache for one hour. Live reads refresh after 20 seconds, failures back off for
60 seconds. Explicit Refresh invalidates all requested entries and refills every
batch. The cache retains at most four years and 128 symbols per year and resets
when native identity changes. Day rollover rereads formerly incomplete history.
Failed native refreshes retain prior bars with their successful-check clock and an
unavailable/stale notice. Missing history and invisible symbols stay explicit.

After first opening, history polling stays active while the app runs, including
when the dock is closed or another dock is selected (one second while batches
remain, otherwise 20 seconds). Disconnect pauses requests; the history reader
remains bounded. Closing removes the visual timeline, its resize observer and
gesture frames, without discarding data, group collapse, dates or scroll memory.
Reopening uses the warmed snapshot immediately and starts no extra request.
Full terminal unmount cancels all polls, listeners, observers and stale replies.

The frontend retains up to four broker/generation/year snapshots and 128 symbol
records per snapshot. Changing the selected symbols preserves existing readings;
initial missing-symbol requests include only the missing instruments and merge
their replies. Removing/reordering fresh cached instruments performs no immediate
fetch. Changing source/year aborts obsolete requests; cached years restore before
paint and never mix source generations. Freshness-only updates preserve candle
identities. Per-mode calculation caches hold at most 256 symbol projections and
192 rows: adding an unrelated instrument computes only that instrument, while an
FX correction invalidates only its own projection and affected currency baskets.
Hidden updates do no row calculations or timeline rendering.

Quote ticks preserve catalog/history identities and do no heatmap calculations.
The timeline mounts only viewport rows/columns with
overscan; scroll and drag writes batch once per animation frame. Browsing performs
no fetching or return recomputation. Tests cover geometric inversion/all currencies,
coverage and clock matching, weekly/year boundaries, earlier-only volatility,
source/account guards, caching/batch work counts, failed refresh retention,
category and symbol ordering, Save/Cancel/watchlists, incremental loading,
background refresh, reopen/scroll restoration, correction work counts, stale
replies and assembled-terminal chart independence.
Visual acceptance remains manual.
