# Calendar persistence

`CalendarStore` is the public connection/lock owner. Its focused mixins run on that
same connection; transaction and concurrency behavior remain centralized.

- `schema.py`: connection setup, schema migration and revision triggers.
- `observations.py`: exact observations, source priority, capture clocks and live collection.
- `coverage.py`: coverage intervals and additive archive imports.
- `backfill.py`: publisher capabilities, leases, chunks, atomic acknowledgement and retry.
- `queries.py`: paged calendar reads, health and optional retained R1 history.
- `support.py`: serialization and interval arithmetic.

Currency admission and publisher version capabilities live in `../currencies.py`.
Contract: [calendar storage](../../docs/STORAGE-CONTRACT.md).
