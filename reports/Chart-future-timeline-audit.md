# Future chart time axis — 12 October 2026

The native time axis now includes the end of the 90th calendar day after the
latest price candle's date. Empty future slots use the active timeframe and the
existing broker/display-clock formatters. Native tick labels, crosshair times,
event icons and drawing coordinates share this timeline, including weekends.

The installed library limits scrolling using valued points rather than whitespace.
A separate invisible series therefore holds timestamps and an inert zero-valued
horizon endpoint on its own scale. This endpoint is never inserted into candle
arrays, quotes, storage or scoring inputs. Initial and double-click fitting use
only actual candles plus the existing margin. Symbol/timeframe date windows and
normal live following are retained.

## Work and timing

The horizon is cached through day 90, so ordinary same-day new candles, quote
updates and pan/hover cause **zero future-series writes**. Date boundaries,
session gaps, symbol/timeframe changes and relevant timestamp corrections rebase
the tail. Retained slots beneath actual candles are checked during replacements;
missing or corrected times cannot leave invented historical session slots.

Terminal-based measurements use the installed chart library with no-op canvas
painting; they are not browser frame-rate measurements. On this machine, M1 setup
took about 220 ms with two price candles, and 532 ms with 40,000 candles. Reusing
the horizon with a new candle and 40,000 loaded candles took 0.3 ms, with no series
writes; the native price update itself took about 149 ms in this harness. M1
initialization/rebases can therefore cause a brief pause. Visual smoothness remains
for user review; no browser automation or screenshot audit was performed.

## Verification

Eight affected suites run sequentially cover the real library's future ticks and
crosshair, all seven timeframes, complete future-space pan, candle isolation,
icons/drawings, session gaps, timestamp corrections, date-window restoration,
live following, symbol/timeframe/broker changes, backfill/cancellation, zero work
on pan and quotes, and assembled-terminal/StrictMode cleanup. Frontend lint/build,
repository navigation and whitespace checks accompany the change.
