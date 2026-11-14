# Fyodor Trading Terminal Lite

Local trading terminal with MT5 charts, economic calendar, MFDI, RSI, volume,
Heatmap, Wildcards, Ledger, Detail, alarms and a manual trade journal.

## Run

Windows x64, Python 3.12, Node.js 22 and pnpm 9.12.3.

```powershell
pnpm setup
pnpm dev:all
```

| Service | Address |
| --- | --- |
| Frontend | http://localhost:5173 |
| MT5 bridge | http://127.0.0.1:8001 |
| Storage | http://127.0.0.1:8002 |
| Alarm worker | http://127.0.0.1:8003 |

`pnpm dev:all` starts the stack and restarts this checkout's alarm worker.
`pnpm dev:ui` uses existing services. `pnpm alarms:restart` restarts only the worker.
MT5 can be disconnected while the UI runs. Publisher/exporter programs are in
`bridge/mql5/Active/`; the bridge connects to the local MT5 installation.

## Code layout

| Directory | Contents |
| --- | --- |
| `frontend/src/` | React UI, chart integrations and feature modules |
| `bridge/` | MT5 adapter and MQL5 publisher/exporter |
| `storage/` | Calendar, saved content, alarms and HTTP APIs |
| `config/` | Broker clocks, calendar measures, currencies and instrument definitions |
| `Market Analyst Workflow/entry-trade/` | Saved trade journal |

## Checks

```powershell
pnpm test
pnpm lint
pnpm build
pnpm check:repo
```

A frontend suite can be selected with `pnpm --dir frontend test -- <filename-fragment>`.

## Data

Local calendar and global Wildcards live in Git-ignored `storage/data/`. Journals use
`Market Analyst Workflow/` subdirectories. Browser settings include drawings,
filters and the MFDI working configuration. Calendar backups do not include
browser settings.

```powershell
pnpm storage:status
pnpm storage:backup -- "C:\backups\fyodor-calendar"
pnpm storage:restore -- "C:\backups\fyodor-calendar" --destination "C:\restored\fyodor-calendar"
```

Backup/restore commands require storage to be stopped. Destinations must be new or empty.

[User manual](user%20manual.md) · [Architecture](docs/ARCHITECTURE.md) · [MT5 bridge](bridge/README.md)
