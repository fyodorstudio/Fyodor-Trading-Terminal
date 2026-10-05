import type { InspectorRelease } from '../inspector-data'
import { assessNfpMajority } from '../grading/nfp-grading'
import { nfpMagnitudeFamily } from './magnitude-families'
import { FamilyMagnitudeTally } from './FamilyMagnitudeTally'
import type { FamilyMagnitudeHistory } from './useFamilyMagnitudeHistory'

export function NfpMagnitudeTally({ release, history }: { release: InspectorRelease | null; history: FamilyMagnitudeHistory }) {
  const majority = assessNfpMajority(release)
  if (!majority) return null
  return <FamilyMagnitudeTally release={release} history={history} family={nfpMagnitudeFamily}
    heading={<strong className={`inspector-majority inspector-direction-${majority.direction}`}
      aria-label="NFP majority direction" title={majority.explanation}>{majority.label}</strong>} />
}
