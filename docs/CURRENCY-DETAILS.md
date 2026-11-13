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

### Ledger for all 28 major pairs

Every major FX pair defaults to the [Ledger category developments](CURRENCY-LEDGER.md),
sharing its historical cutoff with the bottom dock. **Recent developments** shows
previous-to-latest values, descriptive increases/decreases and release evidence
for Rates, Inflation, Labor & wages, Growth & activity and Demand. There are no
scores, momentum advantages, category weights or currency rankings.
The **Rate decisions** tab
shows both currencies' retained policy decisions in the evaluated calendar year,
newest first, with Actual/Forecast/Previous. Historical rate readings use the same
publication/capture rules as the category details. USD remains the Fed target upper bound.
Release clicks open the exact source package in Inspector. Tier List Info returns
to the mounted view without resetting its state. Browsing does no research or writes.

The original six-month USD/CAD `policy_history` API field and table remain for
compatibility with non-Ledger consumers. They are not the all-pair Ledger's source.
No current economic observations are inserted beneath historical decisions.

### Existing comparison for indices and non-Ledger consumers

The visible table has equal-width **base currency | quote currency** columns, or
a single currency for indices. Full-width horizontal subheaders label
S — essential, A — major, B — supporting and C — secondary. Event slots retain
equal block height in both columns. Each block shows
the event name with labelled Previous reading, Latest actual and Next upcoming
forecast cells, then Released at, Next Release and Source link. The forecast
belongs to the next broker occurrence; the latest release’s consensus is never
substituted. Missing values are dashes; zero is valid. Comparable revised previous
values take priority over initial previous values. When the official observation
is newer than the broker vintage, its previous cell stays unavailable. Reading
cells stack below the name in narrow currency columns, keeping equal slot heights. No category
expanders, next-major-release list, verification clocks, coverage prose, repeated
provider labels or policy commentary appear in the comparison. A conflict is the
single U+26A0 ⚠ glyph with an accessible tooltip. Operational fetch failures remain
visible. Definitions/reference periods stay in tooltips and stored evidence.

**Tier List Info** replaces the right-panel body with a static general tier table
and the supplied currency reference table, filtered to the active pair/index.
Closing it (or Escape) returns to the mounted comparison and preserves scroll;
it performs no research or writes. Escape in the main view closes Detail.

## Shared tiers, sources and clocks

`config/event-tiers.json` owns S/A/B/C definitions, the eight currency reference
rows, exact currency/country/series mappings and original-publisher routes. Detail
and Alert consume this same classification; `config/currency-details.json` owns
the numerical measures, units and broker bindings. Unknown series stay admitted
and use secondary C with an explanatory tooltip; no broker importance is used.
The tiers are reference priorities, not forecasts or automatic regime scores.

Alert's Tier column replaces Agent impact labels. Calendar rows use exact-series
tiers even when a historical High/Medium/Low assessment exists. External rows use
a sourced S/A/B/C assessment keyed to that record, otherwise secondary C. Legacy
assessments remain immutable and accessible in stored history; they are not blindly
translated into a tier. Changing labels never selects, cancels or re-arms a bell.

Dates prefer captured broker publication/next-occurrence clocks for convenience;
if absent, retained official publication/schedule dates can supply a fallback.
Unknown hours remain dates only, never guessed instants. The panel applies no
Events-window cutoff. Reference periods, publication, capture and verification
remain independent in storage, with no assessment prose rendered in the table.

Each metric links to its original publisher, including when numbers were captured
from the broker feed. Comparable official observations still lead numeric
conflicts; raw MT5 and all evidence stay intact. Alert links Actual and Previous
to the registered original publisher. Anonymous broker consensus forecasts do
not acquire a central-bank/statistical-office link falsely implying validation;
their source limitation is available on hover. No surprise/directional scoring.

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
USD/CAD also performs two bounded indexed policy-series reads for its six-month
`policy_history` projection; other scopes return null. The history date range and
decisions participate in the revision hash, including window expiry at midnight.
Publication UTC is independent of chart placement. Clients cancel stale requests,
retain same-scope data during outages and poll only while open. CLI verify compares
the full live API projection with this checkout's scoped evidence at one read instant.
A save receipt alone does not prove delivery. Visual acceptance stays with the user.
