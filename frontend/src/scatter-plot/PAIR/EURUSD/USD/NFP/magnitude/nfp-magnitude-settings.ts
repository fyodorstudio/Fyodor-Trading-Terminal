// This scope edits Inspector's shared NFP settings; no Scatter Plot UI dependency
// is required for Inspector to apply saved boundaries while the dock is closed.
export { normalizeNfpMagnitudeSettings, readNfpMagnitudeSettings, saveNfpMagnitudeLimits,
  useNfpMagnitudeSettings, nfpMagnitudeSettingsKey, nfpMagnitudeScope, type NfpMagnitudeSettings } from '../../../../../../inspector/magnitude/nfp-magnitude-settings'
