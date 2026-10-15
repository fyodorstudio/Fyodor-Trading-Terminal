import { useState, type ReactNode } from 'react'
import { AlertDock } from '../alert'
import type { InspectorRelease } from '../economic-calendar/releases/release'
import { ExternalSourcesDock } from '../external-sources/ExternalSourcesDock'
import { AlarmControls } from './AlarmControls'
import { HighlightDock } from './HighlightDock'
import { jakartaDisplay } from './alarm-time'
import { useAlarms } from './useAlarms'
import './events-alarms.css'

export function EventsDock({ brokerId, brokerOffsetSeconds, focusKey, onPrepareResearch }: {
  brokerId: string | null; brokerOffsetSeconds: number; focusKey: string | null; onPrepareResearch?: (release: InspectorRelease) => void
}) {
  const alarms = useAlarms()
  const [tab, setTab] = useState<'highlight' | 'external' | 'calendar'>(() => {
    if (focusKey) return 'external'
    if (new URLSearchParams(window.location.search).get('events') === 'alarms') return 'highlight'
    try {
      const saved = localStorage.getItem('fyodor.events.tab.v1')
      if (saved === 'calendar' && localStorage.getItem('fyodor.alert.highlight-view.v1') === 'true') {
        localStorage.setItem('fyodor.events.tab.v1', 'highlight')
        localStorage.removeItem('fyodor.alert.highlight-view.v1')
        return 'highlight'
      }
      return saved === 'external' || saved === 'calendar' ? saved : 'highlight'
    } catch { return 'highlight' }
  })
  const [savedFocus, setSavedFocus] = useState(focusKey)
  if (savedFocus !== focusKey) { setSavedFocus(focusKey); if (focusKey) setTab('external') }
  const changeTab = (next: typeof tab) => { setTab(next); try { localStorage.setItem('fyodor.events.tab.v1', next) } catch { /* Keep session tab. */ } }
  function header(controls: ReactNode, currencies?: ReactNode) {
    return <header className="events-dock-header">
      <h2>Alert</h2>
      <div className="events-header-filters">
        <nav className="events-view-buttons" aria-label="Event view">
          {([['highlight', 'Highlight'], ['calendar', 'MT5 Calendar'], ['external', 'External Source']] as const).map(([value, label]) =>
            <button type="button" key={value} aria-pressed={tab === value} onClick={() => changeTab(value)}>{label}</button>)}
        </nav>
        {controls}
      </div>
      <span className="events-header-separator" aria-hidden="true">|</span>
      {currencies}
      <AlarmControls alarms={alarms} />
    </header>
  }
  return <section className="events-alarm-dock" aria-label="Alert">
    {tab === 'highlight' && <HighlightDock brokerId={brokerId} alarms={alarms} renderHeader={header} onPrepareResearch={onPrepareResearch} />}
    {tab === 'external' && <ExternalSourcesDock brokerId={brokerId} timeDisplay={jakartaDisplay} focusKey={focusKey} renderHeader={header} showPinControls />}
    {tab === 'calendar' && <AlertDock brokerId={brokerId} brokerOffsetSeconds={brokerOffsetSeconds} timeDisplay={jakartaDisplay} onPrepareResearch={onPrepareResearch} renderHeader={header} calendarOnly />}
  </section>
}
