import type { ReactNode } from 'react'
import type { BottomDockWindow } from './bottom-dock-window'
import type { BottomDockResizeHandle } from './useBottomDockSize'
import './bottom-dock-panel.css'

type BottomDockPanelProps = {
  activeWindow: BottomDockWindow
  activityCount: number
  selectedSymbol: string
  hasResearchSelection: boolean
  onSelectWindow: (window: BottomDockWindow) => void
  onClose: () => void
  children: ReactNode
  resizeHandle?: BottomDockResizeHandle | null
}

export function BottomDockPanel({
  activeWindow,
  activityCount,
  selectedSymbol,
  hasResearchSelection,
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
          className={activeWindow === 'calendar' ? 'active' : ''}
          onClick={() => onSelectWindow('calendar')}
        >
          Economic Calendar <span>Preview</span>
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
        {hasResearchSelection && <button type="button" className={activeWindow === 'arrow-result' ? 'active' : ''}
          onClick={() => onSelectWindow('arrow-result')}>
          Arrow Result <span>{selectedSymbol}</span>
        </button>}
        <button className="bottom-dock-close" type="button" onClick={onClose} aria-label="Close bottom dock">
          ×
        </button>
      </header>
      <div className="bottom-dock-content">{children}</div>
    </section>
  )
}
