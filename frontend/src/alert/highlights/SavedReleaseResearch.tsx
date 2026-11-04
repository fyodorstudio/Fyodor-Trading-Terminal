import type { Highlight } from './highlight-model'
import { HighlightJournal } from './HighlightJournal'
import './saved-release-research.css'

export function SavedReleaseResearch({ item }: { item: Highlight }) {
  return <div className="alert-saved-research">
    {!item.journal?.length && <p>No saved research for this pin.</p>}
    {[...new Set(item.journal?.map(entry => entry.scope))].map(scope =>
      <HighlightJournal key={scope} item={item} scope={scope} />)}
  </div>
}
