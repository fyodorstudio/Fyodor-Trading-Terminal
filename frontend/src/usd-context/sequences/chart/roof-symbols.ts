import type { EventSymbol } from '../../../inspector/event-symbols'
import type { ComboSource } from '../core/contracts'

export type RoofPublication = { source: ComboSource; symbol: EventSymbol }
export type RoofEndpoint = { x: number; publications: RoofPublication[]; activation: boolean }
export const roofDisplayVersion = 4
export const roofLaneY = (lane: number) => 116 - lane * 42

/** Group at a stable candle anchor for a given zoom; panning only translates it. */
export function clusterRoofSymbols(points: readonly RoofEndpoint[]): RoofEndpoint[] {
  const sorted = [...points].sort((a, b) => b.x - a.x), clusters: RoofEndpoint[] = []
  for (const point of sorted) {
    const last = clusters.at(-1), gap = last?.activation ? 50 : 28
    if (last && last.x - point.x < gap) {
      last.publications.push(...point.publications)
      last.activation ||= point.activation
    } else clusters.push({ ...point, publications: [...point.publications] })
  }
  for (const cluster of clusters) cluster.publications.sort((a, b) => a.source.chartAt - b.source.chartAt || a.source.sourceId.localeCompare(b.source.sourceId))
  return clusters.reverse()
}

export const roofEndpointKey = (endpoint: RoofEndpoint) => endpoint.activation ? 'activation' : endpoint.publications.map(p => p.source.sourceId).join('|')
export function roofEndpointTooltip(endpoint: RoofEndpoint, at: number, publicationUpdate: boolean) {
  const clock = (t: number) => new Date(t).toISOString().slice(0, 16).replace('T', ' ') + ' broker time'
  return [endpoint.activation ? `Combo starts: ${clock(at)}` : 'Earlier combo inputs',
    ...(endpoint.activation && !publicationUpdate ? ['Memory update; no new publication. Nearby symbols are earlier inputs.'] : []),
    ...endpoint.publications.map(p => `${p.source.sourceLabel} · ${clock(p.source.chartAt)}`),
    endpoint.publications.length > 1 ? 'Nearby releases grouped at this zoom. Click to choose a release.' :
      endpoint.publications.length ? 'Click to inspect this release.' : 'No visible publication at activation; open the direction box for details.'].join('\n')
}
