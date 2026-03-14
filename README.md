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
## Project Structure

This repository is organized as a unified workspace for the Fyodor Trading Terminal. Below is a breakdown of the root directories:

- **`AGENT_INSTRUCTIONS/`**: Contains specialized instructions and persona-based guides for AI agents (Gemini, Codex, Claude) to ensure consistent development patterns and role-based workflows. It also contains an `archive` of original project strategies.
- **`Main/`**: The primary application directory.
  - `src/`: The React (Vite) frontend terminal.
  - `mt5-bridge/`: The Python (FastAPI) bridge that communicates with MetaTrader 5.
- **`scripts/`**: Automation and utility scripts used to launch and manage the terminal's development environment.
- **`Uncodixfy/`**: Documentation and reference assets for the `uncodixfy` UI design system, ensuring a clean and professional aesthetic.
- **`QUEST_LOG.md`**: A chronological record of development progress, milestones, and technical decisions, organized as a linear history of the project's evolution.
