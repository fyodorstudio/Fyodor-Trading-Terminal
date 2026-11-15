# News Flow frontend

Open with the newspaper button immediately right of Heatmap Ranking. It shares
the right panel with Detail, Events and Ranking. Rows show headline links,
provider and publication time; duplicate article URLs collapse after filtering.
Wildcard entry remains manual.

- `NewsFlowPanel.tsx`: combined reader, date/sort controls, width and paging.
- `NewsConfiguration.tsx`: large centered modal with Browse providers and
  Settings tabs. Body portal, inert background, focus trap/restoration and
  keyboard shortcut containment. Tabs support Left/Right/Home/End.
- `ProviderBrowser.tsx`: one provider's recent or dated headlines, ignoring
  combined-feed visibility and keyword filters. Its date remains independent
  of the right panel and survives tab switches while the modal is open.
- `Headlines.tsx`: simple links/timestamps and truthful historical lookup status.
- `model.ts`: preferences, query serialization and response validation.
- `settings.ts`: shared browser settings subscription; Heatmap date entry point.
- `date-range.ts`: display-date and historical broker-session UTC boundaries.
- `useNewsFlow.ts`: sources/items/history requests. One-second local API reads
  are sequential, cancelled on scope changes/unmount, and retain good snapshots.
  Changes wait behind an update button when reading down the combined list.
- `NewsSoundAlerts.tsx`: workspace-level optional alert listener, independent
  of panel visibility, selected historical date, and All/Filtered mode.
- `sound.ts`: three built-in Web Audio tones, unlocked through a user gesture.

Settings use `fyodor.news-flow.v1`: hidden providers, comma-separated
Include/Exclude, All/Filtered, date/session bounds, sort, width and sound.
Rules match literal case-insensitive substrings in headline text only. Any
Include matches; any Exclude wins; empty Include allows non-excluded stories.
All bypasses keywords without clearing them. Hidden providers keep collecting.

Sound is off by default. Settings offers on/off, Chime/Bell/Pulse and Preview.
Alerts need nonempty Include terms and reject Exclude/hidden providers. Each
matching batch rings once. Initial snapshots, initial provider loads, updates,
historical imports and duplicate links stay silent. The listener starts from a
server cursor and ignores stories published before it was enabled. Backend also
rejects undated, more-than-15-minute-old, or over-one-minute-future publications.
This freshness guard avoids old backfills ringing as breaking news. Audio works
while this terminal page remains open, even with the panel closed; another app's
backend alarm worker is not involved. Browser suspension can delay delivery.

Calendar dates use the display timezone. The Heatmap's daily **News for this date**
button opens the panel for that broker session, preserving source/keyword rules.
Saved explicit UTC session bounds survive closing/reopening the panel; manual
calendar edits clear them and return to display-zone dates. Unknown historical
broker clocks disable the shortcut. Weekly/event-window shortcuts are disabled.

Dates trigger on-demand historical searches plus local cache reads. Known
starter RSS providers use scoped Google News searches; Treasury uses its official
yearly announcement index. Custom RSS feeds without an adapter report historical
lookup unavailable, retaining cached headlines. Historical coverage may be
incomplete; an empty result is not proof no news was published. Search outcomes
cache for 15 minutes; Refresh/Retry can bypass successful caches, not retry delays.
No article versions, causal analysis, full-text extraction or paid service is used.
The existing SQLite cache persists across restarts, without automatic expiry.

Backend ownership: `storage/news_flow/`. Small shell/Heatmap connections only.
Run: `pnpm --dir frontend test -- test_news_flow test_heatmap_wildcards test_terminal_responsiveness`.
