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
broker categories, individual selections and up/down ordering within groups.
There are at most 96 selected rows, including synthetic baskets. Named watchlists
save row selections/order (up to 20); an existing name updates its draft snapshot.
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

## Calculations

Daily net price return is `100 * (close / previous_available_close - 1)`, including
opening gaps. A day without its own candle has no return. A previous-close gap
longer than ten calendar days stays unavailable. Weekly is the final available
close of a Monday–Sunday broker week divided by the immediately preceding week's
final available close, minus one. It is not a sum of daily percentages or rolling
five-day change. An absent preceding week stays unavailable. A live period uses
its latest D1 reading. Tooltips expose comparison dates, raw endpoints and range.
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

Only an open dock polls (one second while batches remain, otherwise 20 seconds).
Changing broker/generation/year/instruments or closing the dock aborts requests,
timers and stale replies. Quote ticks preserve catalog/history identities and do
no heatmap calculations. The timeline mounts only viewport rows/columns with
overscan; scroll and drag writes batch once per animation frame. Browsing performs
no fetching or return recomputation. Tests cover geometric inversion/all currencies,
coverage and clock matching, weekly/year boundaries, earlier-only volatility,
source/account guards, caching/batch work counts, failed refresh retention,
Save/Cancel/watchlists, stale replies and assembled-terminal chart independence.
Visual acceptance remains manual.
