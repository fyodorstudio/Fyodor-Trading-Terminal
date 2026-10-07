import { useCallback, useMemo, useState } from 'react'
import type { EconomicCalendarEvent } from './calendar-event'
import type { ChartTimeframe } from '../market-data/contracts/ChartTimeframe'
import type { OhlcBar } from '../market-data/contracts/OhlcBar'
import type { TimeDisplayPreference } from '../appearance/time-display/time-display-preference'
import { displayDateKey, displayWeekDateKeys } from './calendar-display-range'
import { inspectorDisplayRange, inspectorRangeDates, type InspectorRangePreset } from './inspector-date-range'
import { buildInspectorMarkers, filterInspectorReleases, groupInspectorReleases, inspectorStorageKey,
  readInspectorPreferences, supportsInspector, type InspectorPreferences, type InspectorPreferenceUpdate } from './inspector-data'
import { useStoredCalendar } from './useStoredCalendar'
import { useFamilyMagnitudeHistory } from './magnitude/useFamilyMagnitudeHistory'
import { policyEpisodeWindowMs } from './episodes/policy-episodes'
import { groupIsmEpisodes, ismEpisodeWindowMs } from './episodes/ism-episodes'
import { groupPmiEpisodes } from './episodes/pmi-episodes'
import { episodePublications } from './episodes/display-episodes'
import { useMarkerBars } from './chart/useMarkerBars'

import { normalizeInspectorDetailView } from './inspector-detail-view'
import { useCalendarNow } from './useCalendarNow'
import { usePublicationInspection } from './releases/usePublicationInspection'

const noEvents: EconomicCalendarEvent[] = []

export function useInspector({ events = noEvents, symbol, bars, timeframe, timeDisplay, clockOffsetMs, brokerId, brokerOffsetSeconds = 0, detailOpen = true }: {
  events?: EconomicCalendarEvent[]; symbol: string; bars: OhlcBar[]; timeframe: ChartTimeframe
  timeDisplay: TimeDisplayPreference; clockOffsetMs: number
  brokerId?: string | null; brokerOffsetSeconds?: number; detailOpen?: boolean
}) {
  const brokerTime = brokerId !== undefined
  const rangeDisplay = useMemo<TimeDisplayPreference>(() => brokerTime ? { mode: 'utc', utcOffsetMinutes: 0 } : timeDisplay, [brokerTime, timeDisplay])
  const [preferences, setPreferences] = useState(readInspectorPreferences)
  const [storageFailed, setStorageFailed] = useState(false)
  const [rangePreset, setRangePreset] = useState<InspectorRangePreset>('year-to-date')
  const now = useCalendarNow(clockOffsetMs)
  const initialWeek = displayWeekDateKeys(displayDateKey(now + (brokerTime ? brokerOffsetSeconds * 1000 : 0), rangeDisplay))
  const [customFrom, setCustomFrom] = useState(initialWeek.start)
  const [customTo, setCustomTo] = useState(initialWeek.end)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const supported = supportsInspector(symbol)
  const today = displayDateKey(now + (brokerTime ? brokerOffsetSeconds * 1000 : 0), rangeDisplay)
  const rangeDates = useMemo(() => inspectorRangeDates(rangePreset, today, customFrom, customTo), [rangePreset, today, customFrom, customTo])
  const range = useMemo(() => inspectorDisplayRange(rangeDates, rangeDisplay), [rangeDates, rangeDisplay])
  const selectCustomRange = useCallback((from: string, to: string) => {
    if (!inspectorDisplayRange({ from, to }, rangeDisplay)) return
    setCustomFrom(from); setCustomTo(to); setRangePreset('custom')
  }, [rangeDisplay])
  // Fetch neighboring days so monthly ISM reports and policy companions stay
  // together even when the visible range contains only one publication.
  const storageRange = useMemo(() => range ? { from: range.from - Math.max(policyEpisodeWindowMs, ismEpisodeWindowMs),
    to: range.to + Math.max(policyEpisodeWindowMs, ismEpisodeWindowMs) } : null, [range])
  const storage = useStoredCalendar(brokerId, storageRange, supported && brokerTime)
  const readings = useMemo(() => brokerTime ? storage.events.filter((event) => event.availability === 'observed') : events,
    [brokerTime, storage.events, events])
  const allReleases = useMemo(() => groupInspectorReleases(readings), [readings])
  const displayReleases = useMemo(() => groupPmiEpisodes(groupIsmEpisodes(allReleases)), [allReleases])
  const releases = useMemo(() => supported ? filterInspectorReleases(displayReleases, preferences, range, brokerTime) : [],
    [supported, displayReleases, preferences, range, brokerTime])
  const markerBars = useMarkerBars(bars)
  const markers = useMemo(() => buildInspectorMarkers(releases, preferences, markerBars, timeframe), [releases, preferences, markerBars, timeframe])
  const inspection = usePublicationInspection(symbol, brokerId, displayReleases, supported)
  const { inspectPublication, clearPublicationInspection, inspectingPublication, inspectedRelease, publicationLoading, publicationError } = inspection
  const selectRelease = useCallback((id: string | null) => {
    clearPublicationInspection(); setSelectedId(id)
  }, [clearPublicationInspection])
  const selectedRelease = inspectingPublication ? inspectedRelease :
    releases.find((release) => release.id === selectedId || episodePublications(release)?.some(r => r.id === selectedId)) ?? null
  const needsMagnitude = detailOpen && preferences.detailView === 'table'
  // PMI table sections own their original per-country magnitude histories.
  const magnitudeRelease = needsMagnitude && !selectedRelease?.pmiPublications ? selectedRelease?.ismPublications?.[0] ?? selectedRelease : null
  const magnitudeHistory = useFamilyMagnitudeHistory(brokerId, magnitudeRelease, undefined, clockOffsetMs)
  const applyPreferences = useCallback((next: InspectorPreferences, mode: InspectorPreferenceUpdate = 'save') => {
    const normalized = { ...next, detailView: normalizeInspectorDetailView(next.detailView) }
    setPreferences(normalized)
    if (mode === 'preview') return
    // View controls must not accidentally persist live, unsaved filter edits.
    const saved = mode === 'view' ? { ...readInspectorPreferences(), detailView: normalized.detailView, showHistograms: normalized.showHistograms } : normalized
    try { localStorage.setItem(inspectorStorageKey, JSON.stringify(saved)); setStorageFailed(false) }
    catch { setStorageFailed(true) }
  }, [])
  return useMemo(() => ({ supported, preferences, applyPreferences, storageFailed, rangePreset, setRangePreset, customFrom, setCustomFrom,
    customTo, setCustomTo, range, rangeDates, today, selectCustomRange, allReleases, releases, markers, selectedRelease, selectRelease, now,
    markerBars, brokerTime, brokerOffsetSeconds, brokerId, storage, magnitudeHistory,
    inspectPublication, inspectingPublication, publicationLoading, publicationError }),
    [supported, preferences, applyPreferences, storageFailed, rangePreset, customFrom, customTo, range, rangeDates, today,
      selectCustomRange, allReleases, releases, markers, selectedRelease, selectRelease, now, markerBars, brokerTime, brokerOffsetSeconds, brokerId, storage, magnitudeHistory,
      inspectPublication, inspectingPublication, publicationLoading, publicationError])
}
export type InspectorView = ReturnType<typeof useInspector>
