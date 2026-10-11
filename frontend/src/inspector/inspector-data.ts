// Stable compatibility exports; implementation belongs to focused domain modules.
export { inspectorFamilies, inspectorCategories, type InspectorFamilyId } from './catalog/inspector-families'
export { inspectorStorageKey, gbpInspectorStorageKey, inspectorPreferenceKey, inspectorPair, inspectorPairCurrencies,
  inspectorPairFamilies, defaultInspectorPreferences, readInspectorPreferences, supportsInspector,
  type InspectorPreferences, type InspectorPreferenceUpdate } from './preferences/inspector-preferences'
export { createInspectorReadingSelector } from '../economic-calendar/forex/select-pair-readings'
export type { InspectorRelease } from '../economic-calendar/releases/release'
export { groupInspectorReleases, inspectorEventChartTime, isInspectorCommentary, type InspectorEvent } from './releases/group-releases'
export { filterInspectorReleases } from './filters/filter-releases'
export { buildInspectorMarkers, timeframeSeconds, type InspectorMarker } from './chart/build-markers'
export { inspectorDelta, inspectorSurprise, hasRevisedPreviousChange, inspectorRevisedDelta, inspectorValueUnit,
  formatInspectorValue } from './readings/reading-values'
