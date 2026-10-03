import { useEffect, useId, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

// Feature-local menus open outside the short dock so its scrolling cannot clip
// the picker. They prefer the space above the dock and close on outside/Escape.
export function TimelinePopover({ label, title = label, children }: {
  label: string
  title?: string
  children: (close: () => void) => ReactNode
}) {
  const id = useId()
  const trigger = useRef<HTMLButtonElement>(null)
  const panel = useRef<HTMLDivElement>(null)
  const [placement, setPlacement] = useState<CSSProperties | null>(null)
  function close() { setPlacement(null) }
  useEffect(() => {
    if (!placement) return
    const element = panel.current
    element?.querySelector<HTMLElement>('button, input, select')?.focus()
    function outside(event: PointerEvent) {
      if (!panel.current?.contains(event.target as Node) && !trigger.current?.contains(event.target as Node)) setPlacement(null)
    }
    function keyboard(event: KeyboardEvent) {
      if (event.key === 'Escape') { event.preventDefault(); setPlacement(null); trigger.current?.focus() }
    }
    function resize() { setPlacement(null) }
    document.addEventListener('pointerdown', outside)
    document.addEventListener('keydown', keyboard)
    window.addEventListener('resize', resize)
    return () => {
      document.removeEventListener('pointerdown', outside)
      document.removeEventListener('keydown', keyboard)
      window.removeEventListener('resize', resize)
    }
  }, [placement])
  return <>
    <button ref={trigger} type="button" className="timeline-menu-trigger" aria-label={title}
      aria-haspopup="dialog" aria-expanded={Boolean(placement)} aria-controls={placement ? id : undefined}
      onClick={() => {
        if (placement) { close(); return }
        const rect = trigger.current!.getBoundingClientRect()
        const above = rect.top > window.innerHeight / 2
        const width = Math.min(380, window.innerWidth - 24)
        setPlacement({ position: 'fixed', width, left: Math.max(12, Math.min(rect.left, window.innerWidth - width - 12)),
          ...(above ? { bottom: window.innerHeight - rect.top + 6 } : { top: rect.bottom + 6 }),
          maxHeight: Math.max(100, (above ? rect.top : window.innerHeight - rect.bottom) - 18) })
      }}>{label}</button>
    {placement && createPortal(<div ref={panel} id={id} style={placement} className="timeline-popover"
      role="dialog" aria-label={title}>
      {children(close)}
    </div>, document.body)}
  </>
}
