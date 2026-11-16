# Price alerts

`usePriceAlerts.ts` evaluates live Bid quotes once per armed crossing. It saves
the triggered state and a unique sound-delivery token together, before playback.
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
