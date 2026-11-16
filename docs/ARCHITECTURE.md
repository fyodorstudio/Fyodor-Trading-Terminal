# Architecture

## Services

The React/Vite frontend uses loopback APIs for the MT5 bridge (8001), storage
(8002) and independent alarm worker (8003). Vite proxies `/storage-api` to storage.
The bridge supplies market data and calendar transport; storage owns persistence.
`FYODOR_BRIDGE_API_URL` and `FYODOR_STORAGE_API_URL` configure proxy targets.

## Frontend

| Module under `frontend/src/` | Responsibility |
| --- | --- |
| `terminal-shell`, `workspace-docking` | Chart workspace and panels |
| `market-data` | OHLC, Market Watch, chart navigation, drawings and indicators |
| `economic-calendar`, `inspector` | Event catalogue, filters, release packages and raw readings |
| `alert`, `events-alarms`, `price-alerts` | Calendar reminders and price notifications |
| `currency-ledger`, `currency-details`, `wildcards` | Timeline, metric comparisons and global manual events |
| `heatmap` | Returns, synthetic baskets, rankings and wildcard notes |
| `news-flow` | Right-panel RSS/Atom reader, provider setup and headline filters |
| `entry-trade` | Manual plans and journal |
| `appearance`, `system-connectivity`, `system-observability` | Theme, clocks, connection state and Activity |

Features support USD, EUR, GBP, JPY, CHF, CAD, AUD and NZD and their 28 FX pairs.
`config/chart-currency-scopes.json` also maps supported indices and other symbols.

Chart navigation retains a date window across pair and timeframe changes. Price
bounds are remembered per broker/instrument and shared across its timeframes,
including empty loading states. A new instrument inherits proportional price zoom
and position; revisiting one restores its own bounds. Explicit navigation and
Refocus replace the view. The native minimum candle span can temporarily widen a
very narrow higher-timeframe view; the original date target survives the return.

## Storage

`storage/persistence/schema.py` defines the SQLite calendar schema. Its tables
include sources, events, observations, coverage, jobs and event timing.
`storage/calendar_store.py` exposes the calendar store. The default database is
`storage/data/calendar.sqlite3`; `FYODOR_STORAGE_DATA_DIR` changes the data directory.
SQLite uses WAL mode.

Global Wildcards are stored in `storage/data/wildcards/wildcards.json`.
`storage/wildcards.py` provides revision-checked, atomic CRUD at `/api/v1/wildcards`.
An entry has a title, details, optional source URL, Jakarta date and optional UTC
timestamp. Entries apply to all instruments and brokers. The first read migrates
current manual News and broker wildcard notes; their original files remain intact.
Identical broker notes merge into one global entry. Backup/restore includes the
shared store and legacy files.

`frontend/src/wildcards/` owns the shared state and editor. The dock, chart icons,
Heatmap cells and Detail all use that state. Drawing-toolbar placement converts the
selected candle into a saved UTC timestamp. Chart timeframe changes regroup icons
without changing saved times. Heatmap groups timed entries by broker candle day;
date-only entries retain their entered date.

