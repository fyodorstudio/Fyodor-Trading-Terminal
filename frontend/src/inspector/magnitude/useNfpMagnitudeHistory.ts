import type { InspectorRelease } from '../inspector-data'
import { nfpMagnitudeFamily } from './magnitude-families'
import { useFamilyMagnitudeHistory } from './useFamilyMagnitudeHistory'

export function useNfpMagnitudeHistory(brokerId: string | null | undefined, selected: InspectorRelease | null) {
  return useFamilyMagnitudeHistory(brokerId, selected, nfpMagnitudeFamily)
}
export type NfpMagnitudeHistory = ReturnType<typeof useNfpMagnitudeHistory>
