export type FedEvidence = { url: string; captured_at: string; as_of: string | null; timing: 'pre_release' | 'historical_backfill'; note: string }
export type FedConsensus = FedEvidence & { provider: 'investing' | 'trading_economics'; value: number }
export type FedMeeting = {
  released_at: string
  actual: (FedEvidence & { lower: number; upper: number }) | null
  consensus: FedConsensus[]
  fedwatch: (FedEvidence & { outcomes: { lower: number; upper: number; probability: number }[] }) | null
}
export type FedForecasts = { meetings: ReadonlyMap<number, FedMeeting>; status: string }
const validRate = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 100
const instant = (value: unknown): value is string => typeof value === 'string' && /(?:Z|[+-]\d{2}:\d{2})$/.test(value) && Number.isFinite(Date.parse(value))

/** Reject malformed local responses before they can affect a plotted actual. */
export function parseFedForecasts(value: unknown): ReadonlyMap<number, FedMeeting> {
  const body = value as { schema?: number; meetings?: FedMeeting[] }
  if (!body || body.schema !== 1 || !Array.isArray(body.meetings)) throw new Error('Invalid Fed forecast response')
  const result = new Map<number, FedMeeting>(), now = Date.now()
  for (const row of body.meetings) {
    if (!row || !instant(row.released_at) || !Array.isArray(row.consensus) || row.consensus.length > 2) throw new Error('Invalid Fed meeting')
    const release = Date.parse(row.released_at)
    if (release > now || result.has(release)) throw new Error('Invalid Fed meeting clock')
    const evidence = (item: FedEvidence, hosts: string[], actual = false, cme = false) => {
      if (!item || !instant(item.captured_at) || Date.parse(item.captured_at) > now || typeof item.note !== 'string' || !item.note.trim()) throw new Error('Invalid evidence capture')
      const url = new URL(item.url)
      if (url.protocol !== 'https:' || !hosts.includes(url.hostname) || url.username || url.password || url.port) throw new Error('Invalid evidence publisher')
      if (item.as_of !== null && (!instant(item.as_of) || Date.parse(item.as_of) > Date.parse(item.captured_at))) throw new Error('Invalid evidence as-of')
      if (actual) {
        if (item.timing !== 'historical_backfill' || Date.parse(item.captured_at) < release) throw new Error('Actual predates release')
      } else if (item.timing === 'pre_release') {
        if (!item.as_of || Date.parse(item.captured_at) >= release || Date.parse(item.as_of) >= release) throw new Error('Invalid pre-release snapshot')
      } else if (item.timing !== 'historical_backfill' || Date.parse(item.captured_at) < release) throw new Error('Invalid backfill clock')
      if ((!actual && item.as_of && Date.parse(item.as_of) >= release) || (cme && !item.as_of)) throw new Error('Expectation must predate decision')
    }
    const providers = new Set<string>()
    for (const item of row.consensus) {
      if (!item || !['investing', 'trading_economics'].includes(item.provider) || providers.has(item.provider) || !validRate(item.value)) throw new Error('Invalid consensus')
      providers.add(item.provider)
      evidence(item, item.provider === 'investing' ? ['investing.com', 'www.investing.com'] : ['tradingeconomics.com', 'www.tradingeconomics.com'])
    }
    if (row.actual !== null) {
      if (!row.actual || !validRate(row.actual.lower) || !validRate(row.actual.upper) || row.actual.lower > row.actual.upper) throw new Error('Invalid official target range')
      evidence(row.actual, ['federalreserve.gov', 'www.federalreserve.gov'], true)
    }
    if (row.fedwatch !== null) {
      if (!row.fedwatch || !Array.isArray(row.fedwatch.outcomes) || !row.fedwatch.outcomes.length) throw new Error('Invalid FedWatch distribution')
      evidence(row.fedwatch, ['cmegroup.com', 'www.cmegroup.com', 'cmegroup-tools.quikstrike.net'], false, true)
      const outcomes = [...row.fedwatch.outcomes].sort((a, b) => a.lower - b.lower)
      if (outcomes.some((point, i) => !validRate(point.lower) || !validRate(point.upper) || point.lower >= point.upper || !validRate(point.probability)
        || (i > 0 && outcomes[i - 1].upper > point.lower)) || Math.abs(outcomes.reduce((sum, point) => sum + point.probability, 0) - 100) > 0.2) throw new Error('Invalid FedWatch probabilities')
    }
    result.set(release, row)
  }
  return result
}

/** Positive means a higher/hawkish rate surprise, never a currency-return claim. */
export function fedSurprise(actual: number, forecast: number) {
  const bp = Math.round((actual - forecast) * 10000) / 100
  return { bp, label: bp > 0 ? 'Beat' : bp < 0 ? 'Miss' : 'In line',
    text: `${bp > 0 ? 'Beat · hawkish surprise' : bp < 0 ? 'Miss · dovish surprise' : 'In line'} · ${bp > 0 ? '+' : ''}${bp} bp` }
}

export function fedEvidenceClock(evidence: FedEvidence, format: (at: number) => string) {
  return `${evidence.timing === 'historical_backfill' ? 'Historical backfill' : 'Pre-decision capture'} · retrieved ${format(Date.parse(evidence.captured_at))}${evidence.as_of ? ` · as of ${format(Date.parse(evidence.as_of))}` : ' · original as-of unavailable'}`
}
