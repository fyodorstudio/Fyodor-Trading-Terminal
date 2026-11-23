# Price alerts

`usePriceAlerts.ts` evaluates live Bid quotes and synthetic currency index levels
once per armed crossing. The bridge calculates each index level from its seven
constituent Bid quotes using the chart's fixed reference. The frontend checks
both ends of the quote timestamp range before evaluating an alert. It saves
the triggered state and a unique sound-delivery token together, before playback.

The drawing toolbar has Horizontal Price Alert and Trend Price Alert. A trend
alert tracks the segment between two distinct times and saves the candle spacing
of its drawing timeframe. The line is straight on that timeframe. Other
timeframes show the same trigger prices on their own time axes. Clicking an
alert opens its drawing timeframe. Editing a legacy trend alert gives it the
current chart's candle spacing. The Supply and Demand selector labels either
kind of alert and starts unset.

Trend alerts use the live Market Watch samples. A touch that reverses between
samples may be missed. A stale or interrupted quote stream starts a new
crossing baseline when fresh data returns. If a quote arrives ahead of the
reference candles, it waits within the freshness window for confirmed candle
times. The bridge can load those candles even when another chart is open.
`usePriceAlertDelivery.ts` owns delivery recovery independently of quote evaluation:

- Pending audio survives page reloads. A successful start is saved as played;
  gestures, quotes and reloads cannot replay that delivery.
- Suspended audio is resumed with a two-second bound; transient scheduling errors
  stay pending and retry after a one-second delay, for at most five minutes after crossing.
- Expired recovery becomes missed, with a workspace notice even when the dock is
  closed. Silence/acknowledge cancels recovery without rearming the price level.
- Actual alerts fall back to Thin if custom audio is missing, corrupt or fails
  to decode promptly. Preview retains its explicit custom-file errors.
- Deletion/rearming/settings changes invalidate late async work. Pending tokens
  separate crossings even if they share a timestamp. Muting/zero volume is recorded
  as silent, not successfully played.

`PriceAlertDeliveryNotice.tsx` is the only workspace integration. Row labels expose
pending/played/missed/silenced state. Restored alerts prepare audio on interaction;
monitoring needs the terminal page open and live broker quotes. This browser-only
feature does not run in the calendar alarm worker or deliver phone price alerts.
Windows/browser mute, sleep, audio output and autoplay policies can prevent audible
delivery; a successful Web Audio start cannot certify that a person heard it.

Meaningful regression checks: `test_price_alerts`, `test_custom_price_alert_sound`,
`test_price_alert_delivery`, `test_price_alert_chart_contract`, and assembled
`test_terminal_responsiveness`. Visual checks remain manual.
