import type { InspectorRelease } from '../inspector-data'
import { assessCpiIndexMagnitudeScore } from '../grading/cpi-index-magnitude-score'
import { formatSignedMagnitudeScore } from '../grading/signed-magnitude-score'
import { SignedMagnitudeMatrix } from './SignedMagnitudeMatrix'
import type { FamilyMagnitudeHistory } from './useFamilyMagnitudeHistory'

export function CpiIndexMagnitudeTable({ release, history }: { release: InspectorRelease | null; history: FamilyMagnitudeHistory }) {
  const assessment = assessCpiIndexMagnitudeScore(release, history)
  if (!assessment) return null
  return <SignedMagnitudeMatrix label="CPI price index magnitude score" className="inspector-cpi-index-score"
    header="Price indexes" readings={assessment.readings} scoreMeaning="Index movement"
    caption="Signed price-index movement points. Green positive means the price level rose; red negative means it fell; gray zero is unchanged. Each series has weight 1. Index scores remain separate from the EURUSD rate score. n.s.a. means not seasonally adjusted."
    footer={<><tr><td colSpan={6} aria-label="CPI index score" title="Separate price-level movement scores, excluded from the EURUSD rate total.">
      Adjusted {formatSignedMagnitudeScore(assessment.adjusted)} · n.s.a. {formatSignedMagnitudeScore(assessment.nsa)}
    </td></tr>{history.partial && <tr><td colSpan={6}>Partial history</td></tr>}</>} />
}
