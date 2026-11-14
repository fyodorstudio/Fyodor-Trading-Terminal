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

export function macroMarkerBounds(context: CanvasRenderingContext2D, x: number, y: number, text: string) {
  return { x, y, rx: Math.max(11, context.measureText(text).width / 2 + 5), ry: 8 }
}

/** A small spatial grid keeps dense label placement proportional to visible markers. */
export function createMacroLabelLayout() {
  const occupied = new Map<string, ReturnType<typeof macroMarkerBounds>[]>()
  return { claim(bounds: ReturnType<typeof macroMarkerBounds>, width: number, height: number) {
    const { x, y, rx, ry } = bounds
    if (x - rx < 0 || x + rx > width || y - ry < 0 || y + ry > height) return false
    const cells: string[] = []
    for (let col = Math.floor((x - rx - 1) / 8); col <= Math.floor((x + rx + 1) / 8); col++)
      for (let row = Math.floor((y - ry - 1) / 8); row <= Math.floor((y + ry + 1) / 8); row++) cells.push(`${col}:${row}`)
    for (const cell of cells) for (const other of occupied.get(cell) ?? [])
      if (Math.abs(x - other.x) < rx + other.rx + 2 && Math.abs(y - other.y) < ry + other.ry + 2) return false
    for (const cell of cells) {
      const entries = occupied.get(cell)
      if (entries) entries.push(bounds)
      else occupied.set(cell, [bounds])
    }
    return true
  } }
}

export function paintMacroReleaseMarker(context: CanvasRenderingContext2D, x: number, y: number, text: string, color: string, actual: boolean, background = '#ffffff') {
  context.save(); context.font = '10px sans-serif'; context.textAlign = 'center'; context.textBaseline = 'middle'
  const { rx, ry } = macroMarkerBounds(context, x, y, text)
  context.fillStyle = color; context.strokeStyle = color; context.lineWidth = 1.5; context.setLineDash([])
  context.globalAlpha = 1; context.fillStyle = actual ? color : background
  context.beginPath(); context.rect(x - rx, y - ry, rx * 2, ry * 2); context.fill(); context.stroke()
  const rgb = [1, 3, 5].map(index => parseInt(color.slice(index, index + 2), 16) / 255).map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4)
  const luminance = rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722
  const contrast = (luminance + 0.05) / 0.059 > 1.05 / (luminance + 0.05) ? '#111827' : '#ffffff'
  context.globalAlpha = actual ? 1 : 0.85; context.fillStyle = actual ? contrast : color
  context.fillText(text, x, y, rx * 2 - 8); context.restore()
  return { x, y, rx, ry }
}
