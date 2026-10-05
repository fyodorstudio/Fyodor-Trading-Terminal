# Maintenance baseline

The canonical operating procedure is [SETUP.md](SETUP.md); recovery is
[BACKUP-RESTORE.md](BACKUP-RESTORE.md). README links to these rather than keeping
a second set of setup instructions.

## Repeatable dependencies and checks

`frontend/pnpm-lock.yaml` is the only Node lockfile. Root package commands forward
to the frontend and Python services. `bridge/requirements.lock.txt` pins the
Windows/Python 3.12 runtime and packaging tools. `scripts/setup.ps1` installs all
pins with no dependency resolution, installs this local bridge without build
isolation and runs `pip check`. Version pins preserve resolution, not package
availability forever; retain wheels/installers outside Git if long-term offline
reinstallation matters.

`.github/workflows/checks.yml` installs a clean Windows x64 Python 3.12.10,
Node 22.12.0/pnpm 9.12.3 environment and runs `pnpm test`, `pnpm lint`,
`pnpm build` on pushes, pull requests and manual dispatch. GitHub checks only run
when hosted there with Actions enabled. No account/broker is needed for these
fixture tests. Live MT5 and visual acceptance remain manual.

When updating dependencies, use a separate environment, update exact Python pins
or regenerate the frontend lockfile, run dependency checks and the full suite,
and test live MT5/publisher behavior before accepting the update. Do not resolve
latest Python packages silently as part of normal setup.

## Data and configuration compatibility

Storage schema migration recognizes supported versions and rejects unknown
versions. Backups have their own format/version and hash manifest. Workspace
exports have independent format/version and a supported-key validator catalog.
Adding settings requires registering their validation/export scope in
`frontend/src/workspace-portability/workspace-snapshot.ts` and round-trip tests.
Future settings/file versions need an explicit migration, not guessed defaults.

Magnitude tuples retain existing scope keys. Retired `"p95"` markers are ignored
as Undefined; manual tuples survive. Numeric configuration is per
pair/currency/side/family/series; the Small/Medium/Large palette is global.
Freeze saves fixed tuples; Unfreeze is an editing draft and doesn't change the
saved classification. Reopening always shows saved tuples frozen.

## Expansion and operational review

- Register new families with canonical IDs, units, favorable directions and
  completeness rules. Do not copy another family's economic convention blindly.
- Add scoped adapters under `scatter-plot/PAIR/` and reuse the shared renderer,
  magnitude store/classifier, sample admission and Inspector episode grouping.
- Pair and side controls currently expose only supported EURUSD/USD Quote
  bindings. More folders alone do not enable another pair.
- Add verified broker clocks with tests. Review Elev8-Demo2 before **2032** and
  after broker clock changes; its current profile deliberately ends in 2031.
- Exercise representative larger inventories when adding many families/pairs.
  Current synthetic 140-release tests are a baseline, not a ten-year latency SLA.
- Back up and periodically restore both personal datasets. Retain original
  inventory; future MT5 history availability is outside this application's control.
- Keep bridge/MQL protocols frozen unless an explicitly approved integration
  change includes corresponding compatibility and manual broker checks.

Before accepting changes: terminal tests, lint, build, relevant recovery checks,
and user-owned visual/live checks. Update documents when behavior changes.
