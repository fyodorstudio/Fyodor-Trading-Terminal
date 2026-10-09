import type { EventSymbol } from '../../../inspector/event-symbols'
import type { ComboSource } from '../../../scoring-system/relationships/contracts'
import { roofRowHeight } from './roof-layout'

export type RoofPublication = { source: ComboSource; symbol: EventSymbol }
export type RoofEndpoint = { x: number; publications: RoofPublication[]; activation: boolean; symbolX?: number }
export const roofDisplayVersion = 8
export const roofLaneY = (lane: number, height = 160) => height - 8 - lane * roofRowHeight

/** Merge only a shared candle anchor; never move an older release to activation. */
export function clusterRoofEndpoints(points: readonly RoofEndpoint[]): RoofEndpoint[] {
  const sorted = [...points].sort((a, b) => b.x - a.x), clusters: RoofEndpoint[] = []
  for (const point of sorted) {
    const last = clusters.at(-1)
    if (last && last.x === point.x) {
      last.publications.push(...point.publications.filter(p => !last.publications.some(existing => existing.source.sourceId === p.source.sourceId)))
      last.activation ||= point.activation
      last.symbolX ??= point.symbolX
    } else clusters.push({ ...point, publications: [...point.publications] })
  }
  for (const cluster of clusters) cluster.publications.sort((a, b) => a.source.chartAt - b.source.chartAt || a.source.sourceId.localeCompare(b.source.sourceId))
  return clusters.reverse()
}

export const roofEndpointKey = (endpoint: RoofEndpoint) => endpoint.activation ? 'activation' : endpoint.publications.map(p => p.source.sourceId).join('|')
export const endpointPublications = (endpoint: RoofEndpoint, at: number) => endpoint.activation ?
  endpoint.publications.filter(p => p.source.chartAt === at) : endpoint.publications
