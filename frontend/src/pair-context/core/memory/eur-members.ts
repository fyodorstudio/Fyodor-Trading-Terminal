import type { EurMember, EurSlot, EurSource } from '../contracts'
import { eurExpiry, eurHalfLife, eurSlots, eurSlotWeights } from '../eur-policy'

export const eurDayMs = 86400000

function chooseSources(slot: EurSlot, inventory: readonly EurSource[]) {
  const rows = inventory.filter(s => s.slot === slot)
  if (!rows.length) return []
  const newest = rows.reduce((a, b) => a.chartAt > b.chartAt ? a : b)
  if (newest.reference === null) return [{ ...newest, proxyShare: newest.provisional ? .4 : 1 }]
  const reference = Math.max(...rows.flatMap(s => s.reference === null ? [] : [s.reference]))
  const current = rows.filter(s => s.reference === reference)
  const area = current.find(s => !s.provisional)
  // The aggregate replaces country proxies for the same reference period.
  return area ? [{ ...area, proxyShare: 1 }] : current.map(s => ({
    ...s, proxyShare: slot === 'inflation' ? .4 : s.family === 'german-pmi' ? .6 : .4,
  }))
}

export function updateEurMemory(latest: Map<string, EurSource>, incoming: readonly EurSource[]) {
  for (const row of incoming) {
    const key = `${row.slot}/${row.family}`, old = latest.get(key)
    if (!old || row.reference === null || old.reference === null || row.reference >= old.reference) latest.set(key, row)
  }
}

export function eurMembers(chartAt: number, inventory: readonly EurSource[]): EurMember[] {
  return eurSlots.flatMap(slot => chooseSources(slot, inventory).map(row => {
    const age = Math.max(0, Math.floor(chartAt / eurDayMs) - Math.floor(row.chartAt / eurDayMs))
    const status = age >= eurExpiry(slot) ? 'expired' : row.score === null || !Number.isFinite(row.score) ||
      !Number.isFinite(row.coverage) || row.coverage <= 0 || row.coverage > 1 ? 'unavailable' : 'active'
    const retention = status === 'active' ? 2 ** (-age / eurHalfLife(slot)) : 0
    const weight = eurSlotWeights[slot] * row.proxyShare
    const contribution = status === 'active' ? row.score! / 4 * weight / 100 * row.coverage * retention : 0
    return { ...row, weight, retention, status, contribution }
  }))
}
