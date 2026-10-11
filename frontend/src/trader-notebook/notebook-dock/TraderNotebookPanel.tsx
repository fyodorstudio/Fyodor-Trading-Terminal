import { useNotebookPlan } from './useNotebookPlan'
import type { TraderNotebookPanelProps } from './notebook-panel-contract'
import { ExecutionPlanColumn } from './ExecutionPlanColumn'
import { PinnedArrowsColumn } from './PinnedArrowsColumn'
import { JournalColumn } from './JournalColumn'
import './trader-notebook-panel.css'

export function TraderNotebookPanel(props: TraderNotebookPanelProps) {
  const view = useNotebookPlan(props)
  return <section className="trader-notebook-panel" aria-label="Trader Notebook & Execution Planner">
    <ExecutionPlanColumn view={view} />
    <PinnedArrowsColumn view={view} />
    <JournalColumn view={view} />
  </section>
}
