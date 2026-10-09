import { openFundamentalSettings } from '../../../../fundamental-tools/runtime/settings-navigation'

export function ScoringMethodLink({ family }: { family: string }) {
  return <button type="button" className="scoring-method-link" aria-label="Scoring explanation & settings" onClick={() => openFundamentalSettings(family)}>
    Scoring settings
  </button>
}
