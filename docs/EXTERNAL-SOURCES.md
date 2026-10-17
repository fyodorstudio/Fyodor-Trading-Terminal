# External Sources

The External Source view inside Alert holds sourced events, headlines
and unscheduled watch items outside the broker calendar. It has independent
All/eight-currency filters, search and aligned expandable rows.
The saved Date sort defaults to Upcoming first (soonest future event, then recent
past events, then undated items); Earliest first and Latest first are also available.
Exact event times have a live countdown; Elapsed means the time passed, not that
publication was verified. Date-only schedules show Today on their source day or
a whole-day distance, retaining Hour unconfirmed rather than inventing a time.
Records are shared across brokers; one USD record can inform all seven USD pairs.
**Show: Events / Discovered Limitations** separates the outside-feed event list
from broker-specific reference issues. Limitations retain their existing records,
source links, follow-up actions and offline cache; they are not event pins or
alarms. Currency selection applies locally to both views. Agents read them with
`pnpm analyst limitations --broker <broker>` and refresh the cited evidence before
using them to check MT5 and outside-feed coverage.
Raw MT5 observations remain separate from external research. Highlight displays both
sources together without converting external records into MT5 occurrences. Active
external records are its pins; Pin/Pinned and Highlight Archive/Restore use the
existing immutable archive lifecycle. Active dated records appear as
gold stars on matching currency pairs when **Show icon on chart** is checked, one row above the highest broker-calendar
icon stack, including daily grouping. Clicking a star opens its sourced record;
nearby custom records have their own chooser. Exact UTC times use the broker's
chart clock/DST profile; source dates remain date-only and untimed watch items
have no marker. Pan, zoom and future-space projection do not insert price candles.
No live news
ingestion or background headline monitoring is supplied by this collection.
Confirmed scheduled records with a verified exact event time automatically receive
one Invoke alarm two minutes before each stage through the independent [alarm worker](EVENTS-ALARMS.md).
Date-only and unverified schedules remain visible without a timed alarm.

Agents write records; the UI displays facts, dated interpretation, source links,
event/publication/recorded clocks, uncertainty and immutable version history.
The External Source view has Pin/Pinned controls; archive and restore are available
from Highlight. Search covers titles, facts, currencies,
status and sources. Research details/history expand beneath a row; the dock remains
resizable and scrollable as records grow. Cards, details, data loading and chart
preferences have separate owners so future record categories can reuse the layout.
Refresh both currencies before treating an old interpretation as current.

**Show icon on chart** is a browser display preference per stable record key, shared
across matching pairs and surviving reloads. USD-only records show only on USD
pairs. Untimed watch items have a disabled checkbox. Hiding an icon never modifies
research, raw observations or history. Legacy archived records remain readable in
the dock; their icons default off unless explicitly enabled. Agent lifecycle
commands below remain compatible. Browser storage failure is shown without
pretending the preference was saved.

## Agent commands

Run from Lite; no service or broker connection is needed:

```powershell
pnpm analyst external --scope EURUSD --visibility all --from 2026-08-19 --to 2026-08-20
pnpm analyst external read --key us-treasury-20260819-long-end-buybacks
pnpm analyst external append --input "Market Analyst Workflow/report/<report>/external-event.json"
pnpm analyst external archive --key <key> --expected-version <latest-id>
pnpm analyst external restore --key <key> --expected-version <latest-id>
```

List supports --match, --limit and --offset; follow next_offset. Dates are inclusive
UTC days; date-only records retain their source date. Undated watch items remain
visible in dated scans. Read returns newest versions first, with pagination.

Append input: key (stable lowercase slug), title, currencies (one or more of the
eight majors), kind (scheduled/headline/watch), status (confirmed/reported/unverified),
facts, optional interpretation, time_note, and sources. Sources use kind (web/local),
label, locator and optional note; at least one direct HTTP(S) web source is required.
Local sources must be absolute paths inside Lite. Preserve source availability
and provider/publication clocks in the timing note/source notes.

Optional event_at is a timezone-aware exact reference time; event_date is a
date-only source schedule. Never supply both or invent an hour. Scheduled records
need one; unscheduled watch items must have neither. Optional published_utc is the
source's actual publication time, never a future schedule. saved_utc is generated
when writing: it does not prove the record was available historically. A headline
reference/provider clock does not establish first dissemination or an executable fill.

Corrections repeat the complete request and supply expected_version = latest id.
Archive/restore also require that id. A stale write fails without replacing
anything. Use read to resolve conflicts; retain prior evidence and user notes.
Save only within the user's requested research/lifecycle scope. Do not automatically
turn every limitation, potential risk or search result into a confirmed event.

## Persistence and API

Immutable JSON versions live in Git-ignored Market Analyst Workflow/external-sources/.
Writes use a separate metadata lock and atomic replacement of a new version file.
Corrupt records fail visibly rather than disappearing. Back up this folder with
the user's research folders; calendar backups do not include it.

GET /api/v1/external-sources supports scope, visibility, limit, offset and
after_revision; unchanged replies retain existing identities. GET /{key} returns
history. POST to the collection appends; POST /{key}/archive or /restore accepts
expected_version. Chart stars and the dock poll their scoped collection only
while mounted, cancel stale replies and retain last loaded records on failure.
Chart polling stays local to the overlay. Restart storage manually after installing
the backend change; an older service returns an explicit unavailable message.
