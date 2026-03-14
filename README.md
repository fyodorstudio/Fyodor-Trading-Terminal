# Fyodor Trading Terminal

This repo is the new workspace for the rebuilt trading app.

The main frontend lives in:

`C:\dev\Fyodor Trading Terminal\Main`

The MT5 bridge is now vendored locally in:

`C:\dev\Fyodor Trading Terminal\Main\mt5-bridge`

## One Command Dev

From the repo root:

```bash
pnpm install
pnpm run dev:all
```

That command will:

- launch MetaTrader 5
- bootstrap `Main\mt5-bridge\.venv` if missing
- start the vendored FastAPI bridge on `127.0.0.1:8001`
- start the frontend app from `Main`

## Useful Root Commands

```bash
pnpm run dev:app
pnpm run dev:bridge
pnpm run build
pnpm run test
```

## Notes

- The frontend still expects the MT5 bridge API on `http://127.0.0.1:8001`
- The bridge no longer needs to run from `alternate_version`
- If needed, you can override the MT5 executable path with `MT5_EXE`
