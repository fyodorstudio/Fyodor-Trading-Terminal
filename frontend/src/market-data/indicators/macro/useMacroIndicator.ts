import { useCallback, useEffect, useMemo, useState } from 'react'
import { useStoredCalendar } from '../../../economic-calendar/storage/useStoredCalendar'
import { macroHistory, macroMissing, macroUpcoming, supportsMacro, type MacroIndicator, type MacroTextEvent } from './macro-data'
import { readMacroPreferences, saveMacroPreferences, selectedMacroMetrics, type MacroPreferences } from './macro-preferences'
import { isMacroTextEvent, macroCatalog } from './macro-catalog'
import { useFedForecasts } from './useFedForecasts'
import { useOptionalWildcards } from '../../../wildcards/useWildcards'
import { wildcardChartTime } from '../../../wildcards/wildcard-model'
import { initializeMacroWorkspace } from './macro-workspace'
import { applyMacroEssentials } from './macro-essentials'
const noMacroEvents: MacroTextEvent[] = []

export function useMacroIndicator(symbol: string, brokerId: string | null) {
  const [macroPreferences, setPreferences] = useState<MacroPreferences>(() => {
    const saved = readMacroPreferences(symbol)
    const current = { ...saved, activeCurrency: saved.activeCurrency ?? saved.currencies?.[0] ?? 'USD' }
    return initializeMacroWorkspace(applyMacroEssentials(current))
  })
  const [preferencesSaved, setPreferencesSaved] = useState(true)
  useEffect(() => { saveMacroPreferences(macroPreferences) }, [macroPreferences])
  const [macroSettingsOpen, setMacroSettingsOpen] = useState(false)
  const changeMacro = useCallback((next: MacroPreferences) => { setPreferencesSaved(saveMacroPreferences(next)); setPreferences(next) }, [])
  const toggleMacro = useCallback(() => changeMacro({ ...macroPreferences, enabled: !macroPreferences.enabled }), [changeMacro, macroPreferences])
  const selection = selectedMacroMetrics(macroPreferences).join('|')
  const keys = useMemo(() => selection ? selection.split('|') : [], [selection])
  const active = macroPreferences.enabled && supportsMacro(symbol)
  const [releaseBoundary, setReleaseBoundary] = useState(0)
  const forecasts = useFedForecasts(active && keys.includes('rate'))
  const meetings = forecasts.meetings
  // Selected exact series share one paged snapshot and one calendar polling clock.
  const [range] = useState(() => ({ from: 0, to: Date.UTC(new Date().getUTCFullYear() + 2, 0, 1) }))
  const stored = useStoredCalendar(brokerId, range, active && keys.length > 0, { currencies: [...new Set(keys.map(key => macroCatalog[key].currency))] as ('USD' | 'EUR' | 'GBP' | 'JPY' | 'CHF' | 'CAD' | 'AUD' | 'NZD')[], eventIds: keys.map(key => macroCatalog[key].eventId) })
  const textCurrency = macroPreferences.activeCurrency
  const textSelection = (macroPreferences.eventsByCurrency?.[textCurrency ?? ''] ?? []).filter(key => isMacroTextEvent(key) && macroPreferences.series[key]?.visible).join('|')
  const textKeys = useMemo(() => textSelection ? textSelection.split('|') : [], [textSelection])
  const textStored = useStoredCalendar(brokerId, range, active && macroPreferences.showEventRow !== false && textKeys.length > 0, { eventIds: textKeys.map(key => macroCatalog[key].eventId) })
  const wildcards = useOptionalWildcards()
  const events = useMemo(() => {
    if (!active || macroPreferences.showEventRow === false) return noMacroEvents
    const ids = new Set(textKeys.map(key => macroCatalog[key].eventId))
    const result: MacroTextEvent[] = textStored.events.filter(event => ids.has(event.event_id) && event.currency === textCurrency && event.availability === 'observed' && event.chart_time_seconds !== null)
      .map(event => ({ id: `calendar:${event.value_id}`, time: event.chart_time_seconds!, at: event.release_at, title: `${event.currency} · ${event.name}`, details: '' }))
    for (const entry of wildcards?.snapshot?.items ?? []) {
      if (entry.archived) continue
      const time = wildcardChartTime(entry, { brokerId, brokerOffsetSeconds: 0 })
      if (time !== null) result.push({ id: `wildcard:${entry.id}`, time, at: entry.at ? Date.parse(entry.at) : null, title: entry.title, details: entry.details, wildcardId: entry.id })
    }
    return result.sort((a, b) => a.time - b.time || a.id.localeCompare(b.id))
  }, [textStored.events, wildcards?.snapshot?.items, brokerId, active, macroPreferences.showEventRow, textKeys, textCurrency])
  const { history, forecastHistory, upcoming, missing } = useMemo(() => {
    // Recompute the release cutoff on calendar changes and scheduled releases.
    // oxlint-disable-next-line react/purity
    const now = Math.max(Date.now(), releaseBoundary)
    const readings = stored.events
    const history = macroHistory(readings, now, 'actual', keys)
    const forecastHistory = macroHistory(readings, now, 'forecast', keys)
    // Use the same sourced value for history, the box, and surprise.
    const rateForecasts = new Map((forecastHistory.rate ?? []).map(reading => [reading.releasedAt, reading]))
    if (keys.includes('rate')) history.rate = (history.rate ?? []).map(reading => {
      const meeting = meetings.get(reading.releasedAt)
      const official = meeting?.actual
      const consensus = meeting?.consensus.find(row => row.provider === 'investing')
      const published = official ? { ...reading, value: official.upper, brokerValue: reading.value,
        actualEvidence: { name: 'Federal Reserve', url: official.url } } : reading
      if (!consensus || published.forecastSource) return published
      const forecastSource = { name: 'Investing.com', url: consensus.url, as_of: consensus.as_of ?? undefined }
      rateForecasts.set(reading.releasedAt, { ...reading, value: consensus.value, forecastSource })
      return { ...published, forecast: consensus.value, forecastSource }
    })
    if (keys.includes('rate')) forecastHistory.rate = [...rateForecasts.values()].sort((a, b) => a.time - b.time)
    return { history, forecastHistory, upcoming: macroUpcoming(readings, now, keys), missing: macroMissing(readings, now, keys, history) }
  }, [stored.events, meetings, keys, releaseBoundary])
  const nextRelease = upcoming[0]?.releasedAt
  useEffect(() => {
    if (!active || nextRelease === undefined) return
    const timer = window.setTimeout(() => setReleaseBoundary(Date.now()), Math.min(2147483647, Math.max(1, nextRelease - Date.now())))
    return () => window.clearTimeout(timer)
  }, [active, nextRelease, releaseBoundary])
  const status = !preferencesSaved ? 'MFDI layout could not be saved. Local storage is full or unavailable.' : !brokerId ? 'Connect a broker to load stored macro data'
    : stored.loading ? 'Loading macro releases…'
    : stored.error ? `Macro history unavailable · ${stored.error}`
    : stored.collectorError ? 'Calendar collector unavailable'
    : ''
  const eventStatus = active && macroPreferences.showEventRow !== false ? [textStored.error, wildcards?.error].filter(Boolean).join(' · ') : ''
  const macro: MacroIndicator = useMemo(() => ({ enabled: active, history, forecastHistory, upcoming, missing, status, forecasts, preferences: macroPreferences, sourceId: brokerId, events, eventStatus }), [active, history, forecastHistory, upcoming, missing, status, forecasts, macroPreferences, brokerId, events, eventStatus])
  return { macro, macroPreferences, changeMacro, toggleMacro, macroSettingsOpen, setMacroSettingsOpen }
}
