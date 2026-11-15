# News Flow frontend

Open with the newspaper button beside Heatmap Ranking. The right panel and
near-full-window **News Flow Extended View** share simple headline rows, colours,
Priority stars and Add Wildcard actions. Provider/date scopes remain explicit.

## Ownership

- `NewsFlowPanel.tsx`: combined reader, classification tabs, dates, paging/resize.
- `NewsConfiguration.tsx`: Browse providers / Priority / Settings modal, named
  provider tabs, provider polling controls, colours, keywords and sound settings.
  Portal, inert background and keyboard focus containment; suspends while a
  Wildcard draft is open, retaining date/tab/scroll state when returning.
- `ProviderBrowser.tsx`: provider or Priority page with independent date, paging
  and on-demand history. Provider browsing can inspect hidden providers; Priority
  combines visible providers independently of Include/Exclude classification.
- `Headlines.tsx`: coloured rows, classification reasons, candidate labels,
  persistent Priority star requests and prefilled manual Wildcard drafts.
- `NewsTabs.tsx`, `KeywordTags.tsx`: keyboard-accessible tabs and removable tags.
- `keywords.ts`: editable cross-asset market preset, normalization/matching.
- `model.ts`, `settings.ts`, `date-range.ts`: preferences/shared subscription,
  API queries/validation and display/broker-session date boundaries.
- `useNewsFlow.ts`: network boundary (except the independent sound listener).
- `NewsSoundAlerts.tsx`, `sound.ts`: optional workspace-level built-in tones.

## Classification and tags

All shows every fetched headline within the provider/date scope. Included needs
any Include match and no Exclude match. Excluded is the complement, including
unmatched headlines. An empty Include makes Included empty and Excluded contain
everything. All retains colours (red/grey defaults, configurable), with text
reasons distinguishing an explicit Exclude from No include match.

Keywords are case-insensitive literal words/phrases with word boundaries; AI
never matches said/retail, nor Fed Federer. NFKC/whitespace normalization and
compact/slashed currency-pair normalization let EURUSD match USD/EUR tags.
Frontend and backend apply corresponding rules. Each list supports 500 tags and
16000 characters, with visible validation instead of silently dropping terms.
Enter/comma adds a tag, multi-term paste imports tags, X removes one.

The market preset covers currencies, policy, data, bonds/liquidity, energy,
geopolitics, major equities/AI, metals and positioning. A one-time browser
migration merges it with existing Include terms; existing Exclude terms remain.
Preset version prevents removed tags returning. Settings can add the preset
again. Old Filtered mode migrates to Included. Settings remain browser-local.

## Priority, dates and sound

Priority lists manually starred links first, then expectations candidates in
publication order. Candidate detection uses only headline/feed text and is not
confirmation that information was available before an event. Dates and source
links remain visible. A targeted free Reuters expectations search supplements
the broad feed. No article-body extraction, generated probabilities, causal
analysis or instrument-return badges are implemented. Pins live in SQLite.

Calendar dates use the display zone. Heatmap's daily News for this date preserves
broker-session UTC bounds, including DST, until a manual date edit. Historical
lookup uses scoped Google searches for known RSS providers and Treasury's own
index; custom unsupported feeds explicitly show cached-only coverage. Results
may be incomplete. Cache persists across restarts; no article-version archive.

Provider fetch cadence defaults to 1 second and can be manually overridden
(1–3600 seconds; 60–300 means 1–5 minutes). Browser cache reads remain sequential
1-second requests. Publisher cooldowns survive restarts, Refresh and interval
edits. Hiding a provider affects combined reading/alerts, not collection.

Sound defaults off, offers Chime/Bell/Pulse and Preview, and uses the same word
rules as Included regardless of the selected tab/date. Initial snapshots,
provider priming, edits, history imports and duplicate links stay silent. Fresh
matching arrivals ring once per batch while this terminal is open, including
with the panel closed. Undated/stale publications stay silent. Browser audio
requires a user gesture; suspension can delay delivery.

## Wildcards

Add Wildcard opens the existing editor with title, URL, available feed text and
publication time. Missing publication time uses first_seen, explicitly labelled
Collected at, never invented Google indexing time. Save is manual; placement is
automatic. Existing Wildcard chart mapping uses a containing candle or a nearby
real candle across market gaps (earlier wins ties), retaining original UTC time.
Very long holes/distant missing history do not snap to an unrelated chart edge.
Chart tooltips retain original time and identify nearest-candle display.

Run: `pnpm --dir frontend test -- test_news_flow test_wildcards test_heatmap_wildcards test_terminal_responsiveness`.
Backend: `storage/news_flow/`. Shared Wildcard editor/marker changes stay in
`frontend/src/wildcards/`; shell/Heatmap connections remain small.
