# News Flow backend

This package exclusively owns news providers, feed collection, local headline
history and `/api/v1/news-flow/*`. It does not import calendar or Wildcard logic.
The service mounts `api.news_router` and starts/stops `collector.NewsCollector`
in `storage/app.py`. It works with MT5 disconnected and with the panel closed.
The storage service and computer must be running to collect news.

- `feeds.py`: bounded HTTP fetches, ETag/Last-Modified conditional requests,
  RSS/Atom parsing, plain-text summaries, publication timestamps and feed IDs.
- `store.py`: isolated SQLite database at `<storage data>/news-flow/news.sqlite3`.
  Persisted providers, upserted items, first-seen times, indexed history and
  source/date/keyword/sort/pagination queries. Default source is Reuters via
  the user's Google News RSS query. History has no automatic expiry.
- `collector.py`: at most four concurrent providers and one in-flight request
  per provider. Wait one second after a successful response, including 304.
  Errors use exponential backoff and honor Retry-After, bounded to one day.
  Manual refresh respects existing error backoff. Provider errors preserve data.
- `api.py`: sources GET/POST/PUT, items GET, refresh POST. Only provider name and
  HTTP(S) URL are required. Provider URLs may be RSS/Atom from Google News,
  central banks, speeches or other publishers. Changing a URL clears HTTP cache
  validators and ignores any response still arriving from its previous URL.

All timestamps are UTC milliseconds. Missing publication times remain null;
first_seen is a clearly labelled fallback. Existing publication time survives a
later undated copy. Repeated GUIDs update their item without changing first_seen.
Items from different feeds remain separate: no fuzzy cross-publisher merging.
Feed markup is rendered as text and unsafe article URL schemes are rejected.
Provider configuration is local/trusted; no article content or credentials are
sent to an additional service. No external Python dependency was added.

The collector only discovers what a feed returns; it cannot backfill missed
headlines outside a provider's window, infer an exact market-event time from an
article timestamp, or guarantee when Google indexes a story. RSS/Atom supply
available text and links; opening links can route via Google to a publisher.

`storage/recovery.py` includes this database using SQLite's backup API. Existing
offline backup/restore commands include providers and history; browser display
preferences remain browser-local. No calendar schema change is required.

Run tests: `bridge/.venv/Scripts/python.exe -m unittest storage.news_flow.tests.test_news_flow -v`.
The standard storage suite discovers them through `storage/tests/test_news_flow.py`.
