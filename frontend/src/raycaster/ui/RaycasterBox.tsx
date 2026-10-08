import { useId, useState } from 'react'
import type { relativeContext } from '../../pair-context/core/relative-context'
import type { ContextPoint } from '../../usd-context/core/contracts'
import { useRaycasterPosition } from './useRaycasterPosition'
import { formatAppTimestamp, type TimeDisplayPreference } from '../../appearance/time-display/time-display-preference'
import { familyTitle } from '../../usd-context/core/explanation'
import './raycaster.css'
import { raycasterLabel } from './raycaster-label'
import { usdContextPresentation, usdPresentationVersion, usdPresentationUpdate } from '../core/usd-context-presentation'
import { contextNames, contextVersion } from '../../usd-context/core/policy'
import { UsdSupportDetails } from './UsdSupportDetails'
import { useDisplayClock } from '../../appearance/time-display/useDisplayClock'
import type { ComboSnapshot } from '../../usd-context/sequences/core/contracts'
import { roofSupport, roofResultLabel } from '../../usd-context/sequences/core/relationship-support'
import { relationshipReading, supportReading } from '../../usd-context/core/support-reading'
import { usdPair } from '../../usd-context/core/usd-pair'
import { WeightedSupportBar } from '../../usd-context/ui/WeightedSupportBar'
import { RoofAuditControls } from '../../usd-context/sequences/ui/RoofAuditControls'
import { roofLabel } from '../../usd-context/sequences/chart/roof-label'

export type RaycasterView = 'context' | 'combo'

