# News Flow backend

This package owns free providers, collection, local cache and `/api/v1/news-flow/*`.
It is independent of calendar and Wildcard logic. The storage lifespan mounts
`api.news_router` and starts/stops `collector.NewsCollector`. Collection continues
with MT5 disconnected and the panel closed, while the service/computer run.

- `providers.py`: starter pack (including a targeted Reuters expectations query) and historical scopes. Additive
  migration seeds Reuters via Google News, FXStreet, Fed policy/speeches, ECB,
  BoE news/speeches, BoC releases/speeches, RBA releases/speeches, BoJ and Treasury.
  The v3 expansion added 20 entries (34 at that time): targeted Reuters market and
  Japan searches, Kitco, RBNZ/SNB, BEA/BLS/Eurostat/ONS/Statistics Canada, regional
  economic releases, Japan MOF and EIA. V4 adds 13 feeds (47 defaults): Bloomberg
  direct Markets/Economics and Google headlines/FX; WSJ direct Markets/Google,
  MarketWatch direct, Barron's Google; FT direct/Google, CNBC, investingLive and
  Investing.com Google. V5 adds six specialist/primary/macro feeds and pauses the
  noisy broad Investing.com collector without deleting its cache (52 active starter
  feeds). Collection can be re-enabled in Provider settings. Google delivery is explicit in names. Public headlines
  do not grant subscription article access or the full institutional newswires.
  Existing names/URLs, polling, cooldowns and custom providers are preserved.
  See [SOURCES.md](SOURCES.md) for coverage, verified discovery links and limits.
- `feeds.py`: bounded 4MB HTTP reads with 10-second timeout, conditional GET,
  RSS/Atom parser, plain text and validated article URLs. Relative article URLs
  resolve against the final feed URL; Atom XHTML title/summary constructs are
  flattened safely to plain text. This supports EIA and Statistics Canada.
  The exact Treasury
  press-release index URL is handled by a dedicated JSON adapter using Treasury's
  own `/news-data/press-releases/search/{year}.json` index; no full article scrape.
- `store.py`: isolated `<storage data>/news-flow/news.sqlite3`. Providers, current
  item snapshots, first-seen timestamps, cached searches, Priority pins and live-arrival cursors.
  Repeated GUIDs update current items. No article-version archive is built.
  Source/date filters run before exact-URL deduplication. All is unfiltered;
  With market_relevance=true the shared contextual classifier decides Included;
  explicit Exclude wins and Excluded is the complement. Raw mode preserves literal
  Include/Exclude behavior. Context classification applies before counts and paging,
  including unmatched items. Official protections and manual stars can qualify without Include terms.
  Optional literal case-insensitive headline search intersects these scopes
  before counting, deduplication and pagination; SQL metacharacters stay literal.
  Export reuses these filters and exact-URL deduplication in one locked snapshot,
  with a title/link-only projection, newest first, across all matching rows.
  More than MAX_EXPORT_ITEMS (10,000) is rejected with HTTP 413 instead of partial
  text. Export does not trigger history searches or mutate collection state.
- `relevance.py`, `relevance.json`: the single trading-relevance authority,
  official-source protection, contextual guards, edition-suffix handling, shared
  aliases/preset and profile migration. Reader/export/arrivals/phone use one result.
  See [classification and limits](RELEVANCE.md).
- `rules.py`: bounded, cached, literal whole-word/phrase rules with NFKC and
  currency-pair normalization. Up to 500 tags/16000 characters per list; API
  rejects excess rules rather than truncating. Sound and reading share rules.
  Explicit variants: Japan includes Japanese; Democrat includes Democrats and
  Democratic. Other keywords keep literal word/phrase boundaries.
  Conservative expectations-candidate detection reads headline/feed text only,
  suppresses obvious post-decision headlines and never extracts implied odds.
  Old research-query parameters remain for compatibility. Current reading modes
  use importance.py: disjoint Priority/Included/Excluded and explicit Exclude
  precedence, with conservative automatic candidates and manual stars.
- `importance.py`: headline-only attention rules; Included delivery unions both
  relevant levels. See RELEVANCE.md for the contract.
- `notification_format.py`: bounded single/batch ntfy content and view actions;
  no duplicated title/body or printed URLs, explicit UTC publication/collection.
- `policy.py`: institution-based policy/currency grouping for eight central
  banks. Headline/feed-summary hawkish/dovish wording has bounded attributed
  evidence; mixed or qualified language is distinguished, and missing wording
  stays unclassified. No official-name roster, article extraction or inferred
  stance from rate actions.
