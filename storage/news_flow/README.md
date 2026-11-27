# News Flow backend

Owns providers, collection, the SQLite cache and `/api/v1/news-flow/*`.
`storage/app.py` starts the collector and notifier. Collection works independently
of MT5 and whether the news panel is open.

## Modules

| Module | Responsibility |
| --- | --- |
| `providers.py` | Starter feeds, upgrades and supported historical scopes |
| `collector.py`, `feeds.py` | Scheduled RSS/Atom fetching and parsing |
| `store.py` | Cache, reader queries, exports and arrival cursors |
| `relevance.py`, `relevance.json` | Trading relevance and editable defaults |
| `signals.py`, `importance.py`, `priority.py` | Fundamental mechanisms, Priority 1 classification and manual stars |
| `attention.py`, `publication.py` | Clear-signal selection, routine formats and dated-session checks |
| `rules.py`, `filter_policy.py`, `policy.py` | Matching, user overrides and delivery selection |
| `history.py` | Historical lookup for supported sources |
| `diagnostics.py` | Provider check summaries and collector status |
| `notifications.py`, `notification_format.py` | Android alerts and message formatting |
| `phone.py`, `phone_setup.py` | Authenticated phone reader and local ntfy setup |
| `api.py` | HTTP routes |

## Reading and collection

The cache is `storage/data/news-flow/news.sqlite3`. Collection defaults to one
second per provider, with conditional GET, persisted retry deadlines and backoff.
There is one in-flight request per provider, eight workers and at most two per
host. Provider visibility and collection can be changed independently.

Reader filters apply before counting, deduplication, pagination and export.
The reader uses SQLite snapshots so filtering can run alongside collection.
Repeated page requests reuse results until headline, star or provider content changes.
The newest filtered view can show a recent page while the archive count loads.
The reader, copy and alert paths reuse headline decisions for the same rules.
P1, P2 and Excluded checkboxes select any combination of the three disjoint tiers.
Selecting all shows every tier; clearing all shows no headlines.
The backend supplies classification to desktop, phone, copying and notifications;
see [filter rules](RELEVANCE.md) and the [source catalogue](SOURCES.md).

Publication time controls date scopes, copy windows and Wildcard drafts. Missing
or future publication times use first collection as a stable fallback. Users can
sort by publication or collection time. Historical lookup uses scoped Google
queries and Treasury's yearly index where supported; other feeds use the cache.

## Notifications and phone

Off / Priority 1 only / Priority 1 + Priority 2 / All, selected providers, keywords and publication-age limits are
shared across desktop and Android. One Save settings button applies the alert
controls. Recent unprocessed live arrivals can notify after restart; saved cursors
keep consumed arrivals silent. First-source loads, historical imports and duplicate
links stay silent. Failed delivery keeps the cursor for retry. Priority 1-only delivery also suppresses identical republished
titles within two hours across URLs/providers, retaining changed figures and periods. Desktop sounds and browser popups are handled by the frontend.

The phone reader listens on LAN port 8005 with reader authentication and proxies
only news read routes. Local ntfy uses port 8004 with separate reader/writer
accounts. [Android setup](PHONE.md) covers credentials and startup.

## Tests

From the repository root:

```powershell
pnpm test:storage
```

Feature tests live in `storage/news_flow/tests/` and are included by the discovery
wrappers in `storage/tests/`. Test fixtures cover reader queries, classification,
collection, delivery and the phone gateway.
