---
name: market-data-reader
description: Read Fyodor Lite reports, stored economic-calendar releases, and MT5 OHLC event windows with compact queries and verified broker clocks. Use when local evidence or measured price reactions are needed.
---

Run `pnpm analyst status` from the Lite root to identify the stored broker and live
OHLC availability. Use [dataset navigation](../../../Market%20Analyst%20Workflow/docs/dataset-navigation.md)
for commands. All paths resolve inside Lite independently of the current shell directory.

- Read the brief and release index before requesting focused rows. Paginate with
  `--offset`; names in index previews are not a complete list of series.
- The full report companion includes all stored readings for its scope. Focused
  queries narrow what is returned to the agent, not what the export preserves.
- Calendar reads use a read-only SQLite snapshot, including WAL data. Do not copy
  or modify the live inventory. Use the configured `--database` when appropriate.
- OHLC needs a running bridge or saved evidence. Use explicit UTC instants; the
  helper converts verified historical server clocks and rejects unknown offsets.
  Reuse saved evidence with `--input`; its capture time remains visible.
- M1 reactions need the complete pre-release minute. Missing minutes produce
  unavailable measurements. H1/H4 provide backdrop, not exact release reactions.
- Gaps may be sessions or missing history. OHLC does not establish intrabar order,
  trade fills, spread or news causality; tick volume is not exchange-traded volume.

Do not restart services, change broker settings, or use chart/browser automation
to acquire evidence. Return a clear limitation if required data is unavailable.
