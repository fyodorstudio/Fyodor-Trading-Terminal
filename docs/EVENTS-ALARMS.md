# Alert

The bottom dock has **Highlight / MT5 Calendar / External Source**, in that order.
Highlight is the shared pinned shortlist, combining broker occurrences and active
external records in one date-sorted list with source labels. MT5 Calendar is the
existing upcoming MT5 release browser; External Source is the manually authored
research collection. One compact header puts views/filters on the left and visible
All/eight-currency buttons on the right, separated by `|`, before the alarm menu.
Show: Active / Archived applies to Highlight; Discovered Limitations lives under External Source, separately from Events.
Alarm settings, test and delivery history open only from that dropdown. Original
families, journals, archives, limitations, chart stars and visibility preferences
remain separate. Times use Jakarta AM/PM. Date-only rows show Today on their source
day; they never receive an invented publication hour.

## Automatic workflow

Research and pin an important calendar occurrence, or save a confirmed scheduled
external event with a verified `event_at`. The local alarm worker discovers it
within five seconds and prepares one Invoke reminder two minutes beforehand.
Change this offset in Reminder settings. Existing two-reminder settings migrate
to Invoke at two minutes; pending Prepare jobs are cancelled while history and
per-event choices remain. Each Highlight row has a filled coloured
bell when armed and an outline bell when off. Hover shows Jakarta reminder times;
a multi-stage pin controls all its future stages. Unconfirmed hours disable the bell.
External Source shows Pin/Pinned controls. Existing active external records remain
pinned, preserving alarms; unpin/archive appends an immutable archive version,
while Pin/Restore reactivates it. Both states remain readable in External Source.
Hiding a chart star does not disable an alarm. Pausing alarms cancels
pending delivery; resuming re-arms future reminders. Archive removes future
reminders without deleting research. Distinct policy publication stages remain
distinct, while simultaneous reminders ring in one grouped window.

Windows displays an alarm window and repeats its built-in Exclamation sound
every ten seconds until acknowledged. Copy prompt, Open terminal, Dismiss and
Snooze 5 min are available. Snoozing cannot reach or pass the event time. Prompts
invoke `$one-minute-before-release` near release. Nothing invokes an AI agent,
monitors actuals or places a trade itself.

Use **Test alarm** to verify the desktop window and sound on the actual PC.
Terminal tests mock delivery; they do not establish audibility or inspect UI.
System volume/sound settings and the interactive Windows session still apply.

## Runtime and persistence

`pnpm alarms:start` starts a detached, hidden worker on loopback port 8003, or
reuses it if already running. `pnpm dev:all` includes this step. It does not stop
or restart other services. The browser can close; the worker and Windows must
remain running/awake. No Windows login task, wake timer or power setting is
installed. After reboot, starting the stack starts the worker again.

`storage/data/alarms/state.json` atomically saves settings, per-occurrence alarm
choices, acknowledgements and recent delivery history. One worker owns its
directory lock. It reads the calendar through read-only SQLite snapshots and
existing Highlight/external readers; it never changes source or research data.
Schedule errors suspend new delivery and appear in the dock. Already elapsed
reminders are not replayed on startup. Pending reminders overdue by more than
90 seconds, or whose event has passed, become Missed. A claimed reminder is never
automatically rung twice after a crash; interrupted delivery is reported instead.

The UI proxies `/alarm-api/alarms` to worker `/alarms`: GET returns schedule,
settings, recent jobs and worker status; POST accepts `settings`, `toggle`,
`dismiss`, `snooze` with `expected_revision`, or explicit `test`. Conflicts require
a fresh snapshot. Only loopback terminal origins may mutate alarms. Native
notification payloads are temporary JSON files, not executable prompt strings.
The alarm process has no dependency on bridge modifications or an API key.
