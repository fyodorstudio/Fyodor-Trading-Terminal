import type { OhlcBar } from '../../market-data/contracts/OhlcBar'
import type { TimelineReleaseBlock, TimelineSeriesRow } from './CpiEventTimelineTable'
import { curatedFamilyForBlock, curatedGroupName, type CuratedFamilyId } from './timeline-event-families'

export const eventSymbols = [
  ['star', '★', 'Star'], ['sun', '☀', 'Sun'], ['cloud', '☁', 'Cloud'],
  ['umbrella', '☂', 'Umbrella'], ['snowflake', '❄', 'Snowflake'], ['moon', '☾', 'Moon'],
] as const
export type EventSymbol = typeof eventSymbols[number][0]
export type EventSection = 'before' | 'simultaneous' | 'after'
export type TimelineEventGroup = {
  id: string
  family: string
  familyId?: CuratedFamilyId
  legacyIds: string[]
  currency: string
  countryCode: string
  releaseTimestamp: number
  releaseTimeText: string
  timingUncertain: boolean
  section: EventSection
  block: TimelineReleaseBlock
  sources: Map<string, { block: TimelineReleaseBlock; row: TimelineSeriesRow }>
}
export type EventMarker = { group: TimelineEventGroup; symbol: EventSymbol; time: number }

// Presentation families only. Source names, IDs and readings remain on each row.
export function eventFamily(name: string): string {
  if (/\bCPI\b|Consumer Price Index/i.test(name)) return 'CPI'
  if (/\bPPI\b|Producer Price Index/i.test(name)) return 'PPI'
  if (/\bPCE\b|Personal Consumption Expenditures.*Price/i.test(name)) return 'PCE'
  if (/Retail Sales/i.test(name)) return 'Retail Sales'
  if (/Jobless Claims/i.test(name)) return 'Jobless Claims'
  return name.replace(/\s+(?:m\/m|y\/y|q\/q)\s*$/i, '').trim()
}

export function groupTimelineEvents(blocks: TimelineReleaseBlock[], anchorTime: number): TimelineEventGroup[] {
  const groups = new Map<string, TimelineEventGroup>()
  for (const source of blocks) {
    const familyId = curatedFamilyForBlock(source)
    const legacyFamily = eventFamily(source.family)
    const family = familyId ? curatedGroupName(familyId, source) : legacyFamily
    // Uncertain timing cannot be merged into a confirmed release.
    const id = JSON.stringify([family, source.countryCode ?? '', source.currency,
      source.releaseTimestamp, source.timeMode ?? '', Boolean(source.timingUncertain)])
    const legacyId = JSON.stringify([legacyFamily, source.countryCode ?? '', source.currency,
      source.releaseTimestamp, source.timeMode ?? '', Boolean(source.timingUncertain)])
    let group = groups.get(id)
    if (!group) {
      const block = { ...source, id, family, rows: [] as TimelineSeriesRow[] }
      group = { id, family, familyId, legacyIds: [], currency: source.currency, countryCode: source.countryCode ?? '',
        releaseTimestamp: source.releaseTimestamp, releaseTimeText: source.releaseTimeText,
        timingUncertain: Boolean(source.timingUncertain),
        section: source.releaseTimestamp < anchorTime ? 'before' :
          source.releaseTimestamp === anchorTime ? 'simultaneous' : 'after',
        block, sources: new Map() }
      groups.set(id, group)
    }
    if (legacyId !== id && !group.legacyIds.includes(legacyId)) group.legacyIds.push(legacyId)
    source.rows.forEach((row, index) => {
      const selectionKey = `${source.id}:${row.series}:${index}`
      group.block.rows.push({ ...row, selectionKey })
      group.sources.set(selectionKey, { block: source, row })
    })
  }
  return [...groups.values()].sort((a, b) => a.releaseTimestamp - b.releaseTimestamp ||
    a.countryCode.localeCompare(b.countryCode) || a.family.localeCompare(b.family))
}

export function eventsInWindow(groups: TimelineEventGroup[], bars: OhlcBar[]): TimelineEventGroup[] {
  if (!bars.length) return []
  const start = Number(bars[0].time)
  const end = Number(bars[bars.length - 1].time) + 3600
  return groups.filter((group) => group.releaseTimestamp >= start && group.releaseTimestamp < end)
}

// Only a containing observed H1 candle qualifies. Never snap a weekend/date-only
// event onto a different trading hour or pretend to know its publication time.
export function containingEventBar(timestamp: number, bars: OhlcBar[]): number | null {
  let lo = 0
  let hi = bars.length - 1
  while (lo <= hi) {
    const mid = (lo + hi) >>> 1
    if (Number(bars[mid].time) <= timestamp) lo = mid + 1
    else hi = mid - 1
  }
  const time = hi >= 0 ? Number(bars[hi].time) : null
  return time !== null && timestamp < time + 3600 ? time : null
}

export function buildEventMarkers(groups: TimelineEventGroup[], selected: Record<string, EventSymbol>, bars: OhlcBar[]): EventMarker[] {
  return groups.flatMap((group) => {
    const symbol = selected[group.id]
    const time = containingEventBar(group.releaseTimestamp, bars)
    return symbol && !group.timingUncertain && time !== null ? [{ group, symbol, time }] : []
  })
}

export function symbolGlyph(symbol: EventSymbol): string {
  return eventSymbols.find(([id]) => id === symbol)?.[1] ?? '★'
}

export function isEventSymbol(value: unknown): value is EventSymbol {
  return eventSymbols.some(([id]) => id === value)
}
