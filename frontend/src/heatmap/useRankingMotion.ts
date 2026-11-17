import { useCallback, useEffect, useLayoutEffect, useRef, type RefObject } from 'react'
import { formatHeatmapChange, heatmapOHLC, type HeatmapField, type HeatmapPoint } from './heatmap-model'

type Entry = { row: { id: string }; point: HeatmapPoint | undefined }
type Snapshot = { scope: string; rows: Map<string, Map<string, number | null>> }

// Native animations run outside React: no render loop or animation timers.
export function useRankingMotion({ root, entries, fields, scope, enabled, bars, unusual }: {
  root: RefObject<HTMLElement | null>; entries: Entry[]; fields: readonly HeatmapField[]
  scope: string; enabled: boolean; bars: boolean; unusual: boolean
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
      const values = new Map<string, number | null>(heatmapOHLC(point)
        .filter(field => bars ? field.label === 'C' : fields.includes(field.label)).map(field => [field.label, field.value]))
      if (unusual) values.set('relative', point?.relative ?? null)
      next.rows.set(row.id, values)
    }
    const before = previous.current
    previous.current = next
    if (!before || before.scope !== scope || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      cancel(); return
    }
    for (const [element, animation] of animations.current) {
      if (!root.current.contains(element)) { animations.current.delete(element); animation.cancel() }
    }
    const dark = root.current.ownerDocument.documentElement.dataset.theme === 'dark'
    const flash = dark ? 'rgba(226, 232, 240, 0.28)' : 'rgba(100, 116, 139, 0.30)'
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
      let changed = false
      for (const [field, value] of current) {
        const prior = old.get(field)
        if (value == null || prior == null || !Number.isFinite(value) || !Number.isFinite(prior)
          || formatHeatmapChange(value) === formatHeatmapChange(prior)) continue
        changed = true; break
      }
      if (changed) start(row.querySelector('.heatmap-ranking-entry'), [
        { backgroundColor: flash }, { backgroundColor: flash, offset: .15 }, { backgroundColor: 'transparent' },
      ], 450)
    }
  }, [root, entries, fields, scope, enabled, bars, unusual, cancel])
}
