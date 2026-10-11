# Shared economic calendar

Source observations, source-ID catalogs, pair identity, timing and stored queries.
This domain does not import Inspector UI, magnitude/scoring engines or context workers.

| Folder | Ownership |
| --- | --- |
| `contracts/` | Unmodified MT5 observation fields and exact raw numbers |
| `catalog/` | Stable currency families, full MT5 source manifest and new-event coverage |
| `forex/` | Eight currencies, 28 conventional pairs, stable pair-scoped readings |
| `presentation/` | Configurable event-symbol vocabulary |
| `releases/` | Shared grouped-release contract |
| `storage/` | Cancellable paging/polling and unchanged-row identity |
| `time/` | Display-date ranges |

Inspector owns visible family selection, release/episode grouping, markers and tables.
Scorers consume shared observations; adding a calendar family does not admit it to a scorer.
Old Inspector entry files remain thin compatibility exports; production consumers use
these ownership paths directly.

See [major-pair support](../../../docs/INSPECTOR-MAJOR-FOREX.md) and
[storage contract](../../../docs/STORAGE-CONTRACT.md).

`catalog/source-events.json` records all 1,051 V4-exported event types (28 September
2026). `complete-catalog.ts` extends stable family controls by source country/sector
and publication-name stem. Inspector owns the numeric-ID fallback for newly
introduced events. Neither broadens scoring admission.
