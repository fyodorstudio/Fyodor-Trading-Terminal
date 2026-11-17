import { useCallback, useEffect, useLayoutEffect, useRef, type RefObject } from 'react'
import { formatHeatmapChange, heatmapOHLC, type HeatmapField, type HeatmapPoint } from './heatmap-model'

type Entry = { row: { id: string }; point: HeatmapPoint | undefined }
type Reading = { values: Map<string, number | null>; close: number | null; left: string; width: string }
type Snapshot = { scope: string; rows: Map<string, Reading> }

// Native animations run outside React: no render loop or animation timers.
export function useRankingMotion({ root, entries, fields, scope, enabled, bars, maximum, unusual }: {
  root: RefObject<HTMLElement | null>; entries: Entry[]; fields: readonly HeatmapField[]
  scope: string; enabled: boolean; bars: boolean; maximum: number; unusual: boolean
}) {
  const previous = useRef<Snapshot | null>(null)
  const animations = useRef(new Map<Element, Animation>())
  const cancel = useCallback(() => {
    const active = [...animations.current.values()]
    animations.current.clear()
    for (const animation of active) animation.cancel()
  }, [])
  useLayoutEffect(() => cancel, [cancel])
  useEffect(() => {
    if (!enabled) return
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const changed = () => { if (media.matches) cancel() }
    media.addEventListener('change', changed)
    return () => media.removeEventListener('change', changed)
  }, [enabled, cancel])

  useLayoutEffect(() => {
    if (!enabled || !root.current) { cancel(); previous.current = null; return }
    const next: Snapshot = { scope, rows: new Map() }
    for (const { row, point } of entries) {
      const close = point?.value ?? null
      const width = close == null || maximum === 0 ? 0 : Math.abs(close) / maximum * 50
      const values = new Map<string, number | null>(heatmapOHLC(point)
        .filter(field => bars ? field.label === 'C' : fields.includes(field.label)).map(field => [field.label, field.value]))
      if (unusual) values.set('relative', point?.relative ?? null)
      next.rows.set(row.id, { values, close, left: `${close != null && close < 0 ? 50 - width : 50}%`, width: `${width}%` })
    }
    const before = previous.current
    previous.current = next
    if (!before || before.scope !== scope || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      cancel(); return
    }
    for (const [element, animation] of animations.current) {
      if (!root.current.contains(element)) { animations.current.delete(element); animation.cancel() }
    }
    const style = window.getComputedStyle(root.current)
    const up = style.getPropertyValue('--positive').trim() || '#16a34a'
    const down = style.getPropertyValue('--negative').trim() || '#dc2626'
    const start = (element: Element | null, keyframes: Keyframe[], duration: number) => {
      if (!element || typeof element.animate !== 'function') return
      animations.current.get(element)?.cancel()
      const animation = element.animate(keyframes, { duration, easing: 'ease-out' })
      animations.current.set(element, animation)
      const finished = () => { if (animations.current.get(element) === animation) animations.current.delete(element) }
      animation.onfinish = finished; animation.oncancel = finished
    }
    for (const row of root.current.querySelectorAll<HTMLElement>('[data-ranking-row]')) {
      const id = row.dataset.rankingRow!, old = before.rows.get(id), current = next.rows.get(id)
      if (!old || !current) continue
      for (const [field, value] of current.values) {
        const prior = old.values.get(field)
        if (value == null || prior == null || !Number.isFinite(value) || !Number.isFinite(prior)
          || formatHeatmapChange(value) === formatHeatmapChange(prior)) continue
        const color = value > prior ? up : down
        start(row.querySelector(`[data-rank-field="${field}"]`), [
          { backgroundColor: `color-mix(in srgb, ${color} 32%, transparent)` },
          { backgroundColor: 'transparent' },
        ], 800)
        if (field === 'C') {
          start(row.querySelector('.heatmap-ranking-entry'), [
            { backgroundColor: `color-mix(in srgb, ${color} 9%, transparent)` },
            { backgroundColor: 'transparent' },
          ], 800)
          if (bars) start(row.querySelector('.heatmap-bar-tip'), [
            { opacity: 1, transform: 'scale(1)', backgroundColor: color, boxShadow: `0 0 8px ${color}` },
            { opacity: .6, transform: 'scale(2.2)', backgroundColor: color, offset: .4 },
            { opacity: 0, transform: 'scale(1)', backgroundColor: color },
          ], 650)
        }
      }
      if (bars && old.close != null && current.close != null && (old.left !== current.left || old.width !== current.width)) {
        start(row.querySelector('.heatmap-bar-fill'), [
          { left: old.left, width: old.width }, { left: current.left, width: current.width },
        ], 350)
      }
    }
  }, [root, entries, fields, scope, enabled, bars, maximum, unusual, cancel])
}
