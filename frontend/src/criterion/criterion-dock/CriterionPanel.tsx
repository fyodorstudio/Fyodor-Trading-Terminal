import './criterion-panel.css'

export function CriterionPanel() {
  return (
    <div className="criterion-panel" aria-label="Criterion dock">
      <div className="criterion-empty-state">
        <p className="criterion-empty-title">Criterion</p>
        <p className="criterion-empty-description">No criteria registered yet.</p>
      </div>
    </div>
  )
}
