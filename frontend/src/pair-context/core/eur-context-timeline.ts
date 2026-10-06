import { groupInspectorReleases, inspectorEventChartTime } from '../../inspector/inspector-data'
import { assessEurScore, type EurAssessment } from '../../inspector/scoring/PAIR/EURUSD/EUR/assessment/eur-score'
import { observedEur } from '../../inspector/scoring/PAIR/EURUSD/EUR/assessment/eur-history'
import { eurNumericSeriesIds } from '../../inspector/scoring/PAIR/EURUSD/EUR/policy/eur-policies'
import { eurSlots, eurSlotWeights, eurHalfLife, eurExpiry } from './eur-policy'
import type { EurContextInput, EurContextPoint, EurContextTimeline, EurSource, EurSlot } from './contracts'
const dayMs = 86400000
function sources(a: EurAssessment, at: number, releaseAt: number, series: readonly string[]): EurSource[] {
  const family = a.policy.family
  const source = (slot: EurSlot, score = a.total, coverage = a.coverage): EurSource => ({ slot, family, label: a.policy.label,
    chartAt: at, releaseAt, reference: a.referenceMonth, score, coverage, provisional: ['german-inflation','german-pmi','french-pmi'].includes(family) })
  if (family === 'euro-labor') {
    const unemployment = a.readings.find(r => r.id === 'unemployment')!
    const employment = a.readings.filter(r => r.id.startsWith('employment'))
    return [ ...(series.includes('999030020') ? [source('unemployment', unemployment.points, unemployment.points === null ? 0 : 1)] : []),
      ...(series.some(id => ['999030001','999030002'].includes(id)) ? [source('employment', employment.some(r => r.points !== null) ? employment.reduce((sum,r) => sum + (r.contribution ?? 0), 0) / (employment.reduce((sum,r)=>sum+r.weight,0)/100) : null,
        employment.reduce((sum,r) => sum + (r.points === null ? 0 : r.weight), 0) / employment.reduce((sum,r)=>sum+r.weight,0))] : []) ]
  }
  return [source(family.includes('inflation') ? 'inflation' : family.endsWith('pmi') ? 'pmi' : family === 'euro-wages' ? 'wages' : 'gdp')]
}
function choose(slot: EurSlot, inventory: readonly EurSource[]) {
  const rows = inventory.filter(s => s.slot === slot)
  if (!rows.length) return []
  const newest = rows.reduce((a,b)=>a.chartAt>b.chartAt?a:b)
  if (newest.reference === null) return [{ ...newest, proxyShare: newest.provisional ? .4 : 1 }]
  const reference = Math.max(...rows.flatMap(s => s.reference === null ? [] : [s.reference])), current = rows.filter(s => s.reference === reference)
  const area = current.find(s => !s.provisional)
  // Euro-area aggregate replaces country proxies for this reference period.
  return area ? [{ ...area, proxyShare: 1 }] : current.map(s => ({ ...s, proxyShare: slot === 'inflation' ? .4 : s.family === 'german-pmi' ? .6 : .4 }))
}
export function buildEurContextTimeline(input: EurContextInput): EurContextTimeline {
  const inventory = input.events.filter(e => observedEur(e) && e.release_at <= input.asOf && eurNumericSeriesIds.includes(e.event_id))
  const releases = groupInspectorReleases(inventory).filter(r => input.families.includes(r.familyId as never))
  const valid = releases.filter(r => !r.timingUncertain && r.chartTime !== null && Number.isFinite(r.chartTime) && r.events.every(e => inspectorEventChartTime(e) === r.chartTime))
    .sort((a,b) => a.releaseAt! - b.releaseAt! || a.id.localeCompare(b.id))
  for (let i=1;i<valid.length;i++) if (valid[i].chartTime! < valid[i-1].chartTime! || valid[i].releaseAt === valid[i-1].releaseAt && valid[i].chartTime !== valid[i-1].chartTime)
    throw new Error('EUR history has inconsistent chart clocks; verify stored timing.')
  const updates = new Map<number, EurSource[]>()
  for (const r of valid) {
    const a = assessEurScore(r, inventory, input.settings[r.familyId as keyof typeof input.settings])
    if (!a) continue
    const rows = sources(a, r.chartTime! * 1000, r.releaseAt!, r.events.map(e=>e.event_id))
    updates.set(r.chartTime! * 1000, [...(updates.get(r.chartTime! * 1000) ?? []), ...rows])
  }
  const stages = [...updates.keys()]
  for (const rows of updates.values()) for (const row of rows) stages.push(row.chartAt + eurExpiry(row.slot)*dayMs)
  if (!stages.length) return { points: [], excludedTiming: releases.length - valid.length }
  const first = Math.min(...stages), last = Math.max(...stages)
  for(let day=(Math.floor(first/dayMs)+1)*dayMs;day<last;day+=dayMs) stages.push(day)
  const latest = new Map<string,EurSource>(), points: EurContextPoint[] = []
  for(const chartAt of [...new Set(stages)].sort((a,b)=>a-b)) {
    const incoming = updates.get(chartAt) ?? []
    for(const row of incoming) {
      const key = `${row.slot}/${row.family}`, old = latest.get(key)
      if (!old || row.reference === null || old.reference === null || row.reference >= old.reference) latest.set(key,row)
    }
    const members = eurSlots.flatMap(slot => choose(slot,[...latest.values()]).map(row => {
      const age = Math.max(0, Math.floor(chartAt/dayMs)-Math.floor(row.chartAt/dayMs))
      const status = age >= eurExpiry(slot) ? 'expired' as const : row.score === null || !Number.isFinite(row.score) || !Number.isFinite(row.coverage) || row.coverage <= 0 || row.coverage > 1 ? 'unavailable' as const : 'active' as const
      const retention = status === 'active' ? 2 ** (-age/eurHalfLife(slot)) : 0
      const weight = eurSlotWeights[slot] * row.proxyShare
      return { ...row, weight, retention, status, contribution: status === 'active' ? row.score! / 4 * weight / 100 * row.coverage * retention : 0 }
    }))
    const active = members.filter(m=>m.status==='active')
    const total = active.length ? members.reduce((sum,m)=>sum+m.contribution,0) : null
    points.push({ chartAt, total, members, coverage: active.reduce((sum,m)=>sum+m.weight/100*m.coverage*m.retention,0),
      update: incoming.length ? [...new Set(incoming.map(s=>s.label))].join(' + ') : 'EUR memory aging; no new release.' })
  }
  return { points, excludedTiming: releases.length - valid.length }
}
