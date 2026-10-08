import type { ComboSnapshot } from '../core/contracts'
import { comboActivation } from '../core/combo-activation'
import { roofSupport } from '../core/relationship-support'

type CountKey = 'long' | 'short' | 'balanced' | 'unchanged' | 'insufficient'
const readings = new WeakMap<ComboSnapshot, CountKey>()

/** Counts describe existing snapshot readings, never another combined vote.
 * Cache each reading so viewport/chooser changes do not repeat support arithmetic. */
export function comboColumnSummary(combos: readonly ComboSnapshot[]) {
  const counts = { long: 0, short: 0, balanced: 0, unchanged: 0, insufficient: 0 }
  const updates = new Map<number, { at: number; kind: 'publication' | 'aging' | 'expiry'; releases: string[] }>()
  for (const combo of combos) {
    let reading = readings.get(combo)
    if (!reading) {
      const support = roofSupport(combo)
      reading = support.direction ?? (support.state === 'balanced' || support.state === 'unchanged' ? support.state : 'insufficient')
      readings.set(combo, reading)
    }
    counts[reading]++
    const cause = comboActivation(combo).kind
    const update = updates.get(combo.chartAt) ?? { at: combo.chartAt, kind: cause, releases: [] }
    if (cause === 'publication') update.kind = cause
    else if (update.kind !== 'publication' && cause === 'expiry') update.kind = cause
    for (const source of combo.sources.filter(s => s.chartAt === combo.chartAt))
      if (!update.releases.includes(source.sourceLabel)) update.releases.push(source.sourceLabel)
    updates.set(combo.chartAt, update)
  }
  return { counts, updates: [...updates.values()].sort((a, b) => a.at - b.at) }
}
