import type { InspectorRelease } from '../inspector-data'
import type { NfpMagnitudeHistory } from './useNfpMagnitudeHistory'
import { nfpMagnitudeFamily } from './magnitude-families'
import { magnitudeSizes, tallyFamilyMagnitudes } from './family-magnitude-tally'

export const nfpMagnitudeSizes = magnitudeSizes
export type NfpMagnitudeSize = typeof nfpMagnitudeSizes[number]

export function tallyNfpMagnitudes(release: InspectorRelease | null, rows: NfpMagnitudeHistory['rows']) {
  return tallyFamilyMagnitudes(release, rows, nfpMagnitudeFamily)
}
