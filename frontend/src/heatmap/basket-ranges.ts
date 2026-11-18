import { heatmapDate, heatmapPairs, weekStart, type HeatmapInstrument, type HeatmapMode, type HeatmapPeriod, type HeatmapPoint, type HeatmapRow } from './heatmap-model'

export type BasketRange = { open: number | null; high: number | null; low: number | null; samples: number; expected: number; previous: string | null; reason: string }
export type BasketRanges = { source_id: string; generation: number; sampling: 'M1'; days: Record<string, Record<string, BasketRange>>; pending: number }

export function basketRequest(ids: string[], catalog: HeatmapInstrument[], periods: HeatmapPeriod[], today: string) {
  const currencies = ids.filter(id => id.startsWith('basket:')).map(id => id.slice(7)).sort()
  if (!currencies.length) return ''
  const pairs = Object.fromEntries([...heatmapPairs(catalog)].filter(([pair]) => currencies.some(c => pair.startsWith(c) || pair.endsWith(c))))
  const days = new Set<string>()
  for (const period of periods) for (let at = Date.parse(period.day); at <= Date.parse(period.end); at += 86400_000) {
    const day = heatmapDate(at)
    if (day <= today) days.add(day)
  }
  return JSON.stringify({ currencies, pairs, days: [...days].sort().reverse() })
}

export function validBasketRanges(value: unknown, broker: string, generation: number, request: string): value is BasketRanges {
  if (!value || typeof value !== 'object') return false
  const data = value as BasketRanges, scope = JSON.parse(request) as { days: string[]; currencies: string[] }
  return data.source_id === broker && data.generation === generation && data.sampling === 'M1'
    && Number.isSafeInteger(data.pending) && data.pending >= 0 && !!data.days && typeof data.days === 'object'
    && Object.entries(data.days).every(([day, currencies]) => scope.days.includes(day) && currencies && typeof currencies === 'object'
      && Object.entries(currencies).every(([currency, r]) => scope.currencies.includes(currency) && r && typeof r.reason === 'string'
        && ['open', 'high', 'low'].every(k => r[k as 'open'] === null || (Number.isFinite(r[k as 'open']) && r[k as 'open']! > -100))
        && (r.previous === null || /^\d{4}-\d\d-\d\d$/.test(r.previous))
        && Number.isInteger(r.samples) && r.samples >= 0 && Number.isInteger(r.expected) && r.expected >= 0
        && (r.open === null ? r.high === null && r.low === null : r.high !== null && r.low !== null && r.high >= r.open && r.low <= r.open)))
}

export function withBasketRange(point: HeatmapPoint, open: number, high: number, low: number, reason: string): HeatmapPoint {
  return { ...point, start: 100, open: 100 * (1 + open / 100), close: 100 * (1 + point.value! / 100),
    high: 100 * (1 + Math.max(high, open, point.value!) / 100), low: 100 * (1 + Math.min(low, open, point.value!) / 100),
    reason: [point.reason, reason].filter(Boolean).join('; ') }
}

export function applyBasketRanges(rows: HeatmapRow[], dailyRows: HeatmapRow[], ranges: BasketRanges | null, mode: HeatmapMode): HeatmapRow[] {
  if (!ranges || !Object.keys(ranges.days).length) return rows
  const daily = new Map(dailyRows.map(row => [row.id, row.points]))
  return rows.map(row => {
    if (!row.id.startsWith('basket:')) return row
    const currency = row.id.slice(7), points = new Map(row.points)
    for (const [day, point] of row.points) {
      if (point.value === null) continue
      const observations = mode === 'daily' ? [[day, point] as const]
        : [...daily.get(row.id) ?? []].filter(([d, p]) => weekStart(d) === day && p.value !== null).sort(([a], [b]) => a.localeCompare(b))
      let growth = 1, open: number | null = null, high = -Infinity, low = Infinity, previous = point.from, complete = observations.length > 0
      const reasons = new Set<string>()
      if (mode === 'weekly') {
        const available = new Set(observations.map(([d]) => d))
        for (let at = Date.parse(day); at <= Date.parse(point.through!); at += 86400_000) {
          const weekday = new Date(at).getUTCDay()
          if (weekday > 0 && weekday < 6 && !available.has(heatmapDate(at))) {
            complete = false
            reasons.add('Daily basket history incomplete within weekly session')
          }
        }
      }
      for (const [date, p] of observations) {
        const r = ranges.days[date]?.[currency]
        if (!r || r.open === null || r.high === null || r.low === null || r.previous !== p.from || p.from !== previous) {
          complete = false; reasons.add(r?.reason || 'Basket minute ranges loading or unavailable'); break
        }
        open ??= ((1 + r.open / 100) * growth - 1) * 100
        high = Math.max(high, ((1 + r.high / 100) * growth - 1) * 100)
        low = Math.min(low, ((1 + r.low / 100) * growth - 1) * 100)
        growth *= 1 + p.value! / 100
        previous = p.through
        reasons.add(r.reason)
      }
      points.set(day, complete && open !== null ? withBasketRange(point, open, high, low, [...reasons].join('; '))
        : { ...point, reason: [point.reason, ...reasons].filter(Boolean).join('; ') })
    }
    return { ...row, points }
  })
}
