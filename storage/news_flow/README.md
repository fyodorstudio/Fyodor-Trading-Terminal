# News Flow backend

This package owns free providers, collection, local cache and `/api/v1/news-flow/*`.
It is independent of calendar and Wildcard logic. The storage lifespan mounts
`api.news_router` and starts/stops `collector.NewsCollector`. Collection continues
with MT5 disconnected and the panel closed, while the service/computer run.

- `providers.py`: starter pack and historical query scopes. One-time additive
  migration seeds Reuters via Google News, FXStreet, Fed policy/speeches, ECB,
  BoE news/speeches, BoC releases/speeches, RBA releases/speeches, BoJ and Treasury.
  Existing names/URLs and custom providers are preserved. RBNZ/SNB are not seeded.
- `feeds.py`: bounded 4MB HTTP reads with 10-second timeout, conditional GET,
  RSS/Atom parser, plain text and validated article URLs. The exact Treasury
  press-release index URL is handled by a dedicated JSON adapter using Treasury's
  own `/news-data/press-releases/search/{year}.json` index; no full article scrape.
- `store.py`: isolated `<storage data>/news-flow/news.sqlite3`. Providers, current
  item snapshots, first-seen timestamps, cached searches and live-arrival cursors.
  Repeated GUIDs update current items. No article-version archive is built.
  Source/date/keyword filters run before exact-URL deduplication, preserving
  individual provider browsing. Keywords match headline text, case-insensitively,
  literally; any Include qualifies and any Exclude rejects. Empty Include allows
  non-excluded stories for reading, but never enables keyword alerts.
- `collector.py`: max four simultaneous providers, one request per provider.
  Wait one second after success/304; exponential failure backoff and Retry-After
  up to one day. Refresh respects error backoff. Errors preserve cached items.
- `history.py`: on-demand best-effort Google date searches for configured Google
  feeds and known starter RSS scopes; Treasury fetches the requested UTC year(s).
  Exact UTC window filtering after retrieval. Per-source locks shared with live
  collection. Historical imports preserve live URL, validators and status.
  Successful/empty search outcomes cache 15 minutes; forced refresh bypasses
  success caches, never failure backoff. Custom unsupported feeds are named in
  the response. Google results can be incomplete and are not exhaustive archives.
- `api.py`: sources GET/POST/PUT, items GET, arrivals GET, refresh/history POST.
  Only provider name/HTTP(S) URL required. URL edits clear validators and prime
  the new feed silently; stale in-flight responses are ignored.

All times are UTC milliseconds. Undated feed items retain null publication time,
with clearly labelled first_seen fallback. Local cache persists across restarts
and has no automatic expiry. Offline SQLite backup/restore includes it.

`arrivals` is a monotonic delivery cursor, not an article-version archive. Only
new live items from already-primed feeds create arrivals; historical imports,
first loads, edits and existing article URLs do not. Initial listener requests
return only the cursor. Later requests apply the same Include/Exclude rules and
hidden providers, returning up to 200 matches and advancing the cursor atomically.
Undated or stale (>15min) publications and >1min-future timestamps stay silent.
Frontend coalesces batches into one sound, and requires publication after the
listener was enabled. This is a relevance alert, not a volatility prediction.

No new Python dependency, paid API, full-text scraping or Wildcard mutation.
Provider URLs are local trusted configuration. Feed markup is text only.
Run: `bridge/.venv/Scripts/python.exe -m unittest storage.news_flow.tests.test_news_flow -v`.
Standard suite discovers via `storage/tests/test_news_flow.py`.
