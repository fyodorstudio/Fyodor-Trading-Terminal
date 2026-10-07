import type { ReactNode } from 'react'
import type { relativeContext } from '../../pair-context/core/relative-context'
import { useCallback, useId, useRef } from 'react'
import type { ContextFamily, ContextPoint } from '../../usd-context/core/contracts'
import { RaycasterDetails } from './RaycasterDetails'
import { contextPairLabel } from '../../usd-context/core/usd-pair'
import { useRaycasterPosition } from './useRaycasterPosition'
import { formatAppTimestamp, type TimeDisplayPreference } from '../../appearance/time-display/time-display-preference'
import { familyTitle } from '../../usd-context/core/explanation'
import './raycaster.css'
import type { FreshPoint } from '../../usd-context/sequences/core/contracts'

export function RaycasterBox({ symbol, point, cutoff, loading, message, notice, timeDisplay, onClose, families,
  detailsOpen, onDetailsChange, onToggleFamily, held, relative, relativeUpdate, extraDetails, fresh }: {
  fresh?: FreshPoint | null;
  relative?: ReturnType<typeof relativeContext> | null; relativeUpdate?: string | null; extraDetails?: ReactNode;
  symbol: string; point: ContextPoint | null; cutoff: number | null; loading: boolean; message: string | null;
  timeDisplay: TimeDisplayPreference; onClose: () => void; notice?: string | null; families: readonly ContextFamily[];
  detailsOpen: boolean; onDetailsChange: (open: boolean) => void; onToggleFamily: (family: ContextFamily) => void; held: boolean
}) {
  const { ref, position, drag } = useRaycasterPosition()
  const detailsId = useId()
  const detailsTrigger = useRef<HTMLButtonElement>(null)
  const closeDetails = useCallback(() => onDetailsChange(false), [onDetailsChange])
  const result = point?.result
  const strength = relative ? relative.strength : result?.strength
  const label = loading ? (relative ? 'Calculating EUR / USD context…' : 'Calculating USD context…') : message ? 'USD context unavailable' : cutoff === null ? 'Hover a candle to inspect' :
    relative ? relative.label : result ? contextPairLabel(symbol, result.direction) : 'Uncomputed'
  const tone = label === 'Uncomputed' || loading || message || cutoff === null ? '' : label.endsWith('Long') ? 'long' : 'short'
  return <aside ref={ref} className={`raycaster-box${detailsOpen ? ' raycaster-details-open' : ''}`} aria-label="Raycaster USD context"
    style={{ transform: `translate(${position.x}px, ${position.y}px)` }}>
    <header><button type="button" onPointerDown={drag} className="raycaster-handle" aria-label="Move Raycaster" title="Drag to move Raycaster">⠿ Raycaster</button>
      <button ref={detailsTrigger} type="button" className="raycaster-settings" aria-label="Raycaster calculation and inputs"
        title="Raycaster calculation and inputs" aria-haspopup="dialog" aria-expanded={detailsOpen} aria-controls={detailsOpen ? detailsId : undefined}
        onClick={() => onDetailsChange(!detailsOpen)}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
          <path d="m10 2-.6 3-2.3 1.4-2.9-1L2.2 9l2.3 2v2l-2.3 2 2 3.6 2.9-1L9.4 19l.6 3h4l.6-3 2.3-1.4 2.9 1 2-3.6-2.3-2v-2l2.3-2-2-3.6-2.9 1L14.6 5 14 2z" /><circle cx="12" cy="12" r="3" />
        </svg>
      </button>
      <button type="button" onClick={onClose} aria-label="Hide Raycaster" title="Hide Raycaster">×</button></header>
    {detailsOpen && <RaycasterDetails id={detailsId} families={families} trigger={detailsTrigger} onClose={closeDetails}
      fresh={fresh} extraDetails={extraDetails} onToggleFamily={onToggleFamily} result={result ?? null} symbol={symbol} loading={loading} unavailable={!!message} cutoff={cutoff} held={held} timeDisplay={timeDisplay} summaryLabel={label} />}
    <strong className={`raycaster-bias ${tone}`}>{label}{!loading && !message && cutoff !== null && strength && ` · ${strength.charAt(0).toUpperCase() + strength.slice(1)} evidence`}</strong>
    <p>{loading ? 'Preparing the historical release timeline.' : message ?? (cutoff === null ? 'Move across the chart to read the USD context at each candle’s end.' :
      relative?.explanation ?? result?.explanation ?? 'No eligible release history is available at this candle.')}</p>
    {!loading && !message && point && cutoff !== null && <p className="raycaster-update">Latest update: {relative ? `EUR: ${relativeUpdate ?? 'no eligible update'} · USD: ${point.update}` : point.update}</p>}
    <small title={relative ? `${relative.explanation}\nEUR ${relative.eurTotal?.toFixed(3) ?? 'unavailable'}; USD ${relative.usdTotal?.toFixed(3) ?? 'unavailable'}` : result ? `${result.reason}\n${result.members.map(m => `${familyTitle(m)} · ${formatAppTimestamp(m.releaseAt, timeDisplay)} · weighted score ${m.contribution.toFixed(3)}`).join('\n')}` : undefined}>
      {relative ? 'Relative EUR / USD' : 'USD side only'} · Raycaster filters{cutoff !== null && <> · As of {formatAppTimestamp(cutoff, { mode: 'utc', utcOffsetMinutes: 0 })} broker time (candle end / current time)</>}
    </small>
    {notice && <small role="status">{notice}</small>}
  </aside>
}
