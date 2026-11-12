import { majorCurrencies } from '../economic-calendar/forex/currencies'
import { forexPair, majorForexPairs } from '../economic-calendar/forex/pairs'
import { categoryLabels, getSymbolCategory } from '../market-data/market-watch/symbol-classification'

export type HeatmapMode = 'daily' | 'weekly'
export type HeatmapBar = { time: number; open: number; high: number; low: number; close: number }
export type HeatmapHistory = { schema: 1; source_id: string; generation: number; year: number; today: string
  observed_at: number; revision: string; pending: number
  symbols: Record<string, { bars: HeatmapBar[]; availability: 'available' | 'unavailable' | 'no_history' | 'not_visible'; checked_at: number }> }
export type HeatmapInstrument = { symbol: string; description: string }
export type HeatmapPeriod = { day: string; end: string; label: string; partial: boolean; future: boolean }
export type HeatmapPoint = { value: number | null; relative: number | null; coverage: number; from: string | null; through: string | null
  start: number | null; close: number | null; high: number | null; low: number | null; checkedAt: number | null; reason: string }
export type HeatmapRow = { id: string; label: string; group: string; checkedAt: number | null; points: Map<string, HeatmapPoint> }
const dayMs = 86400_000
export function heatmapGroup(id: string, broker: string | null) {
  return id.startsWith('basket:') ? 'Currencies · synthetic' : categoryLabels[getSymbolCategory(id.slice(7), broker)]
}
export function orderHeatmapGroups(groups: Iterable<string>, order: readonly string[]) {
  const present = [...new Set(groups)]
  return [...order.filter(g => present.includes(g)), ...present.filter(g => !order.includes(g))]
}
export const heatmapDate = (at: number) => new Date(at).toISOString().slice(0, 10)
export function weekStart(day: string) {
  const at = Date.parse(day), weekday = new Date(at).getUTCDay()
  return heatmapDate(at - ((weekday + 6) % 7) * dayMs)
}

export function heatmapPeriods(year: number, mode: HeatmapMode, today: string): HeatmapPeriod[] {
  const result: HeatmapPeriod[] = [], beginning = `${year}-01-01`
  const first = mode === 'weekly' ? weekStart(beginning) : beginning
  for (let at = Date.parse(first); at < Date.UTC(year + 1, 0, 1); at += dayMs * (mode === 'weekly' ? 7 : 1)) {
    const day = heatmapDate(at), end = heatmapDate(at + (mode === 'weekly' ? 6 : 0) * dayMs)
    result.push({ day, end, label: new Date(at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }),
      partial: day <= today && end >= today, future: day > today })
  }
  return result
}

// Prefer the exact broker name; accept recognized suffixes without merging instruments.
export function heatmapPairs(catalog: HeatmapInstrument[]) {
  const result = new Map<string, string>()
  for (const item of [...catalog].sort((a, b) => a.symbol.localeCompare(b.symbol))) {
    const pair = forexPair(item.symbol)
    if (pair && (!result.has(pair) || item.symbol === pair)) result.set(pair, item.symbol)
  }
  return result
}

export function heatmapDefaults(catalog: HeatmapInstrument[], broker: string | null): string[] {
  const pairs = heatmapPairs(catalog)
  const extras = catalog.filter(s => getSymbolCategory(s.symbol, broker) === 'indices'
    || /^(XAUUSD|SPOTBRENT)(?:[._].*|[a-z]*)?$/i.test(s.symbol))
  return [...majorCurrencies.map(c => `basket:${c}`), ...majorForexPairs.flatMap(p => pairs.has(p) ? [`symbol:${pairs.get(p)}`] : []),
    ...extras.slice(0, 32).map(s => `symbol:${s.symbol}`)]
}

export function heatmapRequests(ids: string[], catalog: HeatmapInstrument[]): string[] {
  const pairs = heatmapPairs(catalog)
  const needed = ids.flatMap(id => id.startsWith('symbol:') ? [id.slice(7)] : [])
  for (const currency of majorCurrencies) if (ids.includes(`basket:${currency}`)) {
    for (const pair of majorForexPairs) if (pair.includes(currency) && pairs.has(pair)) needed.push(pairs.get(pair)!)
  }
  return [...new Set(needed)].sort()
}

const blank = (reason: string, coverage = 0): HeatmapPoint => ({ value: null, relative: null, coverage,
  from: null, through: null, start: null, close: null, high: null, low: null, checkedAt: null, reason })

