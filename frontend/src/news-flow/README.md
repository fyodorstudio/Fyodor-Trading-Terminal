# News Flow frontend

Open with the newspaper button beside Heatmap Ranking. The right panel and
near-full-window **News Flow Extended View** share simple headline rows, colours,
Priority stars and Add Wildcard actions. Provider/date scopes remain explicit.
The expanded backend pack seeds 52 active subscriptions; new feeds join this existing
combined stream, selector and provider tabs without separate frontend adapters.
See [the source catalogue](../../../storage/news_flow/SOURCES.md) for coverage.

## Ownership

- `NewsFlowPanel.tsx`: combined reader, classification tabs, dates, debounced
  server-side headline search, paging/resize. Search intersects provider/date/tab
  filters across the matching cache before pagination.
- `NewsProviderSelector.tsx`: header checkbox selector shares hidden-provider
  preferences with Settings and alerts; All/None and keyboard dismissal. Full
  padded label rows activate checkboxes; transient null focus from native label
  activation does not unmount the menu before the checkbox changes. Collapsed
  publisher families have mixed-state bulk checkboxes and expandable member rows.
- `provider-groups.ts`: groups feeds by actual publisher domains, including Google
  site scopes. Unknown/mixed Google searches stay separate; delivery via Google
  alone never establishes a publisher family.
- `NewsCopy.tsx`: rolling hours/days selector in the panel footer and extended
  reader. Preserves provider/classification/search/organizer/currency scopes,
  ignores calendar/paging/sort, and requests newest-first snapshot export. Only
  title/link blocks reach the clipboard. Empty/errors preserve the clipboard;
  denied access leaves a selectable textarea. Closing/unmount/scope changes abort
  requests; a selectable fallback is included in modal keyboard containment.
- `NewsDateFilter.tsx`: calendar icon with a full-area native date input. Opens
  the picker directly, without an intermediate collapsible form or Recent button.
  The active-date chip clears the filter while preserving broker-session rules.
- `NewsConfiguration.tsx`: Browse providers / Settings modal, named
  provider tabs and provider polling controls. Settings separates Global from
  Providers; global settings have no provider navigation. Portal, inert
  background and keyboard focus containment; suspends while a Wildcard draft
  is open, retaining date/tab/scroll state when returning.
- `NewsGlobalSettings.tsx`: shared keywords/colours and sound trigger
  Off / Included headlines / All new headlines, sound selection and Preview.
- `ProviderBrowser.tsx`: per-provider browsing with independent date, classification,
  paging and on-demand history. Browsing can inspect hidden providers.
- `NewsSort.tsx`: shared four-choice publication/collection ordering on PC and phone.
- `NewsFetchDiagnostics.tsx`: lazy provider check summaries and collector run/heartbeat evidence.
- `Headlines.tsx`: coloured rows, classification reasons, candidate labels,
  persistent Priority star requests and prefilled manual Wildcard drafts.
- `NewsTabs.tsx`, `KeywordTags.tsx`: keyboard-accessible tabs and removable tags.
- `keywords.ts`: shared JSON preset/aliases and browser migration; contextual
  authority stays in storage/news_flow/relevance.py, not a duplicate client engine.
- `model.ts`, `settings.ts`, `date-range.ts`: preferences/shared subscription,
  API queries/validation and display/broker-session date boundaries.
- `useNewsFlow.ts`: network boundary (except the independent sound listener).
- `NewsSoundAlerts.tsx`, `sound.ts`, `alert-status.ts`: workspace built-in tones,
  collection cursor, visible audio readiness/pending state and phone rule sync.
- `NewsAlarm.tsx`: header bell, reusable desktop controls, last alert evidence,
  persisted phone triggers and private local ntfy setup/test.
- `mobile/`: separate read-only mobile entry, provider/search/date/classification
  filters and scoped copy. Built by vite.news.config.ts to ignored dist-news;
  served by the authenticated phone gateway, not by exposing the trading app.

## Classification and tags

All shows every fetched headline within the provider/date scope. Trading relevance
is enabled by default: backend relevance.py/relevance.json classify the eight FX
currencies, Brent, gold/silver and index transmission. Include tags have strong and
context-required aliases; verified official policy/economic sources can qualify
without a literal hit. Explicit Exclude wins. Excluded is the complement. Raw literal
mode remains available by unchecking Trading relevance. Response relevance metadata
controls desktop/mobile colours/reasons, SQL filters, copy and alert scope.
See [the relevance contract](../../../storage/news_flow/RELEVANCE.md).

Keywords are case-insensitive literal words/phrases with word boundaries; AI
never matches said/retail, nor Fed Federer. NFKC/whitespace normalization and
compact/slashed currency-pair normalization let EURUSD match USD/EUR tags.
Frontend and backend apply corresponding rules. Each list supports 500 tags and
16000 characters, with visible validation instead of silently dropping terms.
Enter/comma adds a tag, multi-term paste imports tags, X removes one.
Typing filters/highlights existing tags and marks exact duplicates. Moving focus
outside the keyword editor commits a pending valid tag. Japan also matches
Japanese, and Democrat matches Democrats/Democratic, on frontend and backend
(including exclusions and sound). Other tags retain literal word boundaries.

