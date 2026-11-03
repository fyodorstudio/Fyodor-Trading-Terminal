# Currency News

Owner: `frontend/src/currency-news/`, `storage/currency_news.py`, and the `news`
command in `Market Analyst Workflow/tools/market_data.py`.

The bottom dock shows all eight currencies or one selected currency, with latest
verified information, a qualitative implication, its reason, and direct sources.
The old left Fundamentals projection and Thesis forecasting/evaluation UI are
retired. Chart, Inspector, calendar Alert, reminders, Entry Trade and price alerts
remain independent.

## Refresh behavior

Research runs in the agent chat on demand. Copy refresh prompt includes the
selected currency and publication lookback (three hours by default). Changing the
lookback does not reinterpret existing results. Reload saved news only reads the
local store. Polling never invokes AI, fetches news or reads broker prices.

Only researched currencies are updated. Each retains its own source-check time
and window; there is no all-currency freshness clock. A result becomes Aging when
its own window has elapsed since its check. Aging is a request to refresh, not
proof that the implication has reversed. Unknown or older publication times stay
in separately dated background. They cannot create a fresh directional signal.

`checked` means the stated search was performed, not exhaustive worldwide
coverage. `partial` identifies a specific material gap. `unavailable` means no
usable fresh coverage and cannot supply a directional result. Empty checked
results say no qualifying news was verified within the window. They do not claim
there was no news anywhere. News sources and reasoning must support the result;
schema validation cannot certify the agent's financial interpretation.

## Agent interface

```powershell
pnpm analyst news read --scope ALL
pnpm analyst news lessons --scope CAD
pnpm analyst news save --scope CAD --input tmp/cad-news.json
pnpm analyst news read --scope CAD
pnpm analyst news verify --scope CAD
```

Read a focused result before refreshing; read compact lessons only when relevant.
Save accepts one or more researched currencies with `--scope ALL`; a single
currency scope rejects any other currency. A full requested refresh researches
all eight and reports explicit gaps rather than copying unresearched rows.
`verify` compares the running latest and Today table APIs with this checkout's saved projections.
If the wrong checkout or an older service is running, restart the local stack and
retry. Complete delivery through the frontend contract; leave visual acceptance
to the user. Respect explicit chat-only/no-save requests.

Save takes a JSON object (illustrative clocks and sources below):

```json
{
  "window_hours": 3,
  "rows": [{
    "currency": "CAD",
    "checked_at": "2026-11-04T10:00:00Z",
    "coverage": "checked",
    "coverage_note": "",
    "items": [{
      "summary": "Concise verified facts, attributed where needed.",
      "published_at": "2026-11-04T09:00:00Z",
      "timing_note": "",
      "sources": [{"label": "Original publisher", "url": "https://example.com/release"}]
    }],
    "background": [],
    "implication": "supportive",
    "reason": "Explain the currency transmission and material opposition."
  }]
}
```

Allowed implications: `supportive`, `negative`, `mixed`, `no_clear_signal`.
No fresh items requires `no_clear_signal`; an older backdrop remains available
without masquerading as a renewed directional call. An unknown publication time
uses `published_at: null` in background and a `timing_note` containing the original
known date and timing limitation. All known clocks require explicit UTC offsets.
Fresh item publication must fall inside that row's requested window and cannot
follow its check. A check cannot be future-dated. Direct HTTP(S) sources are
required for each item. Blank fields and duplicate currency rows are rejected.

There is no story quota. Prefer material original reporting and concise prose;
do not pad quiet currencies or count syndications as independent confirmation.
The generous schema bounds are payload limits, not authoring targets.

## Persistence and reads

Refresh bodies are immutable under ignored `storage/data/currency-news/runs/`;
one atomic `latest.json` maps each currency to its latest run. Save validates the
whole batch, locks the news directory, writes the immutable body, then atomically
replaces the index and verifies read-back. A repeated identical save reuses the
same content hash. Equal/older conflicting check times are rejected; one delayed
agent cannot silently replace a newer result. Focused saves preserve other rows.
Include this directory in local data backups; generated news is not Git-tracked.

