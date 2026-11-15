export const keywordLimit = 500
export const keywordCharacters = 16000
export const starterKeywords = [
  'USD', 'EUR', 'GBP', 'JPY', 'CHF', 'CAD', 'AUD', 'NZD', 'dollar', 'euro', 'sterling', 'pound', 'yen', 'franc', 'Aussie', 'kiwi', 'greenback', 'DXY', 'yuan', 'renminbi',
  'Fed', 'Federal Reserve', 'FOMC', 'ECB', 'BoE', 'BoJ', 'BoC', 'RBA', 'RBNZ', 'SNB', 'PBoC', 'monetary policy', 'interest rate', 'interest rates', 'cash rate', 'rate hike', 'rate cut', 'tightening', 'easing', 'hawkish', 'dovish', 'Waller', 'Bullock',
  'inflation', 'disinflation', 'CPI', 'PCE', 'PPI', 'payrolls', 'NFP', 'unemployment', 'employment', 'wages', 'jobless claims', 'JOLTS', 'ADP', 'GDP', 'PMI', 'ISM', 'retail sales', 'consumer confidence', 'recession', 'stagflation',
  'Treasury', 'yields', 'bonds', 'gilts', 'Bunds', 'JGBs', 'buyback', 'buybacks', 'auction', 'refunding', 'issuance', 'debt ceiling', 'deficit', 'stimulus', 'quantitative tightening', 'quantitative easing', 'liquidity', 'repo', 'credit spreads',
  'oil', 'crude', 'Brent', 'WTI', 'OPEC', 'OPEC+', 'production cuts', 'output cuts', 'inventories', 'refinery', 'pipeline', 'natural gas', 'LNG', 'supply disruption', 'Hormuz',
  'Trump', 'Iran', 'Israel', 'China', 'Taiwan', 'Russia', 'Ukraine', 'Middle East', 'ceasefire', 'peace talks', 'attack', 'missile', 'sanctions', 'tariffs', 'export controls', 'embargo', 'election', 'midterms', 'Congress', 'government shutdown',
  'Nvidia', 'NVDA', 'Huang', 'artificial intelligence', 'AI', 'semiconductor', 'chips', 'TSMC', 'Microsoft', 'Apple', 'Alphabet', 'Amazon', 'Meta', 'Tesla', 'Nasdaq', 'S&P 500', 'Nikkei', 'DAX', 'FTSE', 'ASX', 'VIX', 'earnings', 'guidance', 'capex', 'financing', 'data centres', 'data centers',
  'gold', 'silver', 'copper', 'platinum', 'palladium', 'iron ore', 'aluminium', 'aluminum', 'nickel', 'lithium', 'rare earths', 'mining', 'commodities', 'XAU', 'XAG',
  'risk appetite', 'risk aversion', 'safe haven', 'positioning', 'short covering', 'short squeeze', 'carry trade', 'carry unwind', 'deleveraging', 'liquidation', 'margin calls', 'default', 'bailout', 'banking crisis', 'contagion',
  'priced in', 'expected', 'unexpected', 'surprise', 'split vote', 'dissent', 'pause', 'forward guidance', 'terminal rate', 'repricing', 'profit taking', 'sell the fact',
]

export function keywordTags(value: string): string[] {
  const seen = new Set<string>()
  return value.split(/[,\n]/).map(term => term.normalize('NFKC').trim().replace(/\s+/g, ' ')).filter(term => {
    const key = term.toLowerCase()
    if (!key || seen.has(key)) return false
    seen.add(key); return true
  })
}

function normalize(value: string) {
  return value.normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').replace(/\b(usd|eur|gbp|jpy|chf|cad|aud|nzd|cny|cnh|xau|xag)[/_-]?(usd|eur|gbp|jpy|chf|cad|aud|nzd|cny|cnh|xau|xag)\b/g, '$1 $2')
}
const compiled = new Map<string, { term: string; pattern: RegExp }[]>()
export function matchingKeyword(title: string, value: string) {
  let rules = compiled.get(value)
  if (!rules) {
    rules = keywordTags(value).map(term => ({ term, pattern: new RegExp(`(?<![\\p{L}\\p{N}_])${normalize(term).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\p{L}\\p{N}_])`, 'u') }))
    if (compiled.size >= 128) compiled.delete(compiled.keys().next().value!)
    compiled.set(value, rules)
  }
  const text = normalize(title)
  return rules.find(rule => rule.pattern.test(text))?.term ?? ''
}
