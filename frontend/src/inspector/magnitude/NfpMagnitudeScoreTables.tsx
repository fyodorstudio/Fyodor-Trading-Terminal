import type { InspectorRelease } from '../inspector-data'
import { assessNfpMagnitudeScore } from '../grading/nfp-magnitude-score'
import { formatSignedMagnitudeScore } from '../grading/signed-magnitude-score'
import { SignedMagnitudeMatrix } from './SignedMagnitudeMatrix'
import type { FamilyMagnitudeHistory } from './useFamilyMagnitudeHistory'

export function NfpMagnitudeScoreTables({ release, history }: { release: InspectorRelease | null; history: FamilyMagnitudeHistory }) {
  const assessment = assessNfpMagnitudeScore(release, history)
  if (!assessment) return null
  return <>
    <SignedMagnitudeMatrix label="NFP supporting magnitudes" className="inspector-nfp-supporting"
      header="Supporting readings" readings={assessment.supporting} scoreMeaning="Supporting convention"
      caption="Supporting signed magnitude points under the existing direction conventions. These seven readings never contribute to the USD total or pair direction. Participation's sign is a simplified convention. Hover or focus each series for its role."
      footer={<tr><td colSpan={6}>Excluded from USD total</td></tr>} />
    <SignedMagnitudeMatrix label="NFP signed magnitude score" className="inspector-nfp-score"
      readings={assessment.primary} scoreMeaning="USD"
      header={<strong className={`inspector-majority inspector-direction-${assessment.direction}`}
        aria-label="NFP pair direction" title={assessment.explanation}>{assessment.label}</strong>}
      caption="Signed USD contributions from Payrolls, Unemployment and Earnings m/m only. Green positive = bullish USD / EURUSD Short pressure; red negative = bearish USD / EURUSD Long pressure. Each primary series has weight 1. Supporting readings are excluded."
      footer={<><tr><td colSpan={6} aria-label="NFP USD score">Total {formatSignedMagnitudeScore(assessment.total)}</td></tr>
        {assessment.tieBreak && <tr><td colSpan={6}>Tie-break: {assessment.tieBreak.label} {formatSignedMagnitudeScore(assessment.tieBreak.score)}</td></tr>}
        {history.partial && <tr><td colSpan={6}>Partial history</td></tr>}
      </>} />
  </>
}
