import type { InspectorRelease } from '../../economic-calendar/releases/release'
import { useHighlights } from './useHighlights'
import { HighlightJournal } from './HighlightJournal'
import { useAlertImpact } from '../impact/useAlertImpact'
import { ImpactDetails } from '../impact/ImpactBadge'
import './saved-release-research.css'

export function SavedReleaseResearch({ sourceId, valueIds, currency, events = [] }: { sourceId: string; valueIds: string[]; currency: string; events?: InspectorRelease['events'] }) {
  const current = useHighlights(sourceId, 0, 'all'), legacy = useHighlights('Elev8-Demo2', 0, 'all')
  const impact = useAlertImpact(sourceId), legacyImpact = useAlertImpact('Elev8-Demo2')
  const matches = [...current.items, ...legacy.items].filter(item => item.currency === currency && item.journal?.length && (
    item.source_id === sourceId ? item.value_ids.some(id => valueIds.includes(id)) : item.events.some(old => events.some(event =>
      old.value_id === event.value_id && old.event_id === event.event_id && old.currency === event.currency && old.country_code === event.country_code
      && old.period_seconds === event.period_seconds && old.time_mode === event.time_mode && old.release_at !== null && old.release_at === event.release_at))))
  return <div className="alert-saved-research">
    {(current.error || legacy.error) && <p role="status">{current.error ?? legacy.error}</p>}
    {!matches.length && <p>No saved research for this release.</p>}
    {matches.map(item => <section key={item.id}><h4>Saved research · {item.source_id}</h4><p>Original source and captured expectations are preserved. These are dated assessments.</p>
      <ImpactDetails item={(item.source_id === sourceId ? impact : legacyImpact).byKey.get(`highlight:${item.source_id}:${item.id}`)} />
      {[...new Set(item.journal?.map(entry => entry.scope))].map(scope => <HighlightJournal key={scope} item={item} scope={scope} />)}
    </section>)}
  </div>
}
