/** Dates are broker chart-clock milliseconds. Records are user annotations, never scorer inputs. */
export type ExternalEvent = { id: string; brokerId: string; symbol: string; title: string; note: string;
  from: number; to: number | null; createdAt: number; updatedAt: number }
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
const clock = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 8640000000000000
export function validExternalEvents(v: unknown): v is ExternalEvent[] {
  return Array.isArray(v) && v.length <= 1000 && new Set(v.map(e => record(e) ? e.id : null)).size === v.length && v.every(e => record(e) &&
    ['id', 'brokerId', 'symbol', 'title'].every(k => typeof e[k] === 'string' && (e[k] as string).trim().length > 0 && (e[k] as string).length <= 160) &&
    typeof e.note === 'string' && e.note.length <= 4000 && clock(e.from) && (e.to === null || (clock(e.to) && e.to > e.from)) && clock(e.createdAt) && clock(e.updatedAt))
}
export const clockInput = (at: number) => new Date(at).toISOString().slice(0, 16)
export function parseClockInput(input: string) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(input)) return null
  const at = Date.parse(input + ':00Z')
  return Number.isFinite(at) && clockInput(at) === input ? at : null
}
export type ExternalInterval = { from: number; to: number; events: readonly ExternalEvent[] }
export function externalIntervals(events: readonly ExternalEvent[]): ExternalInterval[] {
  const changes = new Map<number, { add: ExternalEvent[]; remove: string[] }>()
  const change = (at: number) => { let c = changes.get(at); if (!c) { c = { add: [], remove: [] }; changes.set(at, c) } return c }
  for (const e of events) { change(e.from).add.push(e); if (e.to !== null) change(e.to).remove.push(e.id) }
  const times = [...changes.keys()].sort((a, b) => a - b), active = new Map<string, ExternalEvent>(), intervals: ExternalInterval[] = []
  for (let i = 0; i < times.length; i++) {
    const from = times[i], c = changes.get(from)!
    for (const id of c.remove) active.delete(id)
    for (const e of c.add) active.set(e.id, e)
    if (active.size) intervals.push({ from, to: times[i + 1] ?? Infinity, events: [...active.values()] })
  }
  return intervals
}
export function visibleExternalIntervals(intervals: readonly ExternalInterval[], from: number, to: number) {
  let lo = 0, hi = intervals.length
  while (lo < hi) { const mid = (lo + hi) >>> 1; if (intervals[mid].to <= from) lo = mid + 1; else hi = mid }
  const result: ExternalInterval[] = []
  for (let i = lo; i < intervals.length && intervals[i].from < to; i++) {
    const e = intervals[i], start = Math.max(from, e.from), end = Math.min(to, e.to)
    if (end > start) result.push({ ...e, from: start, to: end })
  }
  return result
}
