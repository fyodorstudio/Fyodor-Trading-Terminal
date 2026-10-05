# Fyodor MT5 bridge

This is a local, read-only adapter. It exposes Market Watch, OHLC, health,
activity, and the MT5 economic-calendar publisher on `127.0.0.1:8001`.
It contains no persistence or trading endpoints.

Native MetaTrader5 calls run in a supervised child process. A stuck broker IPC
call can therefore be terminated without blocking bridge health or Activity.
Selected-chart OHLC initially loads 5,000 bars, then pages backward from MT5 as
the chart approaches its oldest loaded bar until MT5 reports its available
history boundary.

## First setup

Follow the canonical [setup guide](../docs/SETUP.md). From the repository root:

```powershell
pnpm run setup
```

If several MT5 installations are running, set `FYODOR_MT5_TERMINAL_PATH` to
the exact `terminal64.exe` before starting the application.

The root `pnpm run dev:all` command uses `bridge/.venv` directly so frontend and
bridge always start with the same isolated Python dependencies.

## MQL5 Scripts and EA (`bridge/mql5/`)

The current persistent-storage workflow uses Publisher V2.0.2 and Exporter V4
under `mql5/Active`, described in the setup guide. The following describes the
older bridge-only programs, not the fresh-clone storage procedure.

1. **`FyodorCalendarPublisher.mq5` (Live Runtime EA)**:
   - Attach to one MT5 chart to stream live economic calendar releases to the bridge.
   - Add `http://127.0.0.1:8001` to MT5 **Tools > Options > Expert Advisors > Allow WebRequest for listed URL**.
   - The EA only reads the MT5 calendar and posts it to the local bridge; it cannot place orders.

2. **`FyodorMasterExport.mq5` (One-Time Master Historical Exporter)**:
   - Standalone script to export your broker's entire historical economic calendar (all countries, multi-year depth) and historical OHLC candles directly to standard CSV files in MT5's `MQL5/Files/` folder.
   - Useful for offline data audits, backups, and quantitative research against raw broker history.
   - Pre-compiled binary `FyodorMasterExport.ex5` is included and ready to run.

Older predecessor scripts are preserved under `bridge/mql5/legacy/`.

## Bridge v1 acceptance checklist

Bridge v1 is not frozen until the owner manually confirms all of these:

- Cold start with MT5 closed shows Bridge running and MT5 not running.
- Opening MT5 later connects automatically without restarting the app.
- Closing and reopening MT5 recovers with a new source generation.
- Rapid symbol and timeframe switching never shows candles for the wrong selection.
- Live OHLC refresh does not reset chart pan or zoom.
- Market Watch contains every symbol currently visible in MT5.
- A missing-history or IPC error is visible in Activity without freezing the UI.
- The calendar EA can be detached and reattached without restarting the app.
- An interrupted multi-chunk snapshot never replaces the last complete calendar.
- Calendar heartbeat becomes stale after 30 seconds without silently claiming live data.
- One known broker calendar event has the same server time in MT5 and the same selected display time in the app.
- A countdown crossing zero changes to Awaiting actual, then to Released only after MT5 supplies the actual value.
- Market-open and market-closed sessions both show truthful freshness states.
- A longer session keeps the UI responsive and does not accumulate queued requests.

After acceptance, `/api/v1` and calendar protocol version 1 become the frozen
contract.
