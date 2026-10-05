import type { ReactNode } from 'react'
import type { BottomDockWindow } from './bottom-dock-window'
import type { BottomDockResizeHandle } from './useBottomDockSize'
import './bottom-dock-panel.css'

type BottomDockPanelProps = {
  activeWindow: BottomDockWindow
  activityCount: number
  selectedSymbol: string
  onSelectWindow: (window: BottomDockWindow) => void
  onClose: () => void
  children: ReactNode
  resizeHandle?: BottomDockResizeHandle | null
}

export function BottomDockPanel({
  activeWindow,
  activityCount,
  selectedSymbol,
  onSelectWindow,
  onClose,
  children,
  resizeHandle,
}: BottomDockPanelProps) {
  return (
    <section className={`bottom-dock${resizeHandle ? ' resizable' : ''}`} aria-label="Bottom dock">
      {resizeHandle && <div className="bottom-dock-resize-handle" {...resizeHandle} />}
      <header className="bottom-dock-tabs">
        <button
          type="button"
          className={activeWindow === 'notebook' ? 'active' : ''}
          onClick={() => onSelectWindow('notebook')}
        >
          Notebook <span>{selectedSymbol}</span>
        </button>
        <button
          type="button"
          className={activeWindow === 'activity' ? 'active' : ''}
          onClick={() => onSelectWindow('activity')}
        >
          Activity <span>{activityCount}</span>
        </button>
        <button type="button" className={activeWindow === 'inspector' ? 'active' : ''}
          onClick={() => onSelectWindow('inspector')}>Inspector</button>
        <button type="button" className={activeWindow === 'scatter-plot' ? 'active' : ''}
          onClick={() => onSelectWindow('scatter-plot')}>Scatter Plot</button>
        <button type="button" className={activeWindow === 'alert' ? 'active' : ''}
          onClick={() => onSelectWindow('alert')}>Alert</button>
        <button className="bottom-dock-close" type="button" onClick={onClose} aria-label="Close bottom dock">
          ×
        </button>
      </header>
      <div className="bottom-dock-content">{children}</div>
    </section>
  )
}
