import { memo } from 'react'
import { excursionHeading, excursionLines, type AssessmentExcursion as Excursion } from './excursion-model'

export const ExcursionHeading = memo(function ExcursionHeading({ value }: { value?: Excursion }) {
  return <span className="thesis-excursion-heading" title="Observed currency-basket context, not a traded pair’s D1 candle or a forecast. D1 so far/close shows direction from the open; Day max is the larger sampled up/down excursion and can have the opposite sign. Partial history means unsampled minutes remain. Compare the delivered verdict with its separate closing result below."> · {excursionHeading(value)}</span>
})
export const AssessmentExcursion = memo(function AssessmentExcursion({ value }: { value?: Excursion }) {
  return <div className="thesis-excursion" aria-label="Verdict price comparison">{excursionLines(value).map((line,index)=><p key={index}>{line}</p>)}</div>
})
