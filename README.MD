# Fyodor Trading Terminal

A local Windows/MT5 trading workspace with live charts, Market Watch, Inspector,
Scatter Plot, Alert, a manual trade Notebook and Activity telemetry.

## Getting started

Follow [docs/SETUP.md](docs/SETUP.md) for the complete fresh-clone procedure:
pinned dependencies, broker-clock support, calendar seed, Publisher V2, launch
and manual configuration. `pnpm run setup` installs dependencies; `pnpm run dev:all`
starts UI (5173), bridge (8001) and storage (8002).

A clone does not contain personal calendar inventory or browser preferences.
Use [docs/BACKUP-RESTORE.md](docs/BACKUP-RESTORE.md) to preserve both. Settings
includes versioned workspace export/import; `pnpm storage:backup` and
`pnpm storage:restore` handle calendar data separately.

See [docs/MAINTENANCE.md](docs/MAINTENANCE.md) for dependency/CI procedures,
compatibility and expansion. Broker profiles are explicit: Elev8-Demo2 is
currently verified through 2031; other brokers require verified timing rules.

## Repository map

| Path | Responsibility |
| --- | --- |
| `package.json` | Root shortcuts; no separate Node dependencies |
| `scripts/setup.ps1`, `bridge/requirements.lock.txt` | Pinned Python setup and local bridge installation |
| `frontend/package.json`, `frontend/pnpm-lock.yaml` | Frontend commands and the single Node lockfile |
| `frontend/src/terminal-shell/` | Compose feature modules and navigation |
| `frontend/src/inspector/` | Catalog, filters, episodes, grading, stored data and shared magnitude logic |
| `frontend/src/scatter-plot/` | Shared plot/settings with scoped pair/family adapters |
| `frontend/src/alert/` | Upcoming filtered episodes and local countdowns |
| `frontend/src/workspace-portability/` | Versioned browser workspace validation/export/import |
| `frontend/src/market-data/` | Broker feed, candles, drawings and chart settings |
| `frontend/src/trader-notebook/` | Personal plans, notes and registered trade arrows |
| `frontend/src/system-connectivity/`, `system-observability/` | Connection health and Activity |
| `frontend/src/workspace-docking/`, `appearance/` | Dock layout and display preferences |
| `storage/` | SQLite inventory, reconciliation, timing and validated backup/restore |
| `bridge/` | Frozen read-only Python bridge and MQL5 programs/protocols |
| `docs/` | Canonical setup, recovery, maintenance and storage contracts |
| `.github/workflows/checks.yml` | Clean Windows installation, tests, lint and build |

Keep the shell focused on composition. Feature modules own requests,
transformations, state and caches. Inspector's integration entry is
`frontend/src/inspector/index.ts`; it consumes broker identity/clock, chart data,
time preferences and the storage API. Renderers do not own collection.

## Interpretation and data

Inspector supports EURUSD and 21 families in four categories. All 19 numeric families’ magnitude
uses all usable released Actual/Previous deltas since January 2015 through now,
including the selected and newer readings. Scheduled unusable values stay outside
N. `Earlier / All` separates chronology from dataset size. Stored corrections are
not historical data vintages.

Magnitude is **Undefined** or **frozen manual boundaries**. Enter independent
positive Small/Medium/Large native-unit limits and Freeze; above Large is Extreme.
Unfreeze opens a live Scatter Plot preview while Inspector retains saved limits.
Boundary zoom is the default when limits exist. The connected-dot view defaults
to the inspected release plus 12 predecessors; Latest release restores that date
window, and Inspector can open the exact release in Scatter Plot. P95 is retired; legacy
manual tuples persist and legacy P95 selections become Undefined. Numeric limits
are scoped per series; magnitude colors apply globally. Classification rules are
user-chosen interpretations, documented in the family terminology files.

CPI v3, NFP v2, PCE v1, Retail Sales v1, Jobless Claims v1, GDP v1, PPI v1 and both ISM families also offer **Scatter Plot → Measure → Scoring signal** to
inspect their derived inputs, comparison averages and earlier-only automatic
magnitude bands. Manual component edits preview on the chart; **Apply to scorer**
updates the Inspector, and **Use automatic** restores calibration. These saved
settings are separate from original A−P boundaries and included in workspace files.
PCE's **Scoring system** view uses core/headline monthly pace and annual change,
with explicit revised-prior comparisons, one pair bias and an evidence grade.
ISM Services scores orders, activity, employment and input-price pressure against
a recent benchmark floored at 50; its composite PMI supplies context without a
second vote. Its retired first **Scoring system** view included bias, evidence, change size
and component visibility. **Scoring system v2** on either ISM family adds
a monthly Services/Manufacturing context with distinct publication times, one
bias, grouped evidence, pending sections and source-date discrepancy exclusions.
The month's two reports share one chart symbol and Inspector entry, with separate
timed series in a table with sector sections. Two adjacent outputs show the
Manufacturing-time and Services-time context snapshots, each with its own bias
and evidence grade. Earlier snapshots exclude future data; unpublished outputs
stay pending. No publication dropdown is needed.
**Scoring system v3** shows one latest monthly bias with the weighted sector
contributions and which evidence wins. V2 keeps publication snapshots below the
same final headline. The standalone Services v1 screen is retired; its formula
and saved magnitude key are retained internally and documented in the scoring
library. ISM and Scatter signal calculations run in workers, clock updates reuse
results, unchanged inventory preserves model identity, and chart overlays have
stable callbacks behind a memoized chart boundary.
Manufacturing has three configurable source signals; Services shares its v1
component settings. All weights are explicit prototype interpretation rules.

