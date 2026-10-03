import type { TimelineReleaseBlock, TimelineSeriesRow } from './CpiEventTimelineTable'
import { curatedFamilyForBlock } from './timeline-event-families'

export type ReleaseSummaryLine = {
  label: string
  values: { label: string; delta: number | null }[]
  unit: 'pp' | 'bp'
  sum?: number | null
  assessment: string
  reason?: string
}

// Catalog IDs select one definition of headline/core. Index levels, alternate
// core definitions and quarterly GDP/PCE readings never enter these pairs.
const inflationPairs = [
  { country: 'US', currency: 'USD', name: 'CPI', mm: ['840030005', '840030006'], yy: ['840030007', '840030008'] },
  { country: 'US', currency: 'USD', name: 'PPI', mm: ['840030001', '840030002'], yy: ['840030003', '840030004'] },
  { country: 'US', currency: 'USD', name: 'PCE', mm: ['840010003', '840010001'], yy: ['840010004', '840010002'] },
  { country: 'EU', currency: 'EUR', name: 'CPI', mm: ['999030011', '999030010'], yy: ['999030013', '999030012'] },
] as const

// Fixed decimal arithmetic on the exported readings avoids binary rounding
// artifacts. Unsupported precision or malformed data remains incomplete.
const scale = 1_000_000
function decimal(value: TimelineSeriesRow['delta']): number | null {
  if (value === null || value === undefined) return null
  const match = /^([+-]?)(\d+)(?:\.(\d{1,6}))?$/.exec(String(value).trim())
  if (!match) return null
  const magnitude = Number(match[2]) * scale + Number((match[3] ?? '').padEnd(6, '0'))
  const result = match[1] === '-' ? -magnitude : magnitude
  return Number.isSafeInteger(result) ? result : null
}

function reading(block: TimelineReleaseBlock, id: string) {
  const rows = block.rows.filter((row) => !row.isSumRow && !row.isDerived && row.eventId === id)
  if (rows.length !== 1) return { delta: null, row: undefined,
    reason: rows.length ? 'Multiple readings for the same series; inspect reference months and revisions.' : 'Required reading is missing.' }
  const row = rows[0]
  if (row.countryCode && row.countryCode !== block.countryCode) return { delta: null, row, reason: 'Reading country does not match this release.' }
  if (row.unit !== 'CALENDAR_UNIT_PERCENT' || row.multiplier !== 'CALENDAR_MULTIPLIER_NONE') {
    return { delta: null, row, reason: 'Unsupported units; percentage readings are required.' }
  }
  const actual = decimal(row.actual), previous = decimal(row.previous), delta = decimal(row.delta)
  if (actual === null || previous === null || delta === null) return { delta: null, row, reason: 'Actual, Previous or A−P is missing or invalid.' }
  if (actual - previous !== delta) return { delta: null, row, reason: 'Exported A−P does not match Actual minus Previous.' }
  return { delta, row, reason: undefined }
}

function agreement(headline: number, core: number): string {
  if (headline > 0 && core > 0) return 'Both higher'
  if (headline < 0 && core < 0) return 'Both lower'
  if (headline === 0 && core === 0) return 'Both unchanged'
  if (headline * core < 0) return 'Mixed'
  const change = (n: number) => n > 0 ? 'higher' : n < 0 ? 'lower' : 'unchanged'
  return `Headline ${change(headline)} · core ${change(core)}`
}

export function releaseSummary(block: TimelineReleaseBlock): ReleaseSummaryLine[] {
  const pair = inflationPairs.find((candidate) => candidate.country === block.countryCode && candidate.currency === block.currency &&
    block.rows.some((row) => [...candidate.mm, ...candidate.yy].some((id) => id === row.eventId)))
  if (pair) return (['mm', 'yy'] as const).map((period) => {
    const [headline, core] = pair[period].map((id) => reading(block, id))
    const periodMatches = Boolean(headline.row?.periodServerText && core.row?.periodServerText &&
      headline.row.periodServerText === core.row.periodServerText)
    const reason = headline.reason ?? core.reason ?? (!periodMatches ? 'Reference months are missing or different.' : undefined)
    const valid = !reason && headline.delta !== null && core.delta !== null
    return { label: `${pair.name} ${period === 'mm' ? 'm/m' : 'y/y'}`, unit: 'pp',
      values: [{ label: 'Headline', delta: headline.delta === null ? null : headline.delta / scale },
        { label: 'Core', delta: core.delta === null ? null : core.delta / scale }],
      sum: valid ? (headline.delta! + core.delta!) / scale : null,
      assessment: valid ? agreement(headline.delta!, core.delta!) : 'Incomplete', reason }
  })

  // German CPI and HICP are two headline measures, not headline/core. Preserve
  // their separate changes; adding them would count inflation definitions twice.
  if (block.countryCode === 'DE' && block.currency === 'EUR' &&
    block.rows.some((row) => ['276010020', '276010021', '276010022', '276010023'].includes(row.eventId ?? ''))) {
    return [['CPI m/m', '276010020'], ['CPI y/y', '276010021'], ['HICP m/m', '276010022'], ['HICP y/y', '276010023']]
      .filter(([, id]) => block.rows.some((row) => row.eventId === id)).map(([label, id]) => {
        const value = reading(block, id)
        return { label, unit: 'pp', values: [{ label: 'A−P', delta: value.delta === null ? null : value.delta / scale }],
          assessment: value.delta === null ? 'Incomplete' : value.delta > 0 ? 'Higher' : value.delta < 0 ? 'Lower' : 'Unchanged',
          reason: value.reason }
      })
  }

  const family = curatedFamilyForBlock(block)
  const rateId = block.countryCode === 'US' && block.currency === 'USD' && block.rows.some((row) => row.eventId === '840050014') ? '840050014' :
    block.countryCode === 'EU' && block.currency === 'EUR' && block.rows.some((row) => ['999010006', '999010007', '999010015'].includes(row.eventId ?? '')) ? '999010006' : null
  if (rateId) {
    const rate = reading(block, rateId)
    return [{ label: rateId === '999010006' ? 'ECB deposit rate' : 'Fed decision rate', unit: 'bp',
      values: [{ label: 'A−P', delta: rate.delta === null ? null : rate.delta * 100 / scale }],
      assessment: rate.delta === null ? 'Incomplete' : rate.delta > 0 ? 'Hike' : rate.delta < 0 ? 'Cut' : 'Hold', reason: rate.reason }]
  }
  if (family && ['fomc', 'ecb', 'fed-chair', 'ecb-president', 'fed-minutes', 'ecb-accounts'].includes(family)) {
    return [{ label: 'Policy commentary', unit: 'bp', values: [], assessment: 'No numerical rate-change summary',
      reason: 'The calendar entry does not quantify guidance, speeches, projections or meeting text.' }]
  }
  return []
}

export function signedChange(value: number): string {
  return `${value > 0 ? '+' : ''}${value === 0 ? '0' : value.toFixed(6).replace(/\.?0+$/, '')}`
}
