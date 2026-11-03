# Preserved research and cleanup

Before this branch was changed, every tracked file and non-ignored untracked
file was saved in the verified ZIP alongside the repository:

`../Fyodor-preserved-before-currency-news-20261104.zip`

Archive SHA-256:
`d3f51f34389ad4f51641eaa443ee6a4b49da8d035be81ed18996270e27dfc17a`.

Its `PRESERVATION-MANIFEST.json` records the starting Git HEAD and SHA-256 for
each of 712 files. All entries were read back and checked before cleanup. This
includes existing uncommitted work, original Thesis/learning ledgers and source,
all tracked scratch downloads, and failure audits. The original `Lite` branch's
committed history is unchanged. No Git history was rewritten and no automatic
commit was made. This local archive is not distributed by a fresh Git checkout.

The active tree removes the former Thesis/learning runtime, its obsolete tests,
generated evaluation records, saved handoff requests and scratch downloads. New
scratch output is ignored. Existing ignored calendar storage, raw captures,
reports, external-source limitations, reminder choices and user journals stay
in place. Entry Trade remains tracked. Do not delete the preservation ZIP or
ignored local evidence as part of routine source cleanup.

Compact current process lessons were extracted from the latest active reviewed
versions into `docs/research-lessons.json`, retaining source lesson/review IDs.
They are process corrections, not proof of a trading edge. The full
[EURCAD/CAD failure audit](research-audits/2026-11-03-eurcad.md) is retained for
explicit investigation. Consult full archives only when the task needs the
original evidence or implementation; routine news refreshes use
[the short rules](RESEARCH-RULES.md) and focused lesson lookup.

The later cleanup also removes unused calendar compatibility wrappers, their
unreachable admission helper, and the obsolete root attribute for a deleted HTML
report. The old static `frontend/public/entry-trade-research.json` was copied and
hash-verified under ignored `Market Analyst Workflow/report/retired-static-research-20261104/`
before removal. Its Git version remains recoverable from commit `01cf3ab`.
