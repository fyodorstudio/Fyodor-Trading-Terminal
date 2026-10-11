# Fyodor Trading Terminal

Local Windows/MT5 trading workspace with charts, Market Watch, Inspector, Alert,
Scatter Plot, a manual trade Notebook, Activity and Settings. Fundamental Settings
and Roofs are experimental. Inspector supports all eight major currencies and
28 conventional pairs; retained scoring covers USD/EUR and development is paused.

## Start here

- [Setup](docs/SETUP.md): pinned dependencies, broker clocks, calendar seed, publisher and launch.
- [Backup and restore](docs/BACKUP-RESTORE.md): personal calendar data and browser preferences.
- [Repository map](docs/REPOSITORY-MAP.md): terminology, ownership and task entry points.
- [Main objective](fyodor%20trading%20terminal%20main%20objective.md): current interpretation/scope.
- [Agent guidance](AGENTS.md): responsiveness, verification and UI copy rules.
- [Maintenance](docs/MAINTENANCE.md): compatibility, dependencies and CI.

`pnpm run setup` installs dependencies. `pnpm dev:all` starts UI (5173), bridge (8001)
and storage (8002). A clone contains neither personal calendar inventory nor
browser preferences. Use the setup/recovery guides for data operations.

## Development

```powershell
pnpm check:repo
pnpm test
pnpm lint
pnpm build
```

Navigation checks validate current local documentation links, source dependencies,
worker URLs and reachability. Tests run frontend suites sequentially, then storage
fixtures; use `pnpm test:frontend` or `pnpm test:storage` separately.
[Frontend](frontend/README.md), [storage](storage/README.md) and [bridge](bridge/README.md)
guides describe their entry points. [Scripts](scripts/README.md) distinguishes
routine checks from dataset-specific audits. Visual/live MT5 acceptance belongs
to the user.

## Data and interpretation

Shared calendar catalogs/contracts are independent of feature UI and scorer
admission. [Inspector coverage](docs/INSPECTOR-MAJOR-FOREX.md) describes supported
families, pair preferences, date defaults and timing boundaries.
[Scoring ownership](frontend/src/scoring-system/README.md) distinguishes R1 from
retained legacy models. Filters select visibility independently of scoring inputs.
Missing readings remain unavailable; forecasts and prices do not become votes.
Corrections retain source clocks and provenance, without claiming original-time vintages.

[Reports](reports/README.md) preserve research and historical implementation
records. Current module READMEs describe ownership; historical records do not
supersede the objective or authorize restarting paused development.
