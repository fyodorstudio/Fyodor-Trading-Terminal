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
- `history.py`: best-effort Google News date searches, serialized with live fetches
  per provider. Removes rolling/date operators from a copy of the configured query
  and preserves other Google parameters. Searches bounding UTC calendar days,
  then imports only dated entries inside the exact selected timezone range.
  Does not change the live URL, validators or status. Successful/empty results
  are cached for 15 minutes; failures respect exponential backoff/Retry-After.
  Refresh bypasses a successful cache, but never error backoff. Direct RSS/Atom
  providers report unsupported historical retrieval and retain local history.
- `api.py`: sources GET/POST/PUT, items GET, refresh POST, history POST. Only provider name and
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

The live collector only discovers what a feed returns. Google historical searches
can retrieve older items, with no guarantee of complete coverage. The UI labels
this limitation. Neither path infers an exact market-event time from an article
timestamp or guarantees when Google indexes a story. RSS/Atom supply available
text and links; opening links can route via Google to a publisher.

Keyword queries always match any included term and reject any excluded term,
case-insensitively in headline/summary. With no include terms, all non-excluded
items qualify. All mode is implemented by omitting keyword rules from the query;
source/date filters still apply. The old any/all match setting is no longer used.
The history_searches table is added on opening existing databases; no existing
headlines or provider settings are replaced.

`storage/recovery.py` includes this database using SQLite's backup API. Existing
offline backup/restore commands include providers and history; browser display
preferences remain browser-local. No calendar schema change is required.

Run tests: `bridge/.venv/Scripts/python.exe -m unittest storage.news_flow.tests.test_news_flow -v`.
The standard storage suite discovers them through `storage/tests/test_news_flow.py`.
