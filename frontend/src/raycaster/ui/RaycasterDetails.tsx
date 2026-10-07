import { useEffect, useRef, type ReactNode, type RefObject } from 'react'
import type { ContextFamily, ContextResult } from '../../usd-context/core/contracts'
import type { TimeDisplayPreference } from '../../appearance/time-display/time-display-preference'
import { RaycasterInputTable } from './RaycasterInputTable'
import { ContextPolicyDetails } from '../../usd-context/ui/ContextPolicyDetails'
import { SequenceControls } from '../../usd-context/sequences/ui/SequenceControls'
import { FreshNewsSummary } from '../../usd-context/sequences/ui/FreshNewsSummary'
import type { FreshPoint } from '../../usd-context/sequences/core/contracts'
import { useSequencePreferences } from '../../usd-context/sequences/storage/sequence-preferences'
import { RaycasterNotes } from './RaycasterNotes'

export function RaycasterDetails({ id, families, trigger, onClose, held, extraDetails, fresh, ...table }: {
  fresh?: FreshPoint | null;
  extraDetails?: ReactNode; id: string; families: readonly ContextFamily[]; trigger: RefObject<HTMLButtonElement | null>; onClose: () => void;
  onToggleFamily: (family: ContextFamily) => void; result: ContextResult | null; symbol: string; loading: boolean;
  unavailable: boolean; cutoff: number | null; held: boolean; timeDisplay: TimeDisplayPreference; summaryLabel: string
}) {
  const panel = useRef<HTMLDivElement>(null)
  const sequences = useSequencePreferences()
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
    <div className="raycaster-details-heading"><strong>Raycaster · Calculation and inputs</strong>
      <button type="button" onClick={close} aria-label="Close Raycaster details">×</button></div>
    <p>Remembers the latest eligible release from each enabled family and combines its USD bias at the hovered candle’s end. Forecasts are excluded.</p>
    {held && <p role="status">Showing the last inspected candle while you use this popover.</p>}
    <section className="raycaster-section"><h3>Accumulated context</h3><strong>{table.summaryLabel}</strong>
      <p>{table.result?.explanation ?? 'Hover a candle to inspect its result.'}</p></section>
    <section className="raycaster-section" aria-label="Raycaster inputs and contributions"><h3>Inputs and contributions</h3>
      {extraDetails}<RaycasterInputTable families={families} {...table} />
      <p>Click Enabled / Off to change inputs shared with CPI v4. Inspector’s marker filters do not affect this tool. Inflation shares 40%, labor 40%, activity 20%. ISM resolves both sectors as one vote.</p>
    </section>
    <section className="raycaster-section"><h3>Active relationships</h3>
      {!table.loading && !table.unavailable && <ContextPolicyDetails policy={table.result?.policy} />}
      {!table.result?.policy && <p>Hover a candle with available history to inspect the applicable conditions.</p>}
    </section>
    {sequences.fresh && <FreshNewsSummary point={table.loading || table.unavailable ? null : fresh ?? null} symbol={table.symbol} />}
    <SequenceControls supported={/^EURUSD(?:[._-].*|[a-z]*)$/i.test(table.symbol)} />
    <RaycasterNotes />
  </div>
}
