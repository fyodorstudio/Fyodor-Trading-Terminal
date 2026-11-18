import profile from '../../../storage/news_flow/relevance.json'
export const keywordLimit = 500
export const keywordCharacters = 16000
export const starterKeywords: string[] = profile.preset
export const keywordVersion = profile.version

export function upgradeKeywords(value: string, version: number) {
  if (version >= keywordVersion || !value.trim()) return value
  if (version >= 3) {
    const additions = new Set(profile.preset_additions)
    const previous = starterKeywords.filter(term => !additions.has(term))
    const tags = keywordTags(value), current = new Set(tags.map(normalize))
    if (previous.filter(term => current.has(normalize(term))).length < previous.length * .75) return value
    const upgraded = keywordTags([...tags, ...profile.preset_additions].join(','))
    return upgraded.length <= keywordLimit && upgraded.join(', ').length <= keywordCharacters ? upgraded.join(', ') : value
  }
  const legacy = new Set(profile.legacy_preset.map(term => term.toLowerCase()))
  const custom = keywordTags(value).filter(term => !legacy.has(term.toLowerCase()))
  const tags = keywordTags([...starterKeywords, ...custom].join(','))
  return tags.length <= keywordLimit && tags.join(', ').length <= keywordCharacters ? tags.join(', ') : value
}

export function keywordTags(value: string): string[] {
  const seen = new Set<string>()
  return value.split(/[,\n]/).map(term => term.normalize('NFKC').trim().replace(/\s+/g, ' ')).filter(term => {
    const key = normalize(term)
    if (!key || seen.has(key)) return false
    seen.add(key); return true
  })
}

function normalize(value: string) {
  return value.normalize('NFKC').toLowerCase().replace(/[’‘]/g, "'").replace(/[‐‑‒–—]/g, '-').replace(/\s+/g, ' ').replace(/\b(usd|eur|gbp|jpy|chf|cad|aud|nzd|cny|cnh|xau|xag)[/_-]?(usd|eur|gbp|jpy|chf|cad|aud|nzd|cny|cnh|xau|xag)\b/g, '$1 $2')
}
const compiled = new Map<string, { term: string; pattern: RegExp }[]>()
const variants: Record<string, string> = profile.aliases
export function matchingKeyword(title: string, value: string) {
  let rules = compiled.get(value)
  if (!rules) {
    rules = keywordTags(value).map(term => ({ term, pattern: new RegExp(`(?<![\\p{L}\\p{N}_])${variants[normalize(term)] ?? normalize(term).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\p{L}\\p{N}_])`, 'u') }))
    if (compiled.size >= 128) compiled.delete(compiled.keys().next().value!)
    compiled.set(value, rules)
  }
  const text = normalize(title)
  return rules.find(rule => rule.pattern.test(text))?.term ?? ''
}