function symbolPoints(record: HeatmapHistory['symbols'][string] | undefined, mode: HeatmapMode, today: string) {
  const result = new Map<string, HeatmapPoint>()
  if (!record || !record.bars.length) return result
  const groups = new Map<string, HeatmapBar[]>()
  // Never let future or out-of-order native observations enter the evaluation.
  const bars = [...record.bars].filter(b => heatmapDate(b.time * 1000) <= today).sort((a, b) => a.time - b.time)
  for (const bar of bars) {
    const day = heatmapDate(bar.time * 1000), key = mode === 'weekly' ? weekStart(day) : day
    const group = groups.get(key) ?? []; group.push(bar); groups.set(key, group)
  }
  let previous: HeatmapBar | undefined
  for (const [key, group] of groups) {
    const last = group.at(-1)!, from = previous ? heatmapDate(previous.time * 1000) : null
    const through = heatmapDate(last.time * 1000)
    // Long history holes are not silently represented as a single day/week's move.
    const valid = previous && (mode === 'weekly'
      ? weekStart(from!) === heatmapDate(Date.parse(key) - 7 * dayMs)
      : Date.parse(key) - Date.parse(from!) <= 10 * dayMs)
    const value = valid && previous ? (last.close / previous.close - 1) * 100 : null
    result.set(key, { value, relative: null, coverage: value === null ? 0 : 1, from, through, start: previous?.close ?? null,
      close: last.close, high: Math.max(...group.map(b => b.high)), low: Math.min(...group.map(b => b.low)),
      checkedAt: record.checked_at, reason: value === null ? 'Previous close unavailable or history gap'
        : record.availability === 'unavailable' ? 'History reader unavailable; retained reading may be stale' : '' })
    previous = last
  }
  return result
}

function addRelative(points: Map<string, HeatmapPoint>, mode: HeatmapMode) {
  const history: number[] = [], limit = mode === 'daily' ? 60 : 26, minimum = mode === 'daily' ? 20 : 12
  for (const point of points.values()) {
    if (point.value === null) continue
    if (history.length >= minimum) {
      const mean = history.reduce((a, b) => a + b, 0) / history.length
      const variance = history.reduce((sum, v) => sum + (v - mean) ** 2, 0) / (history.length - 1)
      const volatility = Math.sqrt(variance)
      if (volatility > 1e-8) point.relative = point.value / volatility
    }
    history.push(point.value)
    if (history.length > limit) history.shift()
  }
}

type ModelCache = { scope: string; symbols: Map<string, { bars: HeatmapBar[] | undefined; availability: string | undefined; today: string; points: Map<string, HeatmapPoint> }>
  rows: Map<string, { inputs: Map<string, HeatmapPoint>[]; row: HeatmapRow }> }
const emptyPoints = new Map<string, HeatmapPoint>()
export function createHeatmapRowBuilder() {
  const cache: ModelCache = { scope: '', symbols: new Map(), rows: new Map() }
  return (ids: string[], catalog: HeatmapInstrument[], broker: string | null, data: HeatmapHistory | null, mode: HeatmapMode) => buildHeatmapRows(ids, catalog, broker, data, mode, cache)
}

