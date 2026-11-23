import type { LineData, UTCTimestamp } from 'lightweight-charts'
import type { StoredCalendarEvent } from '../../../economic-calendar/storage/useStoredCalendar'
import { chartCalendarRows, hasChartActual } from '../../../economic-calendar/storage/chart-calendar-rows'
import { macroCatalog, macroMetrics } from './macro-catalog'
export { macroMetrics } from './macro-catalog'
import type { OhlcBar } from '../../contracts/OhlcBar'
import type { MacroMetric, MacroPreferences } from './macro-preferences'
import type { FedForecasts } from './fed-forecast'
import { isPublishedTentative } from '../../../inspector/releases/group-releases'

export type MacroReading = { time: number; releasedAt: number; value: number; id: string; currency?: string; brokerValue?: number; unit?: number; multiplier?: number; digits?: number;
  revision?: number; forecast?: number | null; previous?: number | null; impact?: string; actualSource?: string }
export type MacroHistory = Record<MacroMetric, MacroReading[]>
export type MacroScheduled = { time: number; releasedAt: number; metrics: MacroMetric[]; forecasts?: Partial<Record<MacroMetric, number>>;
  formats?: Partial<Record<MacroMetric, Pick<MacroReading, 'unit' | 'multiplier' | 'digits'>>> }
