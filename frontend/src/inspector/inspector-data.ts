import type { EconomicCalendarEvent } from './calendar-event'
import { eventFamilyOptions } from './event-families'
import { isEventSymbol, type EventSymbol } from './event-symbols'
import type { ChartTimeframe } from '../market-data/contracts/ChartTimeframe'
import type { OhlcBar } from '../market-data/contracts/OhlcBar'
import type { CalendarDisplayRange } from './calendar-display-range'
import { fomcDecisionId, fomcCompanionIds, groupFomcEpisodes } from './episodes/fomc-episodes'

const originalInspectorFamilies = ['ecb', 'ecb-president', 'fomc', 'fed-chair', 'euro-inflation', 'german-inflation', 'us-cpi', 'pce', 'ppi']
const inspectorFamilyOrder = [...originalInspectorFamilies, 'euro-labor', 'euro-wages', 'jobs', 'claims',
  'euro-gdp', 'euro-pmi', 'german-pmi', 'french-pmi', 'gdp', 'retail', 'ism-manufacturing', 'ism-services']
export const inspectorFamilies = eventFamilyOptions.filter((family) => inspectorFamilyOrder.includes(family.id))
  .sort((a, b) => inspectorFamilyOrder.indexOf(a.id) - inspectorFamilyOrder.indexOf(b.id))
export type InspectorFamilyId = typeof inspectorFamilies[number]['id']
export const inspectorCategories = [
  { id: 'policy', label: 'Monetary policy', families: ['ecb', 'ecb-president', 'fomc', 'fed-chair'] },
  { id: 'inflation', label: 'Inflation', families: ['euro-inflation', 'german-inflation', 'us-cpi', 'pce', 'ppi'] },
  { id: 'labor', label: 'Labor / wages', families: ['euro-labor', 'euro-wages', 'jobs', 'claims'] },
  { id: 'growth', label: 'Growth / activity', families: ['euro-gdp', 'euro-pmi', 'german-pmi', 'french-pmi', 'gdp', 'retail', 'ism-manufacturing', 'ism-services'] },
] as const
export type InspectorPreferences = {
  version: 2
  families: string[]
  showSymbols: boolean
  symbols: Record<string, EventSymbol>
}
export const inspectorStorageKey = 'fyodor.inspector.eurusd.v1'
export function defaultInspectorPreferences(): InspectorPreferences {
  return { version: 2, families: inspectorFamilies.map((family) => family.id), showSymbols: true,
    symbols: Object.fromEntries(inspectorFamilies.map((family) => [family.id, family.symbol])) }
}
export function readInspectorPreferences(): InspectorPreferences {
  const defaults = defaultInspectorPreferences()
  try {
    const saved = JSON.parse(localStorage.getItem(inspectorStorageKey) ?? '{}')
    const selected = Array.isArray(saved.families) ? [...new Set(saved.families.filter((id: unknown) =>
      inspectorFamilies.some((family) => family.id === id)))] as string[] : defaults.families
    // Upgrade the original all-enabled default once. Custom selections remain
    // exact, including intentionally choosing only the original nine families.
    const oldDefault = saved.version !== 2 && selected.length === originalInspectorFamilies.length &&
      originalInspectorFamilies.every((id) => selected.includes(id))
    return { version: 2, families: oldDefault ? defaults.families : selected,
    showSymbols: typeof saved.showSymbols === 'boolean' ? saved.showSymbols : defaults.showSymbols,
    symbols: { ...defaults.symbols, ...Object.fromEntries(Object.entries(saved.symbols ?? {}).filter(([id, symbol]) =>
      inspectorFamilies.some((family) => family.id === id) && isEventSymbol(symbol))) as Record<string, EventSymbol> } }
  } catch { return defaults }
}
export function supportsInspector(symbol: string): boolean {
  return /^EURUSD(?:[._-].*|[a-z]*)$/i.test(symbol)
}
export type InspectorRelease = {
  id: string
  familyId: InspectorFamilyId
  label: string
  currency: 'EUR' | 'USD'
  country: string
  releaseAt: number | null
  chartTime: number | null
  serverTime: number
  timingUncertain: boolean
  events: EconomicCalendarEvent[]
}

