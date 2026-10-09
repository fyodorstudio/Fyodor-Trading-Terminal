import type { ClaimsAnalysisInput } from './claims-analysis'
import type { ClaimsHorizon } from '../policy/claims-standalone-policy'
import { assessClaimsStandalone } from '../assessment/claims-standalone-score'

export type ClaimsStandaloneInput = ClaimsAnalysisInput & { horizon: ClaimsHorizon; initialWeight: number }
export const calculateClaimsStandalone = ({ release, events, settings, horizon, initialWeight }: ClaimsStandaloneInput) =>
  assessClaimsStandalone(release, events, horizon, settings, initialWeight)