export function RaycasterBox({ symbol, point, cutoff, loading, message, notice, timeDisplay, onClose, relative, relativeUpdate, relativeUpdateAt, selectedCombo, selectionNotice, onClearCombo, brokerId = null, view, onViewChange }: {
  relative?: ReturnType<typeof relativeContext> | null; relativeUpdate?: string | null; relativeUpdateAt?: number | null;
  symbol: string; point: ContextPoint | null; cutoff: number | null; loading: boolean; message: string | null;
  timeDisplay: TimeDisplayPreference; onClose: () => void; notice?: string | null;
  selectedCombo?: ComboSnapshot | null; selectionNotice?: string | null; onClearCombo?: () => void;
  brokerId?: string | null; view?: RaycasterView; onViewChange?: (view: RaycasterView) => void;
}) {
  const { ref, position, drag } = useRaycasterPosition()
  const clock = useDisplayClock(), viewId = useId()
  const [localView, setLocalView] = useState<RaycasterView>('context')
  if (!selectedCombo && localView !== 'context') setLocalView('context')
  const activeView = selectedCombo ? view ?? localView : 'context'
  const result = point?.result
  const presentation = relative ? null : usdContextPresentation(symbol, result, cutoff ?? undefined)
  const strength = relative ? relative.strength : presentation?.evidence
  const label = raycasterLabel({ loading, message, cutoff, relative, result, symbol })
  const selectedSupport = selectedCombo ? roofSupport(selectedCombo) : null
  const selectedEvidence = selectedSupport?.narrow || selectedSupport?.qualified ? 'weak' : selectedCombo?.strength
  const orient = usdPair(symbol)?.usdSide === 'base' ? 1 : -1
  const tone = loading || message || cutoff === null ? '' : relative ? label.endsWith('Long') ? 'long' : label.endsWith('Short') ? 'short' : '' :
    presentation?.state === 'aligned' ? presentation.direction ?? '' : presentation?.state ?? ''
  const fed = selectedCombo?.sources.find(s => s.family === 'fed')
  return <aside ref={ref} className="raycaster-box" aria-label="Raycaster USD context"
    style={{ transform: `translate(${position.x}px, ${position.y}px)` }}>
    <header className="raycaster-header"><button type="button" onPointerDown={drag} className="raycaster-handle" aria-label="Move Raycaster" title="Drag to move Raycaster">⠿ Raycaster</button>
      <label className="raycaster-view-label" htmlFor={viewId}>View</label>
      <select id={viewId} aria-label="Raycaster view" value={activeView} onChange={event => {
        const next = event.target.value as RaycasterView
        setLocalView(next); onViewChange?.(next)
      }}><option value="context">Context</option><option value="combo" disabled={!selectedCombo}>Selected combo</option></select>
      <button type="button" onClick={onClose} aria-label="Hide Raycaster" title="Hide Raycaster">×</button>
    </header>
    {activeView === 'context' ? <>
      <section className="raycaster-reading" aria-label="Accumulated context">
        <small>All news together · {relative ? 'EUR vs USD' : 'USD inputs'}</small>
        <strong className={`raycaster-bias ${tone}`}>{label}{!loading && !message && cutoff !== null && strength && ` · ${strength.charAt(0).toUpperCase() + strength.slice(1)} evidence`}</strong>
        <small className="raycaster-clock">{cutoff !== null ? `Through ${clock.chart(cutoff)} (${clock.zone}) · candle end` : 'Chart clock · hover a candle'}</small>
        {!relative && !loading && !message && cutoff !== null && presentation && <UsdSupportDetails presentation={presentation} compact unified />}
        <p>{loading ? 'Preparing the historical release timeline.' : message ?? (cutoff === null ? 'Move across the chart to read context at each candle’s end.' :
          relative?.explanation ?? (presentation ? supportReading(presentation, result?.members.filter(m => m.status === 'active').map(m => ({ label: m.sourceLabel, towardLong: orient * m.contribution })) ?? []) : 'No eligible release history is available at this candle.'))}</p>
      </section>
      <details className="raycaster-calculations"><summary>Details and calculations</summary>
        {!loading && !message && point && cutoff !== null && <p className="raycaster-update">Latest update: {relative ? `EUR: ${relativeUpdate ?? 'no eligible update'} · USD: ${point.update}` : usdPresentationUpdate(symbol, point, presentation!)}</p>}
        {!relative && presentation && <p>{presentation.explanation}</p>}
        {!relative && result && <table aria-label="Accumulated USD contributions"><thead><tr><th>Input</th><th>USD direction</th><th>Evidence</th><th>USD vote</th></tr></thead><tbody>{result.members.map(m => <tr key={m.family}>
          <td title={`${familyTitle(m)} · ${formatAppTimestamp(m.releaseAt, timeDisplay)}`}>{contextNames[m.family]}<small>{m.status}</small></td>
          <td>{m.status !== 'active' || m.total === null ? '—' : m.contribution > 0 ? 'Stronger' : m.contribution < 0 ? 'Weaker' : 'No lead'}</td>
          <td>{m.status === 'active' ? m.strength ?? 'Ungraded' : '—'}</td><td>{m.status === 'active' && m.total !== null ? m.contribution.toFixed(3) : '—'}</td>
        </tr>)}</tbody></table>}
        <small title={relative ? `${relative.explanation}\nEUR ${relative.eurTotal?.toFixed(3) ?? 'unavailable'}; USD ${relative.usdTotal?.toFixed(3) ?? 'unavailable'}` : result?.reason}>
          {relative ? 'Relative EUR / USD' : `USD side only · ${usdPresentationVersion} · ${contextVersion}`} · Raycaster inputs
        </small>
        {!loading && !message && point && cutoff !== null && <small>Last context update: {clock.chart(relative ? Math.max(point.chartAt, relativeUpdateAt ?? point.chartAt) : point.chartAt)} ({clock.zone}). Candle readings are capped at current time.</small>}
      </details>
      {notice && <small role="status">{notice}</small>}
    </> : selectedCombo && selectedSupport && <section key={selectedCombo.id} className="raycaster-reading selected-roof-reading" aria-label="Selected roof snapshot">
      <div className="raycaster-selected-title"><strong>{roofLabel(selectedCombo)}</strong>{onClearCombo && <button type="button" onClick={onClearCombo}>Clear combo</button>}</div>
      <small>{selectedCombo.kind === 'fresh-news' ? 'Recent changes' : selectedCombo.kind === 'labor-inflation' || selectedCombo.kind === 'weekly-labor' ? 'All news under this labor rule' : 'These releases together'} · USD inputs</small>
      <strong className={`raycaster-bias ${selectedSupport.state} ${selectedSupport.direction ?? ''}`}>{roofResultLabel(selectedCombo)} · {selectedEvidence ? `${selectedEvidence.charAt(0).toUpperCase() + selectedEvidence.slice(1)} evidence` : 'Evidence ungraded'}</strong>
      <small className="raycaster-clock">Snapshot at {clock.chart(selectedCombo.chartAt)} ({clock.zone})</small>
      <WeightedSupportBar support={selectedSupport} />
      <small>Share of weighted support</small>
      <p>{relationshipReading(selectedSupport)}</p>
      {selectedSupport.qualified && <small>Partial or missing evidence.</small>}
      {fed && <small>Fed action: {fed.policyAction?.action ?? 'Unavailable'} · separate from macro support</small>}
      {selectionNotice && <p role="status">{selectionNotice}</p>}
      <details className="raycaster-reaction"><summary>Record price reaction</summary><RoofAuditControls key={`${brokerId}/${symbol}/${selectedCombo.id}`} combo={selectedCombo} symbol={symbol} broker={brokerId} /></details>
      <details className="raycaster-calculations"><summary>Details and calculations</summary>
        <p>Captured support · Net {selectedSupport.net.toFixed(3)} · Separation {(selectedSupport.separation * 100).toFixed(1)}%</p>
        <table aria-label="Selected combo contributions"><thead><tr><th>Input</th><th>Supports</th><th>Evidence</th><th>USD effect</th></tr></thead><tbody>
          {selectedSupport.votes.map(({ source, vote }) => <tr key={source.sourceId}><td>{source.sourceLabel}</td><td>{vote < 0 ? 'Long' : vote > 0 ? 'Short' : 'No lead'}</td><td>{source.strength ?? 'Ungraded'}</td><td>{vote.toFixed(3)}</td></tr>)}
        </tbody></table>
        <small>Captured when this combo was opened. Reopen it after changing inputs. Roof Candy shows this relationship across history; use the toolbar Candy button and Candy settings.</small>
      </details>
    </section>}
  </aside>
}
