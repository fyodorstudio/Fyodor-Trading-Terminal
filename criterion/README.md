# Criterion: historical chart audit

The left Criterion dock lets you inspect pinned, exploratory EURUSD episodes on
the H1 chart. It is **not** a live signal generator or a registered setup.

Choose a research snapshot at the top of the dock:

- **CPI / NFP baseline V2:** the existing A−F and A−P episode audit, unchanged.
- **USD CPI bundle V3 (snapshot v1.1.0):** six A−P interpretations of the
  same-time headline/core CPI bundle. Choose interpretation, co-release filter,
  H60/H120/H240 expiry and nominal ATR stop/target. Each release appears once
  in the list; a comparison may mark it ineligible. Select an episode to see
  its H1 chart, nominal entry/SL/TP, four CPI A/P readings, outcome and audit
  note. A selected ineligible episode shows **No trade**, not an old result.

The bundle dock is EURUSD-only. The research package covers seven USD pairs;
the other six are not silently presented as EURUSD charts. The separate
[integration contract](INTEGRATION.md) names the source runs, hashes,
regeneration command, and known limitations. Export audit notes to Markdown
before changing browsers or clearing storage.

