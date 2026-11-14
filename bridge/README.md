# Fyodor MT5 bridge

Local MT5 adapter serving Market Watch, OHLC, health, Activity and economic-calendar
transport at `127.0.0.1:8001`. Native MetaTrader5 calls run in a supervised child
process. The bridge has no trading endpoints.

From the repository root:

```powershell
pnpm setup
pnpm dev:all
```

`bridge/.venv` contains the Python dependencies. When multiple MT5 installations
are running, `FYODOR_MT5_TERMINAL_PATH` selects the required `terminal64.exe`.

MQL5 publisher/exporter programs are in `mql5/Active/`; earlier versions are in
`mql5/legacy/`. Publisher EAs require their local service URL in MT5's allowed
WebRequest URLs. The publisher reads the MT5 calendar and posts it locally.

See the [application README](../README.md) for services and commands.
