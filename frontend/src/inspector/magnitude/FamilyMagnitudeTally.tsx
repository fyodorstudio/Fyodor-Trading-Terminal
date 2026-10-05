import type { InspectorRelease } from '../inspector-data'
import type { ReactNode } from 'react'
import { gradeFamilyReading, gradeLabels, tallyFamilyReadings } from '../grading/reading-grading'
import { magnitudeSizes, tallyFamilyMagnitudes } from './family-magnitude-tally'
import type { FamilyMagnitudeHistory } from './useFamilyMagnitudeHistory'
import type { MagnitudeFamily } from './magnitude-families'

export function FamilyMagnitudeTally({ release, history, family, heading }: {
  release: InspectorRelease | null; history: FamilyMagnitudeHistory; family: MagnitudeFamily; heading?: ReactNode
}) {
  const counts = tallyFamilyMagnitudes(release, history.rows, family)
  const tally = tallyFamilyReadings(release, family, family.gradingVersion)
  if (!counts || !tally) return null
  const needsHistory = Object.values(history.rows).some((row) => row.mode !== 'undefined')
  const message = needsHistory ? history.message : null
  const notes = [
    ...(['higher', 'lower'] as const).flatMap((grade) => {
      const undefinedCount = release!.events.filter((event) => gradeFamilyReading(event, release!.familyId, family)?.grade === grade &&
        history.rows[event.value_id]?.mode === 'undefined').length
      const unclassified = counts[grade].Unclassified - undefinedCount
      return [undefinedCount ? `${undefinedCount} ${gradeLabels[grade]} undefined` : null,
        unclassified ? `${unclassified} ${gradeLabels[grade]} unclassified` : null].filter(Boolean)
    }),
    ...(history.partial ? ['Partial history'] : []),
  ]
  return <div className="inspector-magnitude-summary" role="status">
    <table className="inspector-magnitude-tally" aria-label={`${family.label} magnitude tally`}>
      <caption className="inspector-sr-only" aria-label={`${family.label} reading tally`}>
        {(['higher', 'lower', 'unchanged', 'missing', 'unrated'] as const).filter((grade) =>
          ['higher', 'lower', 'unchanged'].includes(grade) || tally.counts[grade] > 0)
          .map((grade) => `${tally.counts[grade]} ${gradeLabels[grade]}`).join(' · ')} · {tally.total} readings
      </caption>
      <thead><tr>
        <th scope="col" aria-label={heading ? 'Direction' : 'Family'}>{heading ?? family.label}</th>
        {magnitudeSizes.map((size) => <th scope="col" key={size}>{size}</th>)}
      </tr></thead>
      <tbody>{message ? <tr><td colSpan={5} title={history.error ?? message}>{message}</td></tr> :
        (['higher', 'lower'] as const).map((grade) => <tr key={grade} data-grade={grade} className={`inspector-grade-${grade}`}>
          <th scope="row"><span className={`inspector-grade inspector-grade-${grade}`}>{gradeLabels[grade]}</span>
            {family.familyId !== 'jobs' && <> · {tally.counts[grade]}</>}</th>
          {magnitudeSizes.map((size) => <td key={size} data-size={size}
            className={counts[grade][size] ? undefined : 'inspector-magnitude-empty'}
            aria-label={`${counts[grade][size]} ${gradeLabels[grade]} ${size}`}>
            {counts[grade][size] || '–'}
          </td>)}
        </tr>)}
      </tbody>
      {!message && notes.length > 0 && <tfoot><tr><td colSpan={5}>{notes.join(' · ')}</td></tr></tfoot>}
    </table>
  </div>
}
