# Historical Criterion audit in the terminal

## EURUSD CPI bundle chart snapshot: v1.3.0

The Criterion dock offers a separate **USD CPI bundle V3** research snapshot
(v1.3.0). It is built from the Expanded Macro Research
`USD_CPI_BUNDLE_V1/run_20260930_outcomes_v3` package. It contains 139 in-cutoff
EURUSD release episodes, all six disclosed A−P interpretations, H60/H120/H240,
four SL ATR widths and thirteen TP ATR widths. These are alternative views of the
same releases, **not independent trades**. The post-cutoff September 2026
episode is omitted. The dock's existing baseline CPI/NFP V2 remains a separate
snapshot and is not overwritten.

The published artifact is `frontend/public/criterion/eurusd_cpi_bundle_v3.json`;
its exact SHA-256 (`63a85972b72afc1073b21bec4705e2f11fa777328ebc86231cd46698aafdf1e7`),
trial-ledger source hash (`3c468999f7f876b1dc9ed01e278b389990a73e41f28141f0815c7e504f83273f`)
and version (`1.3.0`) are pinned in `frontend/src/criterion/cpi-bundle-manifest.json`.
The browser verifies the snapshot hash before displaying it. The builder copies
research eligibility, source exclusions, coverage (including gap-free flags), and
sign/concordance fields from the pinned `cpi_pair_expanded_ledger.csv`, verifying
all 66,612 EURUSD trial rows and all 1,872 panel summaries.

The Criterion dock displays **“X match / 139 total”** using independent release
counts, where a match requires rule eligibility, a priced trial for the selected
cell, and inclusion under the active co-release setting. A list view filter
offers **Matching only** (default) and **All releases**; toggling the list view
never modifies calculation parameters, summaries, or co-release settings.

All surfaces (counts, rows, validated trials, chart trade arrows, and level overlays)
consume the unified inclusion decision (`getBundleEpisodeInclusion`), which enforces
strict agreement between rule eligibility metadata and priced trial existence, failing
closed on any unexplained discrepancy.

Specific, rule-aware explanations map the source research exclusion hierarchy first:
- Missing required monthly readings (e.g. 2025-12-18 where monthly readings are absent)
- Zero change in the required series (explaining the 0.0 actual/previous reading change, not a zero CPI inflation rate)
- Headline/core conflict rejected by this interpretation
- Nonconflicting release under a conflict-only interpretation
- Explicit source-recorded coverage failures: missing entry candle, invalid entry delay, insufficient ATR warmup, insufficient horizon bars, and path-gap failure
- Excluded simultaneous Jobless Claims

Source exclusion codes are evaluated first so that rule abstentions (e.g. H60 zero-signal)
are never overwritten by coverage facts from other horizons (e.g. H240 bars).

Overlapping explanations are preserved: when simultaneous Jobless Claims are
excluded on an episode with absent monthly readings (e.g. 2025-12-18) or zero
change, both reasons remain visible. Wording about the absence of simultaneous
Jobless Claims replaces the former "Clean Release" label.

The inclusion decision is shared across counts, rows, selection, results, chart
arrows, and overlays:
- Excluded Claims releases never appear as included trade results or selected-rule trade arrows.
- Their nominal SL and TP chart lines are removed (`levels = null`).
- Excluded historical trials retain their empirical simulation execution flags (`Same-Bar Dual Touch`, `Opening Gap`) when recorded in trial data, while remaining explicitly excluded and labeled as `Gross historical R`.
- Candle inspection and browser-local audit notes are fully preserved during inspection and transitions.
- Existing historical trials may be inspected in **All releases** only with an explicit **“Excluded from current selection”** label.
- The YoY context cue on 2025-12-18 is preserved as descriptive context only without assigning trade counts, simulated outcomes, ATR barriers, or TP/SL badges, reflecting its Claims exclusion when applicable.

This is historical, cost-excluded OHLC simulation with stop-first same-bar
resolution. Exported Previous has not been verified as the value known at the
original release. The H1 chart cannot reconstruct intrabar execution, and no
candidate has been selected or registered. Do not interpret a positive grid
cell as a forward-tested edge.

To regenerate after a deliberate V3 research publication, run from this
terminal repository root:

```powershell
python "Criterion/tools/build_cpi_bundle_snapshot.py"
python -m unittest discover Criterion/tests -v
pnpm --dir frontend build
```

If the snapshot changes, review the new source and update the separate bundle
manifest hash/version deliberately. The existing `research_report.html`
remains baseline report v1.0.1; it has **not** been relabeled as the V3 bundle
report. The full V3 exploratory grid remains in Expanded Macro Research's
standalone `HTML Viewer/table_viewer.html`.

## Published research report: v1.0.1

The URL `http://localhost:5173/criterion/research_report.html` maps to
`frontend/public/criterion/research_report.html` in this repository. The HTML
is now Git-trackable and its SHA-256 is pinned in
`frontend/src/criterion/report-manifest.json`. Version **1.0.1** identifies
this exact copied report, not a new research calculation or a registered setup.

| View | Included scope |
| --- | --- |
| Full HTML report v1.0.1 | US CPI and US NFP; AUDUSD, EURUSD, GBPUSD, NZDUSD, USDCAD, USDCHF, USDJPY; 2015–2026 with 2026 partial. The embedded report contains 140 release timestamps per family and 980 pair-episodes per family (not 980 independent releases). A-F and A-P inputs, H1 paths, and exploratory ATR stop/target outcomes are available for inspection. |
| Terminal Criterion dock | EURUSD only, for those same CPI and NFP source runs. It uses the separate pinned `eurusd_cpi_nfp_v2.json` chart-audit snapshot, not all seven report pairs. |