function releaseLabel(event: EconomicCalendarEvent, familyId: string): string | null {
  if (familyId === 'fomc') return event.event_id === '840050014' ? 'Fed rate decision' : event.name
  if (familyId === 'ecb') return ['999010006', '999010007', '999010015'].includes(event.event_id) ? 'ECB rate decision' : event.name
  if (familyId === 'fed-chair' || familyId === 'ecb-president') return event.name
  if (familyId === 'euro-labor') return event.event_id === '999030020' ? 'Euro-area unemployment' : 'Euro-area employment'
  return null
}
export type InspectorEvent = EconomicCalendarEvent & { chart_time_seconds?: number | null }
export function inspectorEventChartTime(event: InspectorEvent): number | null {
  return event.chart_time_seconds === undefined ? event.release_at === null ? null : event.release_at / 1000 : event.chart_time_seconds
}

export function isInspectorCommentary(event: EconomicCalendarEvent): boolean {
  const family = inspectorFamilies.find((item) => item.country === event.country_code && item.currency === event.currency &&
    (item.events as readonly string[]).includes(event.event_id))
  return !!family && (inspectorCategories[0].families as readonly string[]).includes(family.id) &&
    !['840050014', '999010006', '999010007', '999010015'].includes(event.event_id) &&
    event.actual === null && event.previous === null
}

// Display paired monthly readings before paired annual readings. Catalog
// order differs for PCE and euro-area CPI; original source rows stay intact.
const releaseReadingOrder: Record<string, readonly string[]> = {
  fomc: [fomcDecisionId, ...fomcCompanionIds],
  jobs: ['840030016', '840030015', '840030017', '840030018', '840030019', '840030020', '840030023', '840030022', '840030032', '840030024'],
  'us-cpi': ['840030005', '840030006', '840030007', '840030008'],
  pce: ['840010003', '840010001', '840010004', '840010002'],
  ppi: ['840030001', '840030002', '840030003', '840030004'],
  'euro-inflation': ['999030011', '999030010', '999030013', '999030012'],
  'german-inflation': ['276010020', '276010022', '276010021', '276010023'],
}

// Exact publication identity forms the initial releases; verified FOMC
// companions then attach to a decision within its bounded episode window.
// Reference periods and revision/value identities remain on individual rows.
export function groupInspectorReleases(events: InspectorEvent[]): InspectorRelease[] {
  const groups = new Map<string, InspectorRelease>()
  const seen = new Set<string>()
  for (const event of events) {
    const family = inspectorFamilies.find((candidate) => candidate.country === event.country_code &&
      candidate.currency === event.currency && (candidate.events as readonly string[]).includes(event.event_id))
    if (!family || seen.has(event.value_id)) continue
    seen.add(event.value_id)
    const label = releaseLabel(event, family.id) ?? family.label
    const chartTime = inspectorEventChartTime(event)
    const id = JSON.stringify([family.id, event.country_code, event.currency, event.release_at === null ? event.server_time_seconds : event.release_at / 1000,
      event.time_mode, label, event.server_time_seconds <= 0 ? event.value_id : null])
    let group = groups.get(id)
    if (!group) {
      group = { id, familyId: family.id, label, currency: family.currency as 'EUR' | 'USD',
        country: event.country_code, releaseAt: event.release_at, chartTime, serverTime: chartTime ?? event.server_time_seconds,
        timingUncertain: event.time_mode !== 0 || chartTime === null,
        events: [] }
      groups.set(id, group)
    }
    group.events.push(event)
    group.releaseAt ??= event.release_at
    group.chartTime ??= chartTime
    group.timingUncertain ||= event.time_mode !== 0
  }
  const episodes = groupFomcEpisodes([...groups.values()])
  for (const group of episodes) {
    const catalogOrder = inspectorFamilies.find((family) => family.id === group.familyId)!.events as readonly string[]
    const principal = releaseReadingOrder[group.familyId] ?? []
    const order = [...principal, ...catalogOrder.filter((id) => !principal.includes(id))]
    group.events.sort((a, b) => order.indexOf(a.event_id) - order.indexOf(b.event_id) ||
      a.period_seconds - b.period_seconds || a.revision - b.revision || a.value_id.localeCompare(b.value_id))
  }
  return episodes.sort((a, b) => a.serverTime - b.serverTime || a.label.localeCompare(b.label))
}
export function filterInspectorReleases(groups: InspectorRelease[], preferences: InspectorPreferences, range: CalendarDisplayRange | null, brokerTime = false) {
  if (!range) return []
  return groups.filter((group) => {
    const at = brokerTime ? group.serverTime * 1000 : group.releaseAt
    return preferences.families.includes(group.familyId) && at !== null && at >= range.from && at < range.to
  })
}