- `collector.py`: max eight active providers, two per host, one request per provider.
  Oldest-due scheduling avoids an executor backlog; fetch_ms/queue_ms expose
  request duration and lateness after due (not upstream availability).
  `poll_seconds` defaults to 1, adjustable 1–3600 per provider. `next_fetch_at`,
  `retry_at` and failures persist in SQLite. Success uses the latest interval;
  errors use exponential backoff/Retry-After up to one day. Refresh cannot bypass
  retry deadlines, nor can a restart or interval edit. Pending live fetches
  recheck cooldowns after obtaining the source lock. Legacy retry messages are
  conservatively migrated with their full stated delay once. Source edits do
  not issue an extra global refresh or erase active errors/cooldowns.
- `diagnostics.py`: 24-hour minute summaries of 200/304/429/errors, durations,
  HTTP Date/Age and parsed counts; no response bodies. Collector runs persist
  starts, 30-second heartbeats and clean stops. API diagnostics GET returns the
  current source URL's last hour and five runs. URL edits isolate old evidence.
  Newly discovered live rows retain previous_check_at; backfills/legacy rows do
  not invent it. First collection and publication remain separate.
- `history.py`: on-demand best-effort Google date searches for configured Google
  feeds and known starter RSS scopes; Treasury fetches the requested UTC year(s).
  Exact UTC window filtering after retrieval. Per-source locks shared with live
  collection. Historical imports preserve live URL, validators and status.
  Successful/empty search outcomes cache 15 minutes; forced refresh bypasses
  success caches, never failure backoff. Custom unsupported feeds are named in
  the response. Google results can be incomplete and are not exhaustive archives.
- `api.py`: sources GET/POST/PUT, items/export GET, priority PUT, arrivals GET,
  refresh/history POST. Shared item_scope validates provider/keyword/search/
  organizer/currency filters for both the reader and export. Export ends at
  server UTC now and accepts integer amount + hours/days (up to 10 years).
  Only provider name/HTTP(S) URL required. URL edits clear validators and prime
  the new feed silently; stale in-flight responses are ignored. Existing
  cooldown deadlines remain visible and honoured.

All times are UTC milliseconds. Raw publication metadata remains unchanged.
`timeline_at` is publication unless missing or >= first_seen + 60 seconds,
otherwise stable first_seen. Sort order, date scopes, display and Wildcard drafts
agree; scheduled dates becoming past do not promote announcements. Local cache persists across restarts
and has no automatic expiry. Offline SQLite backup/restore includes it.

`arrivals` is a monotonic delivery cursor, not an article-version archive. Only
new live items from already-primed feeds create arrivals; historical imports,
first loads, edits and existing article URLs do not. Initial listener requests
return only the cursor. `mode=included` applies Include/Exclude; `mode=all`
ignores keywords. Both honor hidden providers and return up to 200 eligible
arrivals; paged batches do not skip remaining matches. Freshness uses received_at
(15 minutes), never publication age. Responses expose received_at separately from
the unchanged publication/timeline metadata. Frontend classifies current rules
at response time, retains its cursor across edits, and coalesces each batch.
Blocked audio is visible and recoverable for one minute without backlog replay.
This is a relevance alert, not a volatility prediction.

`notifications.py` owns backend phone delivery and persisted rules/mode, independent
of browser audio. API notifications GET/PUT, notifications/rules PUT, and test POST
are desktop-only; phone-profile GET exposes only keyword/provider rules. Storage
lifespan starts/stops the notifier with a silent baseline. Failed publishing keeps
the cursor for retry. See [Android setup](PHONE.md) for ntfy ownership, delivery
limits, authentication, local state and startup.

`phone.py` exposes an authenticated read-only LAN reader on 8005, proxying only
items/sources/export/phone-profile GETs to loopback storage. It manages the ntfy
child on 8004; phone_setup.py pins/checksums the official Windows binary and
provisions separate read-only/write-only accounts. The startup helper validates
checkout process identities and opens only the scoped LAN ports. No trading,
provider editing, notification credentials or Wildcard mutation routes are proxied.

No new Python dependency, paid API, full-text scraping or backend Wildcard mutation.
The frontend can open an existing manual Wildcard draft from a headline.
Provider URLs are local trusted configuration. Feed markup is text only.
Run: `bridge/.venv/Scripts/python.exe -m unittest storage.news_flow.tests.test_news_flow -v`.
Standard suite discovers via `storage/tests/test_news_flow.py`.