Fed readings and alarm state use local data subdirectories.
News Flow is isolated in `frontend/src/news-flow/` and `storage/news_flow/`.
The storage service collects free starter feeds independently of MT5 and the
panel, using conditional requests, one-second success cadence and error backoff.
Providers/current headline cache live in `storage/data/news-flow/news.sqlite3`,
included in offline backup/restore. No article-version archive is built.
The v3 source pack added 20 subscriptions (34 at that time): targeted Reuters
FX/oil/equities/metals and Japan economic news, Kitco, RBNZ/SNB, economic releases
across the currency regions, Japan MOF and EIA. Google delivery is named where
direct feeds are blocked/unavailable. `storage/news_flow/SOURCES.md` records
coverage, discovery links and limitations. The additive migration preserves
provider customizations and cached items. RSS/Atom parsing resolves relative
article URLs against the final feed URL and reads XHTML text constructs.
News Flow v4 adds 13 public subscriptions (47 total) including Bloomberg direct
and Google, Dow Jones publications, FT, CNBC, investingLive and Investing.com.
Publisher families group related feeds on desktop/mobile. First collection can
be displayed beside publication without changing timeline order. The isolated
diagnostics module retains 24-hour minute summaries and collector heartbeats;
new live discoveries keep a previous-check timestamp. No feed-body archive or
claim of access to paid institutional wires is introduced.
News Flow Extended View uses provider tabs plus Browse/Priority/Settings.
Settings separates Global (keywords, colours, sound) from Providers (URL,
polling, visibility), with global controls owned by `NewsGlobalSettings.tsx`.
Shared classification is All/Included/Excluded. Trading relevance defaults on;
`storage/news_flow/relevance.py` and its JSON own contextual classification, with
explicit Exclude precedence and verified official-release protection. SQL applies
the decision before count/paging/export; desktop/mobile colours and both alert
paths share it. Literal mode remains available. The preset revision 3 migration
backs up prior settings, preserves custom tags and Off, and changes enabled old
All alerts to Included. V5 adds six specialist feeds and pauses the original
broad Investing.com query without deleting history: 52 active starter feeds.
Provider collection can be paused independently of browsing visibility.
Tag inputs narrow existing labels while typing and save
pending valid tags when focus moves outside the editor. The panel has a provider
checkbox selector and debounced literal headline search; source/date/keyword and
search scopes apply before backend counting/deduplication/pagination. Row actions
are top-right icons. A separate 15-second UI clock updates relative ages without
feed changes; missing/future publication times display labelled first-collection
ages and retain the feed time in the tooltip. Backend timeline_at and frontend
newsTimestamp freeze the fallback against first_seen (60-second future tolerance),
so sorting/date scopes/Wildcard drafts agree and scheduled dates cannot promote
old announcements. The calendar icon is an overlaid
native date input, opening directly without a collapsible form; an active date
chip clears the scope. Provider labels keep their native checkbox activation
through transient null-focus transitions, and the full row is a padded target.
`provider-groups.ts` identifies publisher families from direct feed domains or
Google site scopes; mixed/unknown searches stay separate. Group checkboxes update
existing hidden-source preferences in one operation, with expandable members.
`NewsCopy.tsx` provides rolling hours/days copy in the panel and extended reader.
The backend export route shares validated reader scopes and one locked query,
replacing date/paging with the relative window and a title/link-only projection.
All matching rows are copied newest first; >10,000 is rejected without truncation.
The local cache is exported without historical backfill. Browser clipboard denial
leaves selectable plain text; cancellation/scope changes cannot copy stale data.
A workspace-level listener plays optional built-in sounds using a live arrival
cursor. Global triggers are Off / Included keywords / All new headlines; All
ignores keyword rules but both honor selected providers. Startup snapshots,
history imports and duplicate URLs stay silent. Missing/scheduled live timestamps
use stable first collection. New live discoveries alert even with older publication
metadata; arrival freshness uses received_at. Batches page without skipping matches.
The header bell owns desktop audio readiness/pending/last-alert evidence and phone
setup. Browser rule edits synchronize to a backend-owned NewsNotifier, so Android
ntfy delivery does not depend on an open browser. The separate mobile entry is built
to dist-news and served behind reader authentication on LAN port 8005; only news
read endpoints are proxied. Its ntfy child (8004) has separate read/write accounts.
The startup helper validates checkout ownership, verifies the pinned official binary
on download and scopes the firewall to the routed LAN. See storage/news_flow/PHONE.md.
Provider polling defaults to 1s with per-source overrides and persisted retry
and next-fetch deadlines. Refresh/edits/restarts preserve cooldowns. Priority
combines explicit per-URL SQLite stars, institution-based policy coverage and
conservative feed-text previews. `policy.py` owns bank/currency grouping and
bounded source-wording evidence. All / Central banks / Expectations / Starred and
currency filters apply before pagination. Stance wording is quoted, with no
inferred buy/sell direction, article-body extraction or generated odds. Headline actions open
the existing manual Wildcard editor with original publication time (or labelled
collection-time fallback). Chart markers bridge nearby market gaps to real
candles without altering stored event times. Extended modal state is retained
while the existing Wildcard editor owns focus.
Historical lookup uses scoped Google date queries for starter RSS providers and
Treasury's official yearly announcement index, with exact UTC window filtering,
shared per-provider locks and cached outcomes. Custom unsupported feeds explicitly
report cached-only results. Heatmap's daily shortcut opens News Flow using
historical broker-session UTC bounds, with source/keyword selections preserved.
See the feature READMEs in those folders for entry points and test commands.
`storage/run.py` provides service, import, status, backup, restore and Fed-data
commands. Manual trade journals retain their existing application path.

## Clocks and calendar

