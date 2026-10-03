import { useMemo, useRef, useState } from 'react'
import { snapshotAround, type ResearchAuditData } from '../audit-data'
import { timelineManifest, type CpiTimelineEpisodePayload } from './cpi-event-timeline-data'
import { buildEventMarkers, eventsInWindow, groupTimelineEvents, isEventSymbol,
  type EventSymbol } from './timeline-event-view'

type MarkerPreferences = {
  families: Record<string, EventSymbol>
  episodes: Record<string, Record<string, EventSymbol>>
}
const storageKey = `fyodor_timeline_symbols_v1:${timelineManifest.reviewedSourceManifestSha256}`
const noSelections: Record<string, EventSymbol> = {}

function readPreferences(): MarkerPreferences {
  const empty = { families: {}, episodes: {} }
  try {
    const value = JSON.parse(localStorage.getItem(storageKey) ?? '{}')
    const families = Object.fromEntries(Object.entries(value.families ?? {}).filter(([, symbol]) => isEventSymbol(symbol))) as Record<string, EventSymbol>
    const episodes: MarkerPreferences['episodes'] = {}
    for (const [episode, selections] of Object.entries(value.episodes ?? {})) {
      if (!selections || typeof selections !== 'object') continue
      episodes[episode] = Object.fromEntries(Object.entries(selections).filter(([, symbol]) => isEventSymbol(symbol))) as Record<string, EventSymbol>
    }
    return { families, episodes }
  } catch { return empty }
}

export function useTimelineEventAnnotations(payload: CpiTimelineEpisodePayload | null,
  data: ResearchAuditData | null, priorBars: number) {
  const [afterBars, setAfterBars] = useState<60 | 120 | 240>(240)
  const [preferences, setPreferences] = useState<MarkerPreferences>(readPreferences)
  const preferencesRef = useRef(preferences)
  const [storageFailed, setStorageFailed] = useState(false)
  const [focusedGroupId, setFocusedGroupId] = useState<string | null>(null)
  const [familyFilter, setFamilyFilter] = useState('ALL')
  const [currencyFilter, setCurrencyFilter] = useState('ALL')
  const auditBars = useMemo(() => {
    const entry = payload?.cpiBlock.entryTimestamp
    if (!data || !entry) return null
    try { return snapshotAround(data, entry, afterBars, priorBars) }
    catch { return null }
  }, [data, payload, afterBars, priorBars])
  const allGroups = useMemo(() => payload ? groupTimelineEvents(payload.surroundingBlocks,
    payload.releaseTimestamp) : [], [payload])
  const windowGroups = useMemo(() => eventsInWindow(allGroups, auditBars ?? []), [allGroups, auditBars])
  const groups = useMemo(() => windowGroups.filter((group) =>
    (familyFilter === 'ALL' || group.family === familyFilter) &&
    (currencyFilter === 'ALL' || group.currency === currencyFilter)), [windowGroups, familyFilter, currencyFilter])
  const selected = preferences.episodes[payload?.episodeId ?? ''] ?? noSelections
  const markers = useMemo(() => buildEventMarkers(groups, selected, auditBars ?? []), [groups, selected, auditBars])

  function setEventSymbol(groupId: string, family: string, symbol: EventSymbol, show: boolean) {
    if (!payload) return
    // Use the latest pending preferences even when several controls update in
    // one React batch. Storage writes happen in the event, never during render.
    const previous = preferencesRef.current
    const episode = { ...previous.episodes[payload.episodeId] }
    if (show) episode[groupId] = symbol
    else delete episode[groupId]
    const next = { families: { ...previous.families, [family]: symbol },
      episodes: { ...previous.episodes, [payload.episodeId]: episode } }
    preferencesRef.current = next
    setPreferences(next)
    try { localStorage.setItem(storageKey, JSON.stringify(next)); setStorageFailed(false) }
    catch { setStorageFailed(true) }
  }

  return { auditBars, afterBars, setAfterBars, groups, windowGroups, markers, selected,
    familySymbols: preferences.families, setEventSymbol, storageFailed,
    focusedGroupId, setFocusedGroupId, familyFilter, setFamilyFilter, currencyFilter, setCurrencyFilter }
}
export type TimelineEventAnnotations = ReturnType<typeof useTimelineEventAnnotations>
