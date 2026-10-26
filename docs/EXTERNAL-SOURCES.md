# External Sources

Alert's selected-date table combines Pepperstone readings and named external
publishers. External events, headlines and watch items retain separate identities,
facts, dated interpretation, source links and immutable version history.
All/eight-currency filters apply to the date table. Undated items have their own
section. An elapsed time does not verify publication or an outcome.

Open an event's **Sources & history** for publication/recorded clocks, evidence,
version history and **Show icon on chart**. Feed notes contains broker-specific
Discovered Limitations, with source links, follow-up actions and an offline cache.
Agents read these with `pnpm analyst limitations --broker <broker>`.

Active external records are pins in the agent interface. Archive/restore commands
preserve their immutable lifecycle; Alert displays saved dated records without
collection, search, date-sort or archive controls. Refresh both currency stories
or the commodity mechanism before treating dated interpretation as current.
The collection supplies no live news ingestion or background monitoring.

Active dated records appear as gold stars on matching currency pairs when chart
visibility is enabled. Exact UTC times use the broker's verified chart-clock/DST
profile; source dates stay date-only and untimed watches have no marker. Clicking
a star opens its Alert details. Projection does not insert price candles.

**Show icon on chart** is a browser preference per stable record key, shared across
matching pairs and surviving reloads. Hiding an icon preserves facts and history.
Archived records remain readable; their icons default off unless explicitly
shown. Failed preference writes are reported without claiming success.
A confirmed future scheduled record can have an opt-in Invoke reminder through
the [alarm worker](EVENTS-ALARMS.md). New events start off; pins and icons do not
arm reminders. Date-only and unverified times never supply an alarm hour.

Assess Trade Now now owns upcoming-alert review and has standing authorization to
pin verified material discoveries and request chart visibility, unless the user
explicitly asks for read-only/no-save work. Official publisher schedules/results
and fresh reporting take priority over incomplete broker coverage. The required
discovery receipt records source checks, actual retrieval clocks and pin read-back;
it does not guarantee exhaustive news coverage or create a live monitor.

An append with `show_on_chart: true`, or the command below for an existing active
dated record, persists a new `chart_icon_request_id`. It supersedes a browser hide
from before that request. The user can hide the icon again; ordinary research
updates retain that later choice until another explicit show request. Old records
and boolean browser preferences remain readable without migration. Untimed watches
cannot request a marker; restore an archived record before requesting visibility.
Read back the active scope/time/request ID and, when available, the live storage
route before claiming success. Visual placement remains a manual UI check.
Chart requests use immutable `chart-requests/<version-id>.json` sidecars so older
strict storage/alarm readers keep reading the original record schema. Existing
inline requests remain readable; no history migration is required.

Before analyst writes, `external preflight` probes the running storage capability
and verifies the shared directory. It also checks the active alarm worker's
External Source reader schema/directory (FYODOR_ALARM_PORT, default 8003); an old
or unverifiable worker blocks writes even if storage was restarted. A stopped
worker permits persistence without claiming alarm delivery. Every external CLI
mutation enforces these checks.
An older service, directory mismatch, timeout or malformed reply blocks the write
before files change. A refused connection permits offline persistence, with live
delivery unverified. Load the updated backend/UI before using chart requests;
research does not authorize a service restart. Internal Python writers are for
the storage service and isolated tests, not a preflight bypass in analyst work.

Commodity records may use `instruments: ["BRENT", "WTI"]` or `["GOLD"]` with
empty `currencies` when no independent currency impact is established. At least
one currency or instrument is required. Query with `external --scope BRENT`,
WTI or GOLD; commodity scope includes USD macro context without implying USD bias.
All/search views retain instrument-only records; currency filters stay currency
specific. Chart aliases are shared in config/research-instruments.json and route
commodity records to their matching charts; no commodity is added to the forex
catalog. Schema-3 runtime compatibility is required before new CLI writes.

## Agent commands

Run from Lite; no service or broker connection is needed:

```powershell
pnpm analyst external --scope EURUSD --visibility all --from 2026-08-19 --to 2026-08-20
pnpm analyst external read --key us-treasury-20260819-long-end-buybacks
pnpm analyst external preflight
pnpm analyst external append --input "Market Analyst Workflow/report/<report>/external-event.json"
pnpm analyst external archive --key <key> --expected-version <latest-id>
pnpm analyst external restore --key <key> --expected-version <latest-id>
pnpm analyst external show-on-chart --key <key> --expected-version <latest-id>
```

List supports --match, --limit and --offset; follow next_offset. Dates are inclusive
UTC days; date-only records retain their source date. Undated watch items remain
visible in dated scans. Read returns newest versions first, with pagination.

Append input: key (stable lowercase slug), title, affected currencies and/or
instruments (at least one supported identity), kind (scheduled/headline/watch), status (confirmed/reported/unverified),
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
Assess Trade Now supplies the scoped standing event-pin/icon authorization;
full journals, Thesis conclusions and impact ratings retain their separate rules.

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