export function buildHeatmapRows(ids: string[], catalog: HeatmapInstrument[], broker: string | null, data: HeatmapHistory | null, mode: HeatmapMode, cache?: ModelCache): HeatmapRow[] {
  const pairs = heatmapPairs(catalog), points = new Map<string, Map<string, HeatmapPoint>>()
  const scope = `${broker}:${data?.generation}:${data?.year}`
  if (cache && cache.scope !== scope) { cache.scope = scope; cache.symbols.clear(); cache.rows.clear() }
  for (const symbol of heatmapRequests(ids, catalog)) {
    const key = `${mode}:${symbol}`, record = data?.symbols[symbol], today = data?.today ?? '0000-01-01'
    const saved = cache?.symbols.get(key)
    const values = saved && saved.bars === record?.bars && saved.availability === record?.availability && saved.today === today
      ? saved.points : symbolPoints(record, mode, today)
    if (values !== saved?.points) addRelative(values, mode)
    cache?.symbols.delete(key); cache?.symbols.set(key, { bars: record?.bars, availability: record?.availability, today, points: values })
    points.set(symbol, values)
  }
  while (cache && cache.symbols.size > 256) cache.symbols.delete(cache.symbols.keys().next().value!)
  return ids.map(id => {
    const key = `${mode}:${id}`, saved = cache?.rows.get(key), group = heatmapGroup(id, broker)
    const inputs = id.startsWith('symbol:') ? [points.get(id.slice(7))!]
      : majorForexPairs.filter(p => p.includes(id.slice(7))).map(p => points.get(pairs.get(p) ?? '') ?? emptyPoints)
    const names = id.startsWith('symbol:') ? [id.slice(7)] : majorForexPairs.filter(p => p.includes(id.slice(7))).map(p => pairs.get(p) ?? '')
    const checks = names.map(name => data?.symbols[name]?.checked_at).filter((v): v is number => v != null)
    const checkedAt = checks.length ? Math.min(...checks) : null
    if (saved && inputs.every((p, i) => p === saved.inputs[i]) && inputs.length === saved.inputs.length) {
      const row = saved.row.checkedAt === checkedAt && saved.row.group === group ? saved.row : { ...saved.row, checkedAt, group }
      cache?.rows.delete(key); cache?.rows.set(key, { inputs, row })
      return row
    }
    function remember(row: HeatmapRow) {
      cache?.rows.delete(key); cache?.rows.set(key, { inputs, row })
      while (cache && cache.rows.size > 192) cache.rows.delete(cache.rows.keys().next().value!)
      return row
    }
    if (id.startsWith('symbol:')) {
      const symbol = id.slice(7), values = points.get(symbol) ?? new Map<string, HeatmapPoint>()
      return remember({ id, label: symbol, group, checkedAt, points: values })
    }
    const currency = id.slice(7), values = new Map<string, HeatmapPoint>()
    const members = majorForexPairs.filter(p => p.includes(currency))
    const periods = [...new Set(inputs.flatMap(p => [...p.keys()]))].sort()
    for (const period of periods) {
      const observations = members.map(pair => ({ pair, point: points.get(pairs.get(pair) ?? '')?.get(period) }))
      const available = observations.filter(o => o.point?.value !== null && o.point?.value !== undefined)
      const first = available[0]?.point
      if (available.length !== 7 || !first || available.some(o => o.point!.from !== first.from || o.point!.through !== first.through)) {
        values.set(period, blank('Basket needs all 7 counterparts with matching start/end dates', available.length)); continue
      }
      // Reversing a quote negates its log return, not its ordinary percentage return.
      const logReturn = available.reduce((sum, o) => sum + Math.log1p(o.point!.value! / 100) * (o.pair.startsWith(currency) ? 1 : -1), 0) / 7
      values.set(period, { ...blank(available.some(o => o.point!.reason) ? 'One or more counterparts use retained readings; history reader unavailable' : ''), value: Math.expm1(logReturn) * 100, coverage: 7,
        from: first.from, through: first.through, checkedAt: Math.min(...available.map(o => o.point!.checkedAt!)) })
    }
    addRelative(values, mode)
    return remember({ id, label: `${currency} basket`, group, checkedAt, points: values })
  })
}

export function formatHeatmapChange(value: number | null, unit = '%') {
  if (value === null || !Number.isFinite(value)) return '—'
  const rounded = Math.abs(value) < .005 ? 0 : value
  return `${rounded > 0 ? '+' : ''}${rounded.toFixed(2)}${unit}`
}

export function validHeatmapHistory(value: unknown, source: string, generation: number, year: number): value is HeatmapHistory {
  if (!value || typeof value !== 'object') return false
  const data = value as HeatmapHistory
  const day = (s: unknown): s is string => typeof s === 'string' && /^\d{4}-\d\d-\d\d$/.test(s)
    && Number.isFinite(Date.parse(s)) && heatmapDate(Date.parse(s)) === s
  return data.schema === 1 && data.source_id === source && data.generation === generation && data.year === year
    && day(data.today) && Number.isFinite(data.observed_at) && /^[a-f0-9]{64}$/.test(data.revision)
    && Number.isInteger(data.pending) && data.pending >= 0 && data.pending <= 128
    && !!data.symbols && typeof data.symbols === 'object' && !Array.isArray(data.symbols) && Object.keys(data.symbols).length <= 128
    && Object.values(data.symbols).every(r => r && ['available', 'unavailable', 'no_history', 'not_visible'].includes(r.availability)
      && Number.isFinite(r.checked_at) && Array.isArray(r.bars) && r.bars.length <= 1000
      && r.bars.every((b, i) => b && Number.isInteger(b.time) && b.time > 0 && (i === 0 || b.time > r.bars[i - 1].time)
        && ['open', 'high', 'low', 'close'].every(k => Number.isFinite(b[k as keyof HeatmapBar]) && b[k as keyof HeatmapBar] > 0)
        && b.low <= Math.min(b.open, b.close) && b.high >= Math.max(b.open, b.close)))
}
