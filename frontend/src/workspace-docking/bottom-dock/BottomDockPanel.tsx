import type { ReactNode } from 'react'
import type { BottomDockResizeHandle } from './useBottomDockSize'
import './bottom-dock-panel.css'

export function BottomDockPanel({ children, resizeHandle, hidden = false }: {
  children: ReactNode; resizeHandle?: BottomDockResizeHandle | null; hidden?: boolean
}) {
  return <section hidden={hidden} className={`bottom-dock${resizeHandle ? ' resizable' : ''}`} aria-label="Bottom dock">
    {resizeHandle && <div className="bottom-dock-resize-handle" {...resizeHandle} />}
    <div className="bottom-dock-content">{children}</div>
  </section>
}
