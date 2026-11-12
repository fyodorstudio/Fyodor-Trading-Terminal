import { selectedMacroMetrics } from './macro-preferences'
import type { MacroIndicator, MacroReading } from './macro-data'

type ReleaseMarker = { key: string; time: number; releasedAt: number; forecast?: number; actual?: MacroReading;
  format?: Pick<MacroReading, 'unit' | 'multiplier' | 'digits'> }
const identity = (key: string, releasedAt: number) => `${key}:${releasedAt}`

export function createMacroReleaseMarkers() {
  const markers = new Map<string, ReleaseMarker>()
  let ordered: ReleaseMarker[] = []
  return {
    all: () => ordered,
    hasActual: (key: string, at: number) => !!markers.get(identity(key, at))?.actual,
    clear() { markers.clear(); ordered = [] },
    sync(indicator: MacroIndicator, now: number) {
      const selected = new Set(selectedMacroMetrics(indicator.preferences)), incoming = new Set<string>(), actuals = new Set<string>()
      for (const scheduled of indicator.upcoming ?? []) for (const key of scheduled.metrics) {
        if (!selected.has(key)) continue
        const id = identity(key, scheduled.releasedAt)
        if (scheduled.releasedAt <= now && !markers.has(id)) continue
        const value = scheduled.forecasts?.[key]
        incoming.add(id)
        markers.set(id, { key, time: scheduled.time, releasedAt: scheduled.releasedAt, forecast: Number.isFinite(value) ? value : undefined, format: scheduled.formats?.[key] })
      }
      for (const key of selected) for (const reading of indicator.history[key] ?? []) {
        const id = identity(key, reading.releasedAt), marker = markers.get(id)
        if (marker) { marker.actual = reading; marker.time = reading.time; actuals.add(id) }
      }
      for (const [id, marker] of markers) {
        if (!selected.has(marker.key) || (marker.releasedAt > now && !incoming.has(id)) || (marker.actual && !actuals.has(id))) markers.delete(id)
      }
      ordered = [...markers.values()].sort((a, b) => a.time - b.time)
    },
  }
}

export function paintMacroReleaseMarker(context: CanvasRenderingContext2D, x: number, y: number, text: string, color: string, actual: boolean) {
  context.save(); context.font = '10px sans-serif'; context.textAlign = 'center'; context.textBaseline = 'middle'
  const rx = Math.max(11, Math.min(64, context.measureText(text).width / 2 + 6)), ry = 10
  context.fillStyle = color; context.strokeStyle = color; context.lineWidth = 1.5; context.setLineDash([])
  context.globalAlpha = actual ? 1 : 0.15
  context.beginPath(); context.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); context.fill()
  context.globalAlpha = actual ? 1 : 0.45; context.stroke()
  const rgb = [1, 3, 5].map(index => parseInt(color.slice(index, index + 2), 16))
  const contrast = rgb[0] * 0.299 + rgb[1] * 0.587 + rgb[2] * 0.114 > 150 ? '#111827' : '#ffffff'
  context.globalAlpha = actual ? 1 : 0.85; context.fillStyle = actual ? contrast : color
  context.fillText(text, x, y, rx * 2 - 8); context.restore()
  return { x, y, rx, ry }
}
