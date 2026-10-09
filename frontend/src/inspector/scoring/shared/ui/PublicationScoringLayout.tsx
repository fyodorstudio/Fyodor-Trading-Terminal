import { useContext, type ReactNode } from 'react'
import { ScoringSurface } from './scoring-surface'
import './release-score.css'
import './scoring-sections.css'

/** The Inspector owns standalone scoring; Raycaster owns publication context. */
export function PublicationScoringLayout({ standalone, context, label = 'Publication scoring' }: {
  standalone: ReactNode; context: ReactNode; label?: string
}) {
  const surface = useContext(ScoringSurface)
  return <div className="inspector-publication-score" aria-label={label}>
    {surface !== 'context' && <section className="inspector-scoring-column" aria-label="Standalone Scoring">
      <h2>Standalone Scoring</h2><div className="inspector-scoring-column-body">{standalone}</div>
    </section>}
    {surface !== 'standalone' && <section className="inspector-scoring-column" aria-label="Context-Aware at Publication Scoring">
      <h2>Context-Aware at Publication Scoring</h2><div className="inspector-scoring-column-body">{context}</div>
    </section>}
  </div>
}
