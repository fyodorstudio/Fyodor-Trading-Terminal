# Calendar storage service

Local SQLite inventory and HTTP service on port 8002. Start from
[setup](../docs/SETUP.md); API/schema/clock invariants are in the
[storage contract](../docs/STORAGE-CONTRACT.md).

| Entry | Responsibility |
| --- | --- |
| `run.py`, `app.py` | CLI, service composition and routes |
| `calendar_store.py`, `persistence/` | Public connection/lock owner and focused persistence modules |
| `contracts.py`, `currencies.py` | Observation validation and publisher capabilities |
| `bridge_collector.py` | Read-only bridge collection |
| `archive_import.py` | Additive historical imports |
| `calendar_clock.py` | Verified broker clock rules |
| `recovery.py`, `data_lock.py` | Validated backup/restore and inventory locking |
| `r1_audit_snapshot.py` | Retained R1 history snapshots |
| `tests/` | Temporary fixture inventory and recovery tests |

[Persistence ownership](persistence/README.md) describes the shared transaction
boundary. Run `pnpm test:storage` from the root; fixtures need no MT5 account.
Personal inventory, provenance and generated audit data belong in ignored
`storage/data/`. Hygiene work must not modify that inventory or schema.
Use [backup/restore](../docs/BACKUP-RESTORE.md) for data operations.
