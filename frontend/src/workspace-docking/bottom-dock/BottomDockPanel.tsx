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
  onToggleHeight?: () => void
  isMaxHeight?: boolean
  children: ReactNode
  resizeHandle?: BottomDockResizeHandle | null
}

export function BottomDockPanel({
  activeWindow,
  activityCount,
  selectedSymbol,
  onSelectWindow,
  onClose,
  onToggleHeight,
  isMaxHeight = false,
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
        {onToggleHeight && (
          <button
            type="button"
            className="bottom-dock-size-toggle"
            onClick={onToggleHeight}
            aria-label={isMaxHeight ? 'Minimum dock height' : 'Maximum dock height'}
            title={isMaxHeight ? 'Minimum height' : 'Maximum height'}
          >
            {isMaxHeight ? (
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="5" y="2" width="9" height="9" rx="1.5" />
                <path d="M2 6v7a1 1 0 001 1h7" />
              </svg>
            ) : (
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="2" y="2" width="12" height="12" rx="1.5" />
                <line x1="2" y1="6" x2="14" y2="6" />
              </svg>
            )}
          </button>
        )}
        <button className="bottom-dock-close" type="button" onClick={onClose} aria-label="Close bottom dock">
          ×
        </button>
      </header>
      <div className="bottom-dock-content">{children}</div>
    </section>
  )
}
