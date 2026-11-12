import { majorCurrencies } from '../economic-calendar/forex/currencies'
import type { HeatmapMode } from './heatmap-model'

export type HeatmapPreferences = { rows: string[] | null; groupOrder: string[]; mode: HeatmapMode; shade: 'return' | 'relative'
  rank: 'highest' | 'lowest' | 'unusual'; presets: { name: string; rows: string[]; groupOrder: string[] }[] }
const storageKey = 'fyodor.cross-asset.v1'
const validRow = (v: unknown): v is string => typeof v === 'string' && (v.startsWith('symbol:') && v.length > 7 && v.length <= 135
  || majorCurrencies.some(c => v === `basket:${c}`))
const rows = (v: unknown): string[] => Array.isArray(v) ? [...new Set(v.filter(validRow))].slice(0, 96) : []
const groups = (v: unknown): string[] => Array.isArray(v) ? [...new Set(v.filter((s): s is string => typeof s === 'string' && !!s && s.length <= 80))].slice(0, 32) : []

export function readHeatmapPreferences(broker: string): HeatmapPreferences {
  const defaults: HeatmapPreferences = { rows: null, groupOrder: [], mode: 'daily', shade: 'return', rank: 'highest', presets: [] }
  try {
    const v = JSON.parse(localStorage.getItem(`${storageKey}:${broker}`) ?? 'null')
    if (!v || typeof v !== 'object') return defaults
    return { rows: Array.isArray(v.rows) ? rows(v.rows) : null, groupOrder: groups(v.groupOrder), mode: v.mode === 'weekly' ? 'weekly' : 'daily',
      shade: v.shade === 'relative' ? 'relative' : 'return', rank: ['lowest', 'unusual'].includes(v.rank) ? v.rank : 'highest',
      presets: Array.isArray(v.presets) ? v.presets.filter((p: { name?: unknown }) => p && typeof p.name === 'string' && p.name.trim())
        .slice(0, 20).map((p: { name: string; rows: unknown; groupOrder?: unknown }) => ({ name: p.name.slice(0, 60), rows: rows(p.rows), groupOrder: groups(p.groupOrder) })) : [] }
  } catch { return defaults }
}

export function saveHeatmapPreferences(broker: string, preferences: HeatmapPreferences) {
  localStorage.setItem(`${storageKey}:${broker}`, JSON.stringify(preferences))
}
