# MFDI Fed forecast evidence

Owner: `frontend/src/market-data/indicators/macro/` and
`storage/fed_forecasts.py`. The first version covers USDX Fed decisions only.
All five MFDI lines, Inspector selection, upcoming schedule lines and independent
axis bounds keep their existing behavior.

The plot uses a verified official Federal Reserve **target upper bound** where
saved, matched by exact publication UTC to the captured MT5 decision. The raw
value and value ID remain unchanged in calendar storage and Inspector. A conflict
shows both values in the hover tooltip. Other metrics remain stored MT5 actuals.

Only actual Fed release dots reveal expectations. A primitive draws a short
vertical dashed connector from actual to Investing.com consensus and an endpoint
cap. Nothing adds a valued forecast series, timeline position or autoscale input.
An offscreen endpoint is clipped; the numeric tooltip remains available. Equal
values have a zero-length connector. A primary-consensus Beat outlines the filled
actual dot; Miss and In line remain explicit tooltip labels. Positive surprise
means higher/hawkish rate, negative means lower/dovish rate, not a return forecast.
The comparison is rounded to 0.01 bp to suppress floating-point noise.

The tooltip separately compares **Investing.com consensus** and **Trading
Economics survey Consensus**, never Trading Economics' `TEForecast` model field.
**CME FedWatch** retains the full market-implied target-range probability
distribution. The UI displays the most likely range (including ties) and the
probability of the official actual range when present. It never synthesizes a
point forecast or calls the probability distribution an economist survey.

## Saved evidence and coverage

The UI reads `/api/v1/fed-forecasts` through the storage proxy while MFDI is active
on USDX, once on enable and every minute. Hover performs no fetch. Identical
responses retain their object identities; hiding/unmounting cancels polling and
stale replies. A temporary read failure retains last loaded evidence with an
explicit error label. Empty and missing meeting/provider coverage is Unavailable.

The initial local cache contains the October 28, 2026 decision: official target
3.75–4.00%, Investing.com consensus 4.00%, Trading Economics survey consensus
4.00%. These were verified by reading the source bodies on November 7, 2026 and
saved as **historical backfill**. The pages do not establish an original survey
snapshot clock, so `as_of` is null. There is no claimed pre-decision capture.
CME's public embedded tool did not yield a verifiable historical snapshot;
FedWatch is Unavailable for that meeting. Other decisions start without external
coverage. This is a small manually verified cache, not automatic web ingestion.
The initial cache and research payload are ignored local data, not Git fixtures.

Sources: [Federal Reserve statement](https://www.federalreserve.gov/newsevents/pressreleases/monetary20261028a.htm),
[Investing.com event table](https://www.investing.com/economic-calendar/interest-rate-decision-168),
[Trading Economics event table](https://tradingeconomics.com/united-states/interest-rate),
[CME FedWatch guide](https://www.cmegroup.com/tools-information/quikstrike/cme-fedwatch-tool-user-guide.html).

## Capture and import

Read the actual event-specific source row, verify the meeting instant against
the official Fed statement and preserve the raw source evidence in ignored
`tmp/`. Obtain the original pre-decision as-of from a provider export or dated
snapshot for CME; do not reconstruct it from prices after the decision.
Authenticated feeds/exports can supply future captures without changing the UI.

```powershell
pnpm storage:fed-forecasts read
pnpm storage:fed-forecasts save --input tmp/fed-forecasts.json
```

The save command uses the configured `FYODOR_STORAGE_DATA_DIR` (default
`storage/data/`) and works alongside the service under the cache's writer lock.
It merges complete meeting records by exact UTC, preserving other meetings.
Supply a complete replacement for an existing meeting to correct its evidence.
Immutable content-addressed requests stay in `fed-forecasts/history/` and an
atomic `latest.json` projects the current meetings. Storage backup/restore includes
the projection and history. Invalid imports do not publish a new projection.
This cache never edits calendar records, broker data, alarms or reminders.

Input is `{ "meetings": [...] }`. Each meeting has:

| Field | Meaning |
| --- | --- |
| `released_at` | Offset-aware official publication instant; already released |
| `actual` | Optional official `{lower, upper, ...evidence}` in percentage units |
| `consensus` | Zero to two `{provider, value, ...evidence}` rows; provider is `investing` or `trading_economics`, value is target upper bound in percent |
| `fedwatch` | Optional `{outcomes: [{lower, upper, probability}], ...evidence}`; percent probabilities sum to 100 within rounding tolerance |

Every evidence object requires `url`, `captured_at`, `timing` and a `note`
identifying the source field, meeting and basis. `as_of` is nullable only when
the original snapshot time is unknown. URLs must belong to the named publisher;
all numeric values must be finite. Official ranges cannot be inverted; CME
outcomes must be nonoverlapping and include the complete distribution.

`timing: "pre_release"` requires both a real capture and original as-of strictly
before the decision. `timing: "historical_backfill"` requires capture after
publication and never substitutes the retrieval clock for a pre-release as-of.
An official actual always uses historical_backfill timing, even when captured
immediately after release. FedWatch always requires an original as-of strictly
before the decision, including later-retrieved historical exports. Future capture
clocks, naive timestamps, duplicate meetings/providers and post-decision expectation
as-of times are rejected. Prior content-addressed evidence remains immutable.

Terminal contract tests cover provenance, corrections/backup, malformed caches,
source separation, official/raw conflicts, hover hit testing, surprise labels,
outline/connector primitives, clipped forecasts and preserved chart ranges/data.
Visual acceptance remains a manual user check in both themes.
