import { useCallback, useId, useRef } from 'react'
import { inspectorRangeLabel } from './inspector-date-range'
import type { InspectorView } from './useInspector'
import { RangePopover } from './date-range/RangePopover'

export function InspectorDateRangePicker({ view, open, onOpenChange, filtersOpen }: {
  view: InspectorView; open: boolean; onOpenChange: (open: boolean) => void; filtersOpen: boolean
}) {
  const trigger = useRef<HTMLButtonElement>(null)
  const id = useId()
  const close = useCallback(() => onOpenChange(false), [onOpenChange])
  const label = inspectorRangeLabel(view.rangeDates.from, view.rangeDates.to)
  return <div className="inspector-range"><button ref={trigger} type="button" aria-label="Inspector date range" aria-haspopup="dialog"
    aria-expanded={open} aria-controls={open ? id : undefined} title={`Date range: ${label}`} onClick={() => onOpenChange(!open)}>
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="2" y="3" width="12" height="11" rx="2" />
      <line x1="2" y1="7" x2="14" y2="7" />
      <line x1="5" y1="1.5" x2="5" y2="3.5" />
      <line x1="11" y1="1.5" x2="11" y2="3.5" />
    </svg></button>
    {open && <RangePopover view={view} trigger={trigger} onClose={close} id={id} filtersOpen={filtersOpen} />}
  </div>
}
