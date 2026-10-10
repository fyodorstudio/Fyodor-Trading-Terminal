import { useEffect, useState } from 'react'
import { ContextViewSelector } from '../../pair-context/ui/ContextViewSelector'
import { useCalendarNow } from '../../inspector/useCalendarNow'
import { useExternalEvents } from '../../external-events/storage/external-event-store'
import { ExternalEventManager } from '../../external-events/ui/ExternalEventManager'
import { setToolsOpen, toolScope, useToolInspection } from '../runtime/inspection-session'
import { RaycasterSettings } from '../settings/RaycasterSettings'
import { RoofsSettings } from '../settings/RoofsSettings'
import { CandySettings } from '../settings/CandySettings'
import { ScoringSystemSettings } from '../settings/ScoringSystemSettings'
import type { ChartTimeframe } from '../../market-data/contracts/ChartTimeframe'
import type { InspectorScoringProps } from '../../inspector/scoring/scoring-contracts'
import './fundamental-settings.css'
import '../../external-events/ui/external-events.css'

const tabs = ['Scoring System', 'Raycaster', 'Roofs', 'Candy', 'Outside Events'] as const
export function FundamentalSettingsPanel({ family, onFamilyChange,model,onModelChange, symbol, brokerId, timeframe, clockOffsetMs = 0, brokerOffsetSeconds = 0, release = null, events }: {
  family: string; onFamilyChange: (family: string) => void; symbol: string; brokerId: string | null;
  model?:'legacy'|'r1';onModelChange?:(model:'legacy'|'r1')=>void;
  timeframe: ChartTimeframe; clockOffsetMs?: number; brokerOffsetSeconds?: number
  release?: InspectorScoringProps['release']; events?: InspectorScoringProps['events']
}) {
  const [tab, setTab] = useState<typeof tabs[number]>('Scoring System')
  const scope = toolScope(brokerId, symbol, timeframe)
  const toolsActive = tab !== 'Scoring System'
  useEffect(() => { if (!toolsActive) return; setToolsOpen(scope, true); return () => setToolsOpen(scope, false) }, [scope, toolsActive])
  const supported = /^(EURUSD|GBPUSD|AUDUSD|NZDUSD|USDJPY|USDCHF|USDCAD)(?:[._-].*|[a-z]*)$/i.test(symbol)
  const relativeSupported = /^EURUSD(?:[._-].*|[a-z]*)$/i.test(symbol)
  return <section id="fundamental-settings" className="fundamental-settings-panel" aria-label="Fundamental Settings">
    <h2>Fundamental Settings</h2>
    <nav role="tablist" aria-label="Fundamental settings sections">{tabs.map((name, index) => <button key={name} type="button" role="tab"
      id={`fundamental-tab-${index}`} aria-controls="fundamental-settings-content" aria-selected={tab === name} tabIndex={tab === name ? 0 : -1}
      onClick={() => setTab(name)} onKeyDown={e => {
        const next = e.key === 'ArrowRight' ? (index + 1) % tabs.length : e.key === 'ArrowLeft' ? (index + tabs.length - 1) % tabs.length : e.key === 'Home' ? 0 : e.key === 'End' ? tabs.length - 1 : null
        if (next !== null) { e.preventDefault(); setTab(tabs[next]); (e.currentTarget.parentElement?.children[next] as HTMLElement)?.focus() }
      }}>{name}</button>)}</nav>
    <div id="fundamental-settings-content" role="tabpanel" aria-labelledby={`fundamental-tab-${tabs.indexOf(tab)}`} className="fundamental-settings-content">
      {tab === 'Scoring System' ? <ScoringSystemSettings family={family} onFamilyChange={onFamilyChange} model={model} onModelChange={onModelChange} release={release} events={events} brokerId={brokerId} /> : tab === 'Outside Events' ?
        brokerId && symbol ? <OutsideEventSettings key={scope} scope={scope} symbol={symbol} brokerId={brokerId} clockOffsetMs={clockOffsetMs}
          brokerOffsetSeconds={brokerOffsetSeconds} /> : <p role="status">Connect to a broker to manage outside events.</p> : <>
        <ContextViewSelector supported={relativeSupported} label="Shared Raycaster and Candy context view" />
        {tab === 'Raycaster' && <><p>Experimental · development deferred.</p><RaycasterSettings supported={supported} relativeSupported={relativeSupported} /></>}
        {tab === 'Roofs' && <RoofsSettings supported={relativeSupported} />}
        {tab === 'Candy' && <CandySettings />}
      </>}
    </div>
  </section>
}

function OutsideEventSettings({ scope, symbol, brokerId, clockOffsetMs, brokerOffsetSeconds }: {
  scope: string; symbol: string; brokerId: string; clockOffsetMs: number; brokerOffsetSeconds: number
}) {
  const inspection = useToolInspection(scope), events = useExternalEvents()
  const now = useCalendarNow(clockOffsetMs) + brokerOffsetSeconds * 1000
  return <ExternalEventManager embedded events={events.filter(e => e.symbol === symbol && e.brokerId === brokerId)} initialId={null}
    defaults={inspection?.window ?? { from: now - 3600000, to: now }} symbol={symbol} brokerId={brokerId} />
}
