# Manual outside-event annotations v1

This feature records user-selected audit windows outside the numerical dataset.
It is mounted above Candy, so Candy's visibility controls it. No module here is
used by a scorer, context engine, fresh-news detector or calculation worker.

- `core/`: validated records, strict broker-wall-clock form parsing, overlap sweep
  and binary visible-interval lookup. Start is inclusive; end is exclusive; null
  end means ongoing. Empty gaps have no rectangle.
- `storage/`: immutable external-store snapshots in `fyodor.external-events.v1`,
  scoped by broker and pair, with cross-tab updates and explicit session-only
  reporting if saving fails. Workspace portability validates this key.
- `chart/`: reuses Candy's exact-time coordinate mapping and current-time limit.
  RAF coalesces pan/size updates; no notes means no chart subscriptions.
- `ui/`: create/edit/delete with optional observation/source text, broker-time
  range fields, UTC recording date, Escape dismissal and focus restoration.

`from`/`to` are broker chart-wall-clock milliseconds, matching plotted bars.
`createdAt`/`updatedAt` are actual UTC recording times. They must not be compared
directly to infer whether the record existed before a broker-time event. Notes can
be added retrospectively. A selected window never establishes impact duration or
causation, and an empty strip never establishes absence of an outside event.

Overlapping intervals show all active titles/observations on hover. Clicking opens
the first note; the saved list provides access to every note in the current scope.
The editor defaults a new range to the visible chart window, capped at current time.
There are no inferred, fetched or preloaded geopolitical events.

Terminal regression coverage: `tests/usd-context/test_external_events.mjs`.
Visual positioning, themes and interaction quality remain for the user's audit.