The market preset covers currencies, policy, data, bonds/liquidity, energy,
geopolitics, major equities/AI, metals and positioning. Profile revision 3 replaces the old seed and preserves custom Include terms;
existing Exclude terms remain. Original settings have a one-time local backup.
Preset version prevents removed tags returning. Settings can add the preset
again. Old Filtered mode migrates to Included. Settings remain browser-local.

## Priority, dates and sound

The reading tabs are All / Priority / Included / Excluded. Priority and Included
are disjoint: `importance.py` combines relevance with conservative headline-only
attention rules and manual stars. A bank mention or forecast alone is insufficient.
Each candidate has a reason; no importance, volatility or direction guarantee.
Explicit Exclude wins even over a manual star. Included delivery covers both
relevant tiers, independently of the displayed tab. There is no separate Priority
page, institution/expectations subtabs, currency filtering or stance UI.

Sorting is Newest/Oldest collected/published, defaulting to Newest collected for
old settings without a sortBy. First collection is immutable across repeat checks;
URL deduplication uses the earliest row within the selected provider scope.
Calendar bounds, rolling copy windows and Wildcard drafts still use the stable
publication timeline with missing/future-time fallback. Ordering never changes
those windows. The chosen collection timestamp is emphasized on each row.
Star and Add Wildcard are icon-only actions at the top right of each row, with
tooltips and accessible names. Relative ages update every 15 seconds even when
responses are identical. Missing/future publication timestamps use first_seen
for a labelled First collected age, never the provider polling timestamp. The
tooltip retains exact collection time and any future feed-supplied publication
time. `newsTimestamp` agrees with the server's timeline_at: publication unless
missing or at least 60 seconds beyond first_seen, otherwise first_seen. The
fallback never switches when the scheduled date passes. Display, publication sorting,
calendar scopes and Wildcard drafts agree; raw publication metadata is retained.
Valid publication/collection gaps of at least a minute show both ages (or absolute
dates in dated views). The Collected tooltip keeps exact first_seen and, for newly
discovered live items, the previous successful source check. Old rows/backfills
have unknown prior-check evidence. The sort selector controls chronology explicitly.
Provider settings lazily query /diagnostics: bounded minute summaries and collector
starts/heartbeats distinguish healthy checks, HTTP 304, 429, errors and run gaps.
No response bodies are stored and historical feed availability is not inferred.

Calendar dates use the display zone. Heatmap's daily News for this date preserves
broker-session UTC bounds, including DST, until a manual date edit. Historical
lookup uses scoped Google searches for known RSS providers and Treasury's own
index; custom unsupported feeds explicitly show cached-only coverage. Results
may be incomplete. Cache persists across restarts; no article-version archive.

Provider fetch cadence defaults to 1 second and can be manually overridden
(1–3600 seconds; 60–300 means 1–5 minutes). Browser cache reads remain sequential
1-second requests. Publisher cooldowns survive restarts, Refresh and interval
edits. Hiding a provider affects combined reading/alerts, not collection.

Global sound defaults off and offers Included headlines / All new headlines,
Chime/Bell/Pulse and Preview. Old enabled preferences migrate to keyword mode.
All ignores keyword rules and works with empty Include. Both honor provider
visibility regardless of tab/date. Initial snapshots, provider priming, headline edits,
history imports and duplicate links stay silent. Recent live arrivals ring once
per batch, including while the panel is closed. Collection received_at, not
publication age, determines live delivery. Rules are applied at response time
without resetting the cursor on edits. Audio readiness is visible; blocked
batches can produce one tone within one minute after a gesture, with no old
sound replay. The bell shows last-alert links and both timestamps.

Backend Android delivery has independent Off / Included / All controls. Desktop
workspace syncs keyword/visibility changes even with sound off; backend delivery
continues after browser closure. Phone provider filters remain device-local;
keyword edits synchronize from desktop. Phone setup uses self-hosted ntfy,
with generated private credentials revealed only on request. Its mobile reader
is read-only and supports collected-date queries; it does not fetch history.
See [phone setup](../../../storage/news_flow/PHONE.md).

## Wildcards

Add Wildcard opens the existing editor with title, URL, available feed text and
timeline time. Missing/scheduled publication time uses first_seen, explicitly
labelled Collected at; original scheduled metadata remains in the details.
No invented Google indexing time. Save is manual; placement is
automatic. Existing Wildcard chart mapping uses a containing candle or a nearby
real candle across market gaps (earlier wins ties), retaining original UTC time.
Very long holes/distant missing history do not snap to an unrelated chart edge.
Chart tooltips retain original time and identify nearest-candle display.

Run: `pnpm --dir frontend test -- test_news_flow test_news_controls test_news_phone test_news_relevance test_wildcards test_heatmap_wildcards test_terminal_responsiveness`.
Backend: `storage/news_flow/`. Shared Wildcard editor/marker changes stay in
`frontend/src/wildcards/`; shell/Heatmap connections remain small.

Settings use rectangular keyword tags and bordered sections. Last-alert content
has a bounded scroll area. Menu buttons highlight when expanded; filtering and
enabled-sound states use small indicators rather than persistent selected colour.
Keyboard focus uses focus-visible. Visual verification remains a manual user check.
