import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { readRaycasterPosition, saveRaycasterPosition } from '../storage/raycaster-preferences'

export function useRaycasterPosition() {
  const ref = useRef<HTMLElement>(null)
  const [position, setPosition] = useState(readRaycasterPosition)
  const cleanup = useRef<(() => void) | null>(null)
  const clamp = (x: number, y: number) => {
    const box = ref.current?.getBoundingClientRect(), parent = ref.current?.parentElement?.getBoundingClientRect()
    return { x: Math.min(Math.max(0, x), Math.max(0, (parent?.width ?? 0) - (box?.width ?? 0))),
      y: Math.min(Math.max(0, y), Math.max(0, (parent?.height ?? 0) - (box?.height ?? 0))) }
  }
  useEffect(() => {
    const parent = ref.current?.parentElement
    if (!parent) return
    const observer = new ResizeObserver(() => setPosition(current => {
      const next = clamp(current.x, current.y)
      if (next.x === current.x && next.y === current.y) return current
      saveRaycasterPosition(next); return next
    }))
    observer.observe(parent)
    if (ref.current) observer.observe(ref.current)
    return () => { observer.disconnect(); cleanup.current?.() }
  }, [])
  const drag = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0) return
    event.preventDefault(); event.stopPropagation(); cleanup.current?.()
    const start = { x: event.clientX, y: event.clientY }, initial = position, id = event.pointerId
    const move = (e: PointerEvent) => {
      if (e.pointerId === id) setPosition(clamp(initial.x + e.clientX - start.x, initial.y + e.clientY - start.y))
    }
    const finish = (e: PointerEvent) => {
      if (e.pointerId !== id) return
      cleanup.current?.(); setPosition(current => { saveRaycasterPosition(current); return current })
    }
    cleanup.current = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', finish);
      window.removeEventListener('pointercancel', finish); cleanup.current = null }
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', finish); window.addEventListener('pointercancel', finish)
  }
  return { ref, position, drag }
}
