import { createContext, useContext, useMemo } from 'react'
import { chartClockToUtc, defaultChartClock, utcToChartClock } from './chart-clock'
import { displayClockInput, parseDisplayClockInput } from './display-clock-input'
import { formatAppTimestamp, timeDisplayZoneLabel, type TimeDisplayPreference } from './time-display-preference'

const defaults = { scope: defaultChartClock, preference: { mode: 'utc', utcOffsetMinutes: 0 } as TimeDisplayPreference }
export const DisplayClockContext = createContext(defaults)
export function useDisplayClock() {
  const { scope, preference } = useContext(DisplayClockContext)
  return useMemo(() => ({ scope, preference, zone: timeDisplayZoneLabel(preference),
    chart: (at: number) => { const utc = chartClockToUtc(at, scope); return utc === null ? 'Time unavailable' : formatAppTimestamp(utc, preference) },
    utc: (at: number) => formatAppTimestamp(at, preference),
    date: (utc: number) => displayClockInput(utc, preference).slice(0, 10),
    input: (at: number) => { const utc = chartClockToUtc(at, scope); return utc === null ? '' : displayClockInput(utc, preference) },
    parse: (value: string) => { const utc = parseDisplayClockInput(value, preference); return utc === null ? null : utcToChartClock(utc, scope) },
  }), [scope, preference])
}
