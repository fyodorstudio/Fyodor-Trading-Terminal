# Fyodor Trading Terminal Lite

Local trading terminal with MT5 charts, economic calendar, MFDI, RSI, volume,
Heatmap, News Flow, Wildcards, Ledger, Detail, alarms and a manual trade journal.

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

`pnpm dev:all` replaces this checkout's frontend, bridge, storage, alarm worker,
and private Android news services (ntfy 8004 and read-only phone page 8005).
The desktop opens once bridge and storage are ready. The command reports when
the full stack is ready and reuses current phone frontend assets.
Open the News Flow bell for connection details. First start downloads the pinned,
checksum-verified official Windows ntfy binary into ignored local storage.
`pnpm dev:ui` uses existing services. `pnpm alarms:restart` restarts only alarms;
`pnpm news:phone:restart` rebuilds/restarts only phone news.
See [Android news setup](storage/news_flow/PHONE.md).
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

News Flow ownership: [frontend guide](frontend/src/news-flow/README.md) ·
[backend guide](storage/news_flow/README.md).

## Checks

```powershell
pnpm test
pnpm lint
pnpm build
pnpm check:repo
```

A frontend suite can be selected with `pnpm --dir frontend test -- <filename-fragment>`.

## Data

Global Wildcards are saved by the storage service in the Git-tracked
`storage/data/wildcards/wildcards.json`. The calendar database and other local
storage data are Git-ignored. Journals use `Market Analyst Workflow/`
subdirectories. Browser settings include drawings, filters and the MFDI working
configuration. Calendar backups do not include browser settings.

```powershell
pnpm storage:status
pnpm storage:backup -- "C:\backups\fyodor-calendar"
pnpm storage:restore -- "C:\backups\fyodor-calendar" --destination "C:\restored\fyodor-calendar"
```

Backup/restore commands require storage to be stopped. Destinations must be new or empty.

[User manual](user%20manual.md) · [Architecture](docs/ARCHITECTURE.md) · [MT5 bridge](bridge/README.md)
