import { currencyColorStyle, type CurrencyColors } from './currency-colors'
import { memo, useEffect, useMemo, useState } from 'react'
import type { IChartApi } from 'lightweight-charts'
import type { TimeDisplayPreference } from '../appearance/time-display/time-display-preference'
import { symbolGlyph } from './event-symbols'
import type { InspectorMarker } from './inspector-data'
import { indexMarkers, projectMarkers, sameMarkerClusters, type MarkerCluster } from './chart/marker-projection'
import { markerLabel } from './chart/marker-label'
import './inspector.css'

function InspectorChartMarkersComponent({ chartApi, markers, timeDisplay, onSelectRelease, currencyColors = {} }: {
  currencyColors?: CurrencyColors
  chartApi: IChartApi; markers: InspectorMarker[]; timeDisplay: TimeDisplayPreference; onSelectRelease: (id: string) => void
}) {
  const [positions, setPositions] = useState<MarkerCluster[]>([])
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const index = useMemo(() => indexMarkers(markers), [markers])
  useEffect(() => {
    const scale = chartApi.timeScale()
    let frame: number | null = null
    function update() {
      frame = null
      const clusters = projectMarkers(scale, index)
      setPositions(previous => sameMarkerClusters(previous, clusters) ? previous : clusters)
      // An off-screen or regrouped anchor ends this interaction. Returning to
      // the same candle must not reopen a chooser from an earlier chart view.
      setExpandedId((current) => current !== null && clusters.some((cluster) =>
        cluster.markers.length > 1 && cluster.markers[0].release.id === current) ? current : null)
    }
    const schedule = () => { if (frame === null) frame = window.requestAnimationFrame(update) }
    update()
    scale.subscribeVisibleLogicalRangeChange(schedule)
    scale.subscribeSizeChange(schedule)
    return () => { if (frame !== null) window.cancelAnimationFrame(frame); scale.unsubscribeVisibleLogicalRangeChange(schedule); scale.unsubscribeSizeChange(schedule) }
  }, [chartApi, index])
  if (!markers.length) return null
  const releaseTime = (marker: InspectorMarker) => markerLabel(marker, timeDisplay).time
  const description = (marker: InspectorMarker) => markerLabel(marker, timeDisplay).description
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
export const InspectorChartMarkers = memo(InspectorChartMarkersComponent)
