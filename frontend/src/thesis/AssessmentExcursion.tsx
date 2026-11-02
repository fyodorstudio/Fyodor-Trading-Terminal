import { memo } from 'react'
import { excursionHeading, excursionLines, type AssessmentExcursion as Excursion } from './excursion-model'

export const ExcursionHeading = memo(function ExcursionHeading({ value }: { value?: Excursion }) {
  return <span className="thesis-excursion-heading" title="Largest signed daily excursion in a sampled equal-weight FX basket; not a GBPUSD return, wick maximum or realised profit."> · {excursionHeading(value)}</span>
})
export const AssessmentExcursion = memo(function AssessmentExcursion({ value }: { value?: Excursion }) {
  return <div className="thesis-excursion" aria-label="Verdict price comparison">{excursionLines(value).map((line,index)=><p key={index}>{line}</p>)}</div>
})
