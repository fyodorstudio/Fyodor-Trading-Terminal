# Alert

Alert is one table for the selected **Asia/Jakarta** date. A horizontal five-day
wheel, previous/next, a month revolver, year and Today navigate dates. All/eight-currency
buttons and the existing Alert filters apply without changing alarm choices.
Every captured calendar event on the date is available, including released rows;
no shortlist, automatic archival or manual archive control is involved.

Columns: Time | Event | Actual | Forecast | Previous | Source | Agent impact | Bell.
The table fits the dock width and wraps text; only the date wheel moves
horizontally. The bell column includes room for its button and cell padding.
The time is shared across currencies at the same exact instant. Each pending
Actual cell shows its countdown, including repeated same-time rows. Supplied
actuals remain intact and each reading has a subtle row divider; impact is agent-authored or Unreviewed.
Source identifies Pepperstone or the actual external publisher (for example
Reuters), with links to evidence. External records never acquire invented calendar
readings. Different source values stay separate. One bell covers a publication
package; decision, statement and conference clocks remain separate stages.
Verified publisher packages (Baker Hughes rig counts, matching Jibun/S&P PMI
components and Ivey PMI) share one bell when exact IDs,
country/currency, publication UTC and reference period match. Saved series/family
filters and constituent reminder keys are retained. A partially selected package
shows a mixed bell; an explicit click enables its remaining components, reusing
existing subscriptions. Browsing alone changes no choices. Every broker reading
and external event is a flat row with its own expansion and details, including
linked publishers and components of a reminder package. Opening or collapsing
one row never changes a sibling row. Package membership only controls reminders;
it does not combine event detail panels.

Rows with the same exact publication UTC and currency always form one compact
visual block, with currency shown once, before and after release. A shared
time is shown only at the first currency for that timestamp. The countdown stays
in the Actual column. Darker horizontal rules frame each distinct release time;
same-time rows keep subtle internal dividers, including currency transitions.
This display grouping preserves each publication's details and reminder choice;
different currencies, exact times and unconfirmed hours remain separate.

Click an event row to expand its compact Overview; bell and source-link clicks
keep their own actions. Collapse clears the row emphasis, while keyboard focus
remains visible on its control. Overview keeps source links and chart visibility;
source IDs, capture clocks, raw values and external version history are available
through disclosures. Month/year, Today, currency buttons and Filters match the
exact 44 px outer height of the date wheel, including the nested Alarm Settings
trigger. The month revolver supports clicks/wheel and clamps end-of-month days.
Ordinary event rows share a 36 px height, with compact clock and bell cells so
standalone releases do not become taller than grouped rows. Wrapped content can
grow for readability. The event summary row also collapses Overview; no extra close button is shown.

**Legacy pins & research** in the Alert header opens a read-only browser across
all saved brokers, including Elev8, independently of the date/currency filters.
It exposes active and archived pins, original research and documentation history,
captured readings/evidence and saved prompts. Broker/status/search filters are
local. Opening this browser does not expand persisted pin membership, archive,
restore, delete, subscribe or change alarms. Existing research files stay intact.
Legacy research is no longer hidden inside occurrence-specific tabs.

Feed notes has been removed from the UI. Stored broker/data limitations remain
readable through the CLI/API; agents do not need a dedicated visible collection.
The normal refresh records findings in news/custom events and coverage caveats in
Implication. Ongoing risks remains beside Alarm Settings. Its browser preference
controls current notices in Alert and charts without changing stars or reminders.
Forecast values and their existing attribution remain unchanged.

The outlined risk panel includes a countdown to the next confirmed, precisely
timed saved external release, independently of the date table. Unscheduled risks
and date-only milestones never receive invented countdowns. This is a saved
schedule display, not automatic discovery or proof that its alarm is armed.

Calendar symbols consistently open Inspector first. **View in Alert** beside the
Inspector heading opens the selected Pepperstone release's date, expands its
matching details and scrolls only Alert's scrollport. Repeated selections reuse
the mounted feed. External stars open their Alert details directly because they
have no raw broker Inspector row. A navigation highlight fades and clears on
collapse. Today has a horizontal current-time divider showing only the Jakarta
clock. It follows every elapsed timed event and precedes future/unknown-time
items, moving below all same-time rows at their publication instant. It remains
after the final timed event when all have elapsed. Historical dates omit it.
Clock ticks stay local to countdowns/the line, and its position changes only at
event times or the date boundary; it never scrolls automatically. Native dock scrolling runs no React state or layout handlers.
Bells share one indexed alarm inventory instead of scanning it per publication.

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

Currency News persistence does not change reminders. Assess Trade Now's separate
[global risk workflow](GLOBAL-RISK-WORKFLOW.md), or explicit alarm-curation requests,
may select new verified high-impact occurrences, one bell per release package.
Preserve explicit off choices, global pause and offset. Read worker eligibility,
exact keys and revision before `toggle-many`, then verify selected/armed state
and runtime health. A suggested return time creates no reminder or AI schedule.
Price alerts and news persistence remain independent.

**Alarm Settings** opens global enable/pause, reminder offset, test and delivery
history. A small status dot and ringing indicator preserve worker visibility.
Sound settings are independent of price alerts: Play sound, volume (0–100%),
the shared preset list or uploaded MP3/WAV/OGG, duration (1/3/5/10 seconds),
Save and Preview/Stop. Defaults are 30% volume, three seconds and no repeating.
Preview saves the draft first and uses the actual desktop delivery path; changing
saved audio stops an older preview. Test alarm also checks the notification window.
The browser decodes custom clips up to 2 MB/60 seconds into bounded mono PCM;
the worker validates and stores the WAV locally, so playback works with the browser
closed. No new audio dependency or system-wide volume change is needed.
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

`GET /alarm-api/alarms` returns schedule schema 2, selections, explicit choices
(null for no override), armed state, settings,
worker status and history. POST accepts validated `subscribe`, `toggle-many`,
legacy `toggle`, `curate`, `settings`, `dismiss`, `snooze` or explicit `test`; optimistic
revision checks protect writes. Subscription clocks and eligibility come from
SQLite, never client-supplied values. Only loopback origins can mutate the worker.
`curate` accepts known future eligible keys and atomically preserves explicit off
choices. It leaves pause, offset and sound settings unchanged. Resolved external
risks are ineligible. Invoke prompts reuse pair context without choosing a pair.

Sound mutations are `audio-settings`, `audio-upload`, `preview`, `stop-preview`
and `silence`. Stop sound silences an active notification without acknowledging it.
`clear-missed` acknowledges all missed/failed/interrupted jobs; individual Clear
uses `dismiss`. Original status/errors remain in delivery history, acknowledgements
survive restart and no future selection changes. The UI counts the full unresolved
backlog instead of silently showing only eight items.

Windows displays one grouped notification for simultaneous selected stages.
Audio stops at the saved duration while the window remains visible. Repeat until
dismissed is an explicit opt-in. Copy prompt, Open terminal, Stop sound, Dismiss
and Snooze 5 min remain available; snooze cannot reach the event time. Terminal
checks cover generated WAVs, duration/control wiring and native-script syntax;
audibility and visual acceptance remain the user's checks.

Native windows poll `/alarms/active?ids=<job IDs>` for their own status/audio only,
without repeatedly transferring the full schedule and delivery history.
Keep API inspections focused on settings, status counts and relevant occurrences;
do not dump the full migration receipt and delivery history for routine checks.
