# Alert bottom dock

Open **Alert** from the status bar or bottom dock tabs. Its independently saved
height uses `fyodor.alert.dock-height.v1`. Current pair support matches Inspector:
EURUSD (including supported broker suffixes). The shell passes the same active
broker, applied Inspector preferences, bridge UTC correction and time display.
Draft filter edits do not change Alert. Inspector's historical date range does
not limit the next 60 days of schedules.

## Boundaries

- `model/alert-episodes.ts`: pure catalog-based series scope, shared Inspector
  episode grouping, admission/status transitions and countdown formatting.
- `dock/AlertDock.tsx`: active-dock storage lifecycle, corrected one-second clock,
  memoized grouping, source/coverage states and cards.
- `dock/alert-dock.css`: isolated layout and theme colors.
- `index.ts`: public dock export.

One card represents one existing Inspector episode. CPI/NFP readings at the same
publication group together; FOMC and ECB retain decision anchoring and known meeting companions.
Generic speeches remain independent. Stable country/currency/event IDs own family
membership. Display name matching does not assign families.

The query uses only applied family IDs from the active broker. It fetches a
day-stable recent-30-day/next-60-day window plus clock/grouping margins. Visible
verified episodes enforce the exact rolling window. Coverage warnings concern
the visible window in broker clock coordinates, not extra fetch margins.
Unconfirmed source timing shows **Time unconfirmed**, without an invented UTC
countdown. Withdrawn/unobserved rows are omitted. An empty family selection makes
no requests.

Upcoming episodes show days/hours/minutes remaining (rounded up to the next
minute). Countdown ticks update locally and do not refetch or regroup inventory.
At the deadline a numeric episode shows **Awaiting release data**, then
**Partial release data** while some source rows still lack Actual. When all
numeric rows in that episode have finite Actual, the card leaves the queue.
Completed numeric date-only/unconfirmed episodes also leave once all Actual
values arrive; unavailable timing cannot leave them permanently queued.
Commentary rows do not require numerical values; speeches leave at their time.
Actual arrival is independent of magnitude admission: N still requires a valid
Actual/Previous delta and compatible units.

The existing storage hook handles ten-second polling, consistent paged revision
snapshots, cancellation and failed-request retention. Rescheduled source times
replace cards/countdowns on the next snapshot. Offline, failed collection and
partial coverage are visible; stored countdowns do not imply live verification.
Changing display timezone changes only formatted dates. Closing Alert clears its
timer and aborts polling. Persistent collection continues in `/storage`, whether
this dock is open or closed. No sound, OS notification or scheduled automation is
introduced.

## Verification

`tests/alert/test_alert.mjs` covers pure and mounted production logic: applied
family scope, broker changes, one card per episode, 60-day bounds, countdown
ticks without requests, due/partial/completed states, FOMC/ECB grouping, speeches,
rescheduling, offline data, unknown timing, display timezone, cancellation and
cleanup. Existing navigation/resizing suites cover Alert registration and height.
Visual layout, theme contrast and countdown readability remain manual user checks.
