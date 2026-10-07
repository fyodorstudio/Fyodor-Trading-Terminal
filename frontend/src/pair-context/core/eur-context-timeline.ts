import type { EurContextInput, EurContextPoint, EurContextTimeline, EurSource } from './contracts'
import { eurExpiry } from './eur-policy'
import { eurDayMs, eurMembers, updateEurMemory } from './memory/eur-members'
import { eurPublications } from './publication/eur-publications'

/** Publication batches are atomic; aging uses the stored broker day boundary. */
export function buildEurContextTimeline(input: EurContextInput): EurContextTimeline {
  const { updates, excludedTiming } = eurPublications(input)
  const stages = [...updates.keys()]
  for (const rows of updates.values()) {
    for (const row of rows) stages.push(row.chartAt + eurExpiry(row.slot) * eurDayMs)
  }
  if (!stages.length) return { points: [], excludedTiming }
  const first = Math.min(...stages), last = Math.max(...stages)
  for (let day = (Math.floor(first / eurDayMs) + 1) * eurDayMs; day < last; day += eurDayMs) stages.push(day)

  const latest = new Map<string, EurSource>(), points: EurContextPoint[] = []
  for (const chartAt of [...new Set(stages)].sort((a, b) => a - b)) {
    const incoming = updates.get(chartAt) ?? []
    updateEurMemory(latest, incoming)
    const members = eurMembers(chartAt, [...latest.values()])
    const active = members.filter(m => m.status === 'active')
    const total = active.length ? members.reduce((sum, m) => sum + m.contribution, 0) : null
    points.push({ chartAt, total, members,
      coverage: active.reduce((sum, m) => sum + m.weight / 100 * m.coverage * m.retention, 0),
      update: incoming.length ? [...new Set(incoming.map(s => s.label))].join(' + ') : 'EUR memory aging; no new release.',
    })
  }
  return { points, excludedTiming }
}
