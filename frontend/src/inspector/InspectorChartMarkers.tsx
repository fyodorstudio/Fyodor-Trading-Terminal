import { currencyColorStyle, type CurrencyColors } from './currency-colors'
import { useEffect, useState } from 'react'
import type { IChartApi } from 'lightweight-charts'
import { formatAppTimestamp, type TimeDisplayPreference } from '../appearance/time-display/time-display-preference'
import { symbolGlyph } from './event-symbols'
import type { InspectorMarker } from './inspector-data'
import { inspectorMarkerCoordinate } from './marker-position'
import './inspector.css'

export function InspectorChartMarkers({ chartApi, markers, timeDisplay, onSelectRelease, currencyColors = {} }: {
  currencyColors?: CurrencyColors
  chartApi: IChartApi; markers: InspectorMarker[]; timeDisplay: TimeDisplayPreference; onSelectRelease: (id: string) => void
}) {
  const [positions, setPositions] = useState<{ x: number; markers: InspectorMarker[] }[]>([])
  const [expandedId, setExpandedId] = useState<string | null>(null)
  useEffect(() => {
    const scale = chartApi.timeScale()
    function update() {
      const positioned = markers.map((marker) => {
        const coordinate = inspectorMarkerCoordinate(scale, marker)
        return { marker, x: coordinate === null ? null : Number(coordinate) }
      })
        .filter((item): item is { marker: InspectorMarker; x: number } => item.x !== null && Number.isFinite(item.x) && item.x >= 0 && item.x <= scale.width())
        .sort((a, b) => a.x - b.x)
      const clusters: { x: number; markers: InspectorMarker[] }[] = []
      for (const item of positioned) {
        const previous = clusters[clusters.length - 1]
        if (previous && item.x - previous.x < 36) previous.markers.push(item.marker)
        else clusters.push({ x: item.x, markers: [item.marker] })
      }
      setPositions(clusters)
      // An off-screen or regrouped anchor ends this interaction. Returning to
      // the same candle must not reopen a chooser from an earlier chart view.
      setExpandedId((current) => current !== null && clusters.some((cluster) =>
        cluster.markers.length > 1 && cluster.markers[0].release.id === current) ? current : null)
    }
    update()
    scale.subscribeVisibleLogicalRangeChange(update)
    scale.subscribeSizeChange(update)
    return () => { scale.unsubscribeVisibleLogicalRangeChange(update); scale.unsubscribeSizeChange(update) }
  }, [chartApi, markers])
  if (!markers.length) return null
  const releaseTime = (marker: InspectorMarker) => marker.release.events.some((event) => 'chart_time_seconds' in event)
    ? `${formatAppTimestamp(marker.release.chartTime! * 1000, { mode: 'utc', utcOffsetMinutes: 0 })} · broker time`
    : formatAppTimestamp(marker.release.releaseAt!, timeDisplay)
  const description = (marker: InspectorMarker) => `${marker.release.currency} · ${marker.release.label} · ${releaseTime(marker)}`
  return <div className="inspector-chart-markers" style={currencyColorStyle(currencyColors)} aria-label="Inspector event symbols">
    {positions.map((cluster) => {
      const first = cluster.markers[0], multiple = cluster.markers.length > 1
      const expanded = expandedId === first.release.id
      return <div key={first.release.id} className="inspector-marker-cluster" style={{ left: cluster.x }}>
        <button type="button" className="inspector-chart-symbol" title={cluster.markers.map(description).join('\n')}
          aria-label={multiple ? `${cluster.markers.length} nearby Inspector releases` : `Inspect ${description(first)}`}
          aria-expanded={multiple ? expanded : undefined} onClick={() => multiple ?
            setExpandedId(expanded ? null : first.release.id) : onSelectRelease(first.release.id)}>
          {(['EUR', 'USD'] as const).map((currency) => {
            const items = cluster.markers.filter((marker) => marker.release.currency === currency)
            return items.length ? <span key={currency} className={`inspector-currency-${currency}`}>
              {symbolGlyph(items[0].symbol)}{multiple && <sup>{items.length}</sup>}</span> : null
          })}
        </button>
        {multiple && expanded && <div className="inspector-marker-popup" style={{ left: cluster.x > chartApi.timeScale().width() / 2 ? -270 : 0 }}>
          <button type="button" onClick={() => setExpandedId(null)}>Close</button>
          {cluster.markers.map((marker) => <button type="button" key={marker.release.id}
            onClick={() => { onSelectRelease(marker.release.id); setExpandedId(null) }}>
            <span className={`inspector-currency-${marker.release.currency}`}>{symbolGlyph(marker.symbol)} {marker.release.currency}</span>
            {' · '}{marker.release.label} · {releaseTime(marker)}
          </button>)}
        </div>}
      </div>
    })}
  </div>
}