export type MacroTextEvent = { id: string; time: number; at: number | null; title: string; details: string; wildcardId?: string }
export type MacroMissing = { key: string; time: number; releasedAt: number; dateOnly: boolean; lastKnown: boolean }
export type MacroIndicator = { enabled: boolean; history: MacroHistory; forecastHistory?: MacroHistory; upcoming: MacroScheduled[]; missing?: MacroMissing[]; status: string; preferences: MacroPreferences; forecasts?: FedForecasts; sourceId?: string | null; events?: MacroTextEvent[]; eventStatus?: string }
export function supportsMacro(symbol: string) { return !!symbol.trim() }
export function macroValue(metric: MacroMetric, value: number, reading?: Pick<MacroReading, 'unit' | 'multiplier' | 'digits'>) {
  const definition = macroCatalog[metric], unit = reading?.unit ?? definition?.unit
  const suffix = definition?.suffix ?? (unit === 1 ? '%' : unit === 3 ? ' h'
    : ({ 1: 'k', 2: 'M', 3: 'B', 4: 'T' } as Record<number, string>)[reading?.multiplier ?? 0] ?? (unit === 0 ? ' pts' : ''))
  const digits = unit === 1 ? 2 : Math.min(6, Math.max(0, reading?.digits ?? 2))
  return `${value.toLocaleString('en-US', { minimumFractionDigits: unit === 1 ? 2 : 0, maximumFractionDigits: digits })}${suffix}`
}
/** Compare actual releases, including predecessors outside the loaded candles. */
export function macroNumberLabels(metric: MacroMetric, history: MacroReading[], colorMode: MacroPreferences['colorMode'] = 'custom') {
  return new Map(history.map((reading, index) => {
    const previous = colorMode === 'ap-delta' ? reading.previous : history[index - 1]?.value
    const arrow = previous == null || !Number.isFinite(previous) ? '' : reading.value > previous ? '↑' : reading.value < previous ? '↓' : ''
    return [reading.time, `${arrow}${macroValue(metric, reading.value, reading)}`]
  }))
}
export function macroActualDelta(reading?: MacroReading) {
  if (!reading || reading.previous == null || !Number.isFinite(reading.previous) || !Number.isFinite(reading.value)) return null
  return reading.value - reading.previous
}
export function macroDeltaColor(reading: MacroReading | undefined, fallback: string, inverse = false) {
  const delta = macroActualDelta(reading)
  if (delta === null) return fallback
  if (delta === 0) return '#6b7280'
  return (delta > 0) !== inverse ? '#16a34a' : '#dc2626'
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
function newerReading(event: StoredCalendarEvent, previous: StoredCalendarEvent) {
  if (event.period_seconds !== previous.period_seconds) return event.period_seconds > previous.period_seconds
  if (event.revision !== previous.revision) return event.revision > previous.revision
  return /^\d+$/.test(event.value_id) && /^\d+$/.test(previous.value_id)
    ? BigInt(event.value_id) > BigInt(previous.value_id) : event.value_id > previous.value_id
}
/** Exact captured series, actuals and independently verified publication/chart clocks. */
export function macroHistory(events: StoredCalendarEvent[], now: number, field: 'actual' | 'forecast' = 'actual', keys: readonly string[] = Object.keys(macroMetrics)): MacroHistory {
  const history = {} as MacroHistory
  const byEvent = groupEvents(events)
  for (const key of keys) {
    const metric = macroCatalog[key], readings = new Map<number, StoredCalendarEvent>()
    for (const event of byEvent.get(metric.eventId) ?? []) {
      if (event.event_id !== metric.eventId || event.currency !== metric.currency || event.country_code !== metric.country
        || (metric.unit !== undefined && event.unit !== metric.unit) || (metric.multiplier !== undefined && event.multiplier !== metric.multiplier)
        || event.time_mode !== 0 && !isPublishedTentative(event, true)
        || (event.availability !== 'observed' && (field !== 'actual' || !hasChartActual(event)))
        || event.release_at === null || !Number.isFinite(event.release_at) || event.release_at > now
        || event.chart_time_seconds === null || !Number.isFinite(event.chart_time_seconds)) continue
      const previous = readings.get(event.chart_time_seconds)
      if (!previous || (field === 'actual' && event.period_seconds === previous.period_seconds && !!event.actual_override_source !== !!previous.actual_override_source
        ? !!event.actual_override_source : newerReading(event, previous)))
        readings.set(event.chart_time_seconds, event)
    }
    history[key] = [...readings.values()].filter(event => event[field] !== null && Number.isFinite(event[field]))
      .map(event => ({ time: event.chart_time_seconds!, releasedAt: event.release_at!, value: event[field]!, id: event.value_id, currency: event.currency, unit: event.unit, multiplier: event.multiplier, digits: event.digits,
        revision: event.revision, forecast: Number.isFinite(event.forecast) ? event.forecast : null, previous: Number.isFinite(event.previous) ? event.previous : null, impact: event.impact,
        ...(event.actual_override_source ? { actualSource: event.actual_override_source } : {}) }))
      .sort((a, b) => a.time - b.time)
  }
  return history
}

export function macroMissing(events: StoredCalendarEvent[], now: number, keys: readonly string[], history: MacroHistory): MacroMissing[] {
  const grouped = groupEvents(chartCalendarRows(events, now))
  return keys.flatMap(key => {
    const metric = macroCatalog[key], actualTimes = new Set(history[key]?.map(reading => reading.time))
    const missing = new Map<number, MacroMissing>()
    for (const event of grouped.get(metric.eventId) ?? []) {
      if (event.currency !== metric.currency || event.country_code !== metric.country
        || (metric.unit !== undefined && metric.unit !== event.unit)
        || (metric.multiplier !== undefined && metric.multiplier !== event.multiplier) || hasChartActual(event)) continue
      const dateOnly = event.time_mode !== 0 || event.release_at === null
      const time = dateOnly ? Math.floor(event.server_time_seconds / 86400) * 86400 : event.chart_time_seconds
      const releasedAt = dateOnly ? (time ?? 0) * 1000 : event.release_at
      if (event.chart_clock_profile === null || time === null || !Number.isFinite(time) || time <= 0
        || releasedAt === null || !Number.isFinite(releasedAt) || releasedAt > now || actualTimes.has(time)) continue
      missing.set(time, { key, time, releasedAt, dateOnly, lastKnown: event.availability !== 'observed' })
    }
    return [...missing.values()]
  })
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
      if (!previous || newerReading(event, previous))
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
export function macroPlot(bars: OhlcBar[], history: MacroReading[], step: number, carryLine: boolean, color?: (reading: MacroReading) => string) {
  const line: LineData<UTCTimestamp>[] = [], dots: LineData<UTCTimestamp>[] = []
  const segments: { time: UTCTimestamp; reading: MacroReading }[] = []
  const readings = new Map<number, MacroReading>()
  let index = 0, current: MacroReading | undefined
  for (const bar of bars) {
    let releasedInCandle = false
    while (index < history.length && history[index].time < bar.time + step) {
      current = history[index++]
      releasedInCandle = current.time >= bar.time
    }
    if (!current) continue
    const point = { time: bar.time, value: current.value, ...(color ? { color: color(current) } : {}) }
    if (segments.at(-1)?.reading !== current) segments.push({ time: bar.time, reading: current })
    readings.set(bar.time, current)
    if (carryLine || releasedInCandle) line.push(point)
    if (releasedInCandle) dots.push(point)
  }
  return { line, dots, readings, segments }
}
