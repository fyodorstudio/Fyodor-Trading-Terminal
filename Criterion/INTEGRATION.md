# Historical Criterion audit in the terminal

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
  restores broker candles and Notebook arrows. The H60/H120/H240 selector now
  displays exactly that many observed H1 candles by default, counting the entry
  candle as H1. The **Show prior context** button optionally adds up to 120
  earlier H1 candles for pre-release inspection. Neither view loads a candle
  after the selected expiry.
- Selecting an episode also plots its nominal entry, stop and target as labeled
  chart lines. These are the archived ATR-rule levels, not executable broker
  fills; an opening gap may fill beyond the nominal stop.
- Arrow Result contains an **Audit note** under **Trader Journal & Thesis**.
  Notes are keyed to the pinned viewer hash, event family, direction input
  (A-F or A-P) and episode ID. They auto-save in this browser's local storage,
  survive refresh, and can be reopened from **Saved audit notes** in Criterion.
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
