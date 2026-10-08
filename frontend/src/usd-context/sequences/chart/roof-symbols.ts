import { activationLabel, removalReason } from '../core/combo-activation'
import type { EventSymbol } from '../../../inspector/event-symbols'
import type { ComboActivation, ComboSource } from '../core/contracts'

export type RoofPublication = { source: ComboSource; symbol: EventSymbol }
export type RoofEndpoint = { x: number; publications: RoofPublication[]; activation: boolean; symbolX?: number }
export const roofDisplayVersion = 6
export const roofLaneY = (lane: number) => 124 - lane * 42

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
export function roofEndpointTooltip(endpoint: RoofEndpoint, at: number, activation: ComboActivation | boolean, clock = (t: number) => new Date(t).toISOString().slice(0, 19).replace('T', ' ')) {
  const publications = endpointPublications(endpoint, at)
  const cause = typeof activation === 'boolean' ? { kind: activation ? 'publication' as const : 'aging' as const, removed: [] } : activation
  return [endpoint.activation ? `Combo available from: ${clock(at)}` : 'Earlier contributing releases',
    ...(endpoint.activation ? [activationLabel(cause.kind), ...(cause.kind !== 'publication' ? ['Memory update; no new participating publication.'] : []), ...cause.removed.map(s => `${removalReason(s.reason)}: ${s.sourceLabel} · ${clock(s.chartAt)}`)] : []),
    ...publications.map(p => `${p.source.sourceLabel} · ${clock(p.source.chartAt)}`),
    endpoint.activation && cause.kind !== 'publication' ? 'Click for Combo details.' :
    publications.length > 1 ? 'Several releases share this point. Click to choose a release.' :
      publications.length ? 'Click to inspect this release.' : 'Click for Combo details; no visible activation release.',
    ...(endpoint.activation ? ['Availability is not a trade entry signal. Use the exact time, not the candle open.'] : [])].join('\n')
}
