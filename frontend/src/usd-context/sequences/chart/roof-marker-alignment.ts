import type { MarkerCluster } from '../../../inspector/chart/marker-projection'
import type { PositionedRoof } from './roof-layout'
import type { RoofEndpoint } from './roof-symbols'

/** Match connector inputs to the actual grouped symbol box. Activation retains its
 * native candle anchor: an older clustered release never backdates availability.
 * Projection only; lane assignment remains the cached history-wide plan. */
export function alignRoofMarkers(roofs: readonly PositionedRoof[], clusters: readonly MarkerCluster[]): PositionedRoof[] {
  const positions = new Map<string, number>()
  for (const cluster of clusters) for (const marker of cluster.markers) {
    positions.set(marker.release.id, cluster.x)
    for (const publication of marker.release.ismPublications ?? []) positions.set(publication.id, cluster.x)
  }
  return roofs.map(roof => {
    const endpoints: RoofEndpoint[] = []
    for (const endpoint of roof.endpoints) {
      const xs = endpoint.publications.flatMap(p => positions.has(p.source.sourceId) ? [positions.get(p.source.sourceId)!] : [])
      const symbolX = xs.length ? Math.min(...xs) : undefined
      const aligned = { ...endpoint, x: endpoint.activation ? endpoint.x : symbolX ?? endpoint.x,
        symbolX: endpoint.activation ? symbolX ?? endpoint.symbolX : undefined }
      const same = !aligned.activation && endpoints.find(e => !e.activation && e.x === aligned.x)
      if (same) same.publications = [...same.publications, ...aligned.publications]
      else endpoints.push(aligned)
    }
    endpoints.sort((a, b) => a.x - b.x || Number(a.activation) - Number(b.activation))
    const left = Math.min(roof.right - 4, ...endpoints.map(e => e.x))
    return { ...roof, endpoints, left, labelX: roof.right }
  })
}
