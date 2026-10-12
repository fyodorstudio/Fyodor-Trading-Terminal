import { useCallback, useId, useRef } from 'react'
import { inspectorRangeLabel } from './inspector-date-range'
import type { InspectorView } from './useInspector'
import { RangePopover } from './date-range/RangePopover'
import { InspectorCalendarIcon } from './chart/InspectorCalendarIcon'

export function InspectorDateRangePicker({ view, open, onOpenChange, filtersOpen }: {
  view: InspectorView; open: boolean; onOpenChange: (open: boolean) => void; filtersOpen: boolean
}) {
  const trigger = useRef<HTMLButtonElement>(null)
  const id = useId()
  const close = useCallback(() => onOpenChange(false), [onOpenChange])
  const label = inspectorRangeLabel(view.rangeDates.from, view.rangeDates.to)
  return <div className="inspector-range"><button ref={trigger} type="button" aria-label="Inspector date range" aria-haspopup="dialog"
    aria-expanded={open} aria-controls={open ? id : undefined} title={`Date range: ${label}`} onClick={() => onOpenChange(!open)}>
    <InspectorCalendarIcon /></button>
    {open && <RangePopover view={view} trigger={trigger} onClose={close} id={id} filtersOpen={filtersOpen} />}
  </div>
}
