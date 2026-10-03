import { useMemo, useRef, useState } from 'react'
import { snapshotAround, type ResearchAuditData } from '../audit-data'
import { timelineManifest, type CpiTimelineEpisodePayload } from './cpi-event-timeline-data'
import { buildEventMarkers, containingEventBar, eventsInWindow, groupTimelineEvents, isEventSymbol,
  type EventSymbol } from './timeline-event-view'
import { defaultFamilySymbol, type FamilyWatchlist } from './timeline-event-families'
import { buildFamilyOptions, defaultCurrencySides, defaultEventFamilies, eventCurrencySide, eventFamilyKey,
  isCurrencySide, isFamilySelection, type EventCurrencySide } from './timeline-event-filters'

type MarkerPreferences = {
  families: Record<string, EventSymbol>
  episodes: Record<string, Record<string, EventSymbol>>
  watchlist: FamilyWatchlist
  shortlist: string[]
  currencySides: EventCurrencySide[]
}
const storageKey = `fyodor_timeline_symbols_v1:${timelineManifest.reviewedSourceManifestSha256}`
const noSelections: Record<string, EventSymbol> = {}

function readPreferences(): MarkerPreferences {
  const empty: MarkerPreferences = { families: {}, episodes: {}, watchlist: [...defaultEventFamilies],
    shortlist: [...defaultEventFamilies], currencySides: [...defaultCurrencySides] }
  try {
    const value = JSON.parse(localStorage.getItem(storageKey) ?? '{}')
    const families = Object.fromEntries(Object.entries(value.families ?? {}).filter(([, symbol]) => isEventSymbol(symbol))) as Record<string, EventSymbol>
    const episodes: MarkerPreferences['episodes'] = {}
    for (const [episode, selections] of Object.entries(value.episodes ?? {})) {
      if (!selections || typeof selections !== 'object') continue
      episodes[episode] = Object.fromEntries(Object.entries(selections).filter(([, symbol]) => isEventSymbol(symbol))) as Record<string, EventSymbol>
    }
    const watchlist = value.watchlist === null ? null : Array.isArray(value.watchlist) ?
      [...new Set(value.watchlist.filter(isFamilySelection))] as string[] : [...defaultEventFamilies]
    const shortlist = watchlist ?? (Array.isArray(value.shortlist) ?
      [...new Set(value.shortlist.filter(isFamilySelection))] as string[] : [...defaultEventFamilies])
    const currencySides = Array.isArray(value.currencySides) ? [...new Set(value.currencySides.filter(isCurrencySide))] as EventCurrencySide[] :
      [...defaultCurrencySides]
    return { families, episodes, watchlist, shortlist, currencySides }
  } catch { return empty }
}

