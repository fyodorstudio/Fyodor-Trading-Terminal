import type { OhlcBar } from '../market-data/contracts/OhlcBar'
import type { UTCTimestamp } from 'lightweight-charts'

export type ResearchFamily = 'CPI' | 'NFP'
export type ResearchSignal = 'af' | 'ap'
export type ResearchCohort = 'ALL_ELIGIBLE' | 'COMMON_H240'
export type ResearchPanel = 'FULL_PANEL' | 'JOBLESS_CLAIMS_CLEAN' | 'PRIMARY_PANEL'
export type ResearchTrial = [episodeIndex: number, exitKind: number, exitH: number, grossR: string,
  dualTouch: number, commonH240: number, openingGap: number]

export type ResearchEpisode = {
  id: string
  releaseTime: number
  releaseText: string
  entryTime: number
  entryText: string
  year: number
  actual: string
  forecast: string
  previous: string
  entryPrice: number
  atr: number
  joblessCollision: boolean
  cadJobsCollision: boolean
  commonH240: boolean
  af: { direction: number; eligible: boolean }
  ap: { direction: number; eligible: boolean }
}

export type ResearchSummary = {
  panel: ResearchPanel
  pair: 'EURUSD'
  signal: ResearchSignal
  cohort: ResearchCohort
  horizon: number
  stop: number
  target: number
  bundles: number
  trades: number
  tp: number
  sl: number
  expiry: number
  dual: number
  meanR: string
  grossR: string
  tpMedianH: string
  slMedianH: string
  allMedianH: string
  allP90H: string
  loyoPositive: string
  loyoTotal: string
  adjacentMeanR: string
}

export type ResearchFamilyData = {
  run: string
  codeCommit: string
  sourceHashes: Record<string, string>
  episodes: ResearchEpisode[]
  trials: Record<string, ResearchTrial[]>
  summaries: ResearchSummary[]
}

export type ResearchAuditData = {
  schema: number
  status: string
  selectionPolicy: string
  pair: string
  viewerSha256: string
  candlesSha256: string
  bars: [number, number, number, number, number][]
  families: Record<ResearchFamily, ResearchFamilyData>
}

export type ResearchRule = {
  family: ResearchFamily
  signal: ResearchSignal
  panel: ResearchPanel
  cohort: ResearchCohort
  horizon: number
  stop: number
  target: number
}

export function researchPriceLevels(episode: ResearchEpisode, rule: ResearchRule) {
  const direction = episode[rule.signal].direction
  return {
    entry: episode.entryPrice,
    stop: episode.entryPrice - direction * rule.stop * episode.atr,
    target: episode.entryPrice + direction * rule.target * episode.atr,
    direction,
  }
}

export function cleanPanel(family: ResearchFamily): ResearchPanel {
  return family === 'CPI' ? 'JOBLESS_CLAIMS_CLEAN' : 'PRIMARY_PANEL'
}

export function selectedSummary(data: ResearchAuditData, rule: ResearchRule): ResearchSummary | null {
  return data.families[rule.family].summaries.find((row) =>
    row.panel === rule.panel && row.signal === rule.signal && row.cohort === rule.cohort
    && row.horizon === rule.horizon && row.stop === rule.stop && row.target === rule.target,
  ) ?? null
}

export function selectedTrials(data: ResearchAuditData, rule: ResearchRule): ResearchTrial[] {
  const family = data.families[rule.family]
  const key = `${rule.signal}|${rule.horizon}|${rule.stop}:${rule.target}`
  return (family.trials[key] ?? []).filter((trade) => {
    const episode = family.episodes[trade[0]]
    return (rule.cohort !== 'COMMON_H240' || Boolean(trade[5]))
      && (rule.family !== 'CPI' || rule.panel !== 'JOBLESS_CLAIMS_CLEAN' || !episode.joblessCollision)
  })
}

export function validateSelection(data: ResearchAuditData, rule: ResearchRule) {
  const summary = selectedSummary(data, rule)
  const trials = selectedTrials(data, rule)
  if (!summary || trials.length !== summary.trades
      || trials.filter((t) => t[1] === 0).length !== summary.tp
      || trials.filter((t) => t[1] === 1).length !== summary.sl
      || trials.filter((t) => t[1] === 2).length !== summary.expiry
      || new Set(trials.map((t) => t[0])).size !== summary.bundles
      || Math.abs(trials.reduce((sum, t) => sum + Number(t[3]), 0) - Number(summary.grossR)) > 0.0002) {
    throw new Error('The selected research trades do not reconcile to the pinned summary. Nothing was plotted.')
  }
  return { summary, trials }
}

export function snapshotAround(data: ResearchAuditData, entryTime: number, horizon: number): OhlcBar[] {
  if (![60, 120, 240].includes(horizon)) throw new Error('Unsupported research horizon.')
  let left = 0
  let right = data.bars.length
  while (left < right) {
    const middle = (left + right) >>> 1
    if (data.bars[middle][0] < entryTime) left = middle + 1
    else right = middle
  }
  if (data.bars[left]?.[0] !== entryTime) throw new Error('The selected research entry candle is missing.')
  if (left + horizon > data.bars.length) throw new Error(`The selected research H${horizon} path is incomplete.`)
  // H1 is the entry candle. Retain earlier candles for chart context, but never reveal a bar after Hmax.
  return data.bars.slice(Math.max(0, left - 120), left + horizon)
    .map(([time, open, high, low, close]) => ({ time: time as UTCTimestamp, open, high, low, close }))
}

export function exitLabel(kind: number) {
  return kind === 0 ? 'TP first' : kind === 1 ? 'SL first' : 'Expiry'
}
