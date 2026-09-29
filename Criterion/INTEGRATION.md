# Historical Criterion audit in the terminal

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
- `frontend/public/criterion/research_report.html` is a local, Git-ignored copy
  of the full standalone viewer. It opens in a separate full-width tab because
  the Criterion dock is too narrow for that report. It may be replaced when a
  newly audited report is ready; copying it does not modify the pinned JSON.
- The chart temporarily displays pinned historical candles when an episode is
  selected. The banner and watermark distinguish this from the live MT5 feed.
  Chart times in audit mode use the export's server-clock labels. Return to Live
  restores broker candles and Notebook arrows.
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
