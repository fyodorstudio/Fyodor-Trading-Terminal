# Fyodor agent rules

## Start small

- Read `CONTEXT.md` once per session. Read `docs/Development Logs/Checklist.md` for ongoing work, decisions, and pending verification. For a narrow fix, start with its relevant handoff section.
- Use `docs/NAVIGATION.md` only if the owning file is unknown. Read relevant source and local instructions next. Do not read every README, map, or research document for orientation.
- Search FMS Knowledge or the research ledger for the particular hypothesis before rerunning research. They are references, not mandatory cover-to-cover reading.
- Current user instructions take precedence over repository guidance. Historical docs describe past states; they do not authorize new work.

## Work economically

- Optimize correctness and completed work per usage consumed. Work alone; no subagents.
- Establish evidence before fixing a bug. Distinguish a confirmed cause from a hypothesis; verify the originally failing behavior before calling it fixed.
- Complete the authorized scope autonomously. Do not expand into optional cleanup, unrelated refactors, upgrades, or new systems.
- Use targeted `rg` searches and bounded reads. Batch related independent inspections; avoid repeated reads, large payloads, and redundant status/diff checks.
- Reuse valid checks, cached datasets, fingerprints, and checkpoints. Regenerate only when relevant inputs changed. Do not repeatedly poll unchanged state or restart services without a reason.
- Implement a coherent batch, validate the affected behavior, fix failures, then run one necessary final gate. Do not skip financial/data/lifecycle verification to save tokens.
- Use existing targeted checks. New test files require explicit user agreement; explain the protected behavior first. No broad suite unless justified. `pnpm run typecheck` is the TypeScript gate; docs-only edits need link/content checks, not builds.
- Stay quiet during implementation except for blockers, material findings, or required progress updates. Final: outcome, material caveats, exact manual checks. Never claim browser validation from typecheck or static rendering.
- At milestones, replace stale handoff text with current facts, unresolved issues, and reusable validation. Keep completed history out of the active Checklist. Update CONTEXT only for durable knowledge.

## Boundaries

- Local manual-trading support only; never send MT5 orders or promise profitability. Trusted inputs: MT5 OHLCV and broker economic calendar. FMS results stay gross; no new cost model or external feed.
- Preserve immutable contracts, first-seen provenance, no-lookahead semantics, and unrelated user changes. Statistical uncertainty is visible evidence, not an automatic veto of a positive historical recipe.
- Bridge edits require user authorization covering bridge work; honor existing authorization without asking twice. Leave real-account access outside scope unless explicitly authorized.
- Ignore `docs/Private`, `docs/IGNORE`, archives, generated artifacts, and `garbage` directories unless specifically needed/requested. Never delete them merely to simplify navigation.
- Use `pnpm`; retain route IDs and lockfile ownership. Keep active and garbage routes/styles separate. `react-world-flags` is known working; do not refactor it because of chunk size or a standalone SSR harness problem.
- Do not leave agent-started services occupying port 8001. Use hidden background processes with redirected logs; avoid attached noisy dev sessions.

## UI work

- Target 1440x900 at 100% Chrome zoom, bounded panels and internal scrolling. No overlap, clipped controls, tiny labels, or accidental horizontal/whole-page overflow. Document intentional exceptions in Checklist.
- No Playwright/CDP/browser automation unless requested. Give the owner a concise visual checklist and state that visual verification remains theirs.
- Feature CSS belongs in its owning `Main/src/styles/` file; `Main/src/styles.css` is the import aggregator. Preserve cascade/order when extracting CSS. Shared selectors require a real shared owner.
- Fixed grids must keep a stable column contract. Pair Matrix Evidence must align Latest/Next and keep metadata out of Compare/Driver lanes.
