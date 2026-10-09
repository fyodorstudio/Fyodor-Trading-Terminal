import { useCallback, useEffect, useRef, type PointerEvent as ReactPointerEvent } from 'react'
import type { IChartApi } from 'lightweight-charts'

// SVG hits sit above the chart's mouse surface. Forward only hover movement
// to that surface, retaining native dashed lines, axis labels and subscribers.
// Never forward button events: drawing edits must not start chart navigation.
export function useDrawingCrosshair(chart: IChartApi) {
  const frame = useRef<number | null>(null)
  const latest = useRef<{ clientX: number; clientY: number } | null>(null)
  const entered = useRef<HTMLCanvasElement | null>(null)
  const paneElement = useCallback(() => chart.panes?.()[0]?.getHTMLElement(), [chart])
  const move = useCallback((event: ReactPointerEvent<SVGSVGElement>) => {
    if (event.pointerType === 'touch' || !chart.panes) return
    latest.current = { clientX: event.clientX, clientY: event.clientY }
    if (frame.current !== null) return
    frame.current = window.requestAnimationFrame(() => {
      frame.current = null
      const point = latest.current
      const canvas = paneElement()?.querySelector<HTMLCanvasElement>('canvas:last-of-type')
      if (!point || !canvas) return
      const options = { ...point, view: window, buttons: 0, bubbles: false }
      if (entered.current !== canvas) {
        canvas.dispatchEvent(new window.MouseEvent('mouseenter', options))
        entered.current = canvas
      }
      canvas.dispatchEvent(new window.MouseEvent('mousemove', options))
    })
  }, [chart, paneElement])
  const leave = useCallback((event: ReactPointerEvent<SVGSVGElement>) => {
    const canvas = entered.current
    if (frame.current !== null) window.cancelAnimationFrame(frame.current)
    frame.current = null
    latest.current = null
    entered.current = null
    // Returning to the native canvas lets its own enter/move event take over.
    const related = event.relatedTarget
    if (!(related instanceof Node) || !paneElement()?.contains(related)) {
      if (canvas) canvas.dispatchEvent(new window.MouseEvent('mouseleave', { clientX: event.clientX, clientY: event.clientY, view: window }))
      else chart.clearCrosshairPosition?.()
    }
  }, [chart, paneElement])
  useEffect(() => () => {
    if (frame.current !== null) window.cancelAnimationFrame(frame.current)
    frame.current = null
    latest.current = null
    entered.current = null
  }, [chart])
  return { move, leave }
}
