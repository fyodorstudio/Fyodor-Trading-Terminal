import type { InspectorRelease } from '../inspector-data'
import { assessNfpMajority, gradeLabels, tallyNfpRelease } from '../grading/nfp-grading'
import { nfpMagnitudeSizes, tallyNfpMagnitudes } from './nfp-magnitude-tally'
import type { NfpMagnitudeHistory } from './useNfpMagnitudeHistory'

export function NfpMagnitudeTally({ release, history }: {
  release: InspectorRelease | null; history: NfpMagnitudeHistory
}) {
  const counts = tallyNfpMagnitudes(release, history.rows)
  const tally = tallyNfpRelease(release)
  const majority = assessNfpMajority(release)
  if (!counts || !tally || !majority) return null
  const notes = [
    ...(['good', 'bad'] as const).filter((grade) => counts[grade].Unclassified > 0)
      .map((grade) => `${counts[grade].Unclassified} ${gradeLabels[grade]} unclassified`),
    ...(history.partial ? ['Partial history'] : []),
  ]
  return <div className="inspector-magnitude-summary" role="status">
    <table className="inspector-magnitude-tally" aria-label="NFP magnitude tally">
      <caption className="inspector-sr-only" aria-label="NFP reading tally">
        {(['good', 'bad', 'unchanged', 'missing', 'unrated'] as const).filter((grade) =>
          ['good', 'bad', 'unchanged'].includes(grade) || tally.counts[grade] > 0)
          .map((grade) => `${tally.counts[grade]} ${gradeLabels[grade]}`).join(' · ')} · {tally.total} readings
      </caption>
      <thead><tr>
        <th scope="col" aria-label="Direction"><strong className={`inspector-majority inspector-direction-${majority.direction}`}
          aria-label="NFP majority direction" title={majority.explanation}>{majority.label}</strong></th>
        {nfpMagnitudeSizes.map((size) => <th scope="col" key={size}>{size}</th>)}
      </tr></thead>
      <tbody>{history.message ? <tr><td colSpan={5} title={history.error ?? history.message}>{history.message}</td></tr> :
        (['good', 'bad'] as const).map((grade) => <tr key={grade} data-grade={grade} className={`inspector-grade-${grade}`}>
          <th scope="row"><span className={`inspector-grade inspector-grade-${grade}`}>{gradeLabels[grade]}</span></th>
          {nfpMagnitudeSizes.map((size) => <td key={size} data-size={size}
            className={counts[grade][size] ? undefined : 'inspector-magnitude-empty'}
            aria-label={`${counts[grade][size]} ${gradeLabels[grade]} ${size}`}>
            {counts[grade][size] || '–'}
          </td>)}
        </tr>)}
      </tbody>
      {!history.message && notes.length > 0 && <tfoot><tr><td colSpan={5}>{notes.join(' · ')}</td></tr></tfoot>}
    </table>
  </div>
}
