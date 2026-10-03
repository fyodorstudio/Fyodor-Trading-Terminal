import timelineManifest from '../cpi-event-timeline-manifest.json'
import type { TimelineReleaseBlock, TimelineSeriesRow } from './CpiEventTimelineTable'

export { timelineManifest }

export type CpiTimelineIndexEpisode = {
  episodeId: string
  releaseTimestamp: number
  releaseTimeText: string
  entryTimestamp: number
  entryTimeText: string
  year: number
  cohort: string
  preReleaseAtr: number
  payloadFile: string
  cpiSummary: Record<
    string,
    {
      delta: string | null
      direction: string | null
      grossR: number | null
      outcome: string | null
      isEligible: boolean
      exclusionReason: string | null
    }
  >
  surroundingSummary?: {
    totalReferences: number
    beforeCount: number
    simultaneousCount: number
    preEntryCount: number
    afterEntryCount: number
    uncertainCount: number
  }
}

export type CpiTimelineIndex = {
  study: string
  status: string
  generatedAt: string
  parentManifestSha256: string
  parameters: {
    pair: string
    horizonBars: number
    stopAtr: number
    targetAtr: number
    dualTouchMode: string
    pipSize: number
    maxEntryDelaySeconds: number
    maxUnscheduledWeekdayGapSeconds: number
    allowScheduledHolidays: boolean
  }
  totalEpisodes: number
  episodes: CpiTimelineIndexEpisode[]
}

export type CpiTimelineEpisodePayload = {
  episodeId: string
  releaseTimestamp: number
  releaseTimeText: string
  year: number
  cohort: string
  preReleaseAtr: number
  cpiBlock: TimelineReleaseBlock
  surroundingBlocks: TimelineReleaseBlock[]
}

export type EvaluatedTradeLevel = {
  sourceType: string
  releaseId: string
  eventId: string
  valueId?: string | null
  seriesKey: string
  direction?: string | null
  isEligible: boolean
  exclusionReason?: string | null
  entryPrice?: number | null
  atr?: number | null
  stopPrice?: number | null
  targetPrice?: number | null
  stopAtr?: number | null
  targetAtr?: number | null
  exitReason?: string | null
  grossR?: number | null
  entryBarTimestamp?: number | null
  entryBarServerText?: string | null
  exitTimeServerText?: string | null
  exitBarIdx?: number | null
  barsToExit?: number | null
  dualTouch?: boolean
  isOpeningGap?: boolean
  gapExecutableGrossR?: number | null
  targetFirstGrossR?: number | null
}

export type TimelineChartLevels = {
  label?: string
  entryPrice: number
  stopPrice: number
  targetPrice: number
  direction: 'Long' | 'Short'
  atr: number
  entryTimestamp: number
}

export async function sha256Hex(text: string): Promise<string> {
  const encoded = new TextEncoder().encode(text)
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoded)
  return Array.from(new Uint8Array(hashBuffer), (b) => b.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase()
}

export function formatUnit(unit?: string | null, multiplier?: string | null): string {
  if (!unit || unit === 'CALENDAR_UNIT_NONE') {
    if (multiplier === 'CALENDAR_MULTIPLIER_THOUSANDS') return 'k'
    if (multiplier === 'CALENDAR_MULTIPLIER_MILLIONS') return 'M'
    if (multiplier === 'CALENDAR_MULTIPLIER_BILLIONS') return 'B'
    return ''
  }
  if (unit === 'CALENDAR_UNIT_PERCENT') return '%'
  if (unit === 'CALENDAR_UNIT_CURRENCY' || unit === 'CALENDAR_UNIT_USD') {
    if (multiplier === 'CALENDAR_MULTIPLIER_BILLIONS') return 'B'
    if (multiplier === 'CALENDAR_MULTIPLIER_MILLIONS') return 'M'
    if (multiplier === 'CALENDAR_MULTIPLIER_THOUSANDS') return 'k'
    return ''
  }
  if (
    unit === 'CALENDAR_UNIT_JOB' ||
    unit === 'CALENDAR_UNIT_PEOPLE' ||
    unit === 'CALENDAR_UNIT_POSITION' ||
    unit === 'CALENDAR_UNIT_MORTGAGE' ||
    unit === 'CALENDAR_UNIT_BUILDING'
  ) {
    if (multiplier === 'CALENDAR_MULTIPLIER_THOUSANDS') return 'k'
    if (multiplier === 'CALENDAR_MULTIPLIER_MILLIONS') return 'M'
    if (multiplier === 'CALENDAR_MULTIPLIER_BILLIONS') return 'B'
    return ''
  }
  if (unit === 'CALENDAR_UNIT_BARREL') return multiplier === 'CALENDAR_MULTIPLIER_MILLIONS' ? 'M bbl' : 'bbl'
  if (unit === 'CALENDAR_UNIT_CUBICFEET') return multiplier === 'CALENDAR_MULTIPLIER_BILLIONS' ? 'B cu ft' : 'cu ft'
  if (unit === 'CALENDAR_UNIT_HOUR') return 'h'
  if (unit === 'CALENDAR_UNIT_RIG') return 'rigs'
  if (unit === 'CALENDAR_UNIT_VOTE') return 'votes'
  return ''
}

