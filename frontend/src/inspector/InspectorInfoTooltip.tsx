import { useId, type ReactNode } from 'react'

export function InspectorInfoTooltip({ label, children, placement = 'left' }: { label: string; children: ReactNode; placement?: 'left' | 'right' }) {
  const id = useId()
  return <span className={`inspector-info inspector-info-${placement}`}>
    <button type="button" aria-label={label} aria-describedby={id}>ⓘ</button>
    <span id={id} role="tooltip">{children}</span>
  </span>
}
