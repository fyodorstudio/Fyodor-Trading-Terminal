import { useId, type ReactNode } from 'react'

export function InspectorInfoTooltip({ label, children }: { label: string; children: ReactNode }) {
  const id = useId()
  return <span className="inspector-info">
    <button type="button" aria-label={label} aria-describedby={id}>ⓘ</button>
    <span id={id} role="tooltip">{children}</span>
  </span>
}
