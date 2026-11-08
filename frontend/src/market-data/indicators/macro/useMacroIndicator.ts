import { useCallback, useMemo, useState } from 'react'
import { useStoredCalendar } from '../../../economic-calendar/storage/useStoredCalendar'
import { macroEventIds, macroHistory, macroUpcoming, supportsMacro, type MacroIndicator } from './macro-data'
import { readMacroPreferences, saveMacroPreferences, type MacroPreferences } from './macro-preferences'
import { useFedForecasts } from './useFedForecasts'

export function useMacroIndicator(symbol: string, brokerId: string | null) {
  const [macroPreferences, setPreferences] = useState(readMacroPreferences)
  const [macroSettingsOpen, setMacroSettingsOpen] = useState(false)
  const changeMacro = useCallback((next: MacroPreferences) => { saveMacroPreferences(next); setPreferences(next) }, [])
  const toggleMacro = useCallback(() => setPreferences(current => {
    const next = { ...current, enabled: !current.enabled }; saveMacroPreferences(next); return next
  }), [])
  const active = macroPreferences.enabled && supportsMacro(symbol)
  const forecasts = useFedForecasts(active)
  const meetings = forecasts.meetings
  // All five exact series share one paged snapshot and one calendar polling clock.
  const [range] = useState(() => ({ from: 0, to: Date.UTC(new Date().getUTCFullYear() + 2, 0, 1) }))
  const stored = useStoredCalendar(brokerId, range, active, { currency: 'USD', eventIds: macroEventIds })
  const { history, forecastHistory, upcoming } = useMemo(() => {
    // Advance the release cutoff only when the captured calendar snapshot changes.
    // oxlint-disable-next-line react/purity
    const now = Date.now()
    const history = macroHistory(stored.events, now)
    const forecastHistory = macroHistory(stored.events, now, 'forecast')
    // Saved Fed consensus takes precedence only at its exact calendar release.
    // An explicitly blank saved consensus must not borrow a different vintage.
    const rateForecasts = new Map(forecastHistory.rate.map(reading => [reading.releasedAt, reading]))
    for (const reading of history.rate) {
      const meeting = meetings.get(reading.releasedAt)
      if (!meeting) continue
      const consensus = meeting.consensus.find(row => row.provider === 'investing')
      if (consensus) rateForecasts.set(reading.releasedAt, { ...reading, value: consensus.value })
      else rateForecasts.delete(reading.releasedAt)
    }
    forecastHistory.rate = [...rateForecasts.values()].sort((a, b) => a.time - b.time)
    history.rate = history.rate.map(reading => {
      const official = meetings.get(reading.releasedAt)?.actual
      return official ? { ...reading, value: official.upper, brokerValue: reading.value } : reading
    })
    return { history, forecastHistory, upcoming: macroUpcoming(stored.events, now) }
  }, [stored.events, meetings])
  const status = !brokerId ? 'Connect a broker to load stored macro data'
    : stored.loading ? 'Loading macro releases…'
    : stored.error ? `Macro history unavailable · ${stored.error}`
    : stored.collectorError ? 'Stored MT5 actuals · calendar collector unavailable'
    : 'Stored MT5 actuals · verified Fed values where saved'
  const macro: MacroIndicator = useMemo(() => ({ enabled: active, history, forecastHistory, upcoming, status, forecasts, preferences: macroPreferences }), [active, history, forecastHistory, upcoming, status, forecasts, macroPreferences])
  return { macro, macroPreferences, changeMacro, toggleMacro, macroSettingsOpen, setMacroSettingsOpen }
}
