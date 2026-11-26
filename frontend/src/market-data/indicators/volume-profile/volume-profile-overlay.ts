import type { IChartApi, IPrimitivePaneRenderer, ISeriesApi, ISeriesPrimitive, Logical, Time } from 'lightweight-charts'
import { drawingTimeToLogical, type DrawingTimeline } from '../../chart-drawings/drawing-coordinates'
import type { ProfileSide, ProfileWindow, TickProfile } from './volume-profile'

export type FixedProfileWindow = ProfileWindow & { price1: number; price2: number }

export function createVolumeProfileOverlay(chart: IChartApi, series: ISeriesApi<'Candlestick', Time>) {
  let profile: TickProfile | null = null
  let side: ProfileSide = 'right'
  let fixed: FixedProfileWindow | null = null
  let bars: DrawingTimeline = []
  let step = 60
  let requestUpdate: (() => void) | undefined
  const scale = chart.timeScale()
  const colors = { POC: '#d49b2d', HVN: '#25a596', LVN: '#8897a9' }
  const renderer: IPrimitivePaneRenderer = {
    draw(target) {
      if (!profile && !fixed) return
      target.useMediaCoordinateSpace(({ context, mediaSize: { width, height } }) => {
        context.save()
        if (fixed) {
          const from = drawingTimeToLogical(fixed.from, bars, step)
          const to = drawingTimeToLogical(fixed.to, bars, step)
          const zero = scale.logicalToCoordinate(0 as Logical), one = scale.logicalToCoordinate(1 as Logical)
          // Native logical coordinates accept whole bar indices only.
          const x1 = from === null || zero === null || one === null ? null : zero + (from - 0.5) * (one - zero)
          const x2 = to === null || zero === null || one === null ? null : zero + (to - 0.5) * (one - zero)
          const y1 = series.priceToCoordinate(fixed.price1), y2 = series.priceToCoordinate(fixed.price2)
          if (x1 !== null && x2 !== null && y1 !== null && y2 !== null) {
            const left = Math.max(0, x1), right = Math.min(width, x2)
            if (right > left) {
              context.fillStyle = 'rgba(94, 128, 223, 0.08)'
              context.strokeStyle = 'rgba(94, 128, 223, 0.50)'
              context.fillRect(left, Math.min(y1, y2), right - left, Math.abs(y2 - y1))
              context.strokeRect(left, Math.min(y1, y2), right - left, Math.abs(y2 - y1))
            }
          }
        }
        if (profile) {
          const inset = 4
          const edge = side === 'left' ? inset : width - inset
          const maxWidth = Math.min(168, width * 0.23)
          const pocY = series.priceToCoordinate((profile.poc.low + profile.poc.high) / 2)
          if (pocY !== null && pocY >= 0 && pocY <= height) {
            context.strokeStyle = colors.POC
            context.globalAlpha = 0.75
            context.setLineDash([4, 4])
            context.beginPath()
            context.moveTo(0, pocY)
            context.lineTo(width, pocY)
            context.stroke()
            context.setLineDash([])
          }
          const labels: { node: keyof typeof colors; x: number; y: number }[] = []
          for (const row of profile.rows) {
            if (!row.count && row.node !== 'LVN') continue
            const upper = series.priceToCoordinate(row.high), lower = series.priceToCoordinate(row.low)
            if (upper === null || lower === null || Math.max(upper, lower) < 0 || Math.min(upper, lower) > height) continue
            const span = Math.max(row.node ? 4 : 1, row.count / profile.poc.count * maxWidth)
            const x = side === 'left' ? edge : edge - span
            const y = (upper + lower) / 2
            context.fillStyle = row.node ? colors[row.node] : '#5c82cc'
            context.globalAlpha = row.node ? 0.72 : 0.36
            context.fillRect(x, Math.min(upper, lower), span, Math.max(1, Math.abs(lower - upper) - 1))
            if (row.node && y > 8 && y < height - 8) labels.push({ node: row.node, x: side === 'left' ? x + span + 4 : x - 4, y })
          }
          labels.sort((a, b) => Number(b.node === 'POC') - Number(a.node === 'POC'))
          const printed: number[] = []
          context.globalAlpha = 1
          context.font = '10px sans-serif'
          context.textBaseline = 'middle'
          context.textAlign = side === 'left' ? 'left' : 'right'
          for (const { node, x, y } of labels) {
            if (printed.some(at => Math.abs(at - y) < 13)) continue
            context.fillStyle = colors[node]
            context.fillText(node, x, y)
            printed.push(y)
          }
        }
        context.restore()
      })
    },
  }
  const views = [{ renderer: () => renderer }]
  const primitive: ISeriesPrimitive<Time> = { paneViews: () => views, attached: params => { requestUpdate = params.requestUpdate } }
  series.attachPrimitive(primitive)
  return {
    sync(next: TickProfile | null, placement: ProfileSide, selection: FixedProfileWindow | null, timeline: DrawingTimeline, interval: number) {
      profile = next; side = placement; fixed = selection; bars = timeline; step = interval
      requestUpdate?.()
    },
    destroy() { series.detachPrimitive(primitive) },
  }
}
