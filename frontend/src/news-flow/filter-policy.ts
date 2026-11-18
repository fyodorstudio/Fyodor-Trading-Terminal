import profile from '../../../storage/news_flow/relevance.json'
import { keywordTags, keywordLimit, keywordCharacters } from './keywords'

export type NewsFilterPolicy = typeof profile.filter_defaults
export const defaultFilterPolicy: NewsFilterPolicy = profile.filter_defaults
export const keywordGroups: Record<string, string[]> = profile.groups

export function readFilterPolicy(value: unknown): NewsFilterPolicy {
  let parsed = value
  try { if (typeof value === 'string') parsed = JSON.parse(value) } catch { parsed = null }
  const result = { ...defaultFilterPolicy }
  if (!parsed || typeof parsed !== 'object') return result
  for (const key of Object.keys(defaultFilterPolicy) as (keyof NewsFilterPolicy)[]) {
    const next = (parsed as Record<string, unknown>)[key]
    if (key === 'exceptions' || key === 'other_market_terms') {
      if (typeof next === 'string' && next.length <= keywordCharacters && keywordTags(next).length <= keywordLimit) result[key] = next
    } else if (typeof next === 'boolean') result[key] = next
  }
  return result
}

export function encodeFilterPolicy(value: NewsFilterPolicy) {
  const normalized = readFilterPolicy(value)
  return JSON.stringify(Object.fromEntries(Object.entries(normalized).filter(([key, next]) => next !== defaultFilterPolicy[key as keyof NewsFilterPolicy])))
}

export function upgradeFilterPolicy(value: unknown, version: number) {
  const policy = readFilterPolicy(value)
  if (version < 4 && policy.other_market_terms === profile.filter_previous_other_market_terms) policy.other_market_terms = defaultFilterPolicy.other_market_terms
  return policy
}
