# Repository scripts

`setup.ps1` installs the pinned frontend/Python environment. Follow
[setup](../docs/SETUP.md), rather than maintaining a second installation procedure.

Root `package.json` owns the public commands. `pnpm check:repo` runs the frontend
navigation checker; `pnpm test` runs sequential frontend suites and storage
fixtures. Lint/build are separate checks. CI uses the same commands.

[Frontend scripts](../frontend/README.md) also include historical dataset audits
and replay tools. Those may require local services/inventory and write captured
artifacts. They are not prerequisites for ordinary navigation or fixture tests.
