import { memo } from 'react'
import { excursionHeading, excursionLines, type AssessmentExcursion as Excursion } from './excursion-model'

export const ExcursionHeading = memo(function ExcursionHeading({ value }: { value?: Excursion }) {
  return <span className="thesis-excursion-heading" title="Daily context for this currency against the other seven currencies, using synchronized sampled closes. Compare the delivered verdict with its closing result below; Day max alone does not establish a correct call."> · {excursionHeading(value)}</span>
})
export const AssessmentExcursion = memo(function AssessmentExcursion({ value }: { value?: Excursion }) {
  return <div className="thesis-excursion" aria-label="Verdict price comparison">{excursionLines(value).map((line,index)=><p key={index}>{line}</p>)}</div>
})
