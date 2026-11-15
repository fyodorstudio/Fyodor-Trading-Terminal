# News Flow frontend

Open with the newspaper button immediately right of Heatmap Ranking. It shares
the right-hand panel slot with Detail, Events and Ranking; Escape or × closes it.

`NewsFlowPanel.tsx` owns the panel, date/sort controls, width and history paging.
`NewsConfiguration.tsx` owns the tag popover: provider name/URL, previous/next
provider navigation, adding feeds, visibility and global keyword rules.
`model.ts` owns browser preferences, query serialization and response validation.
`useNewsFlow.ts` is the only network boundary. One-second local API reads are
sequential, aborted on scope changes/unmount, and retain the last good snapshot.
While reading down the list, changed headlines wait behind an update button.

Provider setup/history live on the Python service. Browser settings use
`fyodor.news-flow.v1`: hidden providers, comma-separated include/exclude terms,
any/all matching, date, sort and width. Terms match literal case-insensitive
substrings in titles and supplied feed summaries; excludes win. All providers
are visible initially. Hiding a provider affects display, not collection.
Dates use the application's display timezone (Jakarta by default); the API gets
the corresponding UTC range. Missing publication dates are labelled Collected.
Pages contain 100 headlines and can browse all collected history.

No full-article extraction, paid API, AI classification or Wildcard mutation is
part of this feature. Provider changes support adding and editing name/URL;
there is no deletion or automatic retention policy in this version.

Backend ownership: `storage/news_flow/`. Shell glue is limited to
`terminal-shell/{ChartWorkspaceHeader,TerminalWorkspace}.tsx` and the workspace
hook's shared right-panel state. There is no connection to broker selection.

Run feature tests from the repository root:
`pnpm --dir frontend test -- test_news_flow`.
Tests are colocated in `tests/` and registered in `frontend/tests/suites.mjs`.
