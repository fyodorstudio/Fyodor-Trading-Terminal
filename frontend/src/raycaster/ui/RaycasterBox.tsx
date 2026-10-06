import type { ContextPoint } from '../../usd-context/core/contracts'
import { contextPairLabel } from '../../usd-context/core/usd-pair'
import { useRaycasterPosition } from './useRaycasterPosition'
import { formatAppTimestamp, type TimeDisplayPreference } from '../../appearance/time-display/time-display-preference'
import { familyTitle } from '../../usd-context/core/explanation'
import './raycaster.css'

export function RaycasterBox({ symbol, point, cutoff, loading, message, notice, timeDisplay, onClose }: {
  symbol: string; point: ContextPoint | null; cutoff: number | null; loading: boolean; message: string | null;
  timeDisplay: TimeDisplayPreference; onClose: () => void; notice?: string | null
}) {
  const { ref, position, drag } = useRaycasterPosition()
  const result = point?.result
  const label = loading ? 'Calculating USD context…' : message ? 'USD context unavailable' : cutoff === null ? 'Hover a candle to inspect' :
    result ? contextPairLabel(symbol, result.direction) : 'Uncomputed'
  const tone = result?.direction === 'uncomputed' || !result ? '' : label.endsWith('Long') ? 'long' : 'short'
  return <aside ref={ref} className="raycaster-box" aria-label="Raycaster USD context"
    style={{ transform: `translate(${position.x}px, ${position.y}px)` }}>
    <header><button type="button" onPointerDown={drag} className="raycaster-handle" aria-label="Move Raycaster" title="Drag to move Raycaster">⠿ Raycaster</button>
      <button type="button" onClick={onClose} aria-label="Hide Raycaster" title="Hide Raycaster">×</button></header>
    <strong className={`raycaster-bias ${tone}`}>{label}{!loading && !message && cutoff !== null && result?.strength && ` · ${result.strength.charAt(0).toUpperCase() + result.strength.slice(1)} evidence`}</strong>
    <p>{loading ? 'Preparing the historical release timeline.' : message ?? (cutoff === null ? 'Move across the chart to read the USD context at each candle’s end.' :
      result?.explanation ?? 'No eligible release history is available at this candle.')}</p>
    {!loading && !message && point && cutoff !== null && <p className="raycaster-update">Latest update: {point.update}</p>}
    <small title={result ? `${result.reason}\n${result.members.map(m => `${familyTitle(m)} · ${formatAppTimestamp(m.releaseAt, timeDisplay)} · weighted score ${m.contribution.toFixed(3)}`).join('\n')}` : undefined}>
      USD side only · follows Inspector filters{cutoff !== null && <> · As of {formatAppTimestamp(cutoff, { mode: 'utc', utcOffsetMinutes: 0 })} broker time (candle end / current time)</>}
    </small>
    {notice && <small role="status">{notice}</small>}
  </aside>
}