`GET /api/v1/currency-news` returns schema 1, a content revision and exactly eight
`{currency, snapshot}` rows. A missing result is null, never a legacy verdict.
Each snapshot contains the saved row, window_hours, run_id and saved_at.
`after_revision` returns `{schema:1, revision, unchanged:true}` when unchanged.
The frontend validates the daily and exact-run contracts, retains unchanged row
identities, polls Today only while mounted, aborts stale replies and cancels timers. Errors preserve the
last successfully loaded result with its original times and a visible error.
Source links are HTTP(S), readable in both themes, and facts are rendered as text.

## Daily table and exports

Currency News has one date-based view, opening on Today in Jakarta each time the
panel opens. The date revolver is always visible. All shows eight prescribed rows;
a currency button filters these same rows locally. Empty past, current and future
dates retain the table with No research saved for this date in each empty row.
No other day is borrowed. Date selection never runs research or reconstructs gaps.

Each row defaults to that currency's latest refresh saved on the selected Jakarta
day, independently of the other currencies. A focused CAD refresh changes CAD
without hiding separately saved JPY/EUR results. Multiple refreshes remain
selectable inside each currency row; choosing an earlier version never changes
another row. Returning that row to Latest follows subsequent updates again.
Both views reuse the same saved records; there is no duplicate authoring or
separate All-currency ledger. Sources and check/save clocks remain original.

Today alone offers the lookback and Copy refresh prompt. Past and future dates
are browsing only. Today polls saved data while mounted; earlier dates fetch only
on navigation or Reload saved news. These local GETs never invoke AI or web
research. A local clock follows Jakarta midnight when viewing Today; an explicitly
chosen past date stays selected. New sessions always open Today. Current default
rows show aging; an explicitly chosen earlier version remains labelled.

`GET /api/v1/currency-news/day?date=YYYY-MM-DD&after_revision=<optional-revision>`
returns schema 1, date, revision and exactly eight rows. Each row contains currency,
snapshot and newest-first refreshes (`run_id`, `saved_at`) for that currency/day.
Snapshot is its newest refresh or null. At most eight distinct newest run bodies
are loaded; unchanged polls return schema/date/revision/unchanged and load none.
Only choosing an earlier version reads `/api/v1/currency-news/history/<run-id>`;
immutable bodies are cached locally with a bound. Date changes/unmount abort stale
replies. Failed reads retain only the matching date's last loaded data, with an
error. Scope filters perform no network work. Export follows visible selections.

The optional history API still lists compact metadata, 50 refreshes at a time:
`GET /api/v1/currency-news/history?date=YYYY-MM-DD&before=<optional-last-run-id>`.
It returns schema 1, date, runs (`run_id`, `saved_at`, `currencies`) and next_before.
The exact-run API returns the usual eight-row snapshot plus run_id and saved_at;
unresearched currencies in that individual run remain null. The daily table
combines independently saved currency records rather than using one global run.

The atomic index now stores schema 2 with `latest` pointers and `history`
metadata. A run becomes visible when this single index publication succeeds;
uncommitted orphan files do not enter history. Original simple indexes remain
readable. Legacy history reads inspect existing bodies without modifying files;
the next authorised save adds their metadata atomically, leaving original bodies
unchanged. Normal history pages read no unrelated run bodies. Local storage
backups retain both the index and all immutable bodies together.

Export Markdown downloads the selected date, currency scope and row versions,
including facts, qualitative implication, coverage gaps, background, source links,
original publication/check/save clocks and exact refresh IDs. It runs no research
and writes no local source ledger. History remains ignored local data; use storage
backups or these portable exports rather than committing downloaded news pages.

Old records and failure evidence are preserved as described in
[the archive note](RESEARCH-ARCHIVE.md). Current research quality rules live in
[RESEARCH-RULES.md](RESEARCH-RULES.md); original lessons are available through the
focused CLI lookup, without running the retired learning engine.
