import type { ReactNode } from 'react'
import './release-score.css'
import './scoring-sections.css'

/** One layout owns both interpretations; nested scorers never add grid columns. */
export function PublicationScoringLayout({ standalone, context, label = 'Publication scoring' }: {
  standalone: ReactNode; context: ReactNode; label?: string
}) {
  return <div className="inspector-publication-score" aria-label={label}>
    <section className="inspector-scoring-column" aria-label="Standalone Scoring">
      <h2>Standalone Scoring</h2><div className="inspector-scoring-column-body">{standalone}</div>
    </section>
    <section className="inspector-scoring-column" aria-label="Context-Aware at Publication Scoring">
      <h2>Context-Aware at Publication Scoring</h2><div className="inspector-scoring-column-body">{context}</div>
    </section>
  </div>
}
