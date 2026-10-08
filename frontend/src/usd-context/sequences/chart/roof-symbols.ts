import type { EventSymbol } from '../../../inspector/event-symbols'
import type { ComboSource } from '../core/contracts'

export type RoofPublication = { source: ComboSource; symbol: EventSymbol }
export type RoofEndpoint = { x: number; publications: RoofPublication[]; activation: boolean }
export const roofDisplayVersion = 5
export const roofLaneY = (lane: number) => 116 - lane * 42

/** Merge only a shared candle anchor; never move an older release to activation. */
export function clusterRoofEndpoints(points: readonly RoofEndpoint[]): RoofEndpoint[] {
  const sorted = [...points].sort((a, b) => b.x - a.x), clusters: RoofEndpoint[] = []
  for (const point of sorted) {
    const last = clusters.at(-1)
    if (last && last.x === point.x) {
      last.publications.push(...point.publications)
      last.activation ||= point.activation
    } else clusters.push({ ...point, publications: [...point.publications] })
  }
  for (const cluster of clusters) cluster.publications.sort((a, b) => a.source.chartAt - b.source.chartAt || a.source.sourceId.localeCompare(b.source.sourceId))
  return clusters.reverse()
}

export const roofEndpointKey = (endpoint: RoofEndpoint) => endpoint.activation ? 'activation' : endpoint.publications.map(p => p.source.sourceId).join('|')
export const endpointPublications = (endpoint: RoofEndpoint, at: number) => endpoint.activation ?
  endpoint.publications.filter(p => p.source.chartAt === at) : endpoint.publications
export function roofEndpointTooltip(endpoint: RoofEndpoint, at: number, publicationUpdate: boolean, clock = (t: number) => new Date(t).toISOString().slice(0, 19).replace('T', ' ')) {
  const publications = endpointPublications(endpoint, at)
  return [endpoint.activation ? `Combo available from: ${clock(at)}` : 'Earlier contributing releases',
    ...(endpoint.activation && !publicationUpdate ? ['Memory update; no new publication.'] : []),
    ...publications.map(p => `${p.source.sourceLabel} · ${clock(p.source.chartAt)}`),
    publications.length > 1 ? 'Several releases share this candle. Click to choose a release.' :
      publications.length ? 'Click to inspect this release.' : 'Click for Combo details; no visible activation release.',
    ...(endpoint.activation ? ['Availability is not a trade entry signal. Use the exact time, not the candle open.'] : [])].join('\n')
}
