# Market data and chart interaction

| Folder | Responsibility |
| --- | --- |
| `contracts/` | Quotes, candles and timeframe contracts |
| `mt5-feed/` | Broker polling, paging, source generations and immutable snapshots |
| `candlestick-chart/` | Chart API lifecycle, shared date viewport and candle rendering |
| `market-watch/` | Quote rows and symbol selection |
| `chart-settings/` | Chart appearance preferences |
| `chart-drawings/` | Saved drawings, geometry and viewport projection |
| `chart-drawings/interaction/` | Pointer lifecycle, editing and inline text |

Calendar observations/clocks belong to [economic-calendar](../economic-calendar/README.md),
with broker clock conversion under `system-connectivity/bridge-status/`.
The [terminal shell](../terminal-shell/README.md) supplies event/Notebook overlays.

Retain source-generation isolation, paging order and candle/quote identity when
data is unchanged. Corrections must propagate. Batch viewport work by frame,
project visible drawings only and cancel listeners/frames on unmount. Chart
pan/hover never starts a scoring calculation.

The chart keeps one horizontal date window across symbols and timeframes within
the active broker. Fractional logical coordinates preserve zoom and future empty
space; each symbol refits its price scale. `candlestick-chart/chart-viewport.ts`
uses the existing timeline interpolation helpers. Initial loading fits once;
double-click explicitly resets. Broker changes start a fresh viewport.

`candlestick-chart/future-timeline.ts` extends the native time axis 90 calendar
days from the latest candle's date through the end of day 90 at the active timeframe, including empty weekend
slots. A separate invisible series supplies timestamps and an inert endpoint on
its own scale so the library allows panning through the entire horizon. It never
enters price candles, feed history or calculation inputs. Initial/reset fitting
uses actual candles; live following and shared date windows remain intact.
Quote updates, pan/hover and ordinary same-day new candles do no future-series writes.
A daily rebase, session gap, timeframe/symbol change or relevant
timestamp correction rebuilds the tail. Unused projected slots never become
historical session bars. Native axis/crosshair contracts and deterministic work
counts are exercised in `tests/test_future_timeline.mjs` and the assembled terminal.

When the new symbol's initial page misses the chosen dates, the chart requests
older MT5 pages serially until covered. Failed/no-progress pages stop automatic
retries; unavailable history stays on the selected dates with a notice and retry
when possible. Feed cancellation prevents obsolete replies from replacing a new
symbol. `tests/test_chart_viewport.mjs` mounts the production chart and feed hook
for switching, backfill, future space, retry, exhaustion and stale-reply checks.

Fixture suites cover drawing interactions, installed chart contracts, market
snapshots and the assembled terminal. Live MT5 and visual review belong to the user.
