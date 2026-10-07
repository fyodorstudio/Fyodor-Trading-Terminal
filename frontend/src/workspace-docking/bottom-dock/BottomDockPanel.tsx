import type { ReactNode } from 'react'
import type { BottomDockResizeHandle } from './useBottomDockSize'
import './bottom-dock-panel.css'

export function BottomDockPanel({ children, resizeHandle }: {
  children: ReactNode; resizeHandle?: BottomDockResizeHandle | null
}) {
  return <section className={`bottom-dock${resizeHandle ? ' resizable' : ''}`} aria-label="Bottom dock">
    {resizeHandle && <div className="bottom-dock-resize-handle" {...resizeHandle} />}
    <div className="bottom-dock-content">{children}</div>
  </section>
}
