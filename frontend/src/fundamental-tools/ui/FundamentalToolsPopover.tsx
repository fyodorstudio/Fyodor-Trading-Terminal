import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import type { TimeDisplayPreference } from '../../appearance/time-display/time-display-preference'
import { ContextViewSelector } from '../../pair-context/ui/ContextViewSelector'
import { useCalendarNow } from '../../inspector/useCalendarNow'
import { useExternalEvents } from '../../external-events/storage/external-event-store'
import { ExternalEventManager } from '../../external-events/ui/ExternalEventManager'
import { setToolsOpen, useToolInspection } from '../runtime/inspection-session'
import { RaycasterSettings } from '../settings/RaycasterSettings'
import { RoofsSettings } from '../settings/RoofsSettings'
import { CandySettings } from '../settings/CandySettings'
import '../../raycaster/ui/raycaster.css'
import '../../external-events/ui/external-events.css'

const tabs = ['Raycaster', 'Roofs', 'Candy'] as const
export function FundamentalToolsPopover({ id, scope, trigger, onClose, symbol, supported, relativeSupported, brokerId,
  timeDisplay, clockOffsetMs, brokerOffsetSeconds }: {
  id: string; scope: string; trigger: RefObject<HTMLButtonElement | null>; onClose: () => void; symbol: string;
  supported: boolean; relativeSupported: boolean; brokerId: string | null; timeDisplay: TimeDisplayPreference;
  clockOffsetMs: number; brokerOffsetSeconds: number
}) {
  const panel = useRef<HTMLDivElement>(null), tabButtons = useRef<(HTMLButtonElement | null)[]>([])
  const [tab, setTab] = useState<typeof tabs[number]>('Raycaster'), [outside, setOutside] = useState(false)
  const inspection = useToolInspection(scope), events = useExternalEvents()
  const now = useCalendarNow(clockOffsetMs) + brokerOffsetSeconds * 1000
  const close = () => { onClose(); trigger.current?.focus({ preventScroll: true }) }
  const closeOutside = useCallback(() => { setOutside(false); panel.current?.focus({ preventScroll: true }) }, [])
  useEffect(() => {
    setToolsOpen(scope, true); panel.current?.focus({ preventScroll: true })
    const escape = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); trigger.current?.focus({ preventScroll: true }) } }
    const outsideClick = (e: PointerEvent) => { if (e.target instanceof Node && !panel.current?.contains(e.target) && !trigger.current?.contains(e.target)) onClose() }
    document.addEventListener('keydown', escape); document.addEventListener('pointerdown', outsideClick)
    return () => { setToolsOpen(scope, false); document.removeEventListener('keydown', escape); document.removeEventListener('pointerdown', outsideClick) }
  }, [scope, onClose, trigger])
  return <div id={id} ref={panel} tabIndex={-1} role="dialog" aria-label="Fundamental tools settings" className="fundamental-tools-popover">
    <header><strong>Fundamental tools</strong><button type="button" aria-label="Close fundamental tools settings" onClick={close}>×</button></header>
    {!outside && <>
      <div className="shared-context-mode"><ContextViewSelector supported={relativeSupported} label="Shared Raycaster and Candy context view" /><small>Shared by Raycaster and Candy · Roofs use USD inputs</small></div>
      <div role="tablist" aria-label="Fundamental tool settings tabs">{tabs.map((name, i) => <button key={name} ref={node => { tabButtons.current[i] = node }} type="button" role="tab"
        id={`${id}-tab-${name}`} aria-controls={`${id}-panel`} aria-selected={tab === name} tabIndex={tab === name ? 0 : -1}
        onClick={() => setTab(name)} onKeyDown={e => {
          const next = e.key === 'ArrowRight' ? (i + 1) % tabs.length : e.key === 'ArrowLeft' ? (i + tabs.length - 1) % tabs.length : e.key === 'Home' ? 0 : e.key === 'End' ? tabs.length - 1 : null
          if (next !== null) { e.preventDefault(); setTab(tabs[next]); tabButtons.current[next]?.focus() }
        }}>{name}</button>)}</div>
      <div id={`${id}-panel`} role="tabpanel" aria-labelledby={`${id}-tab-${tab}`} tabIndex={0}>
        {tab === 'Raycaster' && <RaycasterSettings inspection={inspection} symbol={symbol} supported={supported} relativeSupported={relativeSupported} timeDisplay={timeDisplay} />}
        {tab === 'Roofs' && <RoofsSettings supported={relativeSupported} />}
        {tab === 'Candy' && <CandySettings />}
      </div>
      <footer><button type="button" disabled={!brokerId || !symbol} onClick={() => setOutside(true)}>Manage outside events</button>
        {!brokerId && <small>Select a connected broker to record annotations.</small>}</footer>
    </>}
    {outside && brokerId && <ExternalEventManager embedded events={events.filter(e => e.symbol === symbol && e.brokerId === brokerId)} initialId={null}
      defaults={inspection?.window ?? { from: now - 3600000, to: now }} symbol={symbol} brokerId={brokerId} onClose={closeOutside} />}
  </div>
}
