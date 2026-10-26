# Alert

Alert is one table for the selected **Asia/Jakarta** date. A horizontal five-day
wheel, previous/next, month/year and Today navigate dates. All/eight-currency
buttons and the existing Alert filters apply without changing alarm choices.
Every captured calendar event on the date is available, including released rows;
no shortlist, automatic archival or manual archive control is involved.

Columns: Time | Event | Actual | Forecast | Previous | Source | Agent impact | Bell.
Pending rows show a countdown under Actual; impact is agent-authored or Unreviewed.
Source identifies Pepperstone or the actual external publisher (for example
Reuters), with links to evidence. External records never acquire invented calendar
readings. Different source values stay separate. One bell covers a publication
package; decision, statement and conference clocks remain separate stages.

Click an event to open Overview, Sources & history, or Saved research. Sources
keeps exact IDs, capture clocks, revised priors, raw values and external version
history. Saved research retains original broker/as-of provenance, including legacy
Elev8 investigations. No Prepare research action is exposed here; chart Research
Date Range remains available. Feed notes contains Discovered Limitations.

## Dates and source identity

`GET /api/v1/alert-calendar?source_id=Pepperstone-Demo&date=YYYY-MM-DD` reads all
currencies in a consistent store snapshot. Timed membership uses the half-open
Jakarta day converted to publication UTC. Date-only/unverified schedules retain
their source date; undated items have a separate section. Published tentative
numeric readings can use their verified publication clock. No historical chart
profile is guessed. Missing coverage and stale/offline data stay visible.

External records may carry an optional `calendar_reference` with `source_id` and
exact `value_ids`. Only confirmed scheduled records whose IDs, currency and UTC
stage match the selected broker group may join it. All source rows remain
separate, with one bell. Equal times or text similarity alone never merge events.
Original external versions and calendar observations are never rewritten.

## Reminder selection

New events have no alarm selected. Browsing, currency/family filters, date changes,
saving research and showing a chart icon never select or cancel a reminder.
Clicking a future timed group's bell registers a validated, durable subscription
or updates the existing choice. Date-only, unknown-time and elapsed items cannot
receive new timed reminders. An external record must be confirmed and scheduled.

Assess Trade Now has standing permission to select a few verified significant
checkpoint reminders. This is an explicit worker mutation, separate from pinning,
Thesis saves and the left-panel UNTIL field. Preserve explicit off choices, global
pause and offset. Read worker eligibility/keys and revision before POST
`toggle-many`, then verify selection, armed state and runtime health. A suggested
return time alone creates nothing; no AI invocation is scheduled.

**Alarm Settings** opens global enable/pause, reminder offset, test and delivery
history. A small status dot and ringing indicator preserve worker visibility.
Selections can be edited while global delivery is paused; a selected bell and an
actively armed reminder are distinct. One Invoke reminder runs at the chosen
offset (two minutes by default). No AI is invoked automatically.

On the first upgraded worker load, existing future Elev8/Pepperstone pin choices
are matched against Pepperstone using value IDs plus event, currency, country,
reference period, exact publication UTC and timing mode. Conflicting choices
transfer off and are reported. Unmatched old stages are retired from delivery and
listed for review in Alarm Settings. Existing external choices are seeded once;
new external records default off. Original pins, journals, overrides and delivery
history are preserved. The migration receipt is durable and idempotent.

## Runtime and persistence

The independent loopback worker uses port 8003. `pnpm alarms:start` starts it or
reuses a healthy worker. `pnpm dev:all` restarts this checkout's worker and waits
for readiness, so one command loads backend changes. `pnpm alarms:restart` does
the same worker-only restart. Process identity is checked before stopping it;
an unrelated or unverifiable port 8003 listener is left running and startup fails.
Saved settings, selections and delivery history are retained. The browser can close, but
Windows and the worker must remain awake. No Windows login task, wake timer or
power setting is installed.

`storage/data/alarms/state.json` atomically stores settings, subscriptions,
per-stage overrides, migration receipt, acknowledgements and delivery history.
Worker refresh and mutations serialize under one lock. Calendar reads include
committed WAL state and never change observations. Read failures suspend delivery.
Rescheduling updates jobs without replaying acknowledged reminders. Overdue jobs
become Missed; already elapsed reminders are not replayed on startup.

`GET /alarm-api/alarms` returns schedule schema 2, selections, armed state, settings,
worker status and history. POST accepts validated `subscribe`, `toggle-many`,
legacy `toggle`, `settings`, `dismiss`, `snooze` or explicit `test`; optimistic
revision checks protect writes. Subscription clocks and eligibility come from
SQLite, never client-supplied values. Only loopback origins can mutate the worker.

Windows displays one grouped alarm window for simultaneous selected stages and
repeats the built-in sound until acknowledged. Copy prompt, Open terminal, Dismiss
and Snooze 5 min remain available; snooze cannot reach the event time. Use Test
alarm to verify the actual desktop window and sound. Terminal checks mock native
delivery; they do not establish audibility or perform visual UI audits.
