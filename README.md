# Fyodor Trading Terminal

This repo is the workspace for the current Fyodor Trading Terminal app.

If you are starting fresh, begin here first, then use the docs links below.

The main frontend lives in:

`C:\dev\Fyodor Trading Terminal\Main`

The MT5 bridge is now vendored locally in:

`C:\dev\Fyodor Trading Terminal\Main\mt5-bridge`

## Start Here

- Product contract: `docs/Roadmap/PRODUCT_CONTRACT.md`
- Grounded checklist, audit ledger, backlog, and current-state truth: `docs/Roadmap/checklist.md`
- Naming, wording, and state-language authority: `docs/Roadmap/terminology.md`
- Frontend-specific notes: `Main/README.md`
- Bridge-specific notes: `Main/mt5-bridge/README.md`

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
- Use `pnpm` from the repo root as the package-manager source of truth for this workspace

## Project Structure

This repository is organized as a unified workspace for the Fyodor Trading Terminal. Below is a breakdown of the root directories:

- **`Main/`**: The primary application directory.
  - `src/`: The React (Vite) frontend terminal.
  - `mt5-bridge/`: The Python (FastAPI) bridge that communicates with MetaTrader 5.
- **`docs/`**: Product docs, roadmap docs, reference exports, and local agent-skill reference material.
- **`scripts/`**: Automation and utility scripts used to launch and manage the terminal's development environment.
- **`docs/Agent Skills/Uncodixfy/`**: Documentation and reference assets for the `uncodixfy` UI design system, kept as local reference material inside the docs tree.
