import { useEffect, useState } from 'react'
import type { IChartApi, Time } from 'lightweight-charts'
import { formatUnit } from './cpi-event-timeline-data'
import { symbolGlyph, type EventMarker } from './timeline-event-view'
import './cpi-event-timeline.css'

type MarkerCluster = { x: number; markers: EventMarker[] }

// Screen-space clustering keeps neighbouring releases selectable without
// moving their underlying timestamps. The popup lists every original release.
function clusterEventMarkers(markers: EventMarker[], coordinate: (time: number) => number | null,
  width: number): MarkerCluster[] {
  const positions = markers.map((marker) => ({ marker, x: coordinate(marker.time) }))
    .filter((item): item is { marker: EventMarker; x: number } => item.x !== null && item.x >= 0 && item.x <= width)
    .sort((a, b) => a.x - b.x)
  const clusters: MarkerCluster[] = []
  for (const item of positions) {
    const previous = clusters[clusters.length - 1]
    if (previous && item.x - previous.x < 34) previous.markers.push(item.marker)
    else clusters.push({ x: item.x, markers: [item.marker] })
  }
  return clusters
}

function markerDescription(marker: EventMarker): string {
  const { group } = marker
  return [`${group.family} · ${group.countryCode} · ${group.currency}`,
    `Release: ${group.releaseTimeText} · server clock`,
    ...group.block.rows.map((row) => `${row.series}: A ${row.actual ?? '—'} / P ${row.previous ?? '—'} / A−P ${row.delta ?? '—'} ${formatUnit(row.unit, row.multiplier)}`),
  ].join('\n')
}

export function TimelineEventMarkers({ chartApi, markers, onSelectGroup }: {
  chartApi: IChartApi
  markers: EventMarker[]
  onSelectGroup: (id: string) => void
}) {
  const [clusters, setClusters] = useState<MarkerCluster[]>([])
  const [expandedTime, setExpandedTime] = useState<number | null>(null)
  useEffect(() => {
    const scale = chartApi.timeScale()
    const update = () => setClusters(clusterEventMarkers(markers,
      (time) => scale.timeToCoordinate(time as Time), scale.width()))
    update()
    scale.subscribeVisibleLogicalRangeChange(update)
    scale.subscribeSizeChange(update)
    return () => {
      scale.unsubscribeVisibleLogicalRangeChange(update)
      scale.unsubscribeSizeChange(update)
    }
  }, [chartApi, markers])
  if (!markers.length) return null
  return <div className="timeline-chart-symbol-strip" aria-label="Selected surrounding event symbols">
    {clusters.map((cluster) => {
      const first = cluster.markers[0]
      const multiple = cluster.markers.length > 1
      const expanded = expandedTime === first.time
      return <div key={first.group.id} className="timeline-symbol-cluster" style={{ left: cluster.x }}>
        <button type="button" className="timeline-chart-symbol" title={multiple ?
          cluster.markers.map((marker) => `${symbolGlyph(marker.symbol)} ${marker.group.family} · ${marker.group.releaseTimeText}`).join('\n') : markerDescription(first)}
          aria-label={multiple ? `${cluster.markers.length} nearby releases` : `${first.group.family} ${first.group.releaseTimeText}`}
          aria-expanded={multiple ? expanded : undefined}
          onClick={() => multiple ? setExpandedTime(expanded ? null : first.time) : onSelectGroup(first.group.id)}>
          {symbolGlyph(first.symbol)}{multiple && <sup>{cluster.markers.length}</sup>}
        </button>
        {multiple && expanded && <div className="timeline-symbol-popup" style={{ left: cluster.x > chartApi.timeScale().width() / 2 ? -250 : 0 }}>
          <button type="button" onClick={() => setExpandedTime(null)}>Close</button>
          {cluster.markers.map((marker) => <button type="button" key={marker.group.id} title={markerDescription(marker)}
            onClick={() => { onSelectGroup(marker.group.id); setExpandedTime(null) }}>
            {symbolGlyph(marker.symbol)} {marker.group.family} · {marker.group.countryCode} · {marker.group.releaseTimeText}
          </button>)}
        </div>}
      </div>
    })}
  </div>
}