export async function fetchTimelineIndex(signal?: AbortSignal): Promise<CpiTimelineIndex> {
  if (signal?.aborted) {
    throw new DOMException('Aborted', 'AbortError')
  }
  const resp = await fetch(timelineManifest.indexPath, { signal })
  if (signal?.aborted) {
    throw new DOMException('Aborted', 'AbortError')
  }
  if (!resp.ok) {
    throw new Error(`Failed to fetch timeline index (HTTP ${resp.status})`)
  }
  const rawText = await resp.text()
  if (signal?.aborted) {
    throw new DOMException('Aborted', 'AbortError')
  }
  const actualHash = await sha256Hex(rawText)
  if (signal?.aborted) {
    throw new DOMException('Aborted', 'AbortError')
  }
  if (actualHash !== timelineManifest.indexSha256) {
    throw new Error(
      `Timeline index SHA-256 mismatch! Manifest: ${timelineManifest.indexSha256}, Actual: ${actualHash}`
    )
  }
  return JSON.parse(rawText) as CpiTimelineIndex
}

export async function fetchTimelineTradeLevels(
  signal?: AbortSignal
): Promise<Record<string, EvaluatedTradeLevel>> {
  if (signal?.aborted) {
    throw new DOMException('Aborted', 'AbortError')
  }
  const resp = await fetch(timelineManifest.tradeLevelsPath, { signal })
  if (signal?.aborted) {
    throw new DOMException('Aborted', 'AbortError')
  }
  if (!resp.ok) {
    throw new Error(`Failed to fetch timeline trade levels (HTTP ${resp.status})`)
  }
  const rawText = await resp.text()
  if (signal?.aborted) {
    throw new DOMException('Aborted', 'AbortError')
  }
  const actualHash = await sha256Hex(rawText)
  if (signal?.aborted) {
    throw new DOMException('Aborted', 'AbortError')
  }
  if (actualHash !== timelineManifest.tradeLevelsSha256) {
    throw new Error(
      `Timeline trade levels SHA-256 mismatch! Manifest: ${timelineManifest.tradeLevelsSha256}, Actual: ${actualHash}`
    )
  }
  return JSON.parse(rawText) as Record<string, EvaluatedTradeLevel>
}

export async function fetchTimelineEpisode(
  episodeId: string,
  signal?: AbortSignal
): Promise<CpiTimelineEpisodePayload> {
  if (signal?.aborted) {
    throw new DOMException('Aborted', 'AbortError')
  }
  const epInfo = (timelineManifest.episodes as Record<string, { file: string; sha256: string; sizeBytes: number }>)[
    episodeId
  ]
  if (!epInfo) {
    throw new Error(`Episode ${episodeId} not found in publication manifest`)
  }

  const url = `${timelineManifest.episodesDir}/${epInfo.file}`
  const resp = await fetch(url, { signal })
  if (signal?.aborted) {
    throw new DOMException('Aborted', 'AbortError')
  }
  if (!resp.ok) {
    throw new Error(`Failed to fetch episode payload ${episodeId} (HTTP ${resp.status})`)
  }
  const rawText = await resp.text()
  if (signal?.aborted) {
    throw new DOMException('Aborted', 'AbortError')
  }
  const actualHash = await sha256Hex(rawText)
  if (signal?.aborted) {
    throw new DOMException('Aborted', 'AbortError')
  }
  if (actualHash !== epInfo.sha256) {
    throw new Error(
      `Episode payload ${episodeId} SHA-256 mismatch! Expected: ${epInfo.sha256}, Actual: ${actualHash}`
    )
  }
  return JSON.parse(rawText) as CpiTimelineEpisodePayload
}

export function findRowTradeLevels(
  levelsMap: Record<string, EvaluatedTradeLevel> | null,
  episodeId: string,
  block: TimelineReleaseBlock,
  row: TimelineSeriesRow
): EvaluatedTradeLevel | null {
  if (!levelsMap) return null

  // 1. CPI Series
  const seriesToKey: Record<string, string> = {
    'Headline m/m': 'headline_mm',
    'Core m/m': 'core_mm',
    'Headline y/y': 'headline_yy',
    'Core y/y': 'core_yy',
    'm/m Sum': 'mm_sum',
    'y/y Sum': 'yy_sum',
  }

  if (seriesToKey[row.series]) {
    const cpiKey = `${episodeId}:${seriesToKey[row.series]}`
    if (levelsMap[cpiKey]) return levelsMap[cpiKey]
  }

  // 2. Non-CPI with row valueId
  const rowObj = row as any
  const valueId = rowObj.valueId != null ? String(rowObj.valueId) : null
  const eventId = rowObj.eventId != null ? String(rowObj.eventId) : block.id

  if (valueId) {
    const valKey = `value_${valueId}`
    if (levelsMap[valKey]) return levelsMap[valKey]

    const eventValKey = `${eventId}_${valueId}`
    if (levelsMap[eventValKey]) return levelsMap[eventValKey]
  }

  return null
}

export function deriveChartLevels(
  level: EvaluatedTradeLevel | null,
  fallbackEntryTimestamp?: number | null
): TimelineChartLevels | null {
  if (!level || !level.isEligible) return null
  if (level.entryPrice == null || level.stopPrice == null || level.targetPrice == null || level.atr == null) {
    return null
  }
  if (level.direction !== 'Long' && level.direction !== 'Short') return null

  const entryTs = level.entryBarTimestamp ?? fallbackEntryTimestamp
  if (!entryTs) return null

  return {
    entryPrice: level.entryPrice,
    stopPrice: level.stopPrice,
    targetPrice: level.targetPrice,
    direction: level.direction,
    atr: level.atr,
    entryTimestamp: entryTs,
  }
}
