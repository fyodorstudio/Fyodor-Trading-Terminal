import { useId, useState } from 'react'
import { R1Reading } from './R1Reading'
import type { EventSymbol } from '../../inspector/event-symbols'
import type { relativeContext } from '../../scoring-system/context/relative/relative-context'
import type { ContextPoint } from '../../scoring-system/context/usd/contracts'
import type { EurContextPoint } from '../../scoring-system/context/relative/contracts'
import type { FreshPoint } from '../../scoring-system/relationships/contracts'
import { useRaycasterPosition } from './useRaycasterPosition'
import type { TimeDisplayPreference } from '../../appearance/time-display/time-display-preference'
import './raycaster.css'
import { raycasterLabel } from './raycaster-label'
import { usdContextPresentation } from '../core/usd-context-presentation'
import { useDisplayClock } from '../../appearance/time-display/useDisplayClock'
import type { ComboSnapshot } from '../../scoring-system/relationships/contracts'
import { roofSupport, roofResultLabel } from '../../scoring-system/relationships/relationship-support'
import { usdPair } from '../../scoring-system/context/usd/usd-pair'
import { ReadingSummary } from './ReadingSummary'
import { RoofAuditControls } from '../../usd-context/sequences/ui/RoofAuditControls'
import { roofLabel } from '../../usd-context/sequences/chart/roof-label'
import { ContextDetailed } from './ContextDetailed'
import type { InspectorScoringProps } from '../../inspector/scoring/scoring-contracts'

export type RaycasterView = 'context' | 'context-detailed' | 'combo' | 'r1'

