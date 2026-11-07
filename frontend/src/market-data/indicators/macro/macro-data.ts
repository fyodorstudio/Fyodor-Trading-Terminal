import type { LineData, UTCTimestamp } from 'lightweight-charts'
import type { StoredCalendarEvent } from '../../../economic-calendar/storage/useStoredCalendar'
import { chartEventSymbol } from '../../../economic-calendar/forex/chart-event-scope'
import type { OhlcBar } from '../../contracts/OhlcBar'
import type { MacroMetric, MacroPreferences } from './macro-preferences'
import type { FedForecasts } from './fed-forecast'

export const macroMetrics: Record<MacroMetric, { label: string; eventId: string; unit: number; multiplier: number; suffix: string }> = {
  rate: { label: 'Fed rate', eventId: '840050014', unit: 1, multiplier: 0, suffix: '%' },
  payrolls: { label: 'Nonfarm Payrolls', eventId: '840030016', unit: 4, multiplier: 1, suffix: 'k' },
  unemployment: { label: 'Unemployment', eventId: '840030015', unit: 1, multiplier: 0, suffix: '%' },
  coreCpi: { label: 'Core CPI MoM', eventId: '840030006', unit: 1, multiplier: 0, suffix: '%' },
  headlineCpi: { label: 'Headline CPI MoM', eventId: '840030005', unit: 1, multiplier: 0, suffix: '%' },
}
export const macroEventIds = Object.values(macroMetrics).map(metric => metric.eventId)
export type MacroReading = { time: number; releasedAt: number; value: number; id: string; brokerValue?: number }
export type MacroHistory = Record<MacroMetric, MacroReading[]>
export type MacroScheduled = { time: number; releasedAt: number; metrics: MacroMetric[] }
export type MacroIndicator = { enabled: boolean; history: MacroHistory; upcoming: MacroScheduled[]; status: string; preferences: MacroPreferences; forecasts?: FedForecasts }
export function supportsMacro(symbol: string) { return chartEventSymbol(symbol) === 'USDX' }
export function macroValue(metric: MacroMetric, value: number) {
  return `${value.toLocaleString('en-US', { minimumFractionDigits: metric === 'payrolls' ? 0 : 2, maximumFractionDigits: 2 })}${macroMetrics[metric].suffix}`
}
/** Exact captured series, actuals and independently verified publication/chart clocks. */
export function macroHistory(events: StoredCalendarEvent[], now: number): MacroHistory {
  const history = {} as MacroHistory
  for (const key of Object.keys(macroMetrics) as MacroMetric[]) {
    const metric = macroMetrics[key], readings = new Map<number, StoredCalendarEvent>()
    for (const event of events) {
      if (event.event_id !== metric.eventId || event.currency !== 'USD' || event.country_code !== 'US'
        || event.unit !== metric.unit || event.multiplier !== metric.multiplier || event.time_mode !== 0
        || event.availability !== 'observed' || event.actual === null || !Number.isFinite(event.actual)
        || event.release_at === null || !Number.isFinite(event.release_at) || event.release_at > now
        || event.chart_time_seconds === null || !Number.isFinite(event.chart_time_seconds)) continue
      const previous = readings.get(event.chart_time_seconds)
      if (!previous || event.revision > previous.revision || (event.revision === previous.revision && event.value_id > previous.value_id))
        readings.set(event.chart_time_seconds, event)
    }
    history[key] = [...readings.values()].map(event => ({ time: event.chart_time_seconds!, releasedAt: event.release_at!, value: event.actual!, id: event.value_id }))
      .sort((a, b) => a.time - b.time)
  }
  return history
}

/** Scheduled metadata stays separate from actuals; one line per publication instant. */
export function macroUpcoming(events: StoredCalendarEvent[], now: number): MacroScheduled[] {
  const packages = new Map<number, MacroScheduled>()
  for (const key of Object.keys(macroMetrics) as MacroMetric[]) {
    const metric = macroMetrics[key]
    for (const event of events) {
      if (event.event_id !== metric.eventId || event.currency !== 'USD' || event.country_code !== 'US'
        || event.unit !== metric.unit || event.multiplier !== metric.multiplier || event.time_mode !== 0
        || event.availability !== 'observed' || event.release_at === null || !Number.isFinite(event.release_at) || event.release_at <= now
        || event.chart_time_seconds === null || !Number.isFinite(event.chart_time_seconds)) continue
      const existing = packages.get(event.release_at)
      if (existing) {
        if (existing.time === event.chart_time_seconds && !existing.metrics.includes(key)) existing.metrics.push(key)
      } else packages.set(event.release_at, { time: event.chart_time_seconds, releasedAt: event.release_at, metrics: [key] })
    }
  }
  return [...packages.values()].sort((a, b) => a.releasedAt - b.releasedAt)
}

/** Only candle timestamps enter the shared native timeline. Carry-forward is explicit. */
export function macroPlot(bars: OhlcBar[], history: MacroReading[], step: number, carryLine: boolean) {
  const line: LineData<UTCTimestamp>[] = [], dots: LineData<UTCTimestamp>[] = []
  const readings = new Map<number, MacroReading>()
  let index = 0, current: MacroReading | undefined
  for (const bar of bars) {
    let releasedInCandle = false
    while (index < history.length && history[index].time < bar.time + step) {
      current = history[index++]
      releasedInCandle = current.time >= bar.time
    }
    if (!current) continue
    const point = { time: bar.time, value: current.value }
    readings.set(bar.time, current)
    if (carryLine || releasedInCandle) line.push(point)
    if (releasedInCandle) dots.push(point)
  }
  return { line, dots, readings }
}
