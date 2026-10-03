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
   - The bottom dock opens on six compact CPI rows. Title, Before CPI / At CPI / After CPI / On chart tabs, Filters, Window and Info share one header; the repeated CPI banner is removed. Full release/entry timestamps and research identity remain in Info. Browse one date at a time, search across all dates in a tab, or page through at most eight release headers. Before/After start with the nearest date to CPI.
   - EURUSD Filters opens with a Director-approved Most relevant preset: four category controls per currency. USD order is monetary policy, inflation, labor, growth/activity; EUR order is monetary policy, inflation, growth/activity, labor/wages. Categories select related report families together; Customize exposes individual families. German inflation and German/French PMIs sit inside their relevant EUR category, without a separate country-selection step. More context starts collapsed and contains searchable supporting families, including policy minutes/accounts, claims and other national releases. Priority guides review rather than guaranteeing realized price impact; MT5 importance and outcomes do not determine it. The snapshot does not reliably identify flash/first versus final stages, so all recorded updates of selected families remain inspectable. Coverage details also disclose partial fiscal/geopolitical coverage.
   - Previous default filters upgrade to Most relevant; explicit custom/All releases preferences, existing symbol selections and saved national-family defaults are preserved. Most relevant explicitly restores the approved preset; Custom selection and All releases retain the editable shortlist. A saved family remains editable with a zero count when absent from the episode. Other currencies retain their existing separate controls; priority categories are implemented only for EURUSD. Same-time companions share a release while original source rows and distinct policy announcement times remain intact.
   - Apply filters both the list and chart visibility; Apply & mark releases also adds valid timed events in the current window. Hidden marker selections remain saved and reappear when their currency/family is shown again. On chart lists visible marked releases. Tabs, dates and search only navigate the list. Filter drafts are discarded on dismissal; applied selections persist locally. Window controls before/after observed H1 candles without changing reviewed outcomes.
   - Tick a release and choose Star, Sun, Cloud, Umbrella, Snowflake or Moon to mark it on the pinned H1 chart. Symbols Configure is collapsed in Filters. Base symbols are blue, quote symbols purple, with lighter colours in dark mode; red/green direction badges and CPI arrows retain their meaning. Mixed clusters show both currency colours, and popup entries include currency labels. Hover for readings; click to jump to its tab/date/page and open its table. Tentative/date-only events remain visible in the dock without an invented exact-time symbol.
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
