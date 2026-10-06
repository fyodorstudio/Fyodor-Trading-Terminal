import type { InspectorEvent } from '../../inspector/inspector-data'

let nextIdentity = 0
const identities = new WeakMap<readonly InspectorEvent[], number>()
const recent: { events: readonly InspectorEvent[]; identity: number }[] = []
function equal(a: readonly InspectorEvent[], b: readonly InspectorEvent[]) {
  return a.length === b.length && a.every((row, i) => {
    if (row === b[i]) return true
    const keys = Object.keys(row) as (keyof InspectorEvent)[]
    return keys.length === Object.keys(b[i]).length && keys.every(key => row[key] === b[i][key])
  })
}
// Independent stored-calendar consumers return distinct arrays for the same
// snapshot. Compare all row fields once per array, including timing and units.
export function contextInventoryIdentity(events: readonly InspectorEvent[]) {
  const known = identities.get(events)
  if (known !== undefined) return known
  const matching = recent.find(entry => equal(entry.events, events))
  const identity = matching?.identity ?? ++nextIdentity
  identities.set(events, identity)
  if (!matching) { recent.push({ events, identity }); if (recent.length > 3) recent.shift() }
  return identity
}