The UI defaults to Asia/Jakarta (UTC+07:00, AM/PM). Publication timestamps and
broker candle coordinates are separate fields. Historical broker offsets are
configured in `config/broker-clock-profiles.json`. Date-only events have no exact
publication timestamp. Calendar measure definitions are in `config/calendar-measures.json`.
Detail groups calendar readings into Monetary policy, Inflation, Labor and Growth.
Ledger and Detail use the same selected time. Detail's cursor-follow mode batches
hover updates by animation frame; clicking pins the candle time. Its Wildcards
section shows the selected day during hover, or the preceding seven days when
pinned, excluding entries after the selected time. Date-only entries become
eligible at the end of their Jakarta date.

Manual calendar corrections live in `config/calendar-overrides/*.json` and are
applied by `storage/calendar_overrides.py` when reading calendar and Ledger data.
Each file identifies a currency, country and MT5 event ID; each release identifies
its value ID and the fields to replace (`actual`, `forecast`, `previous`,
`revised_previous`, or `released_at`). Omitted fields keep their MT5 values;
`null` clears a numeric field. Release timestamps include their timezone and are
converted to each broker's chart clock. Raw SQLite records stay unchanged.
Restart storage after editing these files. The RBA history uses the supplied
Investing.com table, with pasted times interpreted as Asia/Jakarta.
Eurozone CPI corrections cover the 21 release dates in 2026 through 4 November,
using Eurostat's release-specific HICP tables. Each corrected release links to its
official table. Older CPI history has not been verified by these correction files.

## MFDI

Implementation: `frontend/src/market-data/indicators/macro/`.
The exact calendar catalog supplies numerical series and selectable announcements.
One browser configuration applies across instruments. Currency tabs choose the
active event list and restore its axes, lane order, spacing, folded/hidden groups,
and visibility of the shared announcement/Wildcards row. Category definitions and
colors are shared across currencies. Custom categories support editing and hiding.
Duplicate category names and former standard-category IDs are merged with their
saved assignments, colors and references in every currency view.

Series owns event selection, removal, row appearance and category organization.
Pointer and keyboard handles reorder rows/categories; chart lanes follow the same
order. Hidden rows and empty categories consume no lane height. Folding a group
only folds its drawer list. Category visibility retains individual eye choices.
Lane dragging and the scrollbar share one bounded vertical position; legacy free
offsets are folded into that position. The lock enables group dragging in both
views. Blank-space clicks restore the lock and clear Series highlights. Numerical
plots retain independent scales and linked-axis navigation. Layout-only updates
reuse plotted data and leave the shared time window alone. Divider gestures are
excluded from price panning, hold the price/date view, and persist final MFDI
placements after release. Pointer redraws are batched by animation frame; lane
geometry and Series controls are refreshed only when their inputs change.
UI listeners and timers are cancelled on scope changes
and removal. Appearance settings use drafts with OK/Cancel; working Series changes
persist immediately. `macro-essentials.ts` defines initial numerical selections and
catalog gaps. Initial announcement selections remain editable thereafter.

Actual values use filled rectangles; forecast values use outlined rectangles.
A spatial grid suppresses overlapping labels while preserving hoverable dots.
F controls historical and upcoming forecasts; N controls value text. Placement can
be inside rectangles or above markers. Category colors apply across currency tabs,
with individual series overrides. Appearance reset retains event selections and
visibility. The Settings window contains only global appearance controls.

The shared text row combines selected active-currency announcements with global
Wildcards. Its contents do not create numerical series. Actuals align to containing
chart candles. Policy rates carry forward; other series join released points.
The Fed supplement remains in `storage/fed_forecasts.py` and
`storage/data/fed-forecasts/`. `pnpm storage:fed-forecasts --help` lists its commands.

## Heatmap

Daily returns compare OHLC with the previous available D1 close; weekly returns
compare the week's OHLC with the preceding week's final close. Synthetic currency
baskets use equal-weight geometric returns across seven counterparts. Event-window
views use a fixed common anchor. These calculations live in
`frontend/src/heatmap/`. Selection records exact instrument/period cells or whole
column ranges, independently of the active ranking period. Exports filter each
row's points to avoid expanding scattered selections into extra readings.
The dock and standalone panel share the Details/Bars ranking component and a
broker-scoped view preference; bars always show C on a symmetric return scale.

## Alarms

`storage/alarms.py`, `storage/alarm_service.py` and `storage/alert_subscriptions.py`
implement durable calendar notifications. Settings, selections and delivery history
live under `storage/data/alarms/`. Price alerts have independent browser settings.
Notifications operate while the worker and Windows are running. Alarm selections
refer to MT5 calendar release packages. Desktop notifications support opening
the terminal, sound control, snooze and dismiss.
