# Source coverage and verifiable discovery

Read this for every fresh assessment/alert review, before the backdrop. This is
the shared procedure; no separate alert skill is needed. An explicit prompt-only
or read-only request retains its narrower scope. Do not repeat loaded guidance.

## Immediate work and required source families

Missing material news can affect decisions involving real capital. Prioritize
discovery of the actual active driver and nearest disruption over a polished
backdrop. Include the [brief opportunity sweep](opportunity-discovery.md) for
fresh conversational assessments/reviews, subject to explicit scope overrides.
Surface a supported decision after immediate hazards and both currency mechanisms
are checked; continue the full scan and receipt in the same turn. The first
delivery may precede completed coverage. It must not claim all-clear, completed
pins or a fully ranked comparison while those checks remain unfinished.

Use a trusted invocation cutoff or an immediate clock read. Search the preceding
hour, next six hours and overnight first, with the previous 24 hours as fresh-news
context. Extend schedules at least seven days (or the requested longer holding
horizon), plus a central next policy/projection event beyond that window. Explicit broad
upcoming-alert inventories alone use all eight currencies/90 days; bare opportunity
discovery uses a session decision and seven-day schedule scan. Bound each
failed source to the original attempt and one suitable independent alternate
route, then mark the exact gap. Never let one failed publisher consume the scan.

For commodity scope add the source families and instrument routing in
[commodities](commodities.md); USD macro context cannot substitute for them.

For **each requested currency**, cover these web source families. These are
coverage obligations, not permanent event-impact rankings:

| Family | Read and search for |
| --- | --- |
| `news` | Fresh dated market reporting/headlines plus fiscal, trade, geopolitical, energy, funding and intervention developments. Search beyond the first familiar narrative; check newer contrary developments. |
| `policy` | Official central-bank schedule, latest decision/conditional path, speeches, testimony, interviews, Q&A, projections and relevant operations. |
| `statistics` | Original statistics schedules and releases across inflation, labor/wages and activity; a general calendar is a cross-check, not proof of publisher completeness. |
| `treasury-auctions` (USD) | Treasury auction announcements, auction/result times and financing/refunding stages. |
| `treasury-buybacks` (USD) | Preliminary/final buyback announcements, operation windows and results. An auction check cannot complete this separate obligation. |
| `market-operations` (USD) | Relevant Fed/New York Fed liquidity and market-operation schedules, announcements and results. Record when the opened schedule has no relevant operation. |
| `debt` (other currencies, when material) | Relevant debt-management schedules, issuance, operation windows/results and financing stages. |

