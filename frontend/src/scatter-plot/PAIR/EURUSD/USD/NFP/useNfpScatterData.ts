import { useFamilyScatterData } from '../../../../dock/useFamilyScatterData'
import { nfpMagnitudeFamily } from '../../../../../inspector/magnitude/magnitude-families'

export function useNfpScatterData(brokerId: string | null | undefined, now: number) {
  return useFamilyScatterData(brokerId, now, nfpMagnitudeFamily)
}
