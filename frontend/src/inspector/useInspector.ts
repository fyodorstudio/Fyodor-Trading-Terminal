import { useCallback, useMemo, useState } from 'react'
import type { EconomicCalendarEvent } from '../economic-calendar/contracts/calendar-event'
import type { ChartTimeframe } from '../market-data/contracts/ChartTimeframe'
import type { OhlcBar } from '../market-data/contracts/OhlcBar'
import type { TimeDisplayPreference } from '../appearance/time-display/time-display-preference'
import { displayDateKey, displayWeekDateKeys } from '../economic-calendar/time/calendar-display-range'
import { inspectorDisplayRange, inspectorRangeDates, type InspectorRangePreset } from './inspector-date-range'
import { buildInspectorMarkers } from './chart/build-markers'
import { filterInspectorReleases } from './filters/filter-releases'
import { groupInspectorReleases } from './releases/group-releases'
import { groupInspectorDays, selectedInspectorRelease } from './releases/group-days'
import { inspectorPreferenceKey, readInspectorPreferences, supportsInspector, type InspectorPreferences, type InspectorPreferenceUpdate } from './preferences/inspector-preferences'
import { forexPairCurrencies as inspectorPairCurrencies } from '../economic-calendar/forex/pairs'
import { createInspectorReadingSelector } from '../economic-calendar/forex/select-pair-readings'
import { useStoredCalendar } from '../economic-calendar/storage/useStoredCalendar'
import { policyEpisodeWindowMs } from './episodes/policy-episodes'
import { ismEpisodeWindowMs } from './episodes/ism-episodes'
import { groupPmiEpisodes } from './episodes/pmi-episodes'
import { useMarkerBars } from './chart/useMarkerBars'

import { useCalendarNow } from './useCalendarNow'
import { chartClockToUtc, utcToChartClock } from '../appearance/time-display/chart-clock'

const noEvents: EconomicCalendarEvent[] = []

