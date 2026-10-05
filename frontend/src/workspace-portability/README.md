# Workspace portability

The shell supplies `WorkspaceTransfer` inside Settings. Market chart settings
accept children and do not import Inspector/portability feature code.

`workspace-snapshot.ts` owns format `fyodor-workspace`, version 1, a 10 MB limit,
an explicit validator catalog and replacement/rollback semantics. It exports
owned persisted keys, not arbitrary localStorage. Notes remain plain strings;
other structured preferences preserve their JSON. Scatter appearance uses the
canonical normalizer; magnitude keys use the registered family catalog and
manual tuple validator. Unknown keys/versions/invalid data reject the whole import
before writes. A selected file is a preview; Restore and reload commits it.

Import replaces saved owned keys (absent keys reset), preserves unrelated storage
and excludes local source-clock verification. A failed write attempts to restore
the previous complete snapshot. Shared stores receive a storage event; reload
initializes other features from the restored keys. Browser localStorage cannot
provide an atomic cross-window transaction; avoid editing another tab during
restore. Failures are reported; no successful reload occurs after a failed import.

New preference owners/scopes must add validation here and round-trip fixtures.
Future format versions require explicit migration. New JSON files never include
calendar SQLite data, broker credentials, MT5 inputs or unsaved drafts. See
`docs/BACKUP-RESTORE.md` for the two-part recovery workflow.

`tests/test_workspace_portability.mjs` exercises a fresh persisted-state round
trip, filters/colors/cutoffs/notes/plans, absent-key replacement, exclusions,
invalid file/value rejection, rollback and mounted file preview/reload. Freeze
behavior is additionally covered by magnitude store/editor and model suites.