**USD Retail Sales v1** is available under Inspector → Scoring system on EURUSD.
Control-group pace leads with 60%, ex-autos-and-gas pace 25%, headline pace 15%.
It compares monthly growth with revision-aware prior three-month averages floored
at zero, with grouped evidence and separate change size. Scatter Plot → Scoring
signal exposes exact inputs and configurable magnitudes. Assessment runs in a
worker. Retail sales are nominal; no forecasts or price inputs enter scoring.
See the [scoring library](scoring%20system%20library.MD) for policy and audit.

**Raycaster** opens from the wave button beside the paintbrush toggle near the
timeframe selector. Its movable box reads USD context at the hovered candle end.
Memory v5 combines CPI v3.1 (28%), PCE v1 (10%), PPI v1 (2%), NFP v2 (30%),
Claims v1 (10%), ISM v3 (10%), Retail v1 (7%) and GDP v1 (3%). Qualified labor deterioration with inflation inside declared
guards shifts CPI to 8% and NFP to 50%; the breakdown shows conditions and
effective/base weights. Claims has a 14-day freshness gate, GDP 120 days; others use 45 days.
The gear shows saved Enabled/Off controls, source biases/evidence and weighted
votes. CPI **Scoring system v4** shares those context controls and shows the
unchanged standalone CPI reading, context before/after publication and the CPI
vote change. Inspector marker filters remain independent. The last candle stays visible while inspecting
the popover; its footer marks this as the USD side only. Supported major USD
pairs invert direction when USD is base. Background scoring leaves hover as a
snapshot lookup. See [Raycaster](frontend/src/raycaster/README.md) and
[USD context policy](frontend/src/usd-context/README.md) for timing and limits.

Inspector Filters has one **US ISM Manufacturing / Services** checkbox and symbol
selector controlling both original source families. Legacy partial selections
show as indeterminate until changed; Cancel preserves them.

NFP direction uses signed magnitude points from Payrolls, Unemployment and
Earnings m/m; seven supporting readings stay separate. CPI retains its four-rate
score and separate price-index matrix. Hover series labels for NFP role explanations.
Numeric filterable EUR/USD families support descriptive Higher/Lower deltas and
manual magnitude, with an
optional A−RevP comparison when Revised Previous exists. Both sizes use the same
series limits; histogram counts and Scatter points retain supplied-Previous A−P.
Policy rate boundaries use basis points. Speeches remain nonnumeric. Base/Quote
identity colors are saved from the filter headings and apply to Inspector labels
and chart symbols. Filter category blocks align horizontally across both sides.

Fed and ECB policy episodes group known meeting statements/projections and press
conferences with the numeric rate decision within one hour. Each row keeps its
own release time; ordinary speeches stay separate. Rate deltas show green/red
basis-point changes. See [policy episodes](frontend/src/inspector/episodes/README.md).

Inspector symbols include filtered upcoming releases with verified chart times.
Pan into the blank future area to view scheduled symbols; clicking opens the
exact release. Future spacing projects elapsed timeframe slots from the latest
candle until actual broker candles establish the timeline. No price data is
inserted, and internal historical candle gaps are not filled.

See [shared magnitude behavior](frontend/src/inspector/magnitude/README.md),
[Scatter Plot](frontend/src/scatter-plot/README.md),
[Alert](frontend/src/alert/README.md) and
[storage contract](docs/STORAGE-CONTRACT.md).

## Verification

```powershell
pnpm test
pnpm lint
pnpm build
```

Tests include mounted frontend behavior and temporary storage/recovery fixtures.
Run separately with `pnpm run test:frontend` or `pnpm run test:storage`.
Build output goes to `frontend/dist`. Visual UI audits and live MT5/DST/publisher
acceptance belong to the user; see the setup guide for manual checks.

## USD menu expansion / context v5

GDP and PPI now have standalone EURUSD scorers, shared Scoring signal magnitudes
and background workers. PCE, PPI and GDP also join Raycaster/CPI v4. Domain
budgets remain inflation 40%, labor 40%, activity 20%; the eight-input breakdown
and conditional labor-priority guards are visible. Registered standalone views
for PCE/PPI/GDP/Retail/Claims/Fed additionally display publication-time context.

FOMC rate actions are interpreted separately with Weak action evidence; a hold
supplies no direction. Fed Chair events expose missing text coverage. The feed
contains no statement/speech content, so full policy-guidance scoring remains
pending a timestamped text source. See [scoring system library.MD](scoring%20system%20library.MD)
for exact policies, current coverage and remaining manual review.
