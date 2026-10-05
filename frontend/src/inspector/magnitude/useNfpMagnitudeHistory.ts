import type { InspectorRelease } from '../inspector-data'
import { nfpMagnitudeFamily } from './magnitude-families'
import { useFamilyMagnitudeHistory } from './useFamilyMagnitudeHistory'

export function useNfpMagnitudeHistory(brokerId: string | null | undefined, selected: InspectorRelease | null, clockOffsetMs = 0) {
  return useFamilyMagnitudeHistory(brokerId, selected, nfpMagnitudeFamily, clockOffsetMs)
}
export type NfpMagnitudeHistory = ReturnType<typeof useNfpMagnitudeHistory>
