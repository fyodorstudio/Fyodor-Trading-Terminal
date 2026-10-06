import { useEffect, useMemo, useState } from 'react'
import type { EconomicCalendarEvent } from './calendar-event'
import type { ChartTimeframe } from '../market-data/contracts/ChartTimeframe'
import type { OhlcBar } from '../market-data/contracts/OhlcBar'
import type { TimeDisplayPreference } from '../appearance/time-display/time-display-preference'
import { displayDateKey, displayWeekDateKeys } from './calendar-display-range'
import { inspectorDisplayRange, inspectorRangeDates, type InspectorRangePreset } from './inspector-date-range'
import { buildInspectorMarkers, filterInspectorReleases, groupInspectorReleases, inspectorStorageKey,
  readInspectorPreferences, supportsInspector, type InspectorPreferences } from './inspector-data'
import { useStoredCalendar } from './useStoredCalendar'
import { useFamilyMagnitudeHistory } from './magnitude/useFamilyMagnitudeHistory'
import { policyEpisodeWindowMs } from './episodes/policy-episodes'
import { groupIsmEpisodes, ismEpisodeWindowMs } from './episodes/ism-episodes'

const noEvents: EconomicCalendarEvent[] = []

export function useInspector({ events = noEvents, symbol, bars, timeframe, timeDisplay, clockOffsetMs, brokerId, brokerOffsetSeconds = 0 }: {
  events?: EconomicCalendarEvent[]; symbol: string; bars: OhlcBar[]; timeframe: ChartTimeframe
  timeDisplay: TimeDisplayPreference; clockOffsetMs: number
  brokerId?: string | null; brokerOffsetSeconds?: number
}) {
  const brokerTime = brokerId !== undefined
  const rangeDisplay = useMemo<TimeDisplayPreference>(() => brokerTime ? { mode: 'utc', utcOffsetMinutes: 0 } : timeDisplay, [brokerTime, timeDisplay])
  const [preferences, setPreferences] = useState(readInspectorPreferences)
  const [storageFailed, setStorageFailed] = useState(false)
  const [rangePreset, setRangePreset] = useState<InspectorRangePreset>('this-week')
  const [now, setNow] = useState(() => Date.now() + clockOffsetMs)
  const initialWeek = displayWeekDateKeys(displayDateKey(now + (brokerTime ? brokerOffsetSeconds * 1000 : 0), rangeDisplay))
  const [customFrom, setCustomFrom] = useState(initialWeek.start)
  const [customTo, setCustomTo] = useState(initialWeek.end)
  const [selectedId, selectRelease] = useState<string | null>(null)
  useEffect(() => {
    const update = () => setNow(Date.now() + clockOffsetMs)
    update()
    const timer = window.setInterval(update, 10_000)
    return () => window.clearInterval(timer)
  }, [clockOffsetMs])
  const supported = supportsInspector(symbol)
  const today = displayDateKey(now + (brokerTime ? brokerOffsetSeconds * 1000 : 0), rangeDisplay)
  const rangeDates = useMemo(() => inspectorRangeDates(rangePreset, today, customFrom, customTo), [rangePreset, today, customFrom, customTo])
  const range = useMemo(() => inspectorDisplayRange(rangeDates, rangeDisplay), [rangeDates, rangeDisplay])
  function selectCustomRange(from: string, to: string) {
    if (!inspectorDisplayRange({ from, to }, rangeDisplay)) return
    setCustomFrom(from); setCustomTo(to); setRangePreset('custom')
  }
  // Fetch neighboring days so monthly ISM reports and policy companions stay
  // together even when the visible range contains only one publication.
  const storageRange = useMemo(() => range ? { from: range.from - Math.max(policyEpisodeWindowMs, ismEpisodeWindowMs),
    to: range.to + Math.max(policyEpisodeWindowMs, ismEpisodeWindowMs) } : null, [range])
  const storage = useStoredCalendar(brokerId, storageRange, supported && brokerTime)
  const readings = useMemo(() => brokerTime ? storage.events.filter((event) => event.availability === 'observed') : events,
    [brokerTime, storage.events, events])
  const allReleases = useMemo(() => groupInspectorReleases(readings), [readings])
  const displayReleases = useMemo(() => groupIsmEpisodes(allReleases), [allReleases])
  const releases = useMemo(() => supported ? filterInspectorReleases(displayReleases, preferences, range, brokerTime) : [],
    [supported, displayReleases, preferences, range, brokerTime])
  const markers = useMemo(() => buildInspectorMarkers(releases, preferences, bars, timeframe), [releases, preferences, bars, timeframe])
  const selectedRelease = releases.find((release) => release.id === selectedId) ?? null
  const magnitudeHistory = useFamilyMagnitudeHistory(brokerId, selectedRelease?.ismPublications?.[0] ?? selectedRelease, undefined, clockOffsetMs)
  function applyPreferences(next: InspectorPreferences) {
    setPreferences(next)
    try { localStorage.setItem(inspectorStorageKey, JSON.stringify(next)); setStorageFailed(false) }
    catch { setStorageFailed(true) }
  }
  return { supported, preferences, applyPreferences, storageFailed, rangePreset, setRangePreset, customFrom, setCustomFrom,
    customTo, setCustomTo, range, rangeDates, today, selectCustomRange, allReleases, releases, markers, selectedRelease, selectRelease, now,
    brokerTime, brokerOffsetSeconds, brokerId, storage, magnitudeHistory }
}
export type InspectorView = ReturnType<typeof useInspector>
