# Trader Notebook

| Folder | Responsibility |
| --- | --- |
| `notebook-dock/` | Three-column panel, plan state, sizing and pure plan arithmetic |
| `contracts/` | Notebook and registered-arrow records |
| `storage/` | Saved registered arrows and subscriptions |
| `workflow/` | Trade workflow and captured economic context |
| `chart-levels/` | Planned trade price lines |

Start at `notebook-dock/TraderNotebookPanel.tsx`, then `useNotebookPlan.ts` for
state or `plan-math.ts` for arithmetic. The columns are Execution plan, Pinned
arrows and Journal. Chart selection/navigation is wired by the
[terminal shell](../terminal-shell/README.md).

Notebook captures are manual records; they do not add economic scoring votes.
Preserve stored records, registered-arrow selection and draft/registered price
levels. Workspace validation/export is owned by
[workspace portability](../workspace-portability/README.md).
