import type { NewsSource } from './model'

const families: [string, string, string?][] = [
  ['reuters.com', 'Reuters'], ['federalreserve.gov', 'Federal Reserve'], ['bankofengland.co.uk', 'Bank of England'],
  ['bankofcanada.ca', 'Bank of Canada'], ['rba.gov.au', 'RBA'], ['rbnz.govt.nz', 'RBNZ'], ['snb.ch', 'SNB'],
  ['ecb.europa.eu', 'ECB'], ['boj.or.jp', 'Bank of Japan'], ['eia.gov', 'EIA'], ['kitco.com', 'Kitco'],
  ['fxstreet.com', 'FXStreet'], ['treasury.gov', 'US Treasury'],
  ['bloomberg.com', 'Bloomberg'], ['ft.com', 'Financial Times'], ['cnbc.com', 'CNBC'],
  ['wsj.com', 'Dow Jones publications', 'dowjones.com'], ['marketwatch.com', 'Dow Jones publications', 'dowjones.com'],
  ['barrons.com', 'Dow Jones publications', 'dowjones.com'], ['dowjones.io', 'Dow Jones publications', 'dowjones.com'],
  ['investinglive.com', 'investingLive', 'investinglive.com'], ['forexlive.com', 'investingLive', 'investinglive.com'],
  ['investing.com', 'Investing.com'],
]

function family(source: NewsSource) {
  try {
    const url = new URL(source.url)
    // Google is delivery infrastructure, not a publisher. Mixed/unknown scopes
    // stay separate instead of collecting every Google feed into one group.
    const domains = url.hostname === 'news.google.com'
      ? [...(url.searchParams.get('q') ?? '').matchAll(/(?:^|[\s(])site:([a-z0-9.-]+)/ig)].map(match => match[1].toLowerCase())
      : [url.hostname]
    const matched = domains.map(domain => families.find(([host]) => domain === host || domain.endsWith(`.${host}`)))
    if (matched.length && matched.every(entry => entry && (entry[2] ?? entry[0]) === (matched[0]?.[2] ?? matched[0]?.[0]))) return matched[0]
  } catch { /* A source being edited can briefly have an invalid URL. */ }
}

export function providerGroups(sources: NewsSource[]) {
  const groups = new Map<string, { id: string; name: string; sources: NewsSource[] }>()
  for (const source of sources) {
    const publisher = family(source), id = publisher ? `publisher:${publisher[2] ?? publisher[0]}` : `source:${source.id}`
    const group = groups.get(id) ?? { id, name: publisher?.[1] ?? source.name, sources: [] }
    group.sources.push(source); groups.set(id, group)
  }
  return [...groups.values()]
}
