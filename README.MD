# Fyodor Terminal — Canvas & Notebook

A clean, high-performance trading terminal and forensic notebook built strictly on verified MetaTrader 5 broker data.

---

## Architecture Topology

```
┌────────────────────────────────────────────────────────────────────────┐
│                        FYODOR TERMINAL (FRONTEND)                      │
│   • Renders 60 FPS candlestick charts, Market Watch, and Notebook       │
│   • Interactive drawing toolbar, long/short risk:reward calculators    │
│   • Real-time MT5 Economic Calendar release markers on the timeline    │
└───────────────────────────────────▲────────────────────────────────────┘
                                    │
                   Raw Broker Data  │ (Quotes, Candles & Calendar)
                                    │
┌───────────────────────────────────┴────────────────────────────────────┐
│                               MT5 BRIDGE                               │
│                         (port 8001 / FastAPI)                          │
│   • Native MetaTrader 5 IPC adapter                                    │
│   • Pure read-only market data streaming and historical bar paging     │
│   • Serialized latest-request-wins worker architecture                 │
│   • Zero strategy logic, zero synthetic data, zero external services   │
└────────────────────────────────────────────────────────────────────────┘
```

---

## Core Features

1. **Market Watch**:
   - Dedicated left dock displaying live broker instruments.
   - Real-time bid, ask, spread, daily % change, and fast search filter.
2. **Interactive Candlestick Chart**:
   - Timeframes from `M1` through `MN`.
   - Smooth 2D canvas pan, zoom, dark/light themes, and custom candle colors.
   - Real-time vertical markers for MT5 economic releases pinned above the timeline.
3. **Full Drawing Suite**:
   - Trendlines, horizontal lines, rectangles, parallel channels, position boxes, and text notes.
   - Interactive handles and direct right-click deletion.
4. **Trader's Notebook & Execution Planner**:
   - Located in the bottom dock under the **Notebook** tab.
   - Set planned Entry, Take Profit, and Stop Loss levels with instant pip distance and R:R ratio calculation.
   - Project planned levels directly on the chart (dotted blue Entry, dashed emerald TP, dashed rose SL).
   - Rich forensic journal `<textarea>` automatically saved locally and durable across browser refreshes.
5. **MT5 Economic Calendar**:
   - Historical and upcoming high/medium impact events with countdowns, actual vs. forecast values, and click-to-highlight jump.
6. **CPI & Event Timeline inspection**:
   - The audited Math Lab publication supplies 140 CPI episodes and fixed H240 / SL 1 ATR / TP 1 ATR results.
   - The bottom dock separates surrounding releases into Before CPI, At CPI and After CPI. Expand a family/country/currency release to inspect its original readings; family and currency selectors narrow the view.
   - Tick a release and choose Star, Sun, Cloud, Umbrella, Snowflake or Moon to mark it on the pinned H1 chart. Hover for readings; click to open its table. Nearby symbols form a selectable cluster. Tentative/date-only events remain visible in the dock without an invented exact-time symbol.
   - Before/after selectors change the displayed candles and surrounding events, independently of the published trade horizon. Symbol choices are stored per research identity and episode in this browser, with remembered family defaults. Personal audit notes use the same research/episode ownership and can be exported as Markdown.
   - This feature annotates reviewed data; it does not calculate new outcomes or change signals. See [Fyodor Workspace](Fyodor%20Workspace.md) for project boundaries.

---

## Quickstart

### 1. First-Time Setup
```powershell
python -m venv bridge/.venv
bridge/.venv/Scripts/python.exe -m pip install -e ./bridge
pnpm install
pnpm --dir frontend install --frozen-lockfile
```

### 2. Launch Terminal
```powershell
pnpm run dev:all
```

This concurrently boots:
* **MT5 Bridge** on `http://127.0.0.1:8001`
* **Terminal UI** on `http://localhost:5173`

Open `http://localhost:5173` in your browser.

If the repository has been moved or `dev:all` reports that `vite` or a Node package cannot be found, repair both local dependency trees before launching again:

```powershell
pnpm install --frozen-lockfile --force
pnpm --dir frontend install --frozen-lockfile --force
pnpm run dev:all
```

The root and `frontend` each have their own lockfile and `node_modules`; installing only the root dependencies does not install the UI.
