import type { InspectorRelease } from '../inspector-data'
import { assessCpiMagnitudeScore, formatCpiScore } from '../grading/cpi-magnitude-score'
import { SignedMagnitudeMatrix } from './SignedMagnitudeMatrix'
import type { FamilyMagnitudeHistory } from './useFamilyMagnitudeHistory'

export function CpiMagnitudeScoreTable({ release, history }: { release: InspectorRelease | null; history: FamilyMagnitudeHistory }) {
  const assessment = assessCpiMagnitudeScore(release, history)
  if (!assessment) return null
  return <SignedMagnitudeMatrix label="CPI signed magnitude score" className="inspector-cpi-score"
    readings={assessment.readings} scoreMeaning="USD"
    header={<strong className={`inspector-majority inspector-direction-${assessment.direction}`}
      aria-label="CPI pair direction" title={assessment.explanation}>{assessment.label}</strong>}
    caption="Signed USD contributions. Green positive = bullish USD / EURUSD Short pressure; red negative = bearish USD / EURUSD Long pressure. All four series have weight 1."
    footer={<><tr><td colSpan={6} aria-label="CPI USD score" title="Subtotals and total are signed USD contributions, not holding periods.">
      Monthly {formatCpiScore(assessment.monthly)} · Annual {formatCpiScore(assessment.annual)} · Total {formatCpiScore(assessment.total)}
    </td></tr>
      {assessment.tieBreak && <tr><td colSpan={6}>Tie-break: {assessment.tieBreak.label} {formatCpiScore(assessment.tieBreak.score)}</td></tr>}
      {history.partial && <tr><td colSpan={6}>Partial history</td></tr>}
    </>} />
}
