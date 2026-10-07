import type { ReactNode } from 'react'
import './scoring-sections.css'

export function ScoringSection({ title, children }: { title: string; children: ReactNode }) {
  return <section className="scoring-section" aria-label={title}>
    <h4>{title}</h4>
    <div className="scoring-section-content">{children}</div>
  </section>
}

export function ScoringNotes({ items }: { items: { label: string; content: ReactNode }[] }) {
  return <dl className="scoring-notes">{items.map(item => <div key={item.label}>
    <dt>{item.label}</dt><dd>{item.content}</dd>
  </div>)}</dl>
}
