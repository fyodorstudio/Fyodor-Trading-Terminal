import { useEffect, useState } from 'react'
import {
  formatAppTimestamp,
  timeDisplayLabel,
  type TimeDisplayPreference,
} from '../appearance/time-display/time-display-preference'
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
  settingsOpen: boolean
  timeDisplay: TimeDisplayPreference
  onToggleBottomDock: (window: BottomDockWindow) => void
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
  settingsOpen,
  timeDisplay,
  onToggleBottomDock,
  onToggleSettings,
}: TerminalStatusBarProps) {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  return (
    <footer className="status-bar">
      <span className="status-message"><i className={`status-dot ${sourceState}`} /> {sourceLabel} · {sourceSymbolCount} symbols</span>
      <span className="status-clock">{formatAppTimestamp(now, timeDisplay, 'time')} · {timeDisplayLabel(timeDisplay)}</span>
      <span className="status-selection">{selectedSymbol} · {timeframe} · {barCount} bars</span>
      <div className="status-actions status-primary" role="group" aria-label="App features">
        <button className={`status-action${bottomDockWindow === 'alert' ? ' active' : ''}`} type="button"
          onClick={() => onToggleBottomDock('alert')} aria-expanded={bottomDockWindow === 'alert'}>Alert</button>
        <button className={`status-action${bottomDockWindow === 'currency-news' ? ' active' : ''}`} type="button" onClick={() => onToggleBottomDock('currency-news')} aria-expanded={bottomDockWindow === 'currency-news'}>Currency News</button>
        <button className={`status-action${bottomDockWindow === 'ledger' ? ' active' : ''}`} type="button" onClick={() => onToggleBottomDock('ledger')} aria-expanded={bottomDockWindow === 'ledger'}>Ledger</button>
        <button className={`status-action${bottomDockWindow === 'cross-asset' ? ' active' : ''}`} type="button" onClick={() => onToggleBottomDock('cross-asset')} aria-expanded={bottomDockWindow === 'cross-asset'}>Cross-Asset</button>
        <button className={`status-action${bottomDockWindow === 'inspector' ? ' active' : ''}`} type="button" onClick={() => onToggleBottomDock('inspector')} aria-expanded={bottomDockWindow === 'inspector'}>
          Inspector
        </button>
        <button className={`status-action${bottomDockWindow === 'entry-trade' ? ' active' : ''}`} type="button"
          onClick={() => onToggleBottomDock('entry-trade')} aria-expanded={bottomDockWindow === 'entry-trade'}>Entry Trade</button>
        <button className={`status-action${bottomDockWindow === 'activity' ? ' active' : ''}`} type="button" onClick={() => onToggleBottomDock('activity')} aria-expanded={bottomDockWindow === 'activity'}>
          Activity <span className="activity-count">{activityCount}</span>
        </button>
        <button className={`status-action${settingsOpen ? ' active' : ''}`} type="button" onClick={onToggleSettings} aria-expanded={settingsOpen}>
          <span aria-hidden="true">⚙</span> Settings
        </button>
      </div>
    </footer>
  )
}
