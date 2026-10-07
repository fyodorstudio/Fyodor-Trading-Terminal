import type { relativeContext } from '../../pair-context/core/relative-context'
import type { ContextPoint } from '../../usd-context/core/contracts'
import { useRaycasterPosition } from './useRaycasterPosition'
import { formatAppTimestamp, type TimeDisplayPreference } from '../../appearance/time-display/time-display-preference'
import { familyTitle } from '../../usd-context/core/explanation'
import './raycaster.css'
import { raycasterLabel } from './raycaster-label'

export function RaycasterBox({ symbol, point, cutoff, loading, message, notice, timeDisplay, onClose, relative, relativeUpdate }: {
  relative?: ReturnType<typeof relativeContext> | null; relativeUpdate?: string | null;
  symbol: string; point: ContextPoint | null; cutoff: number | null; loading: boolean; message: string | null;
  timeDisplay: TimeDisplayPreference; onClose: () => void; notice?: string | null
}) {
  const { ref, position, drag } = useRaycasterPosition()
  const result = point?.result
  const strength = relative ? relative.strength : result?.strength
  const label = raycasterLabel({ loading, message, cutoff, relative, result, symbol })
  const tone = loading || message || cutoff === null ? '' : label.endsWith('Long') ? 'long' : label.endsWith('Short') ? 'short' : ''
  return <aside ref={ref} className="raycaster-box" aria-label="Raycaster USD context"
    style={{ transform: `translate(${position.x}px, ${position.y}px)` }}>
    <header><button type="button" onPointerDown={drag} className="raycaster-handle" aria-label="Move Raycaster" title="Drag to move Raycaster">⠿ Raycaster</button>
      <button type="button" onClick={onClose} aria-label="Hide Raycaster" title="Hide Raycaster">×</button></header>
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
