import type { InspectorRelease } from '../../economic-calendar/releases/release'

// Labels for preserved legacy PMI publication snapshots. New chart entries use
// exact publication times rather than combining a three-hour regional round.
export const pmiSectionLabel = (release: InspectorRelease) => release.familyId === 'french-pmi' ? 'France' : release.familyId === 'german-pmi' ? 'Germany' : 'Euro area'
