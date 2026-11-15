# News Flow frontend

Open with the newspaper button immediately right of Heatmap Ranking. It shares
the right-hand panel slot with Detail, Events and Ranking; Escape or × closes it.

`NewsFlowPanel.tsx` owns the panel, date/sort controls, width and history paging.
`NewsConfiguration.tsx` owns the tag button's centered modal: provider name/URL,
previous/next navigation, adding feeds, visibility and global keyword rules.
It portals to the document body, makes the background inert, contains keyboard
focus/shortcuts and restores focus/background state on close.
`model.ts` owns browser preferences, query serialization and response validation.
`useNewsFlow.ts` is the only network boundary. One-second local API reads are
sequential, aborted on scope changes/unmount, and retain the last good snapshot.
While reading down the list, changed headlines wait behind an update button.

Provider setup/history live on the Python service. Browser settings use
`fyodor.news-flow.v1`: hidden providers, comma-separated include/exclude terms,
All/Filtered mode, date, sort and width. The toggle immediately left of the date
button bypasses keyword rules in All mode and applies them in Filtered mode,
without clearing saved rules. Any included term matches; any excluded term wins.
An empty inclusion allows everything except exclusions (e.g. exclude India).
Terms match literal case-insensitive substrings in titles and supplied summaries.
Old settings with non-empty rules migrate to Filtered. All providers are visible
initially. Hiding a provider affects display, not collection.
Dates use the application's display timezone (Jakarta by default); the API gets
the corresponding UTC range. Missing publication dates are labelled Collected.
Pages contain 100 headlines and can browse all collected history.
Selecting a date shows local history and POSTs a historical search for the visible
providers. Google News search feeds support best-effort date retrieval; direct RSS
feeds report saved-history-only. Results are saved on the backend and appear on
the next one-second page poll. Search responses are cancelled on date/provider
changes; live success timestamps, keyword changes, sorting and paging do not
repeat the historical search. Refresh also retries the selected date.

No full-article extraction, paid API, AI classification or Wildcard mutation is
part of this feature. Provider changes support adding and editing name/URL;
there is no deletion or automatic retention policy in this version.

Backend ownership: `storage/news_flow/`. Shell glue is limited to
`terminal-shell/{ChartWorkspaceHeader,TerminalWorkspace}.tsx` and the workspace
hook's shared right-panel state. There is no connection to broker selection.

Run feature tests from the repository root:
`pnpm --dir frontend test -- test_news_flow`.
Tests are colocated in `tests/` and registered in `frontend/tests/suites.mjs`.