const timeframeSeconds: Record<ChartTimeframe, number> = { M1: 60, M5: 300, M15: 900, M30: 1800, H1: 3600, H4: 14400, D1: 86400 }
export type InspectorMarker = { release: InspectorRelease; symbol: EventSymbol; time: number }
export function buildInspectorMarkers(groups: InspectorRelease[], preferences: InspectorPreferences, bars: OhlcBar[], timeframe: ChartTimeframe): InspectorMarker[] {
  if (!preferences.showSymbols || !bars.length) return []
  return groups.flatMap((release) => {
    if (release.timingUncertain || release.chartTime === null) return []
    const timestamp = release.chartTime
    let lo = 0, hi = bars.length - 1
    while (lo <= hi) {
      const mid = (lo + hi) >>> 1
      if (Number(bars[mid].time) <= timestamp) lo = mid + 1
      else hi = mid - 1
    }
    const time = hi >= 0 ? Number(bars[hi].time) : null
    // Use the containing candle, never a nearby candle across a gap or a
    // future publication projected onto the final observed candle.
    if (time === null || timestamp >= time + timeframeSeconds[timeframe]) return []
    return [{ release, time, symbol: preferences.symbols[release.familyId] ?? 'star' }]
  })
}

export function inspectorDelta(event: EconomicCalendarEvent): number | null {
  if (event.actual === null || event.previous === null || !Number.isFinite(event.actual) || !Number.isFinite(event.previous)) return null
  const raw = event as EconomicCalendarEvent & { actual_raw_scaled_1e6?: string | null; previous_raw_scaled_1e6?: string | null }
  if (raw.actual_raw_scaled_1e6 != null && raw.previous_raw_scaled_1e6 != null) {
    if (!/^[+-]?\d+$/.test(raw.actual_raw_scaled_1e6) || !/^[+-]?\d+$/.test(raw.previous_raw_scaled_1e6)) return null
    const difference = BigInt(raw.actual_raw_scaled_1e6) - BigInt(raw.previous_raw_scaled_1e6)
    const number = Number(difference)
    return Number.isSafeInteger(number) ? number / 1_000_000 : null
  }
  const scale = 10 ** Math.min(6, Math.max(0, event.digits))
  const actual = Math.round(event.actual * scale), previous = Math.round(event.previous * scale)
  if (!Number.isSafeInteger(actual) || !Number.isSafeInteger(previous) || !Number.isSafeInteger(actual - previous)) return null
  return (actual - previous) / scale
}
export function inspectorValueUnit(event: EconomicCalendarEvent, delta = false): string {
  const isRate = delta && ['840050014', '999010006', '999010007', '999010015'].includes(event.event_id)
  return event.unit === 1 ? delta ? isRate ? ' bp' : ' pp' : '%' :
    event.unit === 3 ? ' h' : ({ 1: 'k', 2: 'M', 3: 'B', 4: 'T' } as Record<number, string>)[event.multiplier] ??
    (event.unit === 0 ? ' pts' : '')
}
export function formatInspectorValue(value: number | null, event: EconomicCalendarEvent, delta = false, maximumFractionDigits = 6): string {
  if (value === null || !Number.isFinite(value)) return '—'
  const isRate = delta && ['840050014', '999010006', '999010007', '999010015'].includes(event.event_id)
  const number = isRate ? value * 100 : value
  const text = number.toLocaleString(undefined, { maximumFractionDigits, signDisplay: delta ? 'exceptZero' : 'auto' })
  return `${text}${inspectorValueUnit(event, delta)}`
}
