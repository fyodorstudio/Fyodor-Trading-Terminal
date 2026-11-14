import type { LineData, UTCTimestamp } from 'lightweight-charts'
import type { StoredCalendarEvent } from '../../../economic-calendar/storage/useStoredCalendar'
import { macroCatalog, macroMetrics } from './macro-catalog'
export { macroMetrics } from './macro-catalog'
import type { OhlcBar } from '../../contracts/OhlcBar'
import type { MacroMetric, MacroPreferences } from './macro-preferences'
import type { FedForecasts } from './fed-forecast'

export type MacroReading = { time: number; releasedAt: number; value: number; id: string; currency?: string; brokerValue?: number; unit?: number; multiplier?: number; digits?: number;
  forecast?: number | null; previous?: number | null; impact?: string }
export type MacroHistory = Record<MacroMetric, MacroReading[]>
export type MacroScheduled = { time: number; releasedAt: number; metrics: MacroMetric[]; forecasts?: Partial<Record<MacroMetric, number>>;
  formats?: Partial<Record<MacroMetric, Pick<MacroReading, 'unit' | 'multiplier' | 'digits'>>> }
export type MacroTextEvent = { id: string; time: number; at: number | null; title: string; details: string; wildcardId?: string }
export type MacroIndicator = { enabled: boolean; history: MacroHistory; forecastHistory?: MacroHistory; upcoming: MacroScheduled[]; status: string; preferences: MacroPreferences; forecasts?: FedForecasts; sourceId?: string | null; events?: MacroTextEvent[]; eventStatus?: string }
export function supportsMacro(symbol: string) { return !!symbol.trim() }
export function macroValue(metric: MacroMetric, value: number, reading?: Pick<MacroReading, 'unit' | 'multiplier' | 'digits'>) {
  const definition = macroCatalog[metric], unit = reading?.unit ?? definition?.unit
  const suffix = definition?.suffix ?? (unit === 1 ? '%' : unit === 3 ? ' h'
    : ({ 1: 'k', 2: 'M', 3: 'B', 4: 'T' } as Record<number, string>)[reading?.multiplier ?? 0] ?? (unit === 0 ? ' pts' : ''))
  const digits = unit === 1 ? 2 : Math.min(6, Math.max(0, reading?.digits ?? 2))
  return `${value.toLocaleString('en-US', { minimumFractionDigits: unit === 1 ? 2 : 0, maximumFractionDigits: digits })}${suffix}`
}
/** Compare actual releases, including predecessors outside the loaded candles. */
export function macroNumberLabels(metric: MacroMetric, history: MacroReading[]) {
  return new Map(history.map((reading, index) => {
    const previous = history[index - 1]
    const arrow = !previous ? '' : reading.value > previous.value ? '↑' : reading.value < previous.value ? '↓' : ''
    return [reading.time, `${arrow}${macroValue(metric, reading.value, reading)}`]
  }))
}
function groupEvents(events: StoredCalendarEvent[]) {
  const grouped = new Map<string, StoredCalendarEvent[]>()
  for (const event of events) {
    const rows = grouped.get(event.event_id)
    if (rows) rows.push(event)
    else grouped.set(event.event_id, [event])
  }
  return grouped
}
/** Exact captured series, actuals and independently verified publication/chart clocks. */
export function macroHistory(events: StoredCalendarEvent[], now: number, field: 'actual' | 'forecast' = 'actual', keys: readonly string[] = Object.keys(macroMetrics)): MacroHistory {
  const history = {} as MacroHistory
  const byEvent = groupEvents(events)
  for (const key of keys) {
    const metric = macroCatalog[key], readings = new Map<number, StoredCalendarEvent>()
    for (const event of byEvent.get(metric.eventId) ?? []) {
      if (event.event_id !== metric.eventId || event.currency !== metric.currency || event.country_code !== metric.country
        || (metric.unit !== undefined && event.unit !== metric.unit) || (metric.multiplier !== undefined && event.multiplier !== metric.multiplier) || event.time_mode !== 0
        || event.availability !== 'observed'
        || (field === 'actual' && (event.actual === null || !Number.isFinite(event.actual)))
        || event.release_at === null || !Number.isFinite(event.release_at) || event.release_at > now
        || event.chart_time_seconds === null || !Number.isFinite(event.chart_time_seconds)) continue
      const previous = readings.get(event.chart_time_seconds)
      if (!previous || event.revision > previous.revision || (event.revision === previous.revision && event.value_id > previous.value_id))
        readings.set(event.chart_time_seconds, event)
    }
    history[key] = [...readings.values()].filter(event => event[field] !== null && Number.isFinite(event[field]))
      .map(event => ({ time: event.chart_time_seconds!, releasedAt: event.release_at!, value: event[field]!, id: event.value_id, currency: event.currency, unit: event.unit, multiplier: event.multiplier, digits: event.digits,
        forecast: Number.isFinite(event.forecast) ? event.forecast : null, previous: Number.isFinite(event.previous) ? event.previous : null, impact: event.impact }))
      .sort((a, b) => a.time - b.time)
  }
  return history
}

/** Scheduled metadata stays separate from actuals; companions share a publication instant. */
export function macroUpcoming(events: StoredCalendarEvent[], now: number, keys: readonly string[] = Object.keys(macroMetrics)): MacroScheduled[] {
  const packages = new Map<number, MacroScheduled>()
  const byEvent = groupEvents(events)
  for (const key of keys) {
    const metric = macroCatalog[key]
    const readings = new Map<number, StoredCalendarEvent>()
    for (const event of byEvent.get(metric.eventId) ?? []) {
      if (event.event_id !== metric.eventId || event.currency !== metric.currency || event.country_code !== metric.country
        || (metric.unit !== undefined && event.unit !== metric.unit) || (metric.multiplier !== undefined && event.multiplier !== metric.multiplier) || event.time_mode !== 0
        || event.availability !== 'observed' || event.release_at === null || !Number.isFinite(event.release_at) || event.release_at <= now
        || event.chart_time_seconds === null || !Number.isFinite(event.chart_time_seconds)) continue
      const previous = readings.get(event.release_at)
      if (!previous || event.revision > previous.revision || (event.revision === previous.revision && event.value_id > previous.value_id))
        readings.set(event.release_at, event)
    }
    for (const event of readings.values()) {
      const existing = packages.get(event.release_at!)
      const forecast = event.forecast !== null && Number.isFinite(event.forecast) ? { [key]: event.forecast } : {}
      const format = { [key]: { unit: event.unit, multiplier: event.multiplier, digits: event.digits } }
      if (existing) {
        if (existing.time === event.chart_time_seconds) {
          existing.metrics.push(key)
          Object.assign(existing.forecasts!, forecast)
          Object.assign(existing.formats!, format)
        }
      } else packages.set(event.release_at!, { time: event.chart_time_seconds!, releasedAt: event.release_at!, metrics: [key], forecasts: forecast, formats: format })
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
