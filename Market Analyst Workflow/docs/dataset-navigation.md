# Dataset navigation

Run commands from `C:\dev\Fyodor Trading Terminal Lite`. `pnpm analyst` invokes
the existing bridge Python; it needs no new runtime dependencies or API key.
The helper resolves paths from its own file location, so an absolute Python/script
invocation also works from another directory.

## Find evidence

```powershell
pnpm analyst status
pnpm analyst reports
pnpm analyst report latest
pnpm analyst report latest --match "CPI|Interest Rate" --currency USD --limit 30
pnpm analyst report latest --section context --match "CPI" --offset 30
```

`report` accepts a filename or absolute path inside Lite. It reads the brief and
returns a release index by default, with four name previews per release. `--match`
returns full matching readings; `--rows` requests rows without a name filter.
`matches`, `offset`, and `next_offset` expose truncation. Default output is 20
items; the maximum is 500. Old full-table Markdown reports remain supported.
Readings preserve Actual, broker Forecast, Previous, revised Previous, IDs,
period, capture time, revision, timing basis and availability.

## Query stored calendar directly

```powershell
pnpm analyst calendar --broker Elev8-Demo2 --scope EURUSD --from 2026-09-09 --to 2026-09-17 --zone Asia/Jakarta
pnpm analyst calendar --broker Elev8-Demo2 --scope EURUSD --from 2026-09-11 --to 2026-09-11 --zone UTC --match CPI --currency USD
pnpm analyst calendar --broker Elev8-Demo2 --scope GBPUSD --from 2026-10-01 --to 2026-10-12 --context-days 90 --section context --match "CPI|Earnings"
pnpm analyst calendar --broker Elev8-Demo2 --scope EURUSD --from 2026-09-09 --to 2026-09-17 --export --name "September backdrop" --question "What changed the rate outlook?"
```

Dates are inclusive display days, default UTC. `Asia/Jakarta` and fixed offsets
such as `UTC+07:00` work without timezone packages. Other IANA zones require the
runtime's timezone database. Date-only schedules keep their source date.
`--database` defaults to Lite's `storage/data/calendar.sqlite3`; status reports
that same inventory, rather than assuming a service on a shared port owns it.
Calendar service and MT5 can be offline for these read-only snapshot queries.
Coverage remains explicit, including preceding context; raw gap clocks are labeled.

`--export` writes the complete currency/date/context scope even when `--match`
narrows the response. Chart and Alert filters never constrain the export.

## Measure a release reaction

Verify the release instant from the calendar and official release page first.
OHLC endpoints use positional MT5 history; the helper uses a bounded binary seek
and overlapped paging, validates broker/generation, then converts server time.

```powershell
pnpm analyst ohlc --pair EURUSD --timeframe M1 --from 2026-09-11T11:30:00Z --to 2026-09-11T15:00:00Z --event 2026-09-11T12:30:00Z
pnpm analyst ohlc --input "Market Analyst Workflow/report/EURUSD-CPI-Sep11-2026-M1-evidence.json" --event 2026-09-11T12:30:00Z
pnpm analyst ohlc --pair EURUSD --timeframe H1 --from 2026-09-09T00:00:00Z --to 2026-09-18T00:00:00Z
```

The first command saves all returned window candles as a compact `.ohlc.json`
and prints only coverage/gap information and 1/5/15/30/60/120-minute measurements.
Baseline is the complete minute's close immediately before release. A window
must contain every completed minute to receive a measurement; a still-forming
candle cannot supply a completed reaction. Pip size is 0.01 for JPY quote
pairs and 0.0001 for the other supported pairs. Outcomes are broker price evidence,
not executable trade returns or a proof of the news' causal effect.

Saved OHLC can be reused offline with its original capture time. New captures
default to 32 OHLC requests and at most 50,000 timeframe slots. A bound stops with
an explicit error, never silently truncates success. `--max-requests` can rise to
64 when necessary. Use H1 for broad history and M1 for short event windows.
The bridge can supply only history available to its connected MT5 terminal.
Use `--symbol EURUSD.a` for an actual broker suffix, and `--bridge` for a different
endpoint. The default bridge is `http://127.0.0.1:8001`.

Elev8-Demo2 uses the existing verified EET/EEST profile (2014–2031). An unfamiliar
broker requires an explicitly verified historical `--broker-offset-seconds`;
today's offset is not proof of an old offset. DST ambiguities are rejected.

## Files and sources

New research files live in `Market Analyst Workflow/report/` and are ignored by
Git. Share the `.md` brief path; its `.tsv` companion preserves complete evidence.
Existing reports are never rewritten. Analyst conclusions can be saved beside
the evidence when requested, with links and a clear research-as-of timestamp.

Use local calendar/candles for navigation and observed readings. Use web sources
for release-day vintages, survey expectations, statements, projections, policy
pricing, yields and off-calendar developments. The broker feed's provider is not
assumed to be Reuters, Bloomberg or another named survey.
