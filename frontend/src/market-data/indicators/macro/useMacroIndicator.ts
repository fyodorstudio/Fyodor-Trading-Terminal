import { useCallback, useEffect, useMemo, useState } from 'react'
import { useStoredCalendar } from '../../../economic-calendar/storage/useStoredCalendar'
import { macroMetrics, macroHistory, macroUpcoming, supportsMacro, type MacroIndicator, type MacroTextEvent } from './macro-data'
import { readMacroPreferences, saveMacroPreferences, selectedMacroMetrics, type MacroPreferences } from './macro-preferences'
import { isMacroTextEvent, macroCatalog } from './macro-catalog'
import { useFedForecasts } from './useFedForecasts'
import { useOptionalWildcards } from '../../../wildcards/useWildcards'
import { wildcardChartTime } from '../../../wildcards/wildcard-model'
const noMacroEvents: MacroTextEvent[] = []

export function useMacroIndicator(symbol: string, brokerId: string | null) {
  const [macroPreferences, setPreferences] = useState<MacroPreferences>(() => {
    const saved = readMacroPreferences(symbol)
    return { ...saved, activeCurrency: saved.activeCurrency ?? saved.currencies?.[0] ?? 'USD' }
  })
  const [preferencesSaved, setPreferencesSaved] = useState(true)
  useEffect(() => { saveMacroPreferences(macroPreferences) }, [macroPreferences])
  const [macroSettingsOpen, setMacroSettingsOpen] = useState(false)
  const changeMacro = useCallback((next: MacroPreferences) => { setPreferencesSaved(saveMacroPreferences(next)); setPreferences(next) }, [])
  const toggleMacro = useCallback(() => changeMacro({ ...macroPreferences, enabled: !macroPreferences.enabled }), [changeMacro, macroPreferences])
  const selection = selectedMacroMetrics(macroPreferences).join('|')
  const keys = useMemo(() => selection ? selection.split('|') : [], [selection])
  const active = macroPreferences.enabled && supportsMacro(symbol)
  const forecasts = useFedForecasts(active && keys.includes('rate'))
  const meetings = forecasts.meetings
  // Selected exact series share one paged snapshot and one calendar polling clock.
  const [range] = useState(() => ({ from: 0, to: Date.UTC(new Date().getUTCFullYear() + 2, 0, 1) }))
  const stored = useStoredCalendar(brokerId, range, active && keys.length > 0, { currencies: [...new Set(keys.map(key => macroCatalog[key].currency))] as ('USD' | 'EUR' | 'GBP' | 'JPY' | 'CHF' | 'CAD' | 'AUD' | 'NZD')[], eventIds: keys.map(key => macroCatalog[key].eventId) })
  const textCurrency = macroPreferences.currencies?.includes(macroPreferences.activeCurrency ?? '') ? macroPreferences.activeCurrency : undefined
  const textKeys = useMemo(() => Object.keys(macroCatalog).filter(key => isMacroTextEvent(key) && macroCatalog[key].currency === textCurrency), [textCurrency])
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
  const { history, forecastHistory, upcoming } = useMemo(() => {
    // Advance the release cutoff only when the captured calendar snapshot changes.
    // oxlint-disable-next-line react/purity
    const now = Date.now()
    const history = macroHistory(stored.events, now, 'actual', keys)
    const forecastHistory = macroHistory(stored.events, now, 'forecast', keys)
    // Saved Fed consensus takes precedence only at its exact calendar release.
    // An explicitly blank saved consensus must not borrow a different vintage.
    const rateForecasts = new Map((forecastHistory.rate ?? []).map(reading => [reading.releasedAt, reading]))
    for (const reading of history.rate ?? []) {
      const meeting = meetings.get(reading.releasedAt)
      if (!meeting) continue
      const consensus = meeting.consensus.find(row => row.provider === 'investing')
      if (consensus) rateForecasts.set(reading.releasedAt, { ...reading, value: consensus.value })
      else rateForecasts.delete(reading.releasedAt)
    }
    if (keys.some(key => macroCatalog[key].eventId === macroMetrics.rate.eventId)) forecastHistory.rate = [...rateForecasts.values()].sort((a, b) => a.time - b.time)
    if (keys.includes('rate')) history.rate = (history.rate ?? []).map(reading => {
      const official = meetings.get(reading.releasedAt)?.actual
      return official ? { ...reading, value: official.upper, brokerValue: reading.value } : reading
    })
    return { history, forecastHistory, upcoming: macroUpcoming(stored.events, now, keys) }
  }, [stored.events, meetings, keys])
  const status = !preferencesSaved ? 'MFDI layout could not be saved. Local storage is full or unavailable; export a preset backup.' : !brokerId ? 'Connect a broker to load stored macro data'
    : stored.loading ? 'Loading macro releases…'
    : stored.error ? `Macro history unavailable · ${stored.error}`
    : stored.collectorError ? 'Calendar collector unavailable'
    : ''
  const eventStatus = active && macroPreferences.showEventRow !== false ? [textStored.error, wildcards?.error].filter(Boolean).join(' · ') : ''
  const macro: MacroIndicator = useMemo(() => ({ enabled: active, history, forecastHistory, upcoming, status, forecasts, preferences: macroPreferences, sourceId: brokerId, events, eventStatus }), [active, history, forecastHistory, upcoming, status, forecasts, macroPreferences, brokerId, events, eventStatus])
  return { macro, macroPreferences, changeMacro, toggleMacro, macroSettingsOpen, setMacroSettingsOpen }
}
