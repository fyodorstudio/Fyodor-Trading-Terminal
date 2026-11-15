# News Flow backend

This package owns free providers, collection, local cache and `/api/v1/news-flow/*`.
It is independent of calendar and Wildcard logic. The storage lifespan mounts
`api.news_router` and starts/stops `collector.NewsCollector`. Collection continues
with MT5 disconnected and the panel closed, while the service/computer run.

- `providers.py`: starter pack (including a targeted Reuters expectations query) and historical scopes. Additive
  migration seeds Reuters via Google News, FXStreet, Fed policy/speeches, ECB,
  BoE news/speeches, BoC releases/speeches, RBA releases/speeches, BoJ and Treasury.
  Existing names/URLs and custom providers are preserved. RBNZ/SNB are not seeded.
- `feeds.py`: bounded 4MB HTTP reads with 10-second timeout, conditional GET,
  RSS/Atom parser, plain text and validated article URLs. The exact Treasury
  press-release index URL is handled by a dedicated JSON adapter using Treasury's
  own `/news-data/press-releases/search/{year}.json` index; no full article scrape.
- `store.py`: isolated `<storage data>/news-flow/news.sqlite3`. Providers, current
  item snapshots, first-seen timestamps, cached searches, Priority pins and live-arrival cursors.
  Repeated GUIDs update current items. No article-version archive is built.
  Source/date filters run before exact-URL deduplication. All is unfiltered;
  Included requires any Include and no Exclude; Excluded is the complement,
  including unmatched items. Empty Include means no Included items.
  Optional literal case-insensitive headline search intersects these scopes
  before counting, deduplication and pagination; SQL metacharacters stay literal.
- `rules.py`: bounded, cached, literal whole-word/phrase rules with NFKC and
  currency-pair normalization. Up to 500 tags/16000 characters per list; API
  rejects excess rules rather than truncating. Sound and reading share rules.
  Explicit variants: Japan includes Japanese; Democrat includes Democrats and
  Democratic. Other keywords keep literal word/phrase boundaries.
  Conservative expectations-candidate detection reads headline/feed text only,
  suppresses obvious post-decision headlines and never extracts implied odds.
  Priority queries combine candidates and persistent per-URL manual stars,
  independently of Include/Exclude. Stars sort first; date/source scopes apply.
- `collector.py`: max four concurrent providers, one request per provider.
  `poll_seconds` defaults to 1, adjustable 1–3600 per provider. `next_fetch_at`,
  `retry_at` and failures persist in SQLite. Success uses the latest interval;
  errors use exponential backoff/Retry-After up to one day. Refresh cannot bypass
  retry deadlines, nor can a restart or interval edit. Pending live fetches
  recheck cooldowns after obtaining the source lock. Legacy retry messages are
  conservatively migrated with their full stated delay once. Source edits do
  not issue an extra global refresh or erase active errors/cooldowns.
- `history.py`: on-demand best-effort Google date searches for configured Google
  feeds and known starter RSS scopes; Treasury fetches the requested UTC year(s).
  Exact UTC window filtering after retrieval. Per-source locks shared with live
  collection. Historical imports preserve live URL, validators and status.
  Successful/empty search outcomes cache 15 minutes; forced refresh bypasses
  success caches, never failure backoff. Custom unsupported feeds are named in
  the response. Google results can be incomplete and are not exhaustive archives.
- `api.py`: sources GET/POST/PUT, items GET (mode/priority/search), priority PUT, arrivals GET, refresh/history POST.
  Only provider name/HTTP(S) URL required. URL edits clear validators and prime
  the new feed silently; stale in-flight responses are ignored. Existing
  cooldown deadlines remain visible and honoured.

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

No new Python dependency, paid API, full-text scraping or backend Wildcard mutation.
The frontend can open an existing manual Wildcard draft from a headline.
Provider URLs are local trusted configuration. Feed markup is text only.
Run: `bridge/.venv/Scripts/python.exe -m unittest storage.news_flow.tests.test_news_flow -v`.
Standard suite discovers via `storage/tests/test_news_flow.py`.
