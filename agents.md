# Agent Navigation & Operating Instructions

Before reading or modifying any files in this repository, read and follow the workspace architecture and boundary contract:

- [Fyodor Workspace Overview](Fyodor%20Workspace.md)

This defines the strict division of responsibility between **Fyodor Math Lab** (research, calculations, evidence) and **Fyodor Trading Terminal** (live broker display, UI, manual episode audit), as well as the rules governing data integrity, setup publication, and verification.

## Frontend Architecture & Maintainability Rules

- **Shell components compose feature hooks/panels; domain request/cache lifecycles live in hooks**: The root shell remains an integration layout; network lifecycle, cache orchestration, and data transformations reside in focused hooks.
- **Subsystem state belongs in subsystem modules**: Keep domain-specific states, selectors, and level lookups inside their respective feature modules rather than polluting the root shell.
- **Lifecycle bugs require mounted component/hook tests, not duplicated harness logic**: Production defect verification must mount the actual production hooks and components to guard against real lifecycle regressions.
- **User edits (notes/drafts) must be keyed by identity, not transient selection**: Unsaved drafts and persistent records belong to explicit entity identities (`viewerSha256:episodeId`) to prevent crosstalk during rapid navigation.
- **No silent cancellation failures; loading states must not re-trigger their own effects**: Decouple state updates from effect dependency loops and ensure abort handling distinguishes cancellations from actual network errors.
- **Tests for async flows should use controllable deferreds/events instead of wall-clock sleeps**: Eliminate race-condition flakiness in tests by explicitly resolving or rejecting promises via controllable deferreds.
- Report responsibility changes when expanding a large module. Keep feature transformations and annotations out of the shell.
- Report generated asset counts and byte totals before publishing files. Use pnpm with the existing lockfile.
- Run checks appropriate to changed behavior; explain why a broader suite is needed. Report actual results and remaining manual checks.
