# Calendar corrections

MT5 supplies the live calendar. Corrections and publisher-supplied releases are
applied when reading it. Broker observations retain their original values.

## Run an audit

1. In MFDI settings choose **Export selected series**. The JSON includes the
   saved selections across all eight currencies.
2. Run `pnpm storage:calendar-audit --from 2026-11-01 --through 2026-11-23 --selection <mfdi-series.json>`.
   The inclusive dates use Jakarta time. The report lists stored coverage and
   blank actuals. A series with zero rows might have no release in that window.
3. Compare candidates with published schedules and releases. Also check major
   releases outside the current MFDI selection. Supply verified occurrences with
   `--evidence <file.json>` to identify omissions and differences. Repeat
   `--evidence` for multiple files. Add `--apply` to merge the reported fixes.
4. Restart storage after editing correction files. The next calendar poll uses
   the new revision. Existing subscriptions follow a publisher entry if MT5
   later supplies the same occurrence under a native ID.

Useful publisher starting points are the [BLS release calendar](https://www.bls.gov/schedule/),
[BEA release schedule](https://www.bea.gov/news/schedule/full),
[Eurostat release calendar](https://ec.europa.eu/eurostat/news/euro-indicators/release-calendar?type=listMonth),
[ONS releases](https://www.ons.gov.uk/releasecalendar),
[Statistics Bureau of Japan](https://www.stat.go.jp/english/),
[Swiss Federal Statistical Office](https://statistik.admin.ch/en),
[Statistics Canada release schedule](https://www.statcan.gc.ca/en/developers/schedule-key_indicators-eng-json),
[ABS release calendar](https://www.abs.gov.au/release-calendar),
[Stats NZ release calendar](https://www.stats.govt.nz/release-calendar/), and
the [S&P Global PMI schedule](https://www.pmi.spglobal.com/Public/Home/PDF/UK_Rel_Dates).

## Record a correction

- Files in this directory target an exact MT5 event ID and value ID. Set only
  the fields that need changing. `null` clears a reading. Use a timezone-qualified
  `released_at` for a verified clock correction, `source_url` for the official
  actual, and `forecast_source` with `name` and `url` for an attributed forecast.
- `publisher/verified-releases.json` holds publisher evidence keyed by series,
  reference period, exact publication time, unit and multiplier. Use the
  existing catalogue series when available. The `9936…` Australia monthly CPI
  entries are Fyodor catalogue IDs for releases absent from MT5.
- For a new evidence file, use the same `schema` and `releases` structure as the
  publisher file. Every occurrence needs a dated `schedule` with a source link.
  Add `actual` or `forecast` only when verified. A forecast includes an `as_of`
  timestamp or a dated source known to predate the release. Omit an unavailable
  field. For claims, record the initially published number in the MT5 series'
  unit. Later revisions are separate fields.
- Resolve any `verify_time_or_unit` result before applying. It indicates a nearby
  MT5 row whose clock or measurement identity does not match exactly. For a
  confirmed timing discrepancy on an existing row, use the exact-ID override.
