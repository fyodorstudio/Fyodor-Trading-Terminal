import { useState, type ReactNode } from 'react'

/** Native disclosure whose expensive body does not exist while collapsed. */
export function LazyDetails({ summary, children, className }: { summary: ReactNode; children: () => ReactNode; className?: string }) {
  const [open, setOpen] = useState(false)
  return <details className={className} onToggle={event => {
    if (event.target === event.currentTarget) setOpen(event.currentTarget.open)
  }}>
    <summary>{summary}</summary>{open && children()}
  </details>
}