export function useTimelineEventAnnotations(payload: CpiTimelineEpisodePayload | null,
  data: ResearchAuditData | null, priorBars: number) {
  const [afterBars, setAfterBars] = useState<60 | 120 | 240>(240)
  const [preferences, setPreferences] = useState<MarkerPreferences>(readPreferences)
  const preferencesRef = useRef(preferences)
  const [storageFailed, setStorageFailed] = useState(false)
  const [focusedSelection, setFocusedSelection] = useState<{ episodeId: string; id: string | null } | null>(null)
  const [previousEpisodeId, setPreviousEpisodeId] = useState(payload?.episodeId)
  if (previousEpisodeId !== payload?.episodeId) {
    setPreviousEpisodeId(payload?.episodeId)
    setFocusedSelection(null)
  }
  const focusedGroupId = focusedSelection?.episodeId === payload?.episodeId ? focusedSelection?.id ?? null : null
  function setFocusedGroupId(id: string | null) {
    setFocusedSelection({ episodeId: payload?.episodeId ?? '', id })
  }
  const auditBars = useMemo(() => {
    const entry = payload?.cpiBlock.entryTimestamp
    if (!data || !entry) return null
    try { return snapshotAround(data, entry, afterBars, priorBars) }
    catch { return null }
  }, [data, payload, afterBars, priorBars])
  const allGroups = useMemo(() => payload ? groupTimelineEvents(payload.surroundingBlocks,
    payload.releaseTimestamp) : [], [payload])
  const windowGroups = useMemo(() => eventsInWindow(allGroups, auditBars ?? []), [allGroups, auditBars])
  const currencyGroups = useMemo(() => windowGroups.filter((group) => preferences.currencySides.includes(eventCurrencySide(group.currency))),
    [windowGroups, preferences.currencySides])
  const familyOptions = useMemo(() => buildFamilyOptions(windowGroups, preferences.shortlist), [windowGroups, preferences.shortlist])
  const groups = useMemo(() => currencyGroups.filter((group) => preferences.watchlist === null ||
    preferences.watchlist.includes(eventFamilyKey(group))), [currencyGroups, preferences.watchlist])
  const storedSelections = preferences.episodes[payload?.episodeId ?? ''] ?? noSelections
  const selected = useMemo(() => Object.fromEntries(allGroups.flatMap((group) => {
    const symbol = storedSelections[group.id] ?? group.legacyIds.map((id) => storedSelections[id]).find(Boolean)
    return symbol ? [[group.id, symbol]] : []
  })) as Record<string, EventSymbol>, [allGroups, storedSelections])
  // Filters control both views, keeping hidden choices intact for restoration.
  const allMarkers = useMemo(() => buildEventMarkers(windowGroups, selected, auditBars ?? []), [windowGroups, selected, auditBars])
  const markers = useMemo(() => {
    const visible = new Set(groups.map((group) => group.id))
    return allMarkers.filter((marker) => visible.has(marker.group.id))
  }, [allMarkers, groups])
  const selectedGroups = useMemo(() => groups.filter((group) => selected[group.id]), [groups, selected])
  const familySymbols = useMemo(() => {
    const symbols = { ...preferences.families }
    for (const group of allGroups) {
      const key = eventFamilyKey(group)
      if (symbols[key]) continue
      const legacySymbol = [group.family, ...group.legacyIds.map((id) => JSON.parse(id)[0] as string)]
        .map((family) => symbols[family]).find(Boolean)
      if (legacySymbol) symbols[key] = legacySymbol
    }
    return symbols
  }, [allGroups, preferences.families])

  function savePreferences(next: MarkerPreferences) {
    preferencesRef.current = next
    setPreferences(next)
    try { localStorage.setItem(storageKey, JSON.stringify(next)); setStorageFailed(false) }
    catch { setStorageFailed(true) }
  }

  function setEventSymbol(groupId: string, family: string, symbol: EventSymbol, show: boolean) {
    if (!payload) return
    // Use the latest pending preferences even when several controls update in
    // one React batch. Storage writes happen in the event, never during render.
    const previous = preferencesRef.current
    const episode = { ...previous.episodes[payload.episodeId] }
    const group = allGroups.find((candidate) => candidate.id === groupId)
    for (const id of group?.legacyIds ?? []) delete episode[id]
    if (show) episode[groupId] = symbol
    else delete episode[groupId]
    const next = { ...previous, families: { ...previous.families, [family]: symbol,
      ...(group ? { [eventFamilyKey(group)]: symbol } : {}) },
      episodes: { ...previous.episodes, [payload.episodeId]: episode } }
    savePreferences(next)
  }

  function applyFamilies(watchlist: FamilyWatchlist, symbols: Record<string, EventSymbol>, mark = false,
    filter?: { currencySides: EventCurrencySide[]; shortlist: string[] }) {
    const previous = preferencesRef.current
    const currencySides = filter?.currencySides ?? previous.currencySides
    const shortlist = filter?.shortlist ?? watchlist ?? previous.shortlist
    const episodes = { ...previous.episodes }
    if (mark && payload) {
      const episode = { ...episodes[payload.episodeId] }
      for (const group of windowGroups) {
        if (!currencySides.includes(eventCurrencySide(group.currency))) continue
        if (watchlist !== null && !watchlist.includes(eventFamilyKey(group))) continue
        if (group.timingUncertain || containingEventBar(group.releaseTimestamp, auditBars ?? []) === null) continue
        for (const id of group.legacyIds) delete episode[id]
        episode[group.id] = symbols[eventFamilyKey(group)] ?? selected[group.id] ??
          familySymbols[eventFamilyKey(group)] ?? familySymbols[group.family] ?? defaultFamilySymbol(group.familyId)
      }
      episodes[payload.episodeId] = episode
    }
    savePreferences({ families: { ...previous.families, ...symbols }, episodes,
      watchlist: watchlist === null ? null : [...watchlist], shortlist: [...shortlist], currencySides: [...currencySides] })
    setFocusedGroupId(null)
  }

  return { auditBars, afterBars, setAfterBars, groups, windowGroups, markers, selected,
    selectedGroups, watchlist: preferences.watchlist, shortlist: preferences.shortlist,
    currencySides: preferences.currencySides, familyOptions, currencyGroups, applyFamilies,
    hiddenMarkerCount: allMarkers.length - markers.length, familySymbols, setEventSymbol, storageFailed,
    focusedGroupId, setFocusedGroupId }
}
export type TimelineEventAnnotations = ReturnType<typeof useTimelineEventAnnotations>
