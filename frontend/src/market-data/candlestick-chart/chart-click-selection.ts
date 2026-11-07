import type { MouseEventParams, Time } from 'lightweight-charts'

// One native click can reach both a selectable chart object and the background
// dismiss listener. Claim selections without mutating the library's event.
const selections = new WeakSet<MouseEventParams<Time>>()
export function claimChartClick(event: MouseEventParams<Time>) { selections.add(event) }
export function chartClickClaimed(event: MouseEventParams<Time>) { return selections.has(event) }
