import { useEffect, useRef, type RefObject } from 'react'
import { contextExpiryMs, contextPriority, contextNames } from '../../usd-context/core/policy'
import type { ContextFamily, ContextResult } from '../../usd-context/core/contracts'
import type { TimeDisplayPreference } from '../../appearance/time-display/time-display-preference'
import { RaycasterInputTable } from './RaycasterInputTable'
import { ContextPolicyDetails } from '../../usd-context/ui/ContextPolicyDetails'

export function RaycasterDetails({ id, families, trigger, onClose, held, ...table }: {
  id: string; families: readonly ContextFamily[]; trigger: RefObject<HTMLButtonElement | null>; onClose: () => void;
  onToggleFamily: (family: ContextFamily) => void; result: ContextResult | null; symbol: string; loading: boolean;
  unavailable: boolean; cutoff: number | null; held: boolean; timeDisplay: TimeDisplayPreference; summaryLabel: string
}) {
  const panel = useRef<HTMLDivElement>(null)
  useEffect(() => {
    panel.current?.focus({ preventScroll: true })
    const escape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.stopPropagation()
      onClose()
      trigger.current?.focus({ preventScroll: true })
    }
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !panel.current?.contains(event.target) && !trigger.current?.contains(event.target)) onClose()
    }
    document.addEventListener('keydown', escape)
    document.addEventListener('pointerdown', outside)
    return () => {
      document.removeEventListener('keydown', escape)
      document.removeEventListener('pointerdown', outside)
    }
  }, [onClose, trigger])
  const close = () => { onClose(); trigger.current?.focus({ preventScroll: true }) }
  return <div ref={panel} id={id} role="dialog" aria-label="Raycaster calculation and inputs" tabIndex={-1} className="raycaster-details">
    <div className="raycaster-details-heading"><strong>USD context · How it works</strong>
      <button type="button" onClick={close} aria-label="Close Raycaster details">×</button></div>
    <p>Remembers the latest eligible release from each enabled family and combines its USD bias at the hovered candle’s end. Forecasts are excluded.</p>
    {held && <p role="status">Showing the last inspected candle while you use this popover.</p>}
    <RaycasterInputTable families={families} {...table} />
    {!table.loading && !table.unavailable && <ContextPolicyDetails policy={table.result?.policy} />}
    <p>Click Enabled / Off to change the saved context inputs shared with CPI v4. Inspector’s marker filters do not affect this tool. ISM uses Manufacturing and Services as one vote. CPI, PCE and PPI share the inflation budget; ISM, Retail Sales and GDP share activity. Fed text is unavailable, so policy tone has no vote. The base labor budget is 40%; Labor priority raises it to 60%.</p>
    <p>Each source score comes from its release scorer using the applied signal-magnitude settings in Scatter Plot.</p>
    <p><strong>Combining votes:</strong> multiply each source’s signed score by its weight and add. Positive supports USD; negative weakens USD. On EURUSD, weaker USD means Long and stronger USD means Short. USD-base pairs reverse that mapping.</p>
    <p><strong>Memory:</strong> a new family release replaces its old vote, even if uncomputed. Claims expire after 14 days, GDP after 120 days; other votes expire after {contextExpiryMs / 86400000} days on the broker chart clock. Missing, off or expired weights are not redistributed.</p>
    <p><strong>Evidence:</strong> missing inputs, incomplete components, cancellation or a narrow lead give Weak evidence. Strong requires strong agreeing CPI and NFP readings, broad weighted agreement and no active weak family. Opposing NFP and Claims cap evidence at Moderate; their agreement is not an extra independent confirmation. Evidence is not a probability or a score multiplier.</p>
    <p>Exact cancellation follows {contextPriority.map(f => contextNames[f]).join(' → ')} with Weak evidence. No usable votes stays Uncomputed.</p>
    <p><strong>Timing:</strong> includes releases available by the candle’s end, capped at current time for a live candle. Stored history may contain provider revisions. This is a USD-side interpretation with prototype weights and expiry, not a price prediction.</p>
  </div>
}
