# Market data and chart interaction

| Folder | Responsibility |
| --- | --- |
| `contracts/` | Quotes, candles and timeframe contracts |
| `mt5-feed/` | Broker polling, paging, source generations and immutable snapshots |
| `candlestick-chart/` | Chart API lifecycle and candle rendering |
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

Fixture suites cover drawing interactions, installed chart contracts, market
snapshots and the assembled terminal. Live MT5 and visual review belong to the user.
