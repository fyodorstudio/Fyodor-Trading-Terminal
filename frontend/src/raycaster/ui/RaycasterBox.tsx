import type { relativeContext } from '../../pair-context/core/relative-context'
import type { ContextPoint } from '../../usd-context/core/contracts'
import { useRaycasterPosition } from './useRaycasterPosition'
import { formatAppTimestamp, type TimeDisplayPreference } from '../../appearance/time-display/time-display-preference'
import { familyTitle } from '../../usd-context/core/explanation'
import './raycaster.css'
import { raycasterLabel } from './raycaster-label'
import { usdContextPresentation, usdPresentationVersion, usdPresentationUpdate } from '../core/usd-context-presentation'
import { contextVersion } from '../../usd-context/core/policy'
import { UsdSupportDetails } from './UsdSupportDetails'
import { useDisplayClock } from '../../appearance/time-display/useDisplayClock'
import type { ComboSnapshot } from '../../usd-context/sequences/core/contracts'
import { roofSupport, roofResultLabel } from '../../usd-context/sequences/core/relationship-support'
import { relationshipReading, supportReading, supportEvidenceNote } from '../../usd-context/core/support-reading'
import { usdPair } from '../../usd-context/core/usd-pair'
import { SupportSplit } from '../../usd-context/ui/SupportSplit'
import { RoofAuditControls } from '../../usd-context/sequences/ui/RoofAuditControls'
import { roofLabel } from '../../usd-context/sequences/chart/roof-label'

