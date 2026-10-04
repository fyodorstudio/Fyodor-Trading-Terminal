import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

// Portal avoids clipping by the table's scroll container. Dismiss on anchor movement.
export function MagnitudeDetails({ anchor, id, children, onDismiss }: {
  anchor: HTMLElement; id: string; children: ReactNode; onDismiss: () => void
}) {
  const [position, setPosition] = useState<{ left: number; top?: number; bottom?: number; width: number } | null>(null)
  const card = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const rect = anchor.getBoundingClientRect()
    const width = Math.min(340, window.innerWidth - 32)
    const left = Math.max(16, Math.min(rect.right - width, window.innerWidth - width - 16))
    const height = Math.min(window.innerHeight - 32, card.current?.getBoundingClientRect().height || 280)
    setPosition(rect.top >= height + 24 ? { left, width, bottom: window.innerHeight - rect.top + 8 } :
      { left, width, top: Math.max(16, Math.min(rect.bottom + 8, window.innerHeight - height - 16)) })
    const dismiss = () => onDismiss()
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') onDismiss() }
    window.addEventListener('scroll', dismiss, true)
    window.addEventListener('resize', dismiss)
    document.addEventListener('keydown', escape)
    return () => {
      window.removeEventListener('scroll', dismiss, true)
      window.removeEventListener('resize', dismiss)
      document.removeEventListener('keydown', escape)
    }
  }, [anchor, onDismiss, children])
  return createPortal(<div ref={card} id={id} role="tooltip" className="magnitude-details" style={{ ...position, visibility: position ? 'visible' : 'hidden' }}>
    {children}
  </div>, document.body)
}
