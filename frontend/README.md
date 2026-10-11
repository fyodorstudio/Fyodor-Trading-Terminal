# Frontend development

React/TypeScript with Vite and Lightweight Charts. From the repository root:

```powershell
pnpm check:repo
pnpm test:frontend
pnpm lint
pnpm build
```

Run suites sequentially: SSR fixtures share Vite's dependency cache.
`tests/suites.mjs` is the ordered suite list; a focused suite can be run with
`pnpm --dir frontend exec node tests/<suite>.mjs`.

`index.html` loads `src/bootstrap/mount-fyodor-terminal.tsx`, which mounts Activity
and the terminal shell. Start implementation searches at the
[repository map](../docs/REPOSITORY-MAP.md), then the feature's ownership README.
Shared calendar contracts/catalogs are independent of Inspector presentation.
R1 and retained legacy scoring models have separate formulas/settings; development
of scoring is paused.

Production imports should point to focused owners. Historical compatibility
exports remain available for existing tests/consumers. Keep public exports,
saved settings keys and worker inputs stable during file cleanup.

`scripts/check-repository.mjs` validates navigation without starting services.
Other `scripts/audit-*.mjs`, `scripts/usd-context/` and `scripts/pair-context/`
are dataset-specific research/replay tools; inspect their inputs before running
them. Routine fixture checks need no MT5 connection. Build output and dependencies
are ignored; reviewed findings belong in `reports/`.
