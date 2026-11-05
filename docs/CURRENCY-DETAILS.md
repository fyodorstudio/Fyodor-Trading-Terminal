# Currency Detail

Owner: `frontend/src/currency-details/`, `storage/currency_details.py`,
`storage/detail_projection.py`, `storage/detail_registry.py`,
`config/currency-details.json`, and the analyst `details` command.

## Panel and scope

**Detail**, immediately right of Show events, opens a separate right-panel view.
Events and Detail are mutually exclusive; research drafts stay mounted and resume
on close. Chart changes update scope. FX pairs have two currency columns;
EURX/JPYX/USDX have one. Aliases share `config/chart-currency-scopes.json` with
the calendar, outside the 28-pair catalog. Browsing is local, with no AI/web work.

Fixed rows: Policy, Inflation, Labour, Activity, Growth, Consumer. Expand categories
for additional metrics and metrics for definitions, units, sources, MT5
Actual/Forecast/Previous/revised Previous, check dates and limitations. Latest
observations have no Events-window cutoff. Reference period, publication and
verification clocks are independent. Date-only readings never acquire an hour.

Next major releases shows up to three distinct currency/category/publication
packages, using saved official schedules or labeled unverified MT5 schedules.
Metrics retain their own last/next releases and flash/final/revised/decision stages.
Links open official sources or the exact MT5 occurrence in Alert. An elapsed
schedule requests verification, never becomes an invented actual. Optional focus
is dated sourced interpretation with limitations, not an automatic regime detector.

## Registry and conflicts

The registry defines eight currencies, stable metric IDs, S/A/B attention tiers,
native units, frequencies, exact broker IDs and publisher routes. Tiers guide
research; they are not measured volatility, Agent impact or reminder instructions.
Routes aid discovery; they do not verify a current value.

Official observations lead when their reference period is at least as recent as
MT5. A newer MT5 period stays **not independently checked**, with older official
evidence accessible. Only an explicit same-series/period/publication-stage broker
reference can produce matched/conflict status. Other vintages stay not compared.
**Source conflict** retains both readings prominently, without surprise calculations
or directional coloring. Forecast consensus is separately attributed. Raw MT5,
Inspector, alarms and news history are never rewritten by Detail saves.

Use complete monthly Australian CPI and household spending; do not substitute
quarterly CPI or discontinued retail trade. Keep monthly and legacy quarterly
underlying inflation distinct. US GDP is annualized QoQ, euro-area GDP is QoQ;
JPY core excludes fresh food but includes energy. Preserve exact definitions.

## Daily workflow

```powershell
pnpm analyst details prepare --scope EURUSD
pnpm analyst details read --scope EURX
pnpm analyst details save --scope EUR --input tmp/eur-details.json
pnpm analyst details verify --scope EUR
```

Broker defaults to Pepperstone-Demo; database defaults to this checkout's calendar.
Scope accepts ALL, currencies, pairs and supported chart aliases/suffixes. Focused
saves reject other currencies. Prepare returns scoped current News, latest metrics,
publisher routes and deterministic check hints, without web calls or raw archives.
Hints identify missing official observations/schedules, new broker periods,
incomplete checks, conflicts, elapsed publications and daily publisher rechecks.
Preparation lists full definitions/routes only for metrics needing work; unchanged
metrics use compact identity/verification summaries and retain their original clocks.
Unchanged MT5 never proves no official publication/revision occurred. Group source
checks by publisher and reuse decisive evidence for News and Detail; preserve
unchanged observation clocks. Initial coverage costs more than quiet repeat runs.

[Assess Trade Now](../.agents/skills/assess-trade-now/SKILL.md) refreshes both panels
and retains the independent [global risk workflow](GLOBAL-RISK-WORKFLOW.md).
Historical browsing does not refresh live Detail. Chat-only/no-save suppresses
writes. Report partial coverage instead of manufacturing fresh-looking values.

## Save contract

`DetailRefresh` accepts checks and optional focus. Each check contains metric_id,
checked_at, coverage (checked/partial/unavailable), direct publisher sources,
optional observation, optional next_releases and a coverage_note for incomplete
coverage. Omitted observations retain the previous value and verification clock.
Null/omitted next_releases retains its previous schedule/check clock; [] means
schedule checked but no next release confirmed.

Example structure (not a current-data payload):

```json
{
  "checks": [{
    "metric_id": "eur.hicp-yoy",
    "checked_at": "2026-11-05T01:00:00Z",
    "coverage": "checked",
    "sources": [{"label": "Eurostat", "url": "https://ec.europa.eu/eurostat/web/products-euro-indicators/w/2-04112026-ap"}],
    "observation": {
      "period": "2026-10-01", "stage": "flash", "value": 4.0,
      "released_at": "2026-11-04T10:00:00Z", "released_date": "2026-11-04",
      "verified_at": "2026-11-05T01:00:00Z",
      "sources": [{"label": "Eurostat", "url": "https://ec.europa.eu/eurostat/web/products-euro-indicators/w/2-04112026-ap"}],
      "broker_reference": {"source_id": "Pepperstone-Demo", "value_id": "322110", "basis_note": "Same October flash HICP annual rate and stage."}
    },
    "next_releases": [{
      "stage": "final", "period": "2026-10-01", "date": "2026-11-18", "at": null,
      "sources": [{"label": "Eurostat", "url": "https://ec.europa.eu/eurostat/web/products-euro-indicators/w/2-04112026-ap"}]
    }]
  }]
}
```

Normalize reference periods to month/quarter start; policy uses decision date.
Use lower + value for the Fed range, with value as upper bound. verified_at is the
actual numerical/definition check, not unrelated news work. Dates are publication
dates; exact instants must agree in Jakarta. Each next stage requires a sourced
date, never an extrapolated monthly hour. Optional broker references are validated
against saved series, period and publication date; the agent verifies stage
equivalence. Official host validation requires a registered publisher source.

Focus entries contain currency, label, reason, limitations, assessed_at and sources.
They explain policy risks deserving attention, not a trade or measured market
repricing. Disclose when market evidence is unavailable. Focus remains dated until
explicitly researched again; never infer a regime from a single indicator.

## Persistence and delivery

Ignored `storage/data/currency-details/` keeps immutable hashed runs and an atomic
latest index with independent observation/schedule pointers. Equal/older conflicting
checks, future clocks, invalid sources and out-of-scope saves fail before index
publication. Identical retries are idempotent. Backup/restore includes all Detail
history. Routine reads load only scoped current pointers, not previous histories.

GET `/api/v1/currency-details?source_id=Pepperstone-Demo&scope=EURUSD` returns the
projection; after_revision supports unchanged replies. POST accepts DetailRefresh.
Two indexed seeks per mapped metric retrieve latest/next without raw history scans.
Publication UTC is independent of chart placement. Clients cancel stale requests,
retain same-scope data during outages and poll only while open. CLI verify compares
the full live API projection with this checkout's scoped evidence at one read instant.
A save receipt alone does not prove delivery. Visual acceptance stays with the user.
