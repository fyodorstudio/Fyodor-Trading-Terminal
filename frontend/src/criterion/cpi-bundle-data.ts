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
export type BundleEligibilityCategory =
  | 'ELIGIBLE'
  | 'MISSING_INPUTS'
  | 'ZERO_CHANGE'
  | 'CONFLICT_REJECTED'
  | 'NON_CONFLICT'
  | 'COVERAGE_FAILURE'
  | 'UNKNOWN'

export type BundleEligibility = {
  eligible: boolean
  exclusion: string
  category: BundleEligibilityCategory
  reason: string
}

export type BundleCoverage = {
  hasEntryCandle: boolean
  hasAtrWarmup: boolean
  hasH60Bars: boolean
  hasH60GapFree?: boolean
  hasH120Bars: boolean
  hasH120GapFree?: boolean
  hasH240Bars: boolean
  hasH240GapFree?: boolean
  isEntryDelayValid: boolean
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
  eligibility?: Record<BundleComparison, BundleEligibility>
  exclusions?: Record<BundleComparison, string>
  coverage?: BundleCoverage
  headlineMmSign?: string
  coreMmSign?: string
  headlineYySign?: string
  coreYySign?: string
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

export function isBundleEpisodeEligible(episode: BundleEpisode, comparison: BundleComparison): boolean {
  if (episode.eligibility?.[comparison]) {
    return episode.eligibility[comparison].eligible
  }
  return false
}

export function isBundleEpisodeIncluded(episode: BundleEpisode, rule: BundleRule): boolean {
  if (!isBundleEpisodeEligible(episode, rule.comparison)) return false
  if (rule.panel === 'JOBLESS_CLAIMS_CLEAN' && episode.claimsCollision) return false
  return true
}

export type BundleEpisodeInclusion = {
  isEligible: boolean
  isClaimsExcluded: boolean
  isIncluded: boolean
  trial: BundleTrial | null
}

export function getBundleCellTrials(data: BundleSnapshot, rule: BundleRule): Map<number, BundleTrial> {
  const cellKey = bundleCellKey(rule)
  const rawTrials = data.trials[cellKey]
  if (!rawTrials) {
    throw new Error(`Missing trials array for cell ${cellKey}`)
  }
  const trialMap = new Map<number, BundleTrial>()

  for (let i = 0; i < rawTrials.length; i++) {
    const trial = rawTrials[i]
    const episodeIndex = trial[0]
    if (!Number.isInteger(episodeIndex) || episodeIndex < 0 || episodeIndex >= data.episodes.length) {
      throw new Error(`Trial at index ${i} in cell ${cellKey} has invalid episode index: ${String(episodeIndex)}`)
    }
    if (trialMap.has(episodeIndex)) {
      throw new Error(`Cell ${cellKey} contains duplicate trial for episode index ${episodeIndex} (${data.episodes[episodeIndex].id})`)
    }
    trialMap.set(episodeIndex, trial)
  }

  return trialMap
}

export function getBundleEpisodeInclusion(
  data: BundleSnapshot,
  episodeIndex: number,
  rule: BundleRule,
  trialMap?: Map<number, BundleTrial>,
): BundleEpisodeInclusion {
  if (!Number.isInteger(episodeIndex) || episodeIndex < 0 || episodeIndex >= data.episodes.length) {
    throw new Error(`Bundle episode index ${String(episodeIndex)} out of range`)
  }
  const episode = data.episodes[episodeIndex]
  const isEligible = isBundleEpisodeEligible(episode, rule.comparison)
  const cellKey = bundleCellKey(rule)
  const trials = trialMap ?? getBundleCellTrials(data, rule)
  const trial = trials.get(episodeIndex) ?? null

  if (isEligible && !trial) {
    throw new Error(`Episode ${episode.id} marked eligible under ${rule.comparison} but has no priced trial in cell ${cellKey}`)
  }
  if (!isEligible && trial) {
    throw new Error(`Episode ${episode.id} marked ineligible under ${rule.comparison} but has a priced trial in cell ${cellKey}`)
  }

  const isClaimsExcluded = rule.panel === 'JOBLESS_CLAIMS_CLEAN' && Boolean(episode.claimsCollision)
  const isIncluded = isEligible && !isClaimsExcluded

  return {
    isEligible,
    isClaimsExcluded,
    isIncluded,
    trial,
  }
}

export function bundleEpisodeExclusionReasons(episode: BundleEpisode, rule: BundleRule): string[] {
  const reasons: string[] = []
  if (rule.panel === 'JOBLESS_CLAIMS_CLEAN' && episode.claimsCollision) {
    reasons.push('Excluded simultaneous Jobless Claims')
  }
  const el = episode.eligibility?.[rule.comparison]
  if (el && !el.eligible) {
    reasons.push(el.reason)
  }
  return reasons
}

// A descriptive chart cue only. The pinned V3 simulations require m/m anchors;
// y/y agreement must never be substituted into their trade counts or P/L.
export function bundleYoyOnlyDirection(episode: BundleEpisode): 'long' | 'short' | null {
  if (episode.readings.length !== 4 || episode.readings[0].sign !== 'MISSING'
      || episode.readings[1].sign !== 'MISSING') return null
  const headline = episode.readings[2].delta
  const core = episode.readings[3].delta
  if (headline == null || core == null || headline === 0 || core === 0
      || Math.sign(headline) !== Math.sign(core)) return null
  // For EURUSD, cooling USD inflation maps to EURUSD up and vice versa.
  return headline < 0 ? 'long' : 'short'
}

export function bundlePriceLevels(episode: BundleEpisode, trial: BundleTrial, rule: BundleRule) {
  if (!isBundleEpisodeIncluded(episode, rule)) return null
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
  const trialMap = getBundleCellTrials(data, rule)
  const includedTrials: BundleTrial[] = []
  const includedEpisodeIndices = new Set<number>()
  const claimsExcludedTrials: BundleTrial[] = []

  for (let index = 0; index < data.episodes.length; index++) {
    const inclusion = getBundleEpisodeInclusion(data, index, rule, trialMap)
    if (inclusion.trial) {
      if (inclusion.isIncluded) {
        includedTrials.push(inclusion.trial)
        includedEpisodeIndices.add(index)
      } else if (inclusion.isClaimsExcluded) {
        claimsExcludedTrials.push(inclusion.trial)
      }
    }
  }

  if (includedTrials.length + claimsExcludedTrials.length !== trialMap.size) {
    throw new Error(`Not all raw trials in cell ${bundleCellKey(rule)} were accounted for under ${rule.panel}`)
  }

  if (!summary || includedTrials.length !== summary.trades || includedEpisodeIndices.size !== summary.bundles
      || includedTrials.filter((trial) => trial[2] === 0).length !== summary.tp
      || includedTrials.filter((trial) => trial[2] === 1).length !== summary.sl
      || includedTrials.filter((trial) => trial[2] === 2).length !== summary.expiry
      || includedTrials.filter((trial) => trial[5]).length !== summary.dual
      || Math.abs(includedTrials.reduce((sum, trial) => sum + trial[4], 0) - summary.grossR) > 0.0002) {
    throw new Error('The CPI bundle episodes do not reconcile to the pinned summary. Nothing was plotted.')
  }
  return { summary, trials: includedTrials }
}

export type BundleChartArrow = {
  id: string
  time: number
  entryPrice: number
  direction: 'long' | 'short'
  contextOnly?: boolean
}

export function deriveBundleChartArrows(
  data: BundleSnapshot,
  _rule: BundleRule,
  auditBars: { time: number | string }[] | null,
  bundleSelection: { episode: BundleEpisode; trial: BundleTrial | null } | null,
  includedTrials: BundleTrial[],
): BundleChartArrow[] {
  if (!auditBars || auditBars.length === 0) return []
  const first = Number(auditBars[0]?.time)
  const last = Number(auditBars[auditBars.length - 1]?.time)

  const visible = includedTrials.map((trial) => ({ episode: data.episodes[trial[0]], trial }))
  const arrows: BundleChartArrow[] = visible
    .filter(({ episode }) => episode.entryTime != null && episode.entryTime >= first && episode.entryTime <= last)
    .map(({ episode, trial }) => ({
      id: `bundle:${episode.id}`,
      time: episode.entryTime!,
      entryPrice: episode.entryPrice!,
      direction: trial[1] > 0 ? 'long' : 'short',
    }))

  const contextEpisode = bundleSelection?.episode
  const contextDirection = contextEpisode && !bundleSelection?.trial ? bundleYoyOnlyDirection(contextEpisode) : null
  if (
    contextEpisode &&
    contextDirection &&
    contextEpisode.entryTime != null &&
    contextEpisode.entryPrice != null &&
    contextEpisode.entryTime >= first &&
    contextEpisode.entryTime <= last
  ) {
    arrows.push({
      id: `bundle:${contextEpisode.id}`,
      time: contextEpisode.entryTime,
      entryPrice: contextEpisode.entryPrice,
      direction: contextDirection,
      contextOnly: true,
    })
  }

  return arrows
}

export function deriveBundlePriceLevels(
  data: BundleSnapshot,
  rule: BundleRule,
  bundleSelection: { episode: BundleEpisode; trial: BundleTrial | null } | null,
) {
  if (!bundleSelection || !bundleSelection.trial) return null
  const episodeIndex = data.episodes.findIndex((e) => e.id === bundleSelection.episode.id)
  if (episodeIndex === -1) return null
  const inclusion = getBundleEpisodeInclusion(data, episodeIndex, rule)
  if (!inclusion.isIncluded) return null
  return bundlePriceLevels(bundleSelection.episode, bundleSelection.trial, rule)
}

export function deriveNextBundleSelection(
  data: BundleSnapshot,
  rule: BundleRule,
  currentSelection: { episode: BundleEpisode; trial: BundleTrial | null } | null,
): { episode: BundleEpisode; trial: BundleTrial | null } | null {
  if (!currentSelection) return null
  const episode = currentSelection.episode
  const episodeIndex = data.episodes.findIndex((e) => e.id === episode.id)
  if (episodeIndex === -1) return null
  const inclusion = getBundleEpisodeInclusion(data, episodeIndex, rule)
  return { episode, trial: inclusion.trial }
}
