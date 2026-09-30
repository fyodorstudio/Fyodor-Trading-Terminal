export const bundleComparisons = [
  ['CANDIDATE_1_HEADLINE_MM', 'Headline m/m direction'],
  ['CANDIDATE_2_CORE_MM_LED', 'Core m/m direction'],
  ['CANDIDATE_3_CONCORDANT_MM', 'Headline + core agree'],
  ['CANDIDATE_4_CONFLICT_FILTERED_HEADLINE', 'Headline, conflicts excluded'],
  ['CONFLICT_SUBSTUDY_A_HEADLINE', 'Conflicts: headline direction'],
  ['CONFLICT_SUBSTUDY_B_CORE', 'Conflicts: core direction'],
] as const

export type BundleComparison = typeof bundleComparisons[number][0]
export type BundlePanel = 'FULL_PANEL' | 'JOBLESS_CLAIMS_CLEAN'
export type BundleRule = {
  comparison: BundleComparison
  panel: BundlePanel
  horizon: 60 | 120 | 240
  stop: number
  target: number
}
export type BundleReading = {
  name: string
  actual: number | null
  previous: number | null
  delta: number | null
  sign: string
}
export type BundleEpisode = {
  id: string
  releaseTime: number
  releaseText: string
  entryTime: number | null
  entryText: string
  year: number
  entryPrice: number | null
  atr: number | null
  claimsCollision: boolean
  conflict: boolean
  concordance: string
  readings: BundleReading[]
}
export type BundleTrial = [episodeIndex: number, direction: number, exitKind: number, exitH: number,
  grossR: number, dualTouch: boolean, openingGap: boolean]
export type BundleSummary = {
  bundles: number
  trades: number
  tp: number
  sl: number
  expiry: number
  dual: number
  grossR: number
  meanR: number
  loyo: string
}
export type BundleSnapshot = {
  schema: number
  status: string
  selectionPolicy: string
  pair: string
  study: string
  run: string
  sourceSha256: string
  candlesSha256: string
  sourceHashes: Record<string, string>
  episodes: BundleEpisode[]
  trials: Record<string, BundleTrial[]>
  summaries: Record<string, BundleSummary>
}

export function bundleCellKey(rule: BundleRule) {
  return `${rule.comparison}|${rule.horizon}|${rule.stop}:${rule.target}`
}

export function bundleAvailableTrials(data: BundleSnapshot, rule: BundleRule) {
  return data.trials[bundleCellKey(rule)] ?? []
}

export function bundleExclusion(episode: BundleEpisode, rule: BundleRule) {
  return rule.panel === 'JOBLESS_CLAIMS_CLEAN' && episode.claimsCollision ? 'Jobless Claims co-release' : null
}

export function bundlePriceLevels(episode: BundleEpisode, trial: BundleTrial, rule: BundleRule) {
  if (episode.entryPrice == null || episode.atr == null) return null
  return {
    entry: episode.entryPrice,
    stop: episode.entryPrice - trial[1] * rule.stop * episode.atr,
    target: episode.entryPrice + trial[1] * rule.target * episode.atr,
    direction: trial[1],
  }
}

export function validateBundleSelection(data: BundleSnapshot, rule: BundleRule) {
  const summary = data.summaries[`${rule.panel}|${bundleCellKey(rule)}`]
  const all = bundleAvailableTrials(data, rule)
  const trials = all.filter((trial) => !bundleExclusion(data.episodes[trial[0]], rule))
  if (!summary || trials.length !== summary.trades || new Set(trials.map((trial) => trial[0])).size !== summary.bundles
      || trials.filter((trial) => trial[2] === 0).length !== summary.tp
      || trials.filter((trial) => trial[2] === 1).length !== summary.sl
      || trials.filter((trial) => trial[2] === 2).length !== summary.expiry
      || trials.filter((trial) => trial[5]).length !== summary.dual
      || Math.abs(trials.reduce((sum, trial) => sum + trial[4], 0) - summary.grossR) > 0.0002) {
    throw new Error('The CPI bundle episodes do not reconcile to the pinned summary. Nothing was plotted.')
  }
  return { summary, trials }
}