export function RaycasterBox({ symbol, point, cutoff, loading, message, notice, timeDisplay, onClose, relative, relativeUpdate, relativeUpdateAt, selectedCombo, selectionNotice, onClearCombo, roofCandyVisible, onToggleRoofCandy, brokerId = null }: {
  relative?: ReturnType<typeof relativeContext> | null; relativeUpdate?: string | null; relativeUpdateAt?: number | null;
  symbol: string; point: ContextPoint | null; cutoff: number | null; loading: boolean; message: string | null;
  timeDisplay: TimeDisplayPreference; onClose: () => void; notice?: string | null
  selectedCombo?: ComboSnapshot | null; selectionNotice?: string | null; onClearCombo?: () => void
  roofCandyVisible?: boolean; onToggleRoofCandy?: () => void
  brokerId?: string | null
}) {
  const { ref, position, drag } = useRaycasterPosition()
  const clock = useDisplayClock()
  const result = point?.result
  const presentation = relative ? null : usdContextPresentation(symbol, result, cutoff ?? undefined)
  const strength = relative ? relative.strength : presentation?.evidence
  const label = raycasterLabel({ loading, message, cutoff, relative, result, symbol })
  const selectedSupport = selectedCombo ? roofSupport(selectedCombo) : null
  const orient = usdPair(symbol)?.usdSide === 'base' ? 1 : -1
  const tone = loading || message || cutoff === null ? '' : relative ? label.endsWith('Long') ? 'long' : label.endsWith('Short') ? 'short' : '' :
    presentation?.state === 'aligned' ? presentation.direction ?? '' : presentation?.state ?? ''
  return <aside ref={ref} className="raycaster-box" aria-label="Raycaster USD context"
    style={{ transform: `translate(${position.x}px, ${position.y}px)` }}>
    <header><button type="button" onPointerDown={drag} className="raycaster-handle" aria-label="Move Raycaster" title="Drag to move Raycaster">⠿ Raycaster</button>
      <button type="button" onClick={onClose} aria-label="Hide Raycaster" title="Hide Raycaster">×</button></header>
    <section className="raycaster-reading" aria-label="Accumulated context">
    <small>All news together · {relative ? 'EUR vs USD' : 'USD inputs'}{cutoff !== null && ` · through ${clock.chart(cutoff)} (${clock.zone})`}</small>
    <strong className={`raycaster-bias ${tone}`}>{label}{!loading && !message && cutoff !== null && strength && ` · ${strength.charAt(0).toUpperCase() + strength.slice(1)} evidence`}</strong>
    <p>{loading ? 'Preparing the historical release timeline.' : message ?? (cutoff === null ? 'Move across the chart to read the USD context at each candle’s end.' :
      relative?.explanation ?? (presentation ? supportReading(presentation, result?.members.filter(m => m.status === 'active').map(m => ({ label: m.sourceLabel, towardLong: orient * m.contribution })) ?? []) : 'No eligible release history is available at this candle.'))}</p>
    {!relative && !loading && !message && cutoff !== null && presentation && <UsdSupportDetails presentation={presentation} compact />}
    {!relative && presentation && !loading && !message && cutoff !== null && <small>{supportEvidenceNote(presentation)}</small>}
    </section>
    {selectedCombo && selectedSupport && <section className="raycaster-reading selected-roof-reading" aria-label="Selected roof snapshot">
      <header><strong>Selected combo · {roofLabel(selectedCombo)}</strong>{onClearCombo && <button type="button" onClick={onClearCombo} aria-label="Clear selected roof">×</button>}</header>
      <small>{selectedCombo.kind === 'fresh-news' ? 'What changed in these releases' : selectedCombo.kind === 'labor-inflation' || selectedCombo.kind === 'weekly-labor' ? 'All USD news under this labor rule' : 'What these releases say together'} · USD inputs</small>
      <strong className={`raycaster-bias ${selectedSupport.state}`}>{roofResultLabel(selectedCombo)}</strong>
      <SupportSplit support={selectedSupport} />
      <p>{relationshipReading(selectedSupport)}</p>
      <small>{supportEvidenceNote(selectedSupport)}{selectedSupport.direction && selectedCombo.strength ? ` · ${selectedSupport.narrow || selectedSupport.qualified ? 'weak' : selectedCombo.strength} evidence` : ''} · Snapshot at {clock.chart(selectedCombo.chartAt)} ({clock.zone})</small>
      {selectedCombo.sources.find(s => s.family === 'fed') && <small>Fed action: {selectedCombo.sources.find(s => s.family === 'fed')?.policyAction?.action ?? 'Unavailable'} · separate from macro support</small>}
      {selectionNotice && <p role="status">{selectionNotice}</p>}
      {onToggleRoofCandy && <button type="button" aria-pressed={roofCandyVisible} onClick={onToggleRoofCandy}>{roofCandyVisible ? 'Hide Roof Candy' : 'Show Roof Candy'}</button>}
      <small>The percentages above keep the original reading. Selected combo Candy follows newer releases. It stays selected while you click, pan or zoom the chart; × closes it. Opening an individual release also closes it.</small>
      <details className="raycaster-reaction"><summary>Record price reaction</summary><RoofAuditControls combo={selectedCombo} symbol={symbol} broker={brokerId} /></details>
    </section>}
    <details className="raycaster-calculations"><summary>Details and calculations</summary>
    {!loading && !message && point && cutoff !== null && <p className="raycaster-update">Latest update: {relative ? `EUR: ${relativeUpdate ?? 'no eligible update'} · USD: ${point.update}` : usdPresentationUpdate(symbol, point, presentation!)}</p>}
    {!relative && presentation && <p>{presentation.explanation}</p>}
    {!relative && result && <table><thead><tr><th>Input</th><th>USD vote</th></tr></thead><tbody>{result.members.map(m => <tr key={m.family}><td>{familyTitle(m)}</td><td>{m.contribution.toFixed(3)}</td></tr>)}</tbody></table>}
    <small title={relative ? `${relative.explanation}\nEUR ${relative.eurTotal?.toFixed(3) ?? 'unavailable'}; USD ${relative.usdTotal?.toFixed(3) ?? 'unavailable'}` : result ? `Publication / relative gate: ${result.reason}\n${result.members.map(m => `${familyTitle(m)} · ${formatAppTimestamp(m.releaseAt, timeDisplay)} · weighted score ${m.contribution.toFixed(3)}`).join('\n')}` : undefined}>
      {relative ? 'Relative EUR / USD' : `USD side only · ${usdPresentationVersion} · ${contextVersion}`} · Raycaster filters{cutoff !== null && <> · Read through {clock.chart(cutoff)} ({clock.zone}) · candle end, capped at current time</>}
    </small>
    {!loading && !message && point && cutoff !== null && <small>Last context update: {clock.chart(relative ? Math.max(point.chartAt, relativeUpdateAt ?? point.chartAt) : point.chartAt)} ({clock.zone}). Historical candle readings include releases through the candle end.</small>}
    </details>
    {notice && <small role="status">{notice}</small>}
  </aside>
}