The published HTML SHA-256 is
`d9da359c2bfac9aba193648a712bf985751dc9aed5467a5c5cfc4d50871a3c5a`.
The report and EURUSD chart snapshot must match this source hash. A future
research update needs a new version, manifest hash, explicit scope review and
test run; do not silently overwrite v1.0.1. Versioning identifies the artifact,
not the reliability or profitability of any setup.

The Criterion dock is a read-only EURUSD chart-audit view of the pinned CPI and
NFP V2 exploratory research. It is **not** a registered trading setup and does
not issue live signals. Its arrows show the A−F or A−P direction calculated
from archived calendar values; the Arrow Result dock separately shows the later
simulated TP-first, SL-first, or expiry outcome.

## Sources and boundaries

- `frontend/public/criterion/eurusd_cpi_nfp_v2.json` is a compact, versioned
  display artifact. It contains EURUSD H1 candles, episode inputs and 52 ATR
  cells × 3 expiry horizons for CPI and NFP. It is generated, not hand-edited.
- `Criterion/tools/build_audit_snapshot.py` reads the pinned local Expanded
  Macro Research viewer, pre-outcome ledgers and EURUSD H1 export. It checks
  SHA-256 source pins, matches A/F/P and entry timestamps, reconciles every
  displayed summary cell to underlying trials, and independently checks every
  embedded H1 price path against the pinned raw candles.
- `frontend/public/criterion/research_report.html` is the tracked full-width
  standalone viewer. The Criterion dock is too narrow for the complete report.
- The chart temporarily displays pinned historical candles when an episode is
  selected. The banner and watermark distinguish this from the live MT5 feed.
  Chart times in audit mode use the export's server-clock labels. Return to Live
  restores broker candles and Notebook arrows. By default, the H60/H120/H240
  expiry selector displays exactly the selected number of observed H1 candles,
  counting the entry candle as H1. A separate **Prior context** selector controls
  0, 60, 120 or 240 earlier H1 candles; it defaults to **240** and changes only
  the chart display, not the simulated trade or summary. Near the beginning of
  the export, fewer than the requested prior candles may be available. No candle
  after the selected expiry is loaded.
- Selecting an episode also plots its nominal entry, stop and target as labeled
  chart lines. These are the archived ATR-rule levels, not executable broker
  fills; an opening gap may fill beyond the nominal stop. Changing the direction
  rule, expiry, SL ATR, TP ATR, co-release filter or sample coverage keeps the
  selected episode open within the same event family. Its levels, arrow and
  historical outcome update only when a priced trial exists for the new rule;
  otherwise the view explicitly shows **No trade** without reusing the old result.
- The episode list includes priced observations excluded by the selected CPI
  co-release or coverage filter. Their historical result is visible for audit,
  marked **Excluded** between gross R and **Audited**, and not counted in the
  selected summary. CPI's clean filter excludes simultaneous US Initial Jobless
  Claims. NFP on EURUSD has no co-release exclusion; the CAD-employment clean
  policy applies to USDCAD. The redundant **Sample coverage** selector was
  removed from this EURUSD dock; the dock uses `ALL_ELIGIBLE` for the selected
  expiry. An episode with incomplete H240 coverage is labeled in its row. This
  pinned snapshot has zero such CPI or NFP episodes; later uncovered calendar
  releases are not fabricated. The list is not a complete inventory of all
  calendar releases lacking a priced trial. Common-H240 statistical comparisons
  remain in the full research report.
- Arrow Result contains an **Audit note** under **Trader Journal & Thesis**.
  Notes are keyed to the pinned viewer hash, event family, direction input
  (A-F or A-P) and episode ID. They auto-save in this browser's local storage,
  survive refresh, and appear as **Audited** beside the matching episode's
  result. This label means only that a personal note was saved, not that the
  research or setup passed review. Clicking that episode reopens its note;
  noted episodes remain listed even if the current rule has no priced trade.
  They are *not* part of the research package or synchronized to Git. Use
  **Export all notes (.md)** and attach that file in a later Codex discussion;
  Codex cannot read browser-local storage. Export a backup before clearing
  browser data, changing browser profiles, or replacing this device.
- This is gross OHLC simulation with no spread/slippage/financing. Same-bar
  dual touches are stop-first. The 2026 history is partial. Historical results
  are not proof of future profitability or a claim of registration.
- The exported `Previous` field may reflect a later revision. This snapshot does
  not prove what P was known at the original release. Treat A−P arrows as an
  audit aid, not as an ex-ante live-signal validation.

## Regenerate after a deliberate research update

From the terminal repository root:

```powershell
python "Criterion/tools/build_audit_snapshot.py" --research-root "C:\dev\Fyodor Math Lab\Expanded Macro Research"
Copy-Item -LiteralPath "C:\dev\Fyodor Math Lab\Expanded Macro Research\HTML Viewer\table_viewer.html" -Destination "frontend/public/criterion/research_report.html"
```

The script refuses a changed viewer or raw candle export until its expected
hashes are reviewed and deliberately updated. That prevents a silent data
replacement. To study a new event family or pair, update the artifact contract
and selectors explicitly; do not relabel existing CPI/NFP arrows as signals.
If the copied HTML changes, increment `report-manifest.json`'s version and
hash, review the scope above, and run the Criterion tests before committing.