export function RaycasterBox({ symbol, point, eurPoint, fresh, publication, cutoff, loading, message, notice, timeDisplay, onClose, relative, relativeUpdateAt, selectedCombo, selectionNotice, onClearCombo, brokerId = null, now=0, open=null, brokerOffsetSeconds=0, symbols, view, onViewChange }: {
  relative?: ReturnType<typeof relativeContext> | null; relativeUpdate?: string | null; relativeUpdateAt?: number | null;
  symbol: string; point: ContextPoint | null; cutoff: number | null; loading: boolean; message: string | null;
  eurPoint?: EurContextPoint | null; fresh?: FreshPoint | null;
  publication?: InspectorScoringProps;
  timeDisplay: TimeDisplayPreference; onClose: () => void; notice?: string | null;
  selectedCombo?: ComboSnapshot | null; selectionNotice?: string | null; onClearCombo?: () => void;
  now?:number; open?:number|null; brokerOffsetSeconds?:number; symbols?:Record<string,EventSymbol>;
  brokerId?: string | null; view?: RaycasterView; onViewChange?: (view: RaycasterView) => void;
}) {
  const clock = useDisplayClock(), viewId = useId()
  const [localView, setLocalView] = useState<RaycasterView>('context')
  if (!selectedCombo && localView === 'combo') setLocalView('context')
  const requestedView = view ?? localView
  const activeView = !selectedCombo && requestedView === 'combo' ? 'context' : requestedView
  const { ref, position, drag } = useRaycasterPosition(activeView === 'context-detailed' ? 'detailed' : 'compact')
  const result = point?.result
  const presentation = relative ? null : usdContextPresentation(symbol, result, cutoff ?? undefined)
  const strength = relative ? relative.strength : presentation?.evidence
  const label = raycasterLabel({ loading, message, cutoff, relative, result, symbol })
  const selectedSupport = selectedCombo ? roofSupport(selectedCombo) : null
  const selectedEvidence = selectedSupport?.narrow || selectedSupport?.qualified ? 'weak' : selectedCombo?.strength
  const orient = usdPair(symbol)?.usdSide === 'base' ? 1 : -1
  const ready = !loading && !message && cutoff !== null
  const direction = ready ? relative ? relative.direction === 'long' || relative.direction === 'short' ? relative.direction : null : presentation?.direction ?? null : null
  const votes = result?.members.filter(m => m.status === 'active').map(m => ({ label: m.sourceLabel, towardLong: orient * m.contribution })) ?? []
  const fed = selectedCombo?.sources.find(s => s.family === 'fed')
  return <aside ref={ref} className={`raycaster-box${activeView === 'context-detailed' ? ' raycaster-box-detailed' : ''}`} aria-label={activeView==='r1'?'Raycaster R1 currency evidence':'Raycaster USD context'}
    style={{ transform: `translate(${position.x}px, ${position.y}px)` }}>
    <header className="raycaster-header"><button type="button" onPointerDown={drag} className="raycaster-handle" aria-label="Move Raycaster" title="Drag to move Raycaster">⠿ Raycaster</button>
      <label className="raycaster-view-label" htmlFor={viewId}>View</label>
      <select id={viewId} aria-label="Raycaster view" value={activeView} onChange={event => {
        const next = event.target.value as RaycasterView
        setLocalView(next); onViewChange?.(next)
      }}><option value="r1">R1 Scoring System</option><option value="context">Context (Retired)</option><option value="context-detailed">Context-detailed (Retired)</option><option value="combo" disabled={!selectedCombo}>Selected combo (Retired)</option></select>
      <button type="button" onClick={onClose} aria-label="Hide Raycaster" title="Hide Raycaster">×</button>
    </header>
    <div className="raycaster-body">
    {activeView === 'r1' ? <R1Reading brokerId={brokerId} now={now} open={open} cutoff={cutoff} brokerOffsetSeconds={brokerOffsetSeconds} symbols={symbols}/> : activeView !== 'combo' ? <>
      <section className="raycaster-reading" aria-label="Accumulated context">
        <ReadingSummary symbol={symbol} label={label} direction={direction} evidence={ready ? strength : null}
          support={ready ? presentation : null} scope={`Accumulated context · ${relative ? 'EUR vs USD' : 'USD inputs'}`}
          clock={cutoff !== null ? `${clock.chart(cutoff)} (${clock.zone}) · candle end` : 'Hover a candle'} votes={relative ? [] : votes}>
          {!ready && <p className="reading-status">{loading ? 'Preparing the historical release timeline.' : message ?? 'Move across the chart to inspect a candle.'}</p>}
          {ready && point && <dl className="reading-facts"><div><dt>Context update</dt><dd>{clock.chart(relative ? Math.max(point.chartAt, relativeUpdateAt ?? point.chartAt) : point.chartAt)} ({clock.zone})</dd></div></dl>}
        </ReadingSummary>
      </section>
      {activeView === 'context-detailed' && <ContextDetailed point={point} eurPoint={eurPoint} fresh={fresh} symbol={symbol} cutoff={cutoff}
        publication={publication} loading={loading} message={message} label={label} presentation={presentation} relative={!!relative} timeDisplay={timeDisplay} />}
      {notice && <small role="status">{notice}</small>}
    </> : selectedCombo && selectedSupport && <section key={selectedCombo.id} className="raycaster-reading selected-roof-reading" aria-label="Selected roof snapshot">
      <div className="raycaster-selected-title"><strong>{roofLabel(selectedCombo)}</strong>{onClearCombo && <button type="button" onClick={onClearCombo}>Clear combo</button>}</div>
      <ReadingSummary symbol="EURUSD" label={roofResultLabel(selectedCombo)} direction={selectedSupport.direction} evidence={selectedEvidence}
        support={selectedSupport} scope={`${selectedCombo.kind === 'fresh-news' ? 'Recent changes' : selectedCombo.kind === 'labor-inflation' || selectedCombo.kind === 'weekly-labor' ? 'All news under this labor rule' : 'These releases together'} · USD inputs`}
        clockLabel="Snapshot at" clock={`${clock.chart(selectedCombo.chartAt)} (${clock.zone})`}
        votes={selectedSupport.votes.map(({ source, vote }) => ({ label: source.sourceLabel, towardLong: -vote }))} />
      {selectedSupport.qualified && <small>Partial or missing evidence.</small>}
      {fed && <small>Fed action: {fed.policyAction?.action ?? 'Unavailable'} · separate from macro support</small>}
      {selectionNotice && <p role="status">{selectionNotice}</p>}
      <section className="raycaster-calculations" aria-label="Details and calculations"><h3>Contributions and calculations</h3>
        <dl className="reading-metrics"><div><dt>Captured net USD vote</dt><dd>{selectedSupport.net.toFixed(3)}</dd></div><div><dt>Separation</dt><dd>{(selectedSupport.separation * 100).toFixed(1)}%</dd></div></dl>
        <table aria-label="Selected combo contributions"><thead><tr><th>Input</th><th>Supports</th><th>Evidence</th><th>USD effect</th></tr></thead><tbody>
          {selectedSupport.votes.map(({ source, vote }) => <tr key={source.sourceId}><td>{source.sourceLabel}</td><td>{vote < 0 ? 'Long' : vote > 0 ? 'Short' : 'No lead'}</td><td>{source.strength ?? 'Ungraded'}</td><td>{vote.toFixed(3)}</td></tr>)}
        </tbody></table>
        <small>Captured when this combo was opened. Reopen it after changing inputs. Roof Candy shows this relationship across history; use the toolbar Candy button and Candy settings.</small>
      </section>
      <details className="raycaster-reaction"><summary>Record price reaction</summary><RoofAuditControls key={`${brokerId}/${symbol}/${selectedCombo.id}`} combo={selectedCombo} symbol={symbol} broker={brokerId} /></details>
    </section>}
    </div>
  </aside>
}
