import { useMemo } from 'react'
import type { InspectorRelease } from '../../economic-calendar/releases/release'
import { groupInspectorReleases } from '../../inspector/releases/group-releases'
import { useHighlights } from './useHighlights'
import { highlightForRelease } from './highlight-model'

export function InspectorPin({ release, brokerId }: { release: InspectorRelease; brokerId: string | null }) {
  const highlights = useHighlights(brokerId)
  const choices = useMemo(() => release.daily ? groupInspectorReleases(release.events) : [release], [release])
  const action = (item: InspectorRelease) => {
    const pinned = highlightForRelease(highlights.items, item)
    return <button type="button" disabled={!brokerId || highlights.busy} aria-pressed={!!pinned}
      aria-label={`${pinned ? 'Archive' : 'Pin'} ${item.currency} ${item.label}`} onClick={() => void (pinned ? highlights.archive(pinned.id) : highlights.pin(item))}>
      {pinned ? 'Archive' : 'Pin'}{release.daily && ` · ${item.label}`}</button>
  }
  return <div className="inspector-pin">
    {release.daily ? <details><summary>Pin release</summary><div className="inspector-pin-menu">{choices.map(item => <div key={item.id}>{action(item)}</div>)}</div></details> : action(release)}
    {highlights.error && <span role="status">{highlights.error}</span>}
  </div>
}
