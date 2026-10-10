import { openFundamentalSettings } from '../../../../fundamental-tools/runtime/settings-navigation'

export function ScoringMethodLink({ family,model='legacy' }: { family: string;model?:'legacy'|'r1' }) {
  return <button type="button" className="scoring-method-link" aria-label="Scoring explanation & settings" onClick={() => openFundamentalSettings(family,model)}>
    Scoring settings
  </button>
}