For USD `treasury-buybacks`, open TreasuryDirect's
[buyback index](https://www.treasurydirect.gov/auctions/buy-backs/) and linked
current tentative schedule/preliminary/final/result documents. For `treasury-auctions`, open the
[auction schedule/results](https://www.treasurydirect.gov/auctions/announcements-data-results/).
For USD `policy`, include the [Fed calendar](https://www.federalreserve.gov/newsevents/calendar.htm).
For `market-operations`, open relevant [New York Fed operation schedules](https://www.newyorkfed.org/markets/domestic-market-operations).
The Treasury results XML's `announcementDTM` may be the final-announcement clock,
not results dissemination. Read `totalParAmountOffered`, `totalParAmountAccepted`,
cap and accepted issues separately. A TIPS auction and a TIPS buyback are distinct.
Check both auction and operation/result stages; do not equate settlement with news.

Official starting points for other scopes (follow links to current schedules,
releases and media agendas rather than assuming a homepage is complete):

| Currency | Policy | Statistics/debt starting points |
| --- | --- | --- |
| EUR | ECB calendars, national central-bank programmes | Eurostat, national agencies; AFT/other relevant sovereign debt offices during fiscal stress |
| GBP | Bank of England events/market notices | ONS, DMO |
| JPY | Bank of Japan schedule/market operations | Statistics Bureau, Cabinet Office, Ministry of Finance auctions/FX communications |
| CHF | SNB agenda/releases/operations | FSO, SECO, Federal Finance Administration |
| CAD | Bank of Canada schedule/operations | Statistics Canada, Finance Canada/BoC government debt operations |
| AUD | RBA calendar/operations | ABS, AOFM; China/trading-partner releases when material |
| NZD | RBNZ schedule/operations | Stats NZ, NZ Debt Management; China/trading-partner releases when material |

Relevant off-calendar shocks require their original publisher/authority plus fresh
dated reporting. Search both sides of the pair; one currency story cannot establish
relative direction. Add material source families rather than forcing an event
into an unrelated checklist row. Verify announcements and stage times with DST;
unknown hours remain unknown and an unverified schedule never receives a timer.

## Evidence and source failures

Search results locate evidence; open the decisive body and its qualifications.
Record actual event/publication, provider/headline and retrieval clocks separately.
For historical cutoffs, document availability by that cutoff. A later report can
locate older evidence but cannot silently add later facts to the earlier bias.
If a release arrives during research, add a separately timed update and keep the
original information set. A new retrieval timestamp is not new information.

The discovery helper captures local metadata/index pages, not fresh web news.
MT5 omissions are expected possibilities, so complete broker coverage never
substitutes for web coverage. Recheck known limitations against the publisher.
When web retrieval fails, try an alternate route such as the linked XML/text/PDF,
another official endpoint or dated reporting. Preserve evidence bytes/text and
the route used; do not label an access failure as no new news.

## Coverage receipt and completion check

Start with `pnpm analyst discovery start` using the scope, actual broker, cutoff
and an output folder inside Lite. It captures all pages of `highlights`,
`limitations`, `external` and `upcoming` without altering raw observations or pins.
It creates required web-family rows with `pending` status. Fill them from actual
search/open actions; source evidence can be saved tool text/JSON with its tool
reference, or the original downloaded publisher body. Broad journal reads are
optional. Read only focused prior context; a bounded entry-mode or explicitly requested
price-feedback check follows entry-decisions.md, and never substitutes for
source discovery or validates an unobserved causal explanation.
`--days` retains a longer requested horizon; the broker index is capped at its
90-day limit, while official web schedules must cover the full requested horizon.

Record checks immediately after each source-open batch. Save the real returned
tool text/JSON or publisher body; do not reconstruct source evidence from memory.
The helper copies evidence to a unique immutable filename and atomically updates
the receipt, retaining earlier checks and failures. For example:

```powershell
pnpm analyst discovery record --input "<receipt>/discovery.json" --source-id nzd-news --status partial --url "<opened direct URL>" --evidence "<saved tool body inside Lite>" --tool-reference "<actual source-open reference>" --note "Opened current NZ news; wider schedule checks remain"
pnpm analyst discovery record --input "<receipt>/discovery.json" --source-id nzd-policy --status partial --outcome failed --url "<attempted URL>" --tool-reference "<failed tool reference>" --note "Actual retrieval failure; alternate route still pending"
```

Use `checked` only after the family obligation is covered, including the relevant
schedule horizon. A single actual opened body can support a specific verified
event even while that wider family remains `partial`. Two distinct actual failed
retrieval routes plus their notes establish `unavailable`; a deadline is not a
retrieval failure. Repeat `record` for each route, keeping every outcome. The tool
assigns the actual recording clock; `--checked-at` may preserve an already-known
real retrieval clock. Neither clock changes the source's publication time.

For a release wait, `start --release-at <verified UTC> --deadline <UTC>` declares
the bound (default five minutes after publication). At its elapsed deadline:

```powershell
pnpm analyst discovery finish --input "<receipt>/discovery.json" --stop-reason release_deadline --note "<specific checks unfinished at the declared deadline>"
pnpm analyst discovery validate --input "<receipt>/discovery.json"
```

This retains partial checks and marks untouched web rows `deferred`. Validation
can accept an honest bounded partial record, but returns `coverage_complete: false`.
It never turns deferred checks into completed coverage or a fully ranked pair
comparison. Ordinary assessments cannot use this release-only exception to skip
required discovery. Use `finish --stop-reason complete` after all checks, or
`source_gaps` for actual failed retrievals. Finished receipts cannot be edited
through `record`; a new invocation gets a new receipt.

Reuse preparation as dated context without copying old retrievals into the new
receipt's current checks: the validator requires invocation-time check clocks.
Keep the prior receipt path and original source clocks in separate preparation
metadata. Current `sources`/`events` contain this invocation's actual checks and
supported discoveries; mark unfinished current families deferred at the release
deadline rather than inventing new retrieval clocks. Keep carried schedule
candidates in clearly labelled preparation metadata unless freshly verified.
This preserves useful reuse without claiming fresh coverage or delaying a verdict
to repeat the full scan.

`discovery.json` fields:

- `scope`, `broker`, `as_of_utc`, `started_utc`, `horizon_days`;
  `discovery_completed_utc` records the initial immediate pass. If a backdrop is
  researched, its `backdrop_started_utc` must follow that pass, not precede it.
- `sources`: each has `id`, `family`, `currency` (or `ALL` for local captures),
  `status` (`pending`, `partial`, `checked`, `unavailable`, `deferred`), real `checked_utc`, `url` for
  web sources, `evidence_path` relative to this receipt, and `note`. For opened
  web evidence include `tool_reference` or `retrieval_method`; record the actual
  opened route, not just a search query. Unavailable rows need two distinct
  `attempts` and a specific `note`; the final answer must expose that gap.
  Incremental `checks` retain each opened/failed route, clock, tool reference,
  note and copied evidence path. `partial`/`deferred` remain gaps and can finalize
  only under the elapsed release-deadline rule above.
- `events`: `key`, `title`, `currencies`, optional `instruments` (canonical commodity IDs), `stage`, `source_ids`, verified
  `event_at` OR `event_date` (neither for an untimed watch), `material`,
  `surface`, `decision_note`, `available_utc` or explicit `availability_note`,
  `used_for_prompt_verdict`. Later-available facts cannot support the prompt
  verdict. Future events are scenarios, never already-known results.
- `pin` for each material candidate: `source` (`external`/`highlight`), `reference`
  (stable key/exact ID), `status` (`saved`, `existing`, `restored`, `failed`,
  `read_only`), `note` and `saved_utc` when newly saved/restored. For broker pins
  retain the exact source/value IDs. The validator independently reads current
  active records and scope/time; it does not trust a claimed successful status.
  Dated external records need a persisted `chart_icon_request_id`; watches
  cannot acquire a fictitious marker. New material discoveries must be pinned
  before `backdrop_started_utc` unless first discovered later, with that clock
  recorded as `discovered_utc` and a clear post-prompt update.
- `read_only` defaults false; set true only for the user's explicit override.
  `coverage` is `complete` or `partial`; `gaps` lists material unavailable
  sources, pin/runtime failures and unknown clocks. An empty `events` array
  needs `no_material_events_reason`, grounded in the opened sources.
- Retain the brief sweep's actual search/open evidence and currencies checked in
  an `opportunity_sweep` note with evidence paths; a search is not an opened-source
  check. Add `opportunity_receipts` paths for promoted candidates outside this
  receipt's currency scope. Validate each separately; the existing validator
  neither follows those paths nor verifies sweep completeness. An emerging idea
  is not permission to fabricate event facts, timing or a successful pin.

Run `pnpm analyst discovery validate --input "<discovery.json>"` before finalizing.
Missing source families, pending rows, missing evidence, incomplete pagination,
hidden imminent candidates, false pin/icon claims or future evidence leakage
fail validation. A fully documented failed source/write can pass only as partial
coverage, with its gap exposed. Read-only suppresses writes, not discovery.
An early directional delivery does not relax these finalization requirements.
Coverage gaps constrain coverage claims; only a decisive evidence gap constrains
the directional judgment. A pin/runtime failure never proves the market thesis
false and must not keep a supported decision from reaching the user promptly.

The receipt is a record of checks and discovered candidates, not proof that the
world has no unobserved news. Do not claim the checker verifies semantic source
completeness or guarantees future coverage. Its purpose is to make a skipped
Treasury/source-family check and omitted known imminent stage observable.
