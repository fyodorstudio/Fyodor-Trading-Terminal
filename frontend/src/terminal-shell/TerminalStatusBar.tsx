import { ColorThemeButton } from '../appearance/color-theme/ColorThemeButton'
import type { ColorTheme } from '../appearance/color-theme/color-theme-preference'
import type { ChartTimeframe } from '../market-data/contracts/ChartTimeframe'
import type { BottomDockWindow } from '../workspace-docking/bottom-dock/bottom-dock-window'

type TerminalStatusBarProps = {
  sourceState: 'live' | 'waiting' | 'error'
  sourceLabel: string
  sourceSymbolCount: number
  selectedSymbol: string
  timeframe: ChartTimeframe
  barCount: number
  activityCount: number
  bottomDockWindow: BottomDockWindow | null
  hasResearchSelection: boolean
  settingsOpen: boolean
  calendarStatus: string
  calendarEventCount: number
  onToggleBottomDock: (window: BottomDockWindow) => void
  onThemeChanged: (theme: ColorTheme) => void
  onToggleSettings: () => void
}

export function TerminalStatusBar({
  sourceState,
  sourceLabel,
  sourceSymbolCount,
  selectedSymbol,
  timeframe,
  barCount,
  activityCount,
  bottomDockWindow,
  hasResearchSelection,
  settingsOpen,
  calendarStatus,
  calendarEventCount,
  onToggleBottomDock,
  onThemeChanged,
  onToggleSettings,
}: TerminalStatusBarProps) {
  const calendarBadge = calendarStatus === 'live'
    ? calendarEventCount
    : calendarStatus === 'stale' || calendarStatus === 'unavailable'
      ? 'Offline'
      : calendarStatus === 'awaiting-snapshot'
        ? 'Syncing'
        : 'Waiting'
  return (
    <footer className="status-bar">
      <span className="status-message"><i className={`status-dot ${sourceState}`} /> {sourceLabel} · {sourceSymbolCount} symbols</span>
      <span className="status-selection">{selectedSymbol} · {timeframe} · {barCount} bars</span>
      <div className="status-actions">
        <button className={`status-action${bottomDockWindow === 'notebook' ? ' active' : ''}`} type="button" onClick={() => onToggleBottomDock('notebook')} aria-expanded={bottomDockWindow === 'notebook'}>
          Notebook
        </button>
        <button className={`status-action${bottomDockWindow === 'calendar' ? ' active' : ''}`} type="button" onClick={() => onToggleBottomDock('calendar')} aria-expanded={bottomDockWindow === 'calendar'}>
          Calendar <span className={`preview-label${calendarStatus === 'live' ? ' live' : ''}`}>{calendarBadge}</span>
        </button>
        <button className={`status-action${bottomDockWindow === 'activity' ? ' active' : ''}`} type="button" onClick={() => onToggleBottomDock('activity')} aria-expanded={bottomDockWindow === 'activity'}>
          Activity <span className="activity-count">{activityCount}</span>
        </button>
        {hasResearchSelection && <button className={`status-action${bottomDockWindow === 'arrow-result' ? ' active' : ''}`} type="button" onClick={() => onToggleBottomDock('arrow-result')} aria-expanded={bottomDockWindow === 'arrow-result'}>
          Arrow Result
        </button>}
        <ColorThemeButton onThemeChanged={onThemeChanged} />
        <button className={`status-action${settingsOpen ? ' active' : ''}`} type="button" onClick={onToggleSettings} aria-expanded={settingsOpen}>
          <span aria-hidden="true">⚙</span> Settings
        </button>
      </div>
    </footer>
  )
}
