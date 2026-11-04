# Currency News

Owner: `frontend/src/currency-news/`, `storage/currency_news.py`,
`storage/currency_news_feed.py`, and the `news` command in
`Market Analyst Workflow/tools/market_data.py`.

Currency News is a date-filtered story feed. All and individual currency buttons
reuse the same records. A shared story appears once, with all researched currency
tags and a separate implication for each currency. Chart, Inspector, calendar
Alert, Entry Trade, reminders and price alerts remain independent.

## Presentation and dates

The columns are Currencies / Sources, News Fundamentals, and Implication.
News Fundamentals contains only a source-faithful headline or concise factual
summary, plus its publication date/time. All agent interpretation, confidence
limitations and coverage caveats belong in Implication. Direct source links sit
beside the currency tags. No background accordion, lookback selector, aging gate,
repeated save/check lines or explanatory static banner is shown.

The date revolver opens on Today in Jakarta. Known publication instants determine
the Jakarta date. A date-only story belongs to that explicit publication date,
even if researched two days later. With no publication date at all, use the
assessment date. Dates are never borrowed across the selector. Only Today offers
Copy refresh prompt and polls saved results; past/future dates are browsing only.
Today follows Jakarta midnight unless the user selected another date.

Rows sort newest first by publication instant, falling back to last assessment
instant when the hour is unknown. Date-only headlines show just their date;
metadata shows **Assessed 1 hour 4 minutes ago** rather than inventing a source
hour. Reassessing an unknown-hour story moves it up within its own publication
date. This is a discovery/assessment ordering rule, not evidence that old facts
are newly published. A single Last updated age at the top is the latest saved
update affecting the selected date, not a claim that every currency was checked.

Rows load in batches of 50 as the user scrolls; Show more news also works by
keyboard. An assessment selector in Implication appears when an individual
currency/story has multiple saved assessments. Choosing one leaves the headline,
other currencies, publication date and feed ordering alone. Latest follows new
assessments. Export includes all matching rows, including rows not rendered yet,
and the selected implication versions.

## Research and writing

Research happens in the agent chat on demand. Prioritize the newest material
news and relevant earlier context, with no default publication cutoff. An
explicit user research date range still applies. Open decisive source bodies,
verify facts/publication dates, check opposition, and consolidate syndications.
Do not force a story quota or a direction. Unknown timing, inaccessible coverage
and quiet coverage are distinct. See [research rules](RESEARCH-RULES.md).

Use a stable story_id for the same development across currencies and subsequent
assessments. Give a material follow-up its own story_id and dated row, even when
it uses the same source URL. Repeated assessments update that story's currency
view; omitting a previously saved story does not delete it from the date feed.
Do not copy an unresearched currency with a new check time.

A supported directional bias is bullish or bearish. When competing mechanisms
matter, use conditional with explicit bullish_if and bearish_if conditions,
explaining each currency's response separately. Neutral remains valid when no
supported direction or useful scenarios can be established. No bare Mixed label
is displayed. Bias is conditional fundamental pressure, not a trade instruction,
pair ranking, forecast, price scan, outcome score or reminder change.

## Agent interface

```powershell
pnpm analyst news read --scope ALL
pnpm analyst news lessons --scope CAD
pnpm analyst news save --scope CAD --input tmp/cad-news.json
pnpm analyst news read --scope CAD
pnpm analyst news verify --scope CAD
```

Read the scoped current result and relevant compact lessons; do not routinely
load raw research archives. Write a small payload under ignored tmp/. New saves
omit window_hours and put all stories in items; background is a legacy field.
Only researched currencies change. A full all-eight request must investigate all
eight or explicitly report unfinished scope. Respect chat-only/no-save requests.

```json
{
  "rows": [{
    "currency": "CAD",
    "checked_at": "2026-11-04T01:00:00Z",
    "coverage": "checked",
    "items": [{
      "story_id": "canada-policy-20261103",
      "summary": "The central bank raised its policy rate by 25 bp.",
      "published_at": null,
      "published_date": "2026-11-03",
      "sources": [{"label": "Central bank", "url": "https://example.com/statement"}],
      "bias": "conditional",
      "reason": "The rate channel and demand outlook have opposing effects.",
      "bullish_if": "the higher expected rate path persists as demand stabilizes.",
      "bearish_if": "weaker demand causes markets to reverse that rate pricing."
    }]
  }]
}
```

coverage is checked, partial or unavailable. Partial/unavailable requires a
specific coverage_note. Unavailable coverage cannot supply stories. checked_at is
the actual source-check instant and cannot be future-dated. published_at is an
offset-aware instant or null; published_date is a known Jakarta date or null.
When both are supplied they must agree. Never substitute assessment time into
published_at. Unknown timing details may be retained in timing_note for exports;
the headline column does not show this prose.

Each new item needs a stable story_id, factual summary, direct HTTP(S) sources,
bias and currency-specific reason. conditional also requires both scenarios.
The same story_id in a batch must have identical facts and publication timing;
its currency implications may differ. Row-level implication/reason and
window_hours are retained only for old payload compatibility. An empty items
list records a quiet/incomplete check without inventing a feed row.

## Persistence, compatibility and APIs

Immutable refresh bodies live under ignored storage/data/currency-news/runs/.
One atomic index publication admits a run and its story pointers together.
Repeated identical saves are idempotent; equal/older conflicting checks are
rejected. Failures preserve prior results. Never bump a clock merely to bypass
rejection. History is included in storage backups and is not Git-tracked.

Index schema 3 retains latest per-currency pointers and original history metadata,
plus story/currency assessment pointers. Old schema 1/2 indexes and original run
hashes remain readable. Original run bytes are never rewritten. Legacy story
metadata is derived once per index revision in memory, then persisted on the next
authorized save. For old unknown-hour records, a recognizable original date in
timing_note is retained. Explicit legacy qualification sentences are moved to
Implication verbatim; no economic view is invented during compatibility reads.
Old aggregate reasoning is preserved until an agent authors story-specific views.

GET /api/v1/currency-news/feed?date=YYYY-MM-DD returns schema 2, date, revision,
updated_at, stories and coverage. Each story includes its factual source fields,
assessed_at, order_at, sources and per-currency implications with compact version
pointers. The date's latest assessment bodies are loaded once per unique run;
older versions and unrelated dates are not read. after_revision returns a compact
unchanged response without loading run bodies. Uncommitted orphan files cannot
enter the feed. Readers use one atomic index snapshot across concurrent saves.

The previous latest, day, history and exact-run APIs remain available for
compatibility and audit. /currency-news/history/<run-id> reads only a selected
immutable assessment. The frontend validates feed/exact-run contracts, keeps
unchanged story identities stable, cancels timers and stale requests, and retains
the matching date's loaded results on errors. Currency filtering performs no
network work. All browsing is local GETs and never invokes research.

verify compares the running latest/day/story-feed APIs to this checkout's saved
projections. A receipt alone does not prove panel delivery. Restart this
checkout's stack under standing permission if stale, and retry. Visual acceptance
stays with the user. [The archive note](RESEARCH-ARCHIVE.md) covers retired research.
