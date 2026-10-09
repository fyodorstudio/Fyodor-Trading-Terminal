import { openFundamentalSettings } from '../../../../fundamental-tools/runtime/settings-navigation'

export function ScoringMethodLink({ family }: { family: string }) {
  return <button type="button" className="scoring-method-link" onClick={() => openFundamentalSettings(family)}>
    Scoring explanation & settings
  </button>
}