export function useInspector({ events = noEvents, symbol, bars, timeframe, timeDisplay, clockOffsetMs, brokerId, brokerOffsetSeconds = 0 }: {
  events?: EconomicCalendarEvent[]; symbol: string; bars: OhlcBar[]; timeframe: ChartTimeframe
  timeDisplay: TimeDisplayPreference; clockOffsetMs: number
  brokerId?: string | null; brokerOffsetSeconds?: number
}) {
  const brokerTime = brokerId !== undefined
  const rangeDisplay = timeDisplay
  const preferenceKey = inspectorPreferenceKey(symbol)
  const [savedPairKey, setSavedPairKey] = useState(preferenceKey)
  const [preferences, setPreferences] = useState(() => readInspectorPreferences(symbol))
  const [storageFailed, setStorageFailed] = useState(false)
  const [rangePreset, setRangePreset] = useState<InspectorRangePreset>('year-window')
  const now = useCalendarNow(clockOffsetMs)
  const initialWeek = displayWeekDateKeys(displayDateKey(now, rangeDisplay))
  const [customFrom, setCustomFrom] = useState(initialWeek.start)
  const [customTo, setCustomTo] = useState(initialWeek.end)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  if (savedPairKey !== preferenceKey) {
    setSavedPairKey(preferenceKey); setPreferences(readInspectorPreferences(symbol)); setSelectedId(null); setStorageFailed(false)
  }
  const supported = supportsInspector(symbol)
  const today = displayDateKey(now, rangeDisplay)
  const rangeDates = useMemo(() => inspectorRangeDates(rangePreset, today, customFrom, customTo), [rangePreset, today, customFrom, customTo])
  const range = useMemo(() => inspectorDisplayRange(rangeDates, rangeDisplay), [rangeDates, rangeDisplay])
  const selectCustomRange = useCallback((from: string, to: string) => {
    if (!inspectorDisplayRange({ from, to }, rangeDisplay)) return
    setCustomFrom(from); setCustomTo(to); setRangePreset('custom')
  }, [rangeDisplay])
  // Fetch neighboring days so monthly ISM reports and policy companions stay
  // together even when the visible range contains only one publication.
  const storageRange = useMemo(() => {
    if (!range) return null
    const margin = Math.max(policyEpisodeWindowMs,ismEpisodeWindowMs), scope = { brokerId: brokerId ?? null, brokerOffsetSeconds }
    const from = utcToChartClock(range.from - margin, scope), to = utcToChartClock(range.to + margin, scope)
    return from === null || to === null ? null : { from, to }
  }, [range, brokerId, brokerOffsetSeconds])
  const currencies = inspectorPairCurrencies(symbol)
  const storage = useStoredCalendar(brokerId, storageRange, supported && brokerTime, { currencies })
  const readings = useMemo(() => brokerTime ? storage.events.filter((event) => event.availability === 'observed') : events,
    [brokerTime, storage.events, events])
  const selectPairReadings = useMemo(() => createInspectorReadingSelector(currencies), [currencies])
  const pairReadings = useMemo(() => selectPairReadings(readings), [readings, selectPairReadings])
  const allReleases = useMemo(() => groupInspectorReleases(pairReadings), [pairReadings])
  const displayReleases = useMemo(() => groupPmiEpisodes(allReleases), [allReleases])
  const releaseGroups = useMemo(() => supported ? filterInspectorReleases(displayReleases, preferences, range, false,
    release => chartClockToUtc(release.serverTime * 1000, { brokerId: brokerId ?? null, brokerOffsetSeconds })) : [],
    [supported, displayReleases, preferences, range, brokerId, brokerOffsetSeconds])
  const dailyPublications = useMemo(() => preferences.symbolGrouping === 'day' ? groupInspectorReleases(pairReadings, false) : [],
    [pairReadings, preferences.symbolGrouping])
  const days = useMemo(() => supported ? groupInspectorDays(dailyPublications, preferences.families, range, timeDisplay,
    { brokerId: brokerId ?? null, brokerOffsetSeconds }) : [], [supported, dailyPublications, preferences.families, range, timeDisplay, brokerId, brokerOffsetSeconds])
  const releases = preferences.symbolGrouping === 'day' ? days : releaseGroups
  const markerBars = useMarkerBars(bars)
  const markers = useMemo(() => buildInspectorMarkers(releases, preferences, markerBars, timeframe), [releases, preferences, markerBars, timeframe])
  const selectRelease = useCallback((id: string | null) => setSelectedId(id), [])
  const selectedRelease = selectedInspectorRelease(releases, displayReleases, selectedId, timeDisplay)
  const applyPreferences = useCallback((next: InspectorPreferences, mode: InspectorPreferenceUpdate = 'save') => {
    const normalized = { ...next, symbolGrouping: next.symbolGrouping === 'day' ? 'day' as const : 'release' as const,
    }
    setPreferences(normalized)
    if (mode === 'preview') return
    try { localStorage.setItem(preferenceKey, JSON.stringify(normalized)); setStorageFailed(false) }
    catch { setStorageFailed(true) }
  }, [preferenceKey])
  return useMemo(() => ({ supported, preferences, applyPreferences, storageFailed, rangePreset, setRangePreset, customFrom, setCustomFrom,
    customTo, setCustomTo, range, rangeDates, today, selectCustomRange, allReleases, releases, markers, selectedRelease, selectRelease, now,
    markerBars, brokerTime, brokerOffsetSeconds, brokerId, storage }),
    [supported, preferences, applyPreferences, storageFailed, rangePreset, customFrom, customTo, range, rangeDates, today,
      selectCustomRange, allReleases, releases, markers, selectedRelease, selectRelease, now, markerBars, brokerTime, brokerOffsetSeconds, brokerId, storage])
}
export type InspectorView = ReturnType<typeof useInspector>
