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

When the new symbol's initial page misses the chosen dates, the chart requests
older MT5 pages serially until covered. Failed/no-progress pages stop automatic
retries; unavailable history stays on the selected dates with a notice and retry
when possible. Feed cancellation prevents obsolete replies from replacing a new
symbol. `tests/test_chart_viewport.mjs` mounts the production chart and feed hook
for switching, backfill, future space, retry, exhaustion and stale-reply checks.

Fixture suites cover drawing interactions, installed chart contracts, market
snapshots and the assembled terminal. Live MT5 and visual review belong to the user.
