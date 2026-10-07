import { useCallback, useMemo, useState } from 'react'
import type { InspectorRelease } from '../inspector-data'
import { groupInspectorReleases } from '../inspector-data'
import { groupIsmEpisodes, ismEpisodeWindowMs } from '../episodes/ism-episodes'
import { groupPmiEpisodes } from '../episodes/pmi-episodes'
import { policyEpisodeWindowMs } from '../episodes/policy-episodes'
import { episodePublications } from '../episodes/display-episodes'
import { useStoredCalendar } from '../useStoredCalendar'

const findPublication = (releases: readonly InspectorRelease[], id: string) =>
  releases.find(r => r.id === id || episodePublications(r)?.some(p => p.id === id)) ?? null

/** Inspect a source without changing the marker calendar, filters, or saved view. */
export function usePublicationInspection(symbol: string, brokerId: string | null | undefined,
  releases: readonly InspectorRelease[], supported: boolean) {
  const scope = useMemo(() => ({ symbol, brokerId }), [symbol, brokerId])
  const [selection, setSelection] = useState<{ scope: object; id: string; at: number } | null>(null)
  const target = selection?.scope === scope ? selection : null
  if (selection && !target) setSelection(null)
  const local = target ? findPublication(releases, target.id) : null
  const range = useMemo(() => {
    if (!target || local) return null
    const margin = Math.max(policyEpisodeWindowMs, ismEpisodeWindowMs)
    return { from: target.at - margin, to: target.at + margin }
  }, [target, local])
  // Hidden/out-of-range sources in Combo details get an isolated detail query.
  // These rows never replace the marker query or broaden its date range.
  const storage = useStoredCalendar(brokerId, range, supported && !!target && !local)
  const fetched = useMemo(() => groupPmiEpisodes(groupIsmEpisodes(groupInspectorReleases(
    storage.events.filter(e => e.availability === 'observed')))), [storage.events])
  const release = local ?? (target ? findPublication(fetched, target.id) : null)
  const inspectPublication = useCallback((id: string, at: number) => {
    setSelection({ scope, id, at })
  }, [scope])
  const clearPublicationInspection = useCallback(() => setSelection(null), [])
  return { inspectPublication, clearPublicationInspection, inspectingPublication: !!target,
    inspectedRelease: release, publicationLoading: storage.loading, publicationError: storage.error }
}
