import type { InspectorRelease } from '../../economic-calendar/releases/release'
import { ismSourceRelease } from './ism-episodes'
import { pmiSourceRelease } from './pmi-episodes'

export const episodePublications = (release: InspectorRelease) => release.pmiPublications ?? release.ismPublications
export const displaySourceRelease = (release: InspectorRelease | null, sourceId?: string | null, now = Infinity) =>
  release?.pmiPublications ? pmiSourceRelease(release, sourceId, now) : ismSourceRelease(release, sourceId, now)
