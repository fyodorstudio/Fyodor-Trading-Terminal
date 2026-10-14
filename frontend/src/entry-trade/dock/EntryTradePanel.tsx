import { useEntryTradePlan } from './useEntryTradePlan'
import type { EntryTradePanelProps } from './entry-trade-panel-contract'
import { ExecutionPlanColumn } from './ExecutionPlanColumn'
import { PinnedArrowsColumn } from './PinnedArrowsColumn'
import { JournalColumn } from './JournalColumn'
import './entry-trade-panel.css'

export function EntryTradePanel(props: EntryTradePanelProps) {
  const view = useEntryTradePlan(props)
  return <section className="entry-trade-panel" aria-label="Entry Trade">
    <ExecutionPlanColumn view={view} />
    <PinnedArrowsColumn view={view} />
    <JournalColumn view={view} />
  </section>
}
